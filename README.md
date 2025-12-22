# boxes (GitHub Pages) - CSV driven

## What you edit (only one file)
- `boxes.csv` (edit in Excel)
  - columns: id,url,note,tags,preview
  - id: 01..50
  - url: Google Doc / Notion / any http(s) URL
  - note/tags/preview: used by the index page

## How redirect works
- QR code points to: https://zzpy20.github.io/boxes/box-XX/
- `/box-XX/index.html` loads `../redirect.js`
- `redirect.js` reads `../boxes.csv`, finds matching id, redirects to the url.

## Preview images
- Put images under `previews/`, e.g. `previews/box-01.jpg`
- Set preview column in boxes.csv to that path.

## Enable GitHub Pages
Settings → Pages → Deploy from a branch → main / (root)
