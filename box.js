// box.js v3
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
  u.searchParams.set(TOKEN_PARAM, token);
  u.searchParams.set("check", "1");
  return u.toString();
}
function workerRedirectUrl(kvKey, token) {
  const u = new URL(baseUrl() + encodeURIComponent(kvKey));
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaListUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/list");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaNoteGetUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/note");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaNotePostUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/note");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaUploadUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/upload");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaClearUrl(boxId, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId);
  u.searchParams.set("all", "1");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaDeleteOneUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/file");
  u.searchParams.set("name", filename);
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaFileUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + "media/box-" + boxId + "/" + encodeURIComponent(filename));
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}

function ensureModal() {
  if (document.getElementById("authOverlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "authOverlay";
  overlay.innerHTML = [
    "<style>",
    "#authOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);z-index:9999;padding:18px}",
    "#authCard{width:min(400px,100%);background:var(--surface);border:1px solid var(--border-strong);border-radius:20px;overflow:hidden}",
    "#authHead{padding:24px 24px 16px}",
    "#authTitle{margin:0;font-size:18px;font-weight:600;font-family:var(--font)}",
    "#authSub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.5;font-family:var(--font)}",
    "#authBody{padding:0 24px 20px}",
    "#authRow{display:flex;gap:8px}",
    "#authInput{flex:1;padding:11px 14px;border-radius:10px;border:1px solid var(--border-strong);font-size:14px;outline:none;background:var(--bg);color:var(--text);font-family:var(--font)}",
    "#authInput:focus{border-color:var(--text)}",
    "#authBtn{padding:11px 18px;border-radius:10px;border:none;background:var(--accent);color:var(--accent-fg);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font)}",
    "#authBtn:disabled{opacity:.5}",
    "#authErr{margin-top:10px;color:var(--danger);font-size:13px;display:none}",
    "#authFoot{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}",
    "#authLink{color:var(--muted);text-decoration:none;font-size:13px;font-family:var(--font)}",
    "#authLink:hover{color:var(--text)}",
    "#authClose{color:var(--muted);background:transparent;border:0;cursor:pointer;font-size:13px;font-family:var(--font)}",
    "</style>",
    "<div id='authCard' role='dialog'>",
    "<div id='authHead'><h3 id='authTitle'>Enter passphrase</h3>",
    "<div id='authSub'>This box is protected. Your passphrase will be saved on this device.</div></div>",
    "<div id='authBody'><div id='authRow'>",
    "<input id='authInput' type='password' autocomplete='current-password' placeholder='Passphrase...'/>",
    "<button id='authBtn'>Unlock</button></div>",
    "<div id='authErr'>Incorrect passphrase, please try again.</div></div>",
    "<div id='authFoot'><a id='authLink' href='../index.html'>Back to All Boxes</a>",
    "<button id='authClose'>Close</button></div></div>"
  ].join("");
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e) { if (e.target === overlay) hideModal(); });
  document.getElementById("authClose").addEventListener("click", hideModal);
}

function showModal(opts) {
  var onSubmit = opts && opts.onSubmit;
  ensureModal();
  var overlay = document.getElementById("authOverlay");
  var input = document.getElementById("authInput");
  var btn = document.getElementById("authBtn");
  var err = document.getElementById("authErr");
  err.style.display = "none";
  overlay.style.display = "flex";
  input.value = "";
  setTimeout(function() { input.focus(); }, 50);
  function submit() {
    var token = (input.value || "").trim();
    if (!token) return;
    btn.disabled = true;
    onSubmit(token).then(function() { hideModal(); }).catch(function() {
      err.style.display = "block";
      btn.disabled = false;
      input.select();
    });
  }
  btn.onclick = submit;
  input.onkeydown = function(e) { if (e.key === "Enter") submit(); };
}

function hideModal() {
  var o = document.getElementById("authOverlay");
  if (o) o.style.display = "none";
}

var BOX_ID = null, KV_KEY = null, TOKEN = null;
function $(id) { return document.getElementById(id); }
function setStatus(text) { var el = $("status"); if (el) el.textContent = text; }

function fmtBytes(bytes) {
  if (bytes == null) return "";
  var u = ["B","KB","MB","GB","TB"], i = 0, n = Number(bytes) || 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return n.toFixed(i === 0 ? 0 : 1) + " " + u[i];
}
function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" });
}
function fileIcon(name) {
  var ext = (name || "").split(".").pop().toLowerCase();
  var map = {jpg:"🖼",jpeg:"🖼",png:"🖼",gif:"🖼",webp:"🖼",heic:"🖼",avif:"🖼",mp4:"🎬",mov:"🎬",m4v:"🎬",webm:"🎬",mp3:"🎵",m4a:"🎵",aac:"🎵",wav:"🎵",flac:"🎵",ogg:"🎵",pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",csv:"📊",zip:"🗜",rar:"🗜",gz:"🗜",json:"⚙",js:"⚙",html:"🌐",css:"🎨",txt:"📃"};
  return map[ext] || "📎";
}

function checkToken(kvKey, token) {
  return fetch(workerCheckUrl(kvKey, token), { method: "GET", cache: "no-store" })
    .then(function(res) { return res.status === 200; });
}

function loadNote() {
  var el = $("notesEditor");
  if (!el) return Promise.resolve();
  var status = $("notesStatus");
  return fetch(mediaNoteGetUrl(BOX_ID, TOKEN), { cache: "no-store" })
    .then(function(res) {
      if (res.ok) return res.text();
      return "";
    })
    .then(function(html) {
      el.innerHTML = html || "";
      if (status) status.textContent = html ? "Note loaded" : "No note yet";
    })
    .catch(function() { if (status) status.textContent = "Could not load note"; });
}

function saveNote() {
  var el = $("notesEditor");
  if (!el) return Promise.resolve();
  var status = $("notesStatus");
  var btn = $("saveNoteBtn");
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving...";
  return fetch(mediaNotePostUrl(BOX_ID, TOKEN), {
    method: "POST",
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: el.innerHTML
  }).then(function(res) {
    if (status) status.textContent = res.ok ? "Saved" : "Save failed";
  }).catch(function() {
    if (status) status.textContent = "Save failed";
  }).then(function() {
    if (btn) btn.disabled = false;
  });
}

var activeFileRow = null;
function showPreview(name, fileUrl, ext) {
  var body = $("previewBody");
  var filename = $("previewFilename");
  if (filename) filename.textContent = name;
  body.innerHTML = "";
  var isImg = ["jpg","jpeg","png","gif","webp","avif"].indexOf(ext) >= 0;
  var isHeic = ext === "heic";
  var isVid = ["mp4","mov","m4v","webm"].indexOf(ext) >= 0;
  var isAud = ["mp3","m4a","aac","wav","flac","ogg"].indexOf(ext) >= 0;
  var isPdf = ext === "pdf";
  var wrap = document.createElement("div");
  wrap.style.padding = "16px";
  if (isImg) {
    var img = document.createElement("img");
    img.src = fileUrl; img.alt = name; img.className = "previewImg";
    wrap.appendChild(img);
  } else if (isHeic) {
    var p = document.createElement("div"); p.className = "previewHint";
    p.innerHTML = "HEIC files cannot be previewed in Chrome.<br>Open in Safari or download.";
    wrap.appendChild(p);
    var a = document.createElement("a"); a.href = fileUrl; a.target = "_blank"; a.rel = "noreferrer";
    a.className = "btn"; a.style.marginTop = "12px"; a.textContent = "Download HEIC";
    wrap.appendChild(a);
  } else if (isVid) {
    var v = document.createElement("video"); v.controls = true; v.playsInline = true; v.className = "previewMedia";
    var s = document.createElement("source"); s.src = fileUrl; v.appendChild(s); wrap.appendChild(v);
  } else if (isAud) {
    var au = document.createElement("audio"); au.controls = true; au.className = "previewMedia";
    var sa = document.createElement("source"); sa.src = fileUrl; au.appendChild(sa); wrap.appendChild(au);
  } else if (isPdf) {
    var iframe = document.createElement("iframe"); iframe.src = fileUrl; iframe.className = "previewFrame";
    wrap.appendChild(iframe);
  } else {
    var ph = document.createElement("div"); ph.className = "previewHint";
    ph.innerHTML = "This file type cannot be previewed inline.<br><br>";
    var al = document.createElement("a"); al.href = fileUrl; al.target = "_blank"; al.rel = "noreferrer";
    al.className = "btn"; al.textContent = "Open / Download"; ph.appendChild(al); wrap.appendChild(ph);
  }
  body.appendChild(wrap);
}

function refreshList() {
  $("files").innerHTML = "";
  $("empty").style.display = "none";
  setStatus("Loading files...");
  activeFileRow = null;
  $("previewBody").innerHTML = "<div class='preview-empty'>Select a file to preview</div>";
  var fn = $("previewFilename"); if (fn) fn.textContent = "—";
  return fetch(mediaListUrl(BOX_ID, TOKEN), { cache: "no-store" })
    .then(function(res) {
      if (res.status === 401) throw new Error("unauthorized");
      if (!res.ok) throw new Error("list_failed");
      return res.json();
    })
    .then(function(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        $("empty").style.display = "block";
        setStatus("No files in this box.");
        return;
      }
      setStatus(arr.length + " file" + (arr.length === 1 ? "" : "s"));
      arr.sort(function(a, b) { return (a.name || "").localeCompare(b.name || ""); });
      arr.forEach(function(it) {
        var row = document.createElement("div"); row.className = "fileRow";
        var name = it.name || "";
        var ext = name.split(".").pop().toLowerCase();
        var fileUrl = mediaFileUrl(BOX_ID, name, TOKEN);
        row.innerHTML = "<div class='fileIcon'>" + fileIcon(name) + "</div>" +
          "<div class='fileMain'><div class='fileName'>" + name + "</div>" +
          "<div class='fileMeta'>" + fmtBytes(it.size) + (it.lastModified ? " · " + fmtDate(it.lastModified) : "") + "</div></div>" +
          "<div class='fileBtns'><a class='btn sm' href='" + fileUrl + "' target='_blank' rel='noreferrer'>Open</a>" +
          "<button class='btn sm danger' data-act='del'>Delete</button></div>";
        row.addEventListener("click", function(e) {
          if (e.target.closest("[data-act]") || e.target.closest("a")) return;
          if (activeFileRow) activeFileRow.classList.remove("active");
          row.classList.add("active"); activeFileRow = row;
          showPreview(name, fileUrl, ext);
        });
        row.querySelector("[data-act='del']").onclick = function(e) {
          e.stopPropagation();
          if (!confirm("Delete \"" + name + "\"?")) return;
          setStatus("Deleting...");
          fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method: "DELETE" })
            .then(function(resp) {
              if (resp.status === 401) throw new Error("unauthorized");
              if (!resp.ok) { alert("Delete failed."); }
              return refreshList();
            }).catch(handleErr);
        };
        $("files").appendChild(row);
      });
    });
}

function uploadFiles(files) {
  if (!files || files.length === 0) return Promise.resolve();
  var maxBodyBytes = 95 * 1024 * 1024;
  var tooBig = Array.prototype.find.call(files, function(f) { return f && f.size > maxBodyBytes; });
  if (tooBig) { alert("File too large: " + tooBig.name + "\n" + fmtBytes(tooBig.size) + " — max 95 MB"); return Promise.resolve(); }
  var progHost = $("uploadProgress"); progHost.innerHTML = ""; progHost.style.display = "block";
  var items = Array.prototype.map.call(files, function(f) {
    var row = document.createElement("div"); row.className = "progRow";
    row.innerHTML = "<div class='progHeader'><div class='progName'>" + f.name + "</div><div class='progMeta'>" + fmtBytes(f.size) + "</div></div><div class='progBar'><div class='progFill'></div></div><div class='progPct'>0%</div>";
    progHost.appendChild(row);
    return { f: f, fill: row.querySelector(".progFill"), pct: row.querySelector(".progPct") };
  });
  setStatus("Uploading " + items.length + " file(s)...");
  $("uploadBtn").disabled = true; $("fileIn").disabled = true;
  var chain = Promise.resolve();
  items.forEach(function(it) {
    chain = chain.then(function() {
      return new Promise(function(resolve, reject) {
        var fd = new FormData(); fd.append("files", it.f, it.f.name);
        var xhr = new XMLHttpRequest(); xhr.open("POST", mediaUploadUrl(BOX_ID, TOKEN), true);
        xhr.upload.onprogress = function(e) { if (e.lengthComputable) { var p = Math.round(e.loaded/e.total*100); it.fill.style.width=p+"%"; it.pct.textContent=p+"%"; } };
        xhr.onload = function() { if (xhr.status===401){reject(new Error("unauthorized"));return;} if(xhr.status>=200&&xhr.status<300){it.fill.style.width="100%";it.pct.textContent="100%";resolve();}else{alert("Upload failed: "+it.f.name);resolve();} };
        xhr.onerror = function() { alert("Network error: "+it.f.name); resolve(); };
        xhr.send(fd);
      });
    });
  });
  return chain.then(function() {
    $("uploadBtn").disabled = false; $("fileIn").disabled = false; $("fileIn").value = "";
    return refreshList();
  }).then(function() {
    setTimeout(function() { progHost.style.display = "none"; }, 800);
  });
}

function wireDropzone() {
  var dz = $("dropzone"); if (!dz) return;
  function prevent(e) { e.preventDefault(); e.stopPropagation(); }
  ["dragenter","dragover","dragleave","drop"].forEach(function(ev) { dz.addEventListener(ev, prevent, false); document.body.addEventListener(ev, prevent, false); });
  dz.addEventListener("dragenter", function() { dz.classList.add("hover"); });
  dz.addEventListener("dragover", function() { dz.classList.add("hover"); });
  dz.addEventListener("dragleave", function() { dz.classList.remove("hover"); });
  dz.addEventListener("drop", function(e) { dz.classList.remove("hover"); var f=e.dataTransfer&&e.dataTransfer.files; if(f&&f.length) uploadFiles(f).catch(handleErr); });
}

function wireButtons() {
  $("logoutBtn").onclick = function() { clearToken(); alert("Signed out."); location.reload(); };
  var snb = $("saveNoteBtn"); if (snb) snb.onclick = function() { saveNote().catch(handleErr); };
  $("refreshBtn").onclick = function() { refreshList().catch(handleErr); };
  $("fileIn").onchange = function(e) { var f=e.target.files; if(f&&f.length) uploadFiles(f).catch(handleErr); };
  $("uploadBtn").onclick = function() { $("fileIn").click(); };
  $("clearBtn").onclick = function() {
    if (!confirm("Delete ALL files in this box? This cannot be undone.")) return;
    setStatus("Clearing...");
    fetch(mediaClearUrl(BOX_ID, TOKEN), { method: "DELETE" })
      .then(function(res) { if(res.status===401) throw new Error("unauthorized"); if(!res.ok) alert("Clear failed."); $("previewBody").innerHTML="<div class='preview-empty'>Select a file to preview</div>"; return refreshList(); })
      .catch(handleErr);
  };
}

function handleErr(e) {
  var msg = (e && e.message) ? e.message : String(e || "");
  if (msg === "unauthorized") { clearToken(); alert("Session expired. Please enter your passphrase again."); location.reload(); return; }
  console.error(e); setStatus("Error: " + msg);
}

function main() {
  BOX_ID = getBoxIdFromPath();
  if (!BOX_ID) { setStatus("Invalid box path."); return; }
  $("boxTitle").textContent = "BOX-" + BOX_ID;
  var bc = $("breadcrumbCurrent"); if (bc) bc.textContent = "BOX-" + BOX_ID;
  document.title = "BOX-" + BOX_ID;

  loadBoxesJson().then(function(data) {
    var boxes = Array.isArray(data.boxes) ? data.boxes : [];
    var row = boxes.find(function(b) { return String(b.id || "").padStart(2,"0") === BOX_ID; });
    KV_KEY = row && typeof row.key === "string" ? row.key.trim() : "";
    var tags = (row && Array.isArray(row.tags)) ? row.tags : [];
    $("tags").innerHTML = "";
    tags.filter(Boolean).forEach(function(t) {
      var s = document.createElement("span"); s.className = "tag"; s.textContent = String(t); $("tags").appendChild(s);
    });
    wireButtons();
    wireDropzone();
    var saved = getSavedToken();
    return checkToken(KV_KEY || "dummy", saved || "x").then(function(ok) {
      if (ok && saved) {
        TOKEN = saved;
        $("authPill").textContent = "Authenticated";
        $("authPill").className = "pill ok";
        return Promise.all([refreshList(), loadNote()]);
      } else {
        if (saved) clearToken();
        return new Promise(function(resolve) {
          showModal({
            onSubmit: function(tok) {
              return checkToken(KV_KEY || "dummy", tok).then(function(ok2) {
                if (!ok2) throw new Error("unauthorized");
                saveToken(tok); TOKEN = tok;
                $("authPill").textContent = "Authenticated";
                $("authPill").className = "pill ok";
                resolve();
                return Promise.all([refreshList(), loadNote()]);
              });
            }
          });
        });
      }
    });
  }).catch(function(e) {
    setStatus("Error: " + (e && e.message ? e.message : String(e)));
    console.error(e);
  });
}

main();
