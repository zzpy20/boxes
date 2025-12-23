// box.js — v7.1 stable baseline (syntax-safe)
// ===== Auth hard-gate (for current HTML IDs) =====
(function () {
  const pill = document.getElementById("authPill");

  // If token already exists, just show status and continue.
  const existing = localStorage.getItem("boxes_auth_token") || "";
  if (existing) {
    if (pill) pill.textContent = "Auth: ✓";
    return;
  }

  // Otherwise, require secret before any page logic continues.
  const secret = (prompt("Enter secret to access this box:") || "").trim();

  if (!secret) {
    // User cancelled/closed prompt -> bounce back to index
    location.href = "/boxes/";
    // Stop further script execution
    throw new Error("Auth required");
  }

  localStorage.setItem("boxes_auth_token", secret);
  if (pill) pill.textContent = "Auth: ✓";

  // Continue to the rest of your box.js code.
})();



let TOKEN = localStorage.getItem("boxes_auth_token") || "";

const BOX_ID = (() => {
  const m = location.pathname.match(/box-(\d+)/);
  return m ? m[1] : "";
})();

function baseUrl() {
  return "https://box-redirect.ausz.workers.dev/";
}

function showModal(opts = {}) {
  const onClose = typeof opts.onClose === "function" ? opts.onClose : null;

  const overlay = document.getElementById("authOverlay");
  overlay.style.display = "flex";

  document.getElementById("authClose").onclick = () => {
    overlay.style.display = "none";
    if (onClose) onClose();
  };

  document.getElementById("authSubmit").onclick = () => {
    const input = document.getElementById("authInput");
    const value = input.value.trim();
    if (!value) return;

    TOKEN = value;
    localStorage.setItem("boxes_auth_token", TOKEN);
    overlay.style.display = "none";
    init();
  };
}

async function init() {
  if (!TOKEN) {
    showModal({
      onClose: () => {
        location.href = "/boxes/";
      }
    });
    return;
  }

  const authStatus = document.getElementById("authStatus");
  if (authStatus) authStatus.textContent = "Auth: ✓";

  await loadFiles();
}

async function loadFiles() {
  const list = document.getElementById("fileList");
  if (!list) return;

  const url = `${baseUrl()}media/box-${BOX_ID}/list?t=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url);

  if (!res.ok) {
    list.textContent = "Failed to load files.";
    return;
  }

  const data = await res.json();
  list.innerHTML = "";

  (data.files || []).forEach(file => {
    const div = document.createElement("div");
    const a = document.createElement("a");

    a.href = `${baseUrl()}media/box-${BOX_ID}/${encodeURIComponent(file.name)}?t=${encodeURIComponent(TOKEN)}`;
    a.textContent = file.name;
    a.target = "_blank";

    div.appendChild(a);
    list.appendChild(div);
  });
}

window.addEventListener("DOMContentLoaded", init);
