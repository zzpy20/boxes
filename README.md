# boxes: Auth modal + remember login + Worker rate limit (Public GitHub Pages, Private URLs)

## What you get
- Nice auth modal on box pages (no browser prompt)
- Remember login on device (localStorage)
- Logout button on index page
- Worker validates token (secret) before redirect
- Worker rate limits requests (basic anti-bruteforce)

## Cloudflare Worker setup
1) Bind KV namespace as: BOX_KV
2) Add Worker Secret:
   - Name: BOX_AUTH_TOKEN
   - Value: your passphrase/token (long random recommended)
3) Paste `cloudflare_worker.js` into your Worker and deploy

## GitHub repo setup
1) Upload everything in this bundle to your repo root and commit (overwrite)
2) Edit `redirect.js` and set:
   const WORKER_BASE = "https://<your-worker-domain>/";
   MUST end with '/'

## How it works
- When opening /box-XX/:
  - redirect.js checks token in localStorage
  - calls Worker ?check=1 with CORS JSON
  - if ok -> redirects via Worker to real URL
  - if not -> shows modal, saves token after success

## Reset / logout
- Open https://zzpy20.github.io/boxes/ and click "退出/清除本机授权"
