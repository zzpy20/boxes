// cloudflare_worker.js
// Stable version compatible with v7.1 frontend
// - Private media via R2
// - Unicode / Chinese filenames supported
// - Special-space tolerant (NBSP / U+202F)
// - Auth token required (BOX_AUTH_TOKEN)
// - KV redirect for boxes (BOX_KV)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    const cors = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Range",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const token = url.searchParams.get("t") || "";
    if (token !== env.BOX_AUTH_TOKEN) {
      return json({ ok: false, error: "unauthorized" }, 401, cors);
    }

    const parts = url.pathname.split("/").filter(Boolean);

    // /media/box-01/list
    if (parts[0] === "media" && parts[2] === "list") {
      const box = parts[1];
      const prefix = `${box}/`;
      const listed = await env.BOX_R2.list({ prefix });
      const files = listed.objects.map(o => ({
        name: o.key.slice(prefix.length),
        size: o.size,
        lastModified: o.uploaded
      }));
      return json({ ok: true, files }, 200, cors);
    }

    // /media/box-01/upload
    if (parts[0] === "media" && parts[2] === "upload" && request.method === "POST") {
      const box = parts[1];
      const prefix = `${box}/`;
      const form = await request.formData();
      const file = form.get("file");
      if (!file) return json({ ok: false }, 400, cors);

      let name = decodeURIComponent(file.name);
      try { name = name.normalize("NFC"); } catch {}
      name = name.replace(/[\u00A0\u202F\u2007]/g, " ").trim();

      await env.BOX_R2.put(prefix + name, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" }
      });
      return json({ ok: true }, 200, cors);
    }

    // /media/box-01/<filename>
    if (parts[0] === "media" && parts.length >= 3) {
      const box = parts[1];
      const rawName = parts.slice(2).map(p => decodeURIComponent(p)).join("/");
      const prefix = `${box}/`;

      const candidates = [
        prefix + rawName,
        prefix + rawName.replace(/[\u00A0\u202F\u2007]/g, " "),
        prefix + rawName.replace(/[\u00A0\u202F\u2007]/g, "_"),
      ];

      let obj = null;
      let head = null;
      for (const key of candidates) {
        head = await env.BOX_R2.head(key);
        if (head) {
          obj = await env.BOX_R2.get(key);
          if (obj) break;
        }
      }

      if (!obj) return json({ ok: false, error: "not_found" }, 404, cors);

      const headers = {
        ...cors,
        "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      };
      return new Response(obj.body, { status: 200, headers });
    }

    // /go/box-01 redirect
    if (parts[0] === "go" && parts[1]) {
      const key = parts[1];
      const target = await env.BOX_KV.get(key) || await env.BOX_KV.get(key.replace("-", ""));
      if (!target) return json({ ok: false, error: "box_not_configured" }, 404, cors);
      return Response.redirect(target, 302);
    }

    return json({ ok: false, error: "not_found" }, 404, cors);
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
