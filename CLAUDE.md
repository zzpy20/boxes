# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Behavioral guidelines to reduce common LLM coding mistakes.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project: Boxes

A personal file-storage app. Each "box" is a numbered container holding files, a rich-text note, and metadata (tags, cover image, UID, links).

### Two deployment modes

The same static frontend (`index.html`, `box/index.html`) works in both modes. The only difference is which backend answers API calls.

| Mode | Backend | Storage |
|---|---|---|
| **Cloudflare** (primary) | `cloudflare_worker.js` deployed as a Worker | R2 bucket (`BOX_R2`) for files; KV (`BOX_KV`) for search index |
| **Docker / self-hosted** | `server.js` (Node/Express) | `data/files/` volume for files; `data/search-index.json` for search index |

**The `api-config.js` seam:** In Cloudflare mode this file is a static no-op. In Docker mode `server.js` intercepts `GET /api-config.js` and responds with `window.__BOXES_API_BASE__ = window.location.origin + "/"` so the frontend hits the local server instead of the Worker URL hardcoded in the HTML.

### Commands

```bash
npm start                  # Run local/Docker server (port 3000, reads .env)
docker compose up -d       # Start via Docker Compose
node backup.js             # Download all R2 files + KV search index → boxes-backup-YYYY-MM-DD.tar.gz
```

`backup.js` requires these env vars in `.env`: `CF_ACCOUNT_ID`, `CF_R2_BUCKET`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN`.

No test suite. No linter config.

### Auth

Token stored in `localStorage` as `boxes_auth_token`. Every API request appends `?t={token}`. Auth check: `GET /?check=1&t={token}` → 200 if valid. The token is `AUTH_TOKEN` env var in Docker mode and `BOX_AUTH_TOKEN` secret in Worker mode.

### Data model

**`boxes.json`** — static list of boxes `[{id, key, note, tags}]`. Seeded into `data/boxes.json` on first Docker run. The home page fetches this to build the card grid.

**Search index** — a JSON array stored in KV (`sys:search-index`) or `data/search-index.json`. One entry per box:
```json
{
  "boxId": "01",
  "boxDesc": "...", "boxNote": "...", "boxTags": [], "boxUid": "STOR-001",
  "coverFile": "beach.jpg", "boxLinks": [{"label": "...", "url": "..."}],
  "files": [{"name": "...", "caption": "...", "tags": []}],
  "boxFolders": ["photos"],
  "boxTrash": [{"name": "...", "trashedPath": "_trash/...", "originalPath": "...", "deletedAt": "..."}]
}
```
A special `{boxId: "_config"}` entry stores `customBoxes`, `deletedIds`, and `trash` for home-page box add/delete/restore.

**Per-box files** are stored under the R2 key prefix `box-{id}/`. Special keys: `_meta` (JSON of per-file caption+tags), `note` (HTML), `_cover` (filename of cover image). The `_trash/` prefix is used for soft-deleted files.

### Virtual folders

Single-level only, enforced client-side. A folder is just an R2 key prefix: `box-01/photos/beach.jpg`. No real folder objects exist; the folder list is derived from `boxFolders` in the search index plus folders inferred from file paths.

### Key files

| File | Role |
|---|---|
| `index.html` | Home page — box grid, search, admin (add/delete/restore boxes, rebuild index, print labels) |
| `box/index.html` | Per-box page — file list, upload, preview, notes, folders, trash |
| `cloudflare_worker.js` | Worker: auth, rate-limiting, R2 file ops, KV search index, redirect lookup |
| `server.js` | Express equivalent of the Worker for Docker mode |
| `backup.js` | CLI: download R2 + KV → local `.tar.gz` |
| `boxes.json` | Default box list (seeded into data dir on first run) |
| `Dockerfile` / `docker-compose.yml` | Docker build and Compose config |

### Deployments

- **Cloudflare**: `https://boxes.1000600.xyz` (GitHub Pages frontend + Worker `box-redirect.ausz.workers.dev`)
- **Docker/VPS**: `http://194.195.253.94` (Linode, nginx → port 3000)
- **GitHub repo**: `https://github.com/zzpy20/boxes`
