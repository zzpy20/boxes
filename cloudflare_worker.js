// Cloudflare Worker: KV-backed redirect (private URL store)
// Request:  https://<worker-domain>/<key>
// KV:       key -> target URL (https://...)
// Bind KV namespace as: BOX_KV
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.replace(/^\/+/, "");
    if (!key) return new Response("Missing key", { status: 400 });

    const target = await env.BOX_KV.get(key);
    if (!target) return new Response("Key not found", { status: 404 });

    return Response.redirect(target, 302);
  }
};
