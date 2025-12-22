// redirect.js (KEY -> Cloudflare Worker -> KV -> URL)
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/"; // TODO: replace, must end with '/'

function getBoxIdFromPath() {
  const m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}

async function loadBoxesJson() {
  const res = await fetch("../boxes.json", { cache: "no-store" });
  if (!res.ok) throw new Error("boxes.json not found");
  return await res.json();
}

(async () => {
  const msgEl = document.getElementById("msg");
  const id = getBoxIdFromPath();
  if (!id) { msgEl.textContent = "Invalid box path. Expected /box-XX/"; return; }

  try {
    const data = await loadBoxesJson();
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const row = boxes.find(b => String(b.id || "").padStart(2, "0") === id);
    const key = row && typeof row.key === "string" ? row.key.trim() : "";

    if (!key) { msgEl.textContent = `BOX-${id} has no key yet. Set key in boxes.json.`; return; }
    if (!/^https:\/\//i.test(WORKER_BASE)) { msgEl.textContent = "WORKER_BASE not configured in redirect.js"; return; }

    const base = WORKER_BASE.endsWith("/") ? WORKER_BASE : (WORKER_BASE + "/");
    location.replace(base + encodeURIComponent(key));
  } catch (e) {
    msgEl.textContent = "Error loading boxes.json.";
  }
})();
