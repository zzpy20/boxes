// Cloudflare Worker: KV-backed redirect + token auth + rate limiting
//
// Bindings:
//   - KV namespace: BOX_KV
// Secrets:
//   - BOX_AUTH_TOKEN  (your passphrase/token)
//
// Endpoints:
//   GET /<key>?t=<token>            -> 302 redirect to real URL (if authorized)
//   GET /<key>?t=<token>&check=1    -> 200 JSON {ok:true} (if authorized) [CORS enabled]
//
// Rate limiting (simple, in cache):
//   - Total requests per IP: 60 / minute
//   - Unauthorized attempts per IP: 12 / 10 minutes
//
// Notes:
//   - This is a pragmatic limiter. For stronger protection, add a Cloudflare Rate Limiting rule in Dashboard.

const MAX_REQ_PER_MIN = 60;
const MAX_UNAUTH_PER_10MIN = 12;

function json(body, status=200, headers={}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function corsHeaders(origin) {
  // Restrict to your GitHub Pages origin if you want:
  // const allow = "https://zzpy20.github.io";
  // return { "Access-Control-Allow-Origin": allow, "Vary": "Origin" };
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}

async function bumpCounter(cache, key, ttlSeconds) {
  const cacheKey = new Request("https://rate.local/" + key);
  const hit = await cache.match(cacheKey);
  let n = 0;
  if (hit) {
    const t = await hit.text();
    n = parseInt(t, 10) || 0;
  }
  n += 1;
  await cache.put(cacheKey, new Response(String(n), {
    headers: { "Cache-Control": `max-age=${ttlSeconds}` }
  }));
  return n;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // CORS preflight for check requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const ip = getClientIp(request);
    const cache = caches.default;

    // Total rate limit
    const minuteBucket = Math.floor(Date.now() / 60000);
    const totalKey = `total:${ip}:${minuteBucket}`;
    const total = await bumpCounter(cache, totalKey, 70);
    if (total > MAX_REQ_PER_MIN) {
      return json({ ok: false, error: "rate_limited" }, 429, corsHeaders(origin));
    }

    const key = url.pathname.replace(/^\/+/, "");
    if (!key) return new Response("Missing key", { status: 400 });

    const token = url.searchParams.get("t") || "";
    const isCheck = url.searchParams.get("check") === "1";

    const okAuth = !!env.BOX_AUTH_TOKEN && token === env.BOX_AUTH_TOKEN;

    if (!okAuth) {
      // Unauthorized limiter (10 min bucket)
      const tenBucket = Math.floor(Date.now() / 600000);
      const unauthKey = `unauth:${ip}:${tenBucket}`;
      const unauth = await bumpCounter(cache, unauthKey, 650);
      if (unauth > MAX_UNAUTH_PER_10MIN) {
        return json({ ok: false, error: "too_many_unauthorized" }, 429, corsHeaders(origin));
      }
      if (isCheck) return json({ ok: false }, 401, corsHeaders(origin));
      return new Response("Unauthorized", { status: 401 });
    }

    if (isCheck) {
      return json({ ok: true }, 200, corsHeaders(origin));
    }

    const target = await env.BOX_KV.get(key);
    if (!target) return new Response("Not found", { status: 404 });

    return Response.redirect(target, 302);
  }
};
