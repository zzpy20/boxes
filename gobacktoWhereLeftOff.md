# Where We Left Off

**Last updated:** 2026-04-26  
**Session name:** lightbox

## What was done this session

1. **Updated `CLAUDE.md`** — added full project architecture section to the boxes repo.

2. **Pushed missing commits to GitHub** — the print-all-labels button and other features were committed locally but not pushed. Now live at `boxes.1000600.xyz`.

3. **Created `home-dashboard` GitHub repo** (private) — `https://github.com/zzpy20/home-dashboard`
   - Contains `index.html`, `sysinfo.sh`, `.gitignore`, `README.md`
   - `monitor.sh` is gitignored (contains Telegram token)

4. **Set up Jellyfin on Mac mini**
   - Installed via `brew install jellyfin` (GUI app at `/Applications/Jellyfin.app`)
   - Running as a Mac app (menu bar), not a launchd service
   - Accessible at `jellyfin.1000600.xyz` via Tailscale + Caddy
   - DNS A record added in Cloudflare: `jellyfin` → `100.115.24.94`
   - Caddy config updated: `/opt/homebrew/etc/Caddyfile`
   - Caddy is a custom build (has Cloudflare DNS module); reload via `curl -s localhost:2019/load -H "Content-Type: text/caddyfile" --data-binary @/opt/homebrew/etc/Caddyfile`
   - Do NOT use `brew services restart caddy` — it uses the wrong binary and crashes

5. **Restored home dashboard** (`home.1000600.xyz`) — had accidentally overwritten with an older git version. Reconstructed with all 5 service tiles (Mac, Plex, My Links, Boxes, Jellyfin) + live system stats + network section.

6. **Updated `monitor.sh`** on Mac mini — removed Plex and Jellyfin from Telegram alerts. Now monitors: Home, Mac Files, Boxes, My Links.

## Current project state

All services running and healthy:
- `home.1000600.xyz` — dashboard with system stats
- `mac.1000600.xyz` — file browser
- `plex.1000600.xyz` — Plex (start manually)
- `jellyfin.1000600.xyz` — Jellyfin (start manually via app)
- `boxes.1000600.xyz` — boxes app
- `links.1000600.xyz` — my links

## Important: Caddy on Mac mini

Caddy is a **custom build** with the Cloudflare DNS module. It is NOT managed by brew services — there's a separate process already running. To reload config after changes:

```bash
curl -s localhost:2019/load -H "Content-Type: text/caddyfile" --data-binary @/opt/homebrew/etc/Caddyfile
```

## Nothing pending

No next steps queued.

## How to resume

Start a new Claude Code session in this repo and say:

> "Read gobacktoWhereLeftOff.md and let's continue working on the boxes app."
