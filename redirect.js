// redirect.js
// Reads ../boxes.csv, finds row with id matching current /box-XX/ page, and redirects to row.url.
// CSV supports quoted fields, commas, and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { // escaped quote
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = "";
      } else if (c === '\r') {
        // ignore, handle on \n
      } else if (c === '\n') {
        row.push(field);
        field = "";
        // skip empty trailing lines
        if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  // last field
  if (field.length || row.length) {
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
  }

  if (!rows.length) return { headers: [], data: [] };
  const headers = rows[0].map(h => (h || "").trim().toLowerCase());
  const data = rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] ?? "").trim());
    return obj;
  });
  return { headers, data };
}

function getBoxIdFromPath() {
  // Works for /boxes/box-01/ or /box-01/ etc.
  const m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}

async function loadCsv(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
  return await res.text();
}

(async () => {
  const msgEl = document.getElementById("msg");
  const id = getBoxIdFromPath();

  if (!id) {
    msgEl.textContent = "Invalid box path. Expected /box-XX/";
    return;
  }

  try {
    const csvText = await loadCsv("../boxes.csv");
    const { data } = parseCsv(csvText);

    const row = data.find(r => (r.id || "").padStart(2, "0") === id);
    const target = row && row.url ? row.url : "";

    if (!target) {
      msgEl.textContent = `BOX-${id} has no URL yet. Please update boxes.csv (column: url).`;
      return;
    }

    // Basic safety: only allow http/https
    if (!/^https?:\/\//i.test(target)) {
      msgEl.textContent = `BOX-${id} URL is invalid (must start with http/https).`;
      return;
    }

    // Redirect
    location.replace(target);
  } catch (e) {
    msgEl.textContent = "Error loading boxes.csv. Check that boxes.csv exists at repo root and is valid CSV.";
  }
})();
