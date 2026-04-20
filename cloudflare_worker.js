// Cloudflare Worker: KV-backed redirect + private media (R2) with token auth
// Bindings:
//   - KV namespace: BOX_KV
//   - R2 bucket:    BOX_R2   (bucket name: boxes-files)
// Secrets:
//   - BOX_AUTH_TOKEN
//
// Redirect:
//   GET /<kvKey>?t=<token>           -> 302 Location to real URL
//   GET /<kvKey>?t=<token>&check=1   -> 200 {"ok":true} (CORS)
//
// Media (private):
//   GET    /media/box-01/list?t=...              -> list files
//   POST   /media/box-01/upload?t=...            -> upload (multipart form-data, field "files")
//   GET    /media/box-01/<filename>?t=...        -> stream/download (supports Range)
//   DELETE /media/box-01?all=1&t=...             -> delete all
//   DELETE /media/box-01/file?name=F&t=...       -> delete one

const MAX_REQ_PER_MIN = 120;
const MAX_UNAUTH_PER_10MIN = 20;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Range",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

async function bumpCounter(cache, key, ttlSeconds) {
  const cacheKey = new Request("https://rate.local/" + key);
  const hit = await cache.match(cacheKey);
  let n = 0;
  if (hit) n = parseInt(await hit.text(), 10) || 0;
  n += 1;
  await cache.put(
    cacheKey,
    new Response(String(n), {
      headers: { "Cache-Control": `max-age=${ttlSeconds}` },
    })
  );
  return n;
}

function safeDecodePathPart(s){
  // URL.pathname keeps percent-encoding; decode to get real filename (spaces/Chinese/etc.)
  try { return decodeURIComponent(s); } catch { return s; }
}

function sanitizeFilename(name) {
  // Keep Unicode but prevent path traversal, normalize common weird spaces.
  let s = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  try { s = s.normalize("NFC"); } catch {}
  // normalize special spaces to normal space
  s = s.replace(/[\u00A0\u202F\u2007]/g, " ");
  // remove ASCII control chars
  s = s.replace(/[\u0000-\u001F\u007F]/g, "");
  s = s.trim().slice(0, 180);
  if (!s) s = "file";
  return s;
}

function sanitizePath(p){
  return String(p||"").split("/").map(s=>sanitizeFilename(s)).filter(Boolean).join("/")||"file";
}

function legacySanitize(s){
  // Old v2 behavior: replace non-ASCII-ish chars with underscores (kept for backwards compatibility)
  return String(s||"")
    .replace(/[\u00A0\u202F\u2007]/g, "_")
    .replace(/[^\w.\- ()\[\]{}@+=,;!~'`]/g, "_")
    .slice(0,180) || "file";
}

async function r2HeadAny(env, keys){
  for(const k of keys){
    const h = await env.BOX_R2.head(k);
    if(h) return { key: k, head: h };
  }
  return null;
}

async function r2GetAny(env, keys, opts){
  for(const k of keys){
    const o = opts ? await env.BOX_R2.get(k, opts) : await env.BOX_R2.get(k);
    if(o) return { key: k, obj: o };
  }
  return null;
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) return null;
  let start = m[1] === "" ? null : parseInt(m[1], 10);
  let end = m[2] === "" ? null : parseInt(m[2], 10);
  if (start === null && end === null) return null;

  if (start === null) {
    const n = end || 0;
    if (n <= 0) return null;
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    if (start >= size) return null;
    if (end === null || end >= size) end = size - 1;
    if (end < start) return null;
  }
  return { start, end };
}

async function handleMedia(request, env, origin, tokenOk) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/+/, "");
  const parts = path.split("/"); // ["media","box-01",...]
  const isApi = true;

  if (!tokenOk) return json({ ok: false, error: "unauthorized" }, 401, corsHeaders(origin));

  const box = parts[1] || "";
  if (!/^box-\d{2}$/i.test(box)) {
    return json({ ok: false, error: "invalid_box" }, 400, corsHeaders(origin));
  }
  const prefix = `${box}/`;

  // LIST
  if (parts.length === 3 && parts[2] === "list" && request.method === "GET") {
    const out = [];
    let cursor = undefined;
    for (let i = 0; i < 20; i++) {
      const res = await env.BOX_R2.list({ prefix, cursor, limit: 1000 });
      for (const obj of res.objects) {
        const name = obj.key.slice(prefix.length);
        if (name === "_meta" || name === "note" || name === "_cover" || name.startsWith("_trash/")) continue;
        out.push({
          name,
          size: obj.size,
          etag: obj.etag,
          lastModified: obj.uploaded ? obj.uploaded.toISOString() : null,
        });
      }
      if (!res.truncated) break;
      cursor = res.cursor;
    }
    return json(out, 200, corsHeaders(origin));
  }

  // UPLOAD
  if (parts.length === 3 && parts[2] === "upload" && request.method === "POST") {
    const ct = request.headers.get("Content-Type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return json({ ok: false, error: "content_type_must_be_multipart" }, 400, corsHeaders(origin));
    }
    const form = await request.formData();
    const files = form.getAll("files");
    if (!files || files.length === 0) {
      return json({ ok: false, error: "no_files" }, 400, corsHeaders(origin));
    }
    const folderParam = sanitizeFilename(url.searchParams.get("folder") || "");
    let saved = 0;
    for (const item of files) {
      if (!(item instanceof File)) continue;
      const clean = sanitizeFilename(item.name || "file");
      const key = folderParam ? `${prefix}${folderParam}/${clean}` : `${prefix}${clean}`;
      await env.BOX_R2.put(key, item.stream(), {
        httpMetadata: { contentType: item.type || "application/octet-stream" },
      });
      saved++;
    }
    return json({ ok: true, saved }, 200, corsHeaders(origin));
  }

  // DELETE ALL
  if (parts.length === 2 && request.method === "DELETE" && url.searchParams.get("all") === "1") {
    let cursor = undefined;
    let deleted = 0;
    for (let i = 0; i < 50; i++) {
      const res = await env.BOX_R2.list({ prefix, cursor, limit: 1000 });
      if (res.objects.length) {
        const keys = res.objects.map((o) => o.key);
        await env.BOX_R2.delete(keys);
        deleted += keys.length;
      }
      if (!res.truncated) break;
      cursor = res.cursor;
    }
    return json({ ok: true, deleted }, 200, corsHeaders(origin));
  }

  // DELETE ONE
  if (parts.length === 3 && parts[2] === "file" && request.method === "DELETE") {
    const rawName = safeDecodePathPart(url.searchParams.get("name") || "");
    const cleanPath = sanitizePath(rawName);
    if (!cleanPath || cleanPath === "file") return json({ ok: false, error: "missing_name" }, 400, corsHeaders(origin));
    const key = prefix + cleanPath;
    if (cleanPath.includes("/")) {
      // File in a folder — exact key only
      await env.BOX_R2.delete(key);
    } else {
      // Root file — include legacy alternate keys for backwards compatibility
      const clean = sanitizeFilename(rawName);
      const alt1 = prefix + legacySanitize(clean);
      const alt2 = prefix + clean.replace(/[\u00A0\u202F\u2007]/g, "_");
      const alt3 = prefix + clean.replace(/[\u00A0\u202F\u2007]/g, " ");
      await env.BOX_R2.delete(Array.from(new Set([key, alt1, alt2, alt3])));
    }
    return json({ ok: true }, 200, corsHeaders(origin));
  }

  // MOVE FILE (path-aware copy+delete, supports folder paths)
  if (parts.length === 3 && parts[2] === "move" && request.method === "POST") {
    const fromPath = sanitizePath(safeDecodePathPart(url.searchParams.get("from") || ""));
    const toPath = sanitizePath(safeDecodePathPart(url.searchParams.get("to") || ""));
    if (!fromPath || !toPath || fromPath === "file" || toPath === "file") {
      return json({ ok: false, error: "missing_params" }, 400, corsHeaders(origin));
    }
    const src = await env.BOX_R2.get(prefix + fromPath);
    if (!src) return json({ ok: false, error: "not_found" }, 404, corsHeaders(origin));
    const ct = src.httpMetadata?.contentType || "application/octet-stream";
    await env.BOX_R2.put(prefix + toPath, src.body, { httpMetadata: { contentType: ct } });
    await env.BOX_R2.delete(prefix + fromPath);
    return json({ ok: true }, 200, corsHeaders(origin));
  }

  // DELETE FOLDER (deletes all files with folder prefix)
  if (parts.length === 3 && parts[2] === "folder" && request.method === "DELETE") {
    const folderName = sanitizeFilename(safeDecodePathPart(url.searchParams.get("name") || ""));
    if (!folderName) return json({ ok: false, error: "missing_name" }, 400, corsHeaders(origin));
    const folderPrefix = prefix + folderName + "/";
    let cursor = undefined, deleted = 0;
    for (let i = 0; i < 20; i++) {
      const res = await env.BOX_R2.list({ prefix: folderPrefix, cursor, limit: 1000 });
      if (res.objects.length) { await env.BOX_R2.delete(res.objects.map(o => o.key)); deleted += res.objects.length; }
      if (!res.truncated) break;
      cursor = res.cursor;
    }
    return json({ ok: true, deleted }, 200, corsHeaders(origin));
  }

  // RENAME FILE
  if (parts.length === 3 && parts[2] === "rename" && request.method === "POST") {
    const fromName = sanitizePath(safeDecodePathPart(url.searchParams.get("from") || ""));
    const toName = sanitizePath(safeDecodePathPart(url.searchParams.get("to") || ""));
    if (!fromName || !toName) return json({ ok: false, error: "missing_params" }, 400, corsHeaders(origin));
    const fromKey = prefix + fromName;
    const toKey = prefix + toName;
    const src = await env.BOX_R2.get(fromKey);
    if (!src) return json({ ok: false, error: "not_found" }, 404, corsHeaders(origin));
    const ct = src.httpMetadata?.contentType || "application/octet-stream";
    await env.BOX_R2.put(toKey, src.body, { httpMetadata: { contentType: ct } });
    await env.BOX_R2.delete(fromKey);
    return json({ ok: true }, 200, corsHeaders(origin));
  }

  // SAVE FILE (note, _meta, or any raw file path)
  if (request.method === "POST" && parts.length >= 3 && parts[2] !== "upload") {
    const rawFilename = parts.slice(2).map(safeDecodePathPart).join("/");
    const clean = sanitizeFilename(rawFilename);
    if (!clean) return json({ ok: false, error: "missing_filename" }, 400, corsHeaders(origin));
    const key = prefix + clean;
    const ct = request.headers.get("Content-Type") || "application/octet-stream";
    await env.BOX_R2.put(key, request.body, { httpMetadata: { contentType: ct } });
    return json({ ok: true }, 200, corsHeaders(origin));
  }

  // GET FILE
  if (request.method === "GET" && parts.length >= 3) {
    const rawFilename = parts.slice(2).map(safeDecodePathPart).join("/");
    let raw = rawFilename || "";
    try { raw = raw.normalize("NFC"); } catch {}
    // Do NOT sanitize away special spaces yet; we use raw as one candidate exactly as stored.
    const clean = sanitizeFilename(raw);

    const key = prefix + clean;

    // Backwards-compatible lookup for older sanitized keys / special spaces / exact raw key
    const rawKey = prefix + raw;
    const rawSpaceKey = prefix + raw.replace(/[\u00A0\u202F\u2007]/g, " ");
    const rawUnderscoreKey = prefix + raw.replace(/[\u00A0\u202F\u2007]/g, "_");
    const alt1 = prefix + legacySanitize(raw);
    const alt2 = prefix + legacySanitize(clean);
    const alt3 = prefix + clean.replace(/[\u00A0\u202F\u2007]/g, "_");

    const candidates = Array.from(new Set([rawKey, rawSpaceKey, rawUnderscoreKey, key, alt1, alt2, alt3]));

    const found = await r2HeadAny(env, candidates);
    if (!found) return json({ ok: false, error: "not_found" }, 404, corsHeaders(origin));

    const size = found.head.size;
    const range = parseRange(request.headers.get("Range"), size);

    const got = await r2GetAny(
      env,
      candidates,
      range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined
    );
    if (!got) return json({ ok: false, error: "not_found" }, 404, corsHeaders(origin));

    const contentType =
      got.obj.httpMetadata?.contentType ||
      found.head.httpMetadata?.contentType ||
      "application/octet-stream";

    
    const headers = {
      ...corsHeaders(origin),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    };

    const lower = clean.toLowerCase();
    const inline =
      contentType.startsWith("image/") ||
      contentType.startsWith("video/") ||
      contentType.startsWith("audio/") ||
      contentType === "application/pdf" ||
      lower.endsWith(".pdf");
    headers["Content-Disposition"] = `${inline ? "inline" : "attachment"}; filename="${clean.replace(/"/g, "")}"; filename*=UTF-8\'\'${encodeURIComponent(clean)}`;

    if (range) {
      headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
      headers["Content-Length"] = String(range.end - range.start + 1);
      return new Response(got.obj.body, { status: 206, headers });
    }
    headers["Content-Length"] = String(size);
    return new Response(got.obj.body, { status: 200, headers });
  }

  return json({ ok: false, error: "unsupported_media_route" }, 404, corsHeaders(origin));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";
    const path = url.pathname;

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Rate limiting
    const ip = getClientIp(request);
    const cache = caches.default;
    const minuteBucket = Math.floor(Date.now() / 60000);
    const total = await bumpCounter(cache, `total:${ip}:${minuteBucket}`, 70);
    if (total > MAX_REQ_PER_MIN) return json({ ok: false, error: "rate_limited" }, 429, corsHeaders(origin));

    const token = url.searchParams.get("t") || "";
    const tokenOk = !!env.BOX_AUTH_TOKEN && token === env.BOX_AUTH_TOKEN;

    if (!tokenOk) {
      const tenBucket = Math.floor(Date.now() / 600000);
      const unauth = await bumpCounter(cache, `unauth:${ip}:${tenBucket}`, 650);
      if (unauth > MAX_UNAUTH_PER_10MIN) return json({ ok: false, error: "too_many_unauthorized" }, 429, corsHeaders(origin));
    }

    // Search index
    if (path === "/search-index") {
      if (!tokenOk) return json({ ok: false, error: "unauthorized" }, 401, corsHeaders(origin));
      if (request.method === "GET") {
        const val = await env.BOX_KV.get("sys:search-index");
        if (!val) return json([], 200, corsHeaders(origin));
        return new Response(val, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin) } });
      }
      if (request.method === "POST") {
        const body = await request.text();
        await env.BOX_KV.put("sys:search-index", body);
        return json({ ok: true }, 200, corsHeaders(origin));
      }
      return json({ ok: false, error: "method_not_allowed" }, 405, corsHeaders(origin));
    }

    // Media
    if (path.startsWith("/media/")) {
      return await handleMedia(request, env, origin, tokenOk);
    }

    // Redirect
    const kvKey = path.replace(/^\/+/, "");
    if (!kvKey) return new Response("Missing key", { status: 400 });

    const isCheck = url.searchParams.get("check") === "1";
    if (!tokenOk) {
      if (isCheck) return json({ ok: false, error: "unauthorized" }, 401, corsHeaders(origin));
      return new Response("Unauthorized", { status: 401 });
    }

    if (isCheck) return json({ ok: true }, 200, corsHeaders(origin));

    const target = await env.BOX_KV.get(kvKey);
    if (!target) return new Response("Not found", { status: 404 });

    return Response.redirect(target, 302);
  },
};
