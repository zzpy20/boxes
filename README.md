# boxes (Public GitHub Pages) + Cloudflare KV (Private URLs)

## What changes vs your old version
- GitHub (public) stores ONLY keys, notes, tags, preview
- Real URLs never appear in GitHub
- Cloudflare KV (private) stores: key -> URL
- QR scans go: /box-XX/ -> redirect.js -> Worker/<key> -> 302 -> real URL

## Step A: Cloudflare (once)
1) Create a Worker (e.g. box-redirect)
2) Create a KV namespace (e.g. BOX_KV)
3) Bind KV to Worker with variable name: BOX_KV
4) Paste `cloudflare_worker.js` into the Worker, deploy
5) Add KV entries:
   - kitchen_docs -> https://docs.google.com/...
   - winter_clothes -> https://notion.so/...
   (Only you can read/modify KV)

## Step B: GitHub (repo)
1) Upload EVERYTHING in this zip to your `boxes` repo root and commit (overwrite existing files).
2) Edit `redirect.js`:
   const WORKER_BASE = "https://<your-worker-domain>/";
   Must end with '/'

## Step C: Edit keys / notes
Open:
- https://zzpy20.github.io/boxes/admin.html
Workflow:
- Load current boxes.json
- Edit key/note/tags
- Download boxes.json
- Upload & overwrite boxes.json in repo root and commit

## Optional hardening
- Remove the admin link from index.html if you don't want it discoverable.
