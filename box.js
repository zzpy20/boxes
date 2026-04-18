// box.js v2 — redesigned English UI
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/";
const TOKEN_STORAGE_KEY = "boxes_auth_token";
const TOKEN_PARAM = "t";

function getBoxIdFromPath() {
  const m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}
async function loadBoxesJson() {
  const res = await fetch("../boxes.json", { cache: "no-store" });
  if (!res.ok) throw new Error("boxes.json not found");
  return await res.json();
}
function getSavedToken() { try { return (localStorage.getItem(TOKEN_STORAGE_KEY) || "").trim(); } catch { return ""; } }
function saveToken(t) { try { localStorage.setItem(TOKEN_STORAGE_KEY, t.trim()); } catch {} }
function clearToken() { try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {} }
function baseUrl() { return WORKER_BASE.endsWith("/") ? WORKER_BASE : (WORKER_BASE + "/"); }

function workerCheckUrl(kvKey, token) {
  const u = new URL(baseUrl() + encodeURIComponent(kvKey));
  u.searchParams.set(TOKEN_PARAM, token); u.searchParams.set("check", "1");
  return u.toString();
}
function workerRedirectUrl(kvKey, token) {
  const u = new URL(baseUrl() + encodeURIComponent(kvKey));
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaListUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/list");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaUploadUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/upload");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaClearUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId);
  u.searchParams.set("all", "1"); u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaDeleteOneUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/file");
  u.searchParams.set("name", filename); u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaFileUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/" + encodeURIComponent(filename));
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}

function ensureModal() {
  if (document.getElementById("authOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.innerHTML = '<style>#authOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);z-index:9999;padding:18px}#authCard{width:min(400px,100%);background:var(--surface);border:1px solid var(--border-strong);border-radius:20px;overflow:hidden}#authHead{padding:24px 24px 16px}#authTitle{margin:0;font-size:18px;font-weight:600;font-family:var(--font)}#authSub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.5;font-family:var(--font)}#authBody{padding:0 24px 20px}#authRow{display:flex;gap:8px}#authInput{flex:1;padding:11px 14px;border-radius:10px;border:1px solid var(--border-strong);font-size:14px;outline:none;background:var(--bg);color:var(--text);font-family:var(--font)}#authInput:focus{border-color:var(--text)}#authBtn{padding:11px 18px;border-radius:10px;border:none;background:var(--accent);color:var(--accent-fg);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font)}#authBtn:disabled{opacity:.5}#authErr{margin-top:10px;color:var(--danger);font-size:13px;display:none}#authFoot{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}#authLink{color:var(--muted);text-decoration:none;font-size:13px;font-family:var(--font)}#authClose{color:var(--muted);background:transparent;border:0;cursor:pointer;font-size:13px;font-family:var(--font)}</style><div id="authCard" role="dialog"><div id="authHead"><h3 id="authTitle">Enter passphrase</h3><div id="authSub">This box is protected. Your passphrase will be saved on this device.</div></div><div id="authBody"><div id="authRow"><input id="authInput" type="password" autocomplete="current-password" placeholder="Passphrase…"/><button id="authBtn">Unlock</button></div><div id="authErr">Incorrect passphrase, please try again.</div></div><div id="authFoot"><a id="authLink" href="../index.html">← All Boxes</a><button id="authClose">Close</button></div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(); });
  document.getElementById("authClose").addEventListener("click", hideModal);
}

function showModal({ onSubmit } = {}) {
  ensureModal();
  const overlay = document.getElementById("authOverlay");
  const input = document.getElementById("authInput");
  const btn = document.getElementById("authBtn");
  const err = document.getElementById("authErr");
  err.style.display = "none"; overlay.style.display = "flex"; input.value = "";
  setTimeout(() => input.focus(), 50);
  const submit = async () => {
    const token = (input.value || "").trim(); if (!token) return;
    btn.disabled = true;
    try { await onSubmit(token); hideModal(); }
    catch (e) { err.style.display = "block"; btn.disabled = false; input.select(); }
  };
  btn.onclick = submit;
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
}
function hideModal() { const o = document.getElementById("authOverlay"); if (o) o.style.display = "none"; }

let BOX_ID = null, KV_KEY = null, TOKEN = null;
function $(id) { return document.getElementById(id); }
function setStatus(text) { const el = $("status"); if (el) el.textContent = text; }

function fmtBytes(bytes) {
  if (bytes == null) return "";
  const u = ["B","KB","MB","GB","TB"]; let i = 0, n = Number(bytes) || 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i === 0 ? 0 : 1) + " " + u[i];
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" });
}
function fileIcon(name) {
  const ext = (name || "").split(".").pop().toLowerCase();
  const map = {jpg:"🖼",jpeg:"🖼",png:"🖼",gif:"🖼",webp:"🖼",heic:"🖼",avif:"🖼",mp4:"🎬",mov:"🎬",m4v:"🎬",webm:"🎬",mp3:"🎵",m4a:"🎵",aac:"🎵",wav:"🎵",flac:"🎵",ogg:"🎵",pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",csv:"📊",zip:"🗜",rar:"🗜",gz:"🗜",json:"⚙️",js:"⚙️",html:"🌐",css:"🎨",txt:"📃"};
  return map[ext] || "📎";
}

async function checkToken(kvKey, token) {
  const res = await fetch(workerCheckUrl(kvKey, token), { method: "GET", cache: "no-store" });
  return res.status === 200;
}

async function refreshList() {
  $("files").innerHTML = ""; $("empty").style.display = "none"; setStatus("Loading files…");
  const res = await fetch(mediaListUrl(BOX_ID, TOKEN), { cache: "no-store" });
  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error("list_failed");
  const arr = await res.json();
  if (!Array.isArray(arr) || arr.length === 0) {
    $("empty").style.display = "block"; setStatus("No files in this box."); return;
  }
  setStatus(arr.length + " file" + (arr.length === 1 ? "" : "s"));
  arr.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  for (const it of arr) {
    const row = document.createElement("div"); row.className = "fileRow";
    const name = it.name || "";
    const ext = name.split(".").pop().toLowerCase();
    const isImg = ["jpg","jpeg","png","gif","webp","heic","avif"].includes(ext);
    const isHeic = ext === "heic";
    const isVid = ["mp4","mov","m4v","webm"].includes(ext);
    const isAud = ["mp3","m4a","aac","wav","flac","ogg"].includes(ext);
    const isPdf = ext === "pdf";
    const fileUrl = mediaFileUrl(BOX_ID, name, TOKEN);
    row.innerHTML = '<div class="fileIcon">' + fileIcon(name) + '</div><div class="fileMain"><div class="fileName">' + name + '</div><div class="fileMeta">' + fmtBytes(it.size) + (it.lastModified ? " · " + fmtDate(it.lastModified) : "") + '</div></div><div class="fileBtns"><a class="btn" href="' + fileUrl + '" target="_blank" rel="noreferrer">Open</a><button class="btn" data-act="preview">Preview</button><button class="btn danger" data-act="del">Delete</button></div>';
    row.querySelector('[data-act="preview"]').onclick = () => {
      const host = $("preview"); host.innerHTML = "";
      const title = document.createElement("div"); title.className = "previewTitle"; title.textContent = "Preview · " + name; host.appendChild(title);
      if (isImg && !isHeic) { const img = document.createElement("img"); img.src = fileUrl; img.alt = name; img.className = "previewImg"; host.appendChild(img); }
      else if (isHeic) { const p = document.createElement("div"); p.className = "previewHint"; p.textContent = "HEIC files cannot be previewed in Chrome. Open in Safari or download."; host.appendChild(p); }
      else if (isVid) { const v = document.createElement("video"); v.controls = true; v.playsInline = true; v.className = "previewMedia"; const s = document.createElement("source"); s.src = fileUrl; v.appendChild(s); host.appendChild(v); }
      else if (isAud) { const a = document.createElement("audio"); a.controls = true; a.className = "previewMedia"; const s = document.createElement("source"); s.src = fileUrl; a.appendChild(s); host.appendChild(a); }
      else if (isPdf) { const iframe = document.createElement("iframe"); iframe.src = fileUrl; iframe.className = "previewFrame"; host.appendChild(iframe); }
      else { const p = document.createElement("div"); p.className = "previewHint"; p.textContent = "This file type cannot be previewed. Click Open to download."; host.appendChild(p); }
      host.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    row.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm('Delete "' + name + '"?')) return;
      setStatus("Deleting…");
      const resp = await fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method: "DELETE" });
      if (resp.status === 401) throw new Error("unauthorized");
      if (!resp.ok) { alert("Delete failed."); }
      await refreshList();
    };
    $("files").appendChild(row);
  }
}

async function uploadFiles(files) {
  if (!files || files.length === 0) return;
  const maxBodyBytes = 95 * 1024 * 1024;
  const tooBig = Array.from(files).find(f => (f && f.size) > maxBodyBytes);
  if (tooBig) { alert("File too large: " + tooBig.name + "\n" + fmtBytes(tooBig.size) + " — max 95 MB"); return; }
  const progHost = $("uploadProgress"); progHost.innerHTML = ""; progHost.style.display = "block";
  const items = Array.from(files).map(f => {
    const row = document.createElement("div"); row.className = "progRow";
    row.innerHTML = '<div class="progHeader"><div class="progName">' + f.name + '</div><div class="progMeta">' + fmtBytes(f.size) + '</div></div><div class="progBar"><div class="progFill"></div></div><div class="progPct">0%</div>';
    progHost.appendChild(row);
    return { f, fill: row.querySelector(".progFill"), pct: row.querySelector(".progPct") };
  });
  setStatus("Uploading " + items.length + " file(s)…");
  $("uploadBtn").disabled = true; $("fileIn").disabled = true;
  for (const it of items) {
    await new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append("files", it.f, it.f.name);
      const xhr = new XMLHttpRequest(); xhr.open("POST", mediaUploadUrl(BOX_ID, TOKEN), true);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) { const p = Math.round((e.loaded / e.total) * 100); it.fill.style.width = p + "%"; it.pct.textContent = p + "%"; } };
      xhr.onload = () => { if (xhr.status === 401) { reject(new Error("unauthorized")); return; } if (xhr.status >= 200 && xhr.status < 300) { it.fill.style.width = "100%"; it.pct.textContent = "100%"; resolve(); } else { alert("Upload failed: " + it.f.name); resolve(); } };
      xhr.onerror = () => { alert("Network error: " + it.f.name); resolve(); };
      xhr.send(fd);
    });
  }
  $("uploadBtn").disabled = false; $("fileIn").disabled = false; $("fileIn").value = "";
  await refreshList();
  setTimeout(() => { progHost.style.display = "none"; }, 800);
}

function wireDropzone() {
  const dz = $("dropzone"); if (!dz) return;
  const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
  ["dragenter","dragover","dragleave","drop"].forEach(ev => { dz.addEventListener(ev, prevent, false); document.body.addEventListener(ev, prevent, false); });
  dz.addEventListener("dragenter", () => dz.classList.add("hover"));
  dz.addEventListener("dragover", () => dz.classList.add("hover"));
  dz.addEventListener("dragleave", () => dz.classList.remove("hover"));
  dz.addEventListener("drop", async (e) => { dz.classList.remove("hover"); const files = e.dataTransfer && e.dataTransfer.files; if (files && files.length) await uploadFiles(files).catch(handleErr); });
}

function wireButtons() {
  $("logoutBtn").onclick = () => { clearToken(); alert("Signed out."); location.reload(); };
  $("openUrlBtn").onclick = async () => {
    if (!KV_KEY) { alert("No URL configured for this box."); return; }
    if (!TOKEN) { alert("Not authenticated."); return; }
    if (!confirm("Open the URL linked to this box?")) return;
    location.href = workerRedirectUrl(KV_KEY, TOKEN);
  };
  $("refreshBtn").onclick = () => refreshList().catch(handleErr);
  $("fileIn").onchange = (e) => { const f = e.target.files; if (f && f.length) uploadFiles(f).catch(handleErr); };
  $("uploadBtn").onclick = () => $("fileIn").click();
  $("clearBtn").onclick = async () => {
    if (!confirm("Delete ALL files in this box? This cannot be undone.")) return;
    setStatus("Clearing…");
    const res = await fetch(mediaClearUrl(BOX_ID, TOKEN), { method: "DELETE" });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) { alert("Clear failed."); }
    $("preview").innerHTML = ""; await refreshList();
  };
}

function handleErr(e) {
  const msg = (e && e.message) ? e.message : String(e || "");
  if (msg === "unauthorized") { clearToken(); alert("Session expired. Please enter your passphrase again."); location.reload(); return; }
  console.error(e); setStatus("Error: " + msg);
}

(async function main() {
  BOX_ID = getBoxIdFromPath();
  if (!BOX_ID) { setStatus("Invalid box path."); return; }
  $("boxTitle").textContent = "BOX-" + BOX_ID;
  try {
    const data = await loadBoxesJson();
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const row = boxes.find(b => String(b.id || "").padStart(2, "0") === BOX_ID);
    KV_KEY = row && typeof row.key === "string" ? row.key.trim() : "";
    $("note").textContent = (row && row.note) ? String(row.note) : "No description";
    const tags = (row && Array.isArray(row.tags)) ? row.tags : [];
    $("tags").innerHTML = "";
    tags.filter(Boolean).forEach(t => { const s = document.createElement("span"); s.className = "tag"; s.textContent = String(t); $("tags").appendChild(s); });
    $("kvKey").textContent = KV_KEY || "Not configured";
    if (!KV_KEY) { const btn = $("openUrlBtn"); if (btn) btn.style.display = "none"; }
  } catch (e) { setStatus("Failed to load boxes.json"); return; }
  wireButtons(); wireDropzone();
  const saved = getSavedToken();
  if (saved && await checkToken(KV_KEY || "dummy", saved).catch(() => false)) { TOKEN = saved; }
  else {
    if (saved) clearToken();
    await new Promise((resolve) => {
      showModal({ onSubmit: async (tok) => { const ok = await checkToken(KV_KEY || "dummy", tok); if (!ok) throw new Error("unauthorized"); saveToken(tok); TOKEN = tok; } });
      const t0 = Date.now();
      const timer = setInterval(() => { if (TOKEN) { clearInterval(timer); resolve(); } if (Date.now() - t0 > 10 * 60 * 1000) { clearInterval(timer); resolve(); } }, 120);
    });
  }
  if (!TOKEN) { setStatus("Not authenticated."); return; }
  $("authPill").textContent = "Authenticated ✓";
  $("authPill").className = "pill ok";
  await refreshList();
})().catch(handleErr);
