// redirect.js (JSON-driven)
// Reads ../boxes.json, finds row with id matching current /box-XX/ page, and redirects to row.url.
function getBoxIdFromPath() {
  const m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}
async function loadJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load JSON: ${res.status}`);
  return await res.json();
}
(async () => {
  const msgEl = document.getElementById("msg");
  const id = getBoxIdFromPath();
  if (!id) { msgEl.textContent = "Invalid box path. Expected /box-XX/"; return; }
  try {
    const data = await loadJson("../boxes.json");
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const row = boxes.find(r => String(r.id || "").padStart(2, "0") === id);
    const target = row && typeof row.url === "string" ? row.url.trim() : "";
    if (!target) { msgEl.textContent = `BOX-${id} has no URL yet. Please update boxes.json (field: url).`; return; }
    if (!/^https?:\/\//i.test(target)) { msgEl.textContent = `BOX-${id} URL is invalid (must start with http/https).`; return; }
    location.replace(target);
  } catch (e) {
    msgEl.textContent = "Error loading boxes.json. Check that boxes.json exists at repo root and is valid JSON.";
  }
})();
