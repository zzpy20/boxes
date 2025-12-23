// redirect.js — GitHub Pages auth UI + Cloudflare Worker auth + KV redirect
// - Stores auth token in localStorage (device-level "remember login")
// - Shows a nice modal (no browser prompt)
// - Calls Worker ?check=1 (CORS JSON) to validate token before redirect
// - Redirects via Worker to keep real URL out of GitHub
//
// REQUIRED Worker behavior:
//   GET https://<worker>/<key>?t=<token>&check=1   => 200 {"ok":true} or 401 {"ok":false}
//   GET https://<worker>/<key>?t=<token>          => 302 Location: <real url>
// Worker must set CORS headers for check requests.
//
// Configure:
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/"; // TODO: replace, MUST end with '/'
const TOKEN_STORAGE_KEY = "BOX_AUTH_TOKEN";
const TOKEN_PARAM = "t";

// ---------- helpers ----------
function getBoxIdFromPath() {
  const m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}

async function loadBoxesJson() {
  const res = await fetch("../boxes.json", { cache: "no-store" });
  if (!res.ok) throw new Error("boxes.json not found");
  return await res.json();
}

function getSavedToken() {
  try { return (localStorage.getItem(TOKEN_STORAGE_KEY) || "").trim(); }
  catch { return ""; }
}

function saveToken(token) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token.trim()); } catch {}
}

function clearToken() {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

function workerUrlFor(key, token, check=false) {
  const base = WORKER_BASE.endsWith("/") ? WORKER_BASE : (WORKER_BASE + "/");
  const u = new URL(base + encodeURIComponent(key));
  u.searchParams.set(TOKEN_PARAM, token);
  if (check) u.searchParams.set("check", "1");
  return u.toString();
}

function setMsg(text) {
  const el = document.getElementById("msg");
  if (el) el.textContent = text;
}

// ---------- modal UI ----------
function ensureModal() {
  if (document.getElementById("authOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.innerHTML = `
    <style>
      #authOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);z-index:9999;padding:18px}
      #authCard{width:min(420px,100%);background:#fff;border:1px solid #e6e8ee;border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.18);overflow:hidden}
      #authHead{padding:16px 16px 10px}
      #authTitle{margin:0;font-size:18px;font-weight:800;letter-spacing:.2px}
      #authSub{margin:8px 0 0;color:#64748b;font-size:13px;line-height:1.45}
      #authBody{padding:12px 16px 16px}
      #authRow{display:flex;gap:10px;align-items:center}
      #authInput{flex:1;padding:12px 12px;border-radius:14px;border:1px solid #e6e8ee;font-size:14px;outline:none}
      #authBtn{padding:12px 14px;border-radius:14px;border:1px solid #111;background:#111;color:#fff;font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap}
      #authBtn:disabled{opacity:.6;cursor:not-allowed}
      #authErr{margin-top:10px;color:#b91c1c;font-size:13px;display:none}
      #authFoot{padding:10px 16px 14px;border-top:1px solid #eef2f7;color:#64748b;font-size:12px;display:flex;justify-content:space-between;gap:10px}
      #authLink{color:#334155;text-decoration:none;border-bottom:1px dashed #cbd5e1}
      #authClose{color:#334155;background:transparent;border:0;cursor:pointer;padding:0}
    </style>
    <div id="authCard" role="dialog" aria-modal="true">
      <div id="authHead">
        <h3 id="authTitle">🔒 请输入口令</h3>
        <div id="authSub">此页面需要授权才能打开箱子内容（仅你本人可用）。口令会保存在本机（记住登录）。</div>
      </div>
      <div id="authBody">
        <div id="authRow">
          <input id="authInput" type="password" inputmode="text" autocomplete="current-password" placeholder="输入口令..." />
          <button id="authBtn">解锁</button>
        </div>
        <div id="authErr">口令错误或已失效，请重试。</div>
      </div>
      <div id="authFoot">
        <a id="authLink" href="../index.html" target="_self">返回索引页</a>
        <button id="authClose" title="关闭">关闭</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideModal();
  });
  document.getElementById("authClose").addEventListener("click", hideModal);
}

function showModal({ onSubmit } = {}) {
  ensureModal();
  const overlay = document.getElementById("authOverlay");
  const input = document.getElementById("authInput");
  const btn = document.getElementById("authBtn");
  const err = document.getElementById("authErr");
  err.style.display = "none";
  overlay.style.display = "flex";
  input.value = "";
  setTimeout(() => input.focus(), 50);

  const submit = async () => {
    const token = (input.value || "").trim();
    if (!token) return;
    btn.disabled = true;
    try {
      await onSubmit(token);
      hideModal();
    } catch (e) {
      err.style.display = "block";
      btn.disabled = false;
      input.select();
    }
  };

  btn.onclick = submit;
  input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
}

function hideModal() {
  const overlay = document.getElementById("authOverlay");
  if (overlay) overlay.style.display = "none";
}

// ---------- auth check + redirect ----------
async function checkTokenWithWorker(key, token) {
  const url = workerUrlFor(key, token, true);
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  return res.status === 200;
}

function redirectViaWorker(key, token) {
  const url = workerUrlFor(key, token, false);
  location.replace(url);
}

(async () => {
  const id = getBoxIdFromPath();
  if (!id) { setMsg("Invalid box path. Expected /box-XX/"); return; }

  if (!/^https:\/\//i.test(WORKER_BASE)) { setMsg("WORKER_BASE not configured in redirect.js"); return; }

  setMsg("Loading…");
  let key = "";
  try {
    const data = await loadBoxesJson();
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const row = boxes.find(b => String(b.id || "").padStart(2, "0") === id);
    key = row && typeof row.key === "string" ? row.key.trim() : "";
  } catch (e) {
    setMsg("Error loading boxes.json.");
    return;
  }

  if (!key) { setMsg(`BOX-${id} has no key yet. Set key in boxes.json.`); return; }

  // 1) try saved token
  const saved = getSavedToken();
  if (saved) {
    setMsg("Checking authorization…");
    const ok = await checkTokenWithWorker(key, saved);
    if (ok) {
      setMsg("Redirecting…");
      redirectViaWorker(key, saved);
      return;
    } else {
      clearToken();
    }
  }

  // 2) show login modal
  setMsg("Authorization required.");
  showModal({
    onSubmit: async (token) => {
      setMsg("Checking authorization…");
      const ok = await checkTokenWithWorker(key, token);
      if (!ok) throw new Error("unauthorized");
      saveToken(token);
      setMsg("Redirecting…");
      redirectViaWorker(key, token);
    }
  });
})();
