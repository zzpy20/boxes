# boxes (GitHub Pages) - JSON + Admin editor (Bulk URL paste)

## Edit workflow
1) Open: https://zzpy20.github.io/boxes/admin.html
2) Click "Load current boxes.json"
3) Edit in the table OR use the bulk URL paste (one URL per line)
4) Click "Download boxes.json"
5) Upload the downloaded boxes.json to your GitHub repo root (overwrite) and commit

## Bulk URL paste formats
- One URL per line (sequential): line1 -> BOX-01, line2 -> BOX-02 ...
- Or "id,url" per line: e.g. "01,https://..." (updates by ID)

## Redirect behavior
- QR code points to: https://zzpy20.github.io/boxes/box-XX/
- /box-XX/ loads ../redirect.js
- redirect.js reads ../boxes.json and redirects to the url
