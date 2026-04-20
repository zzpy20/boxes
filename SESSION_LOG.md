# Boxes App — Session Log

## Live Deployments
- **Cloudflare (primary)**: https://boxes.1000600.xyz
- **Docker/VPS**: http://194.195.253.94 (Linode, nginx → Docker port 3000)
- **GitHub repo**: https://github.com/zzpy20/boxes

---

## Features Built This Session

### 1. Per-box File Trash Bin
- Soft-delete files/folders to `_trash/` prefix in R2
- Metadata stored in `boxTrash` array in search index
- Trash modal: restore individual items, restore all, permanent delete, empty trash
- Restoring a file from a deleted folder automatically recreates the folder in `boxFolders`
- Worker LIST endpoint skips `_trash/*` keys so trashed files stay hidden

### 2. Upload Fix (root upload creating "file" folder)
- Bug: empty folder param was passing through `sanitizeFilename()` which falls back to `"file"`
- Fix: check if folder param is non-empty before calling `sanitizePath()`

### 3. Restore All Button
- Added to trash modal alongside "Empty trash"
- Restores all trashed files, re-adds their parent folders to `boxFolders`, restores metadata

### 4. Context-aware "Clear All"
- At root: clears entire box (unchanged)
- Inside a folder: soft-deletes only files in that folder, keeps the folder itself
- Confirm prompt explains "Only the files will be removed — the folder itself will be kept."

### 5. Trash "from folder" display + folder restore on single item restore
- Trash items show "from [foldername]" in the modal
- Single item restore re-adds parent folder to `boxFolders` if it was deleted

### 6. Seven UX Improvements
- **File preview modal**: clicking image/PDF opens preview; "Open in new tab" button also available
- **Copy link**: ⋯ menu item copies direct file URL to clipboard (with fallback prompt)
- **Dynamic empty states**: context-aware text ("This folder is empty." vs "No files yet.")
- **Sort preference per box**: saved as `boxSortField_{BOX_ID}` in localStorage (not shared across boxes)
- **Duplicate file warning**: alerts before overwriting an existing file on upload
- **Storage size indicator**: total size of all files shown next to "Files" header
- **Mobile action bar**: wraps on narrow screens so buttons aren't clipped

### 7. QR Code Label Generator
- "Label" button in header generates printable label: QR code + box name + UID
- QR encodes the box URL — scan with iPhone native camera opens the box directly
- Print button uses `window.print()` with CSS that isolates just the label
- Shows hint if no UID is set yet
- Uses `qrcode.js` library (CDN, ~10KB, no server needed)

### 8. Docker Version
- `server.js`: Node.js/Express server replicating all Cloudflare Worker endpoints
- `Dockerfile` + `docker-compose.yml`: single container, data on named volume
- `api-config.js`: intercepted by Docker server to set `window.__BOXES_API_BASE__ = window.location.origin + "/"`
- `box.js` + `index.html`: `WORKER_BASE` reads `window.__BOXES_API_BASE__` if set, falls back to Cloudflare URL
- Both deployments use the same codebase — Cloudflare version unaffected

### 9. VPS Deployment on Linode
- Ubuntu 24.04, Nanode 1GB ($5/month)
- Docker installed via `curl -fsSL https://get.docker.com | sh`
- Nginx reverse proxy: port 80 → localhost:3000
- ufw firewall: ports 22, 80, 443 open only (port 3000 blocked externally)
- Deploy steps: `git clone` → edit `AUTH_TOKEN` in `docker-compose.yml` → `docker compose up -d`

---

## Key Files

| File | Purpose |
|---|---|
| `cloudflare_worker.js` | Cloudflare Worker — all API routes, auth, R2/KV ops |
| `box.js` | Main frontend JS (currently v=16) |
| `box/index.html` | Box detail page |
| `index.html` | Home page |
| `boxes.json` | Box config (id, key, tags) |
| `api-config.js` | No-op static file; Docker server intercepts to inject API base URL |
| `server.js` | Node.js/Express Docker server |
| `Dockerfile` | Docker image definition |
| `docker-compose.yml` | Container config (port, volume, env vars) |

---

## Architecture

### Cloudflare Version
```
Browser → GitHub Pages (index.html, box.js)
        → Cloudflare Worker (auth, API)
              → R2 (file storage)
              → KV (search index, metadata)
```

### Docker Version
```
Browser → Nginx (port 80)
        → Node.js/Express server (port 3000)
              → /data/files/ (Docker named volume)
              → /data/search-index.json
              → /data/boxes.json
```

---

## Important Code Patterns

### Virtual Folders
- R2 key prefixes: `box-01/photos/beach.jpg`
- No real folder objects — folders inferred from file paths
- Empty folders persisted in `boxFolders` array in search index
- Single-level depth enforced client-side

### Soft Delete
- File moved to `_trash/originalpath` in R2
- Metadata saved in `boxTrash` array in search index
- Worker LIST skips `_trash/*` so trashed files are hidden
- Restore = MOVE back to original path
- Empty trash = DELETE FOLDER on `_trash`

### Auth
- Token stored in `localStorage`
- Check: `GET /{key}?check=1&t={token}` → 200 if valid
- All API calls include `?t={token}` param

### Search Index
```json
{
  "boxId": "01",
  "boxNote": "...",
  "boxDesc": "...",
  "boxTags": [],
  "files": [{"name": "...", "caption": "...", "tags": []}],
  "coverFile": "...",
  "boxUid": "STOR-001",
  "boxLinks": [{"label": "...", "url": "..."}],
  "boxFolders": ["photos"],
  "boxTrash": [{"name": "...", "trashedPath": "_trash/...", "originalPath": "...", "deletedAt": "...", "meta": {}}]
}
```

---

## Docker Commands Learned

```bash
docker compose up --build -d        # Build image and start in background
docker compose down                 # Stop and remove containers (data safe)
docker compose down -v              # Stop and remove containers AND volumes (data gone)
docker compose restart              # Restart containers (does NOT update env vars)
docker compose up -d                # Recreate containers with updated compose file
docker compose build --no-cache     # Force clean rebuild ignoring cached layers
docker compose logs -f              # Stream live logs
docker compose exec boxes env       # Inspect environment variables inside container
docker exec -it boxes-boxes-1 sh    # Get a shell inside the running container
docker volume ls                    # List all volumes
docker volume inspect boxes_boxes-data  # Inspect volume details
```

### Backup & Restore Volume
```bash
# Backup (run on server)
docker run --rm -v boxes_boxes-data:/data -v /tmp:/backup alpine tar czf /backup/boxes-backup.tar.gz /data

# Download to local Mac
scp root@194.195.253.94:/tmp/boxes-backup.tar.gz ~/Desktop/boxes-backup.tar.gz

# Restore on any Docker environment
docker volume create boxes_boxes-data
docker run --rm -v boxes_boxes-data:/data -v ~/Desktop:/backup alpine tar xzf /backup/boxes-backup.tar.gz -C /
docker compose up -d
```

---

## Nginx Config (`/etc/nginx/sites-available/boxes`)
```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Adding Domain + HTTPS Later
1. Point domain DNS A record to server IP
2. SSH in and run:
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d yourdomain.com
```
That's it — certbot auto-configures nginx and renews the cert automatically.

---

## Migration: Cloudflare → Docker (if ever needed)
1. Download all files from Cloudflare R2 dashboard (or via API)
2. Export search index JSON from KV (`sys:search-index` key)
3. Drop files into Docker volume at `/data/files/`
4. Save search index as `/data/search-index.json`
5. `docker compose up -d`

---

## Pending / Future Ideas
- Domain + HTTPS on Linode (have a spare domain ready)
- Shareable links (KV-based share tokens — deferred, personal use only for now)
- Nested folders (currently single-level only)
- Bulk download as zip
- Auto backup script for Docker volume
