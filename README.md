# boxes (GitHub Pages UI) + Cloudflare Worker (auth) + R2 private files

## Your settings
- Worker domain: https://box-redirect.ausz.workers.dev/
- R2 bucket name: boxes-files
- R2 binding name: BOX_R2
- KV binding name: BOX_KV
- Secret: BOX_AUTH_TOKEN

## Install (GitHub)
1) Unzip this bundle
2) Copy EVERYTHING into your repo root (overwrite), commit.

## Install (Cloudflare Worker)
1) Open Worker: box-redirect
2) Replace code with cloudflare_worker.js, Save & Deploy
3) Bindings:
   - KV Namespace: variable name BOX_KV -> your existing namespace
   - R2 Bucket: variable name BOX_R2 -> bucket boxes-files
4) Secret:
   - BOX_AUTH_TOKEN = your passphrase

## Use
- Open any box page: /box-01/
- Upload any files; they will be stored privately in R2 under box-01/
- Preview common types; open/download any file
- Clear All deletes everything under that box in R2
