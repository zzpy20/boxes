// box.js v7 - collapsible notes + grid hover fix + multiselect
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/";
const TOKEN_STORAGE_KEY = "boxes_auth_token";
const TOKEN_PARAM = "t";

function getBoxIdFromPath() {
  var m = location.pathname.match(/box-(\d{2})\/?$/i);
  return m ? m[1] : null;
}
async function loadBoxesJson() {
  var res = await fetch("../boxes.json", { cache: "no-store" });
  if (!res.ok) throw new Error("boxes.json not found");
  return await res.json();
}
function getSavedToken() { try { return (localStorage.getItem(TOKEN_STORAGE_KEY) || "").trim(); } catch { return ""; } }
function saveToken(t) { try { localStorage.setItem(TOKEN_STORAGE_KEY, t.trim()); } catch {} }
function clearToken() { try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {} }
function baseUrl() { return WORKER_BASE.endsWith("/") ? WORKER_BASE : (WORKER_BASE + "/"); }

function workerCheckUrl(kvKey, token) {
  var u = new URL(baseUrl() + encodeURIComponent(kvKey));
  u.searchParams.set(TOKEN_PARAM, token); u.searchParams.set("check", "1"); return u.toString();
}
function mediaListUrl(boxId, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/list");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaNoteGetUrl(boxId, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/note");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaNotePostUrl(boxId, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/note");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaUploadUrl(boxId, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/upload");
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaClearUrl(boxId, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId);
  u.searchParams.set("all", "1"); u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaDeleteOneUrl(boxId, filename, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/file");
  u.searchParams.set("name", filename); u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}
function mediaFileUrl(boxId, filename, token) {
  var u = new URL(baseUrl() + "media/box-" + boxId + "/" + encodeURIComponent(filename));
  u.searchParams.set(TOKEN_PARAM, token); return u.toString();
}

function ensureModal() {
  if (document.getElementById("authOverlay")) return;
  var overlay = document.createElement("div");
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
  err.style.display = "none"; overlay.style.display = "flex"; input.value = "";
  setTimeout(function() { input.focus(); }, 50);
  function submit() {
    var token = (input.value || "").trim(); if (!token) return;
    btn.disabled = true;
    onSubmit(token).then(function() { hideModal(); }).catch(function() {
      err.style.display = "block"; btn.disabled = false; input.select();
    });
  }
  btn.onclick = submit;
  input.onkeydown = function(e) { if (e.key === "Enter") submit(); };
}
function hideModal() { var o = document.getElementById("authOverlay"); if (o) o.style.display = "none"; }

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
function isImageExt(ext) { return ["jpg","jpeg","png","gif","webp","avif","heic"].indexOf(ext) >= 0; }
function isHeicExt(ext) { return ext === "heic"; }

var heicCache = {};
function loadHeicUrl(fileUrl) {
  if (heicCache[fileUrl]) return Promise.resolve(heicCache[fileUrl]);
  return fetch(fileUrl)
    .then(function(res) { return res.blob(); })
    .then(function(blob) { return window.heic2any({ blob: blob, toType: "image/jpeg", quality: 0.75 }); })
    .then(function(converted) {
      var url = URL.createObjectURL(converted);
      heicCache[fileUrl] = url; return url;
    });
}

function checkToken(kvKey, token) {
  return fetch(workerCheckUrl(kvKey, token), { method: "GET", cache: "no-store" })
    .then(function(res) { return res.status === 200; });
}

function loadNote() {
  var el = $("notesEditor"); if (!el) return Promise.resolve();
  var status = $("notesStatus");
  return fetch(mediaNoteGetUrl(BOX_ID, TOKEN), { cache: "no-store" })
    .then(function(res) { return res.ok ? res.text() : ""; })
    .then(function(html) {
      el.innerHTML = html || "";
      if (status) status.textContent = html ? "Note loaded" : "No note yet";
      if (typeof updateNotesPreview === "function") updateNotesPreview();
    })
    .catch(function() { if (status) status.textContent = "Could not load note"; });
}

function saveNote() {
  var el = $("notesEditor"); if (!el) return Promise.resolve();
  var status = $("notesStatus"), btn = $("saveNoteBtn");
  if (btn) btn.disabled = true;
  if (status) status.textContent = "Saving...";
  return fetch(mediaNotePostUrl(BOX_ID, TOKEN), {
    method: "POST", headers: { "Content-Type": "text/html; charset=utf-8" }, body: el.innerHTML
  }).then(function(res) {
    if (status) status.textContent = res.ok ? "Saved" : "Save failed";
    if (typeof updateNotesPreview === "function") updateNotesPreview();
  }).catch(function() { if (status) status.textContent = "Save failed"; })
  .then(function() { if (btn) btn.disabled = false; });
}

// ── Selection ──
var selectedFiles = {};

function updateActionBar() {
  var keys = Object.keys(selectedFiles);
  var bar = $("actionBar");
  var count = $("actionCount");
  if (keys.length > 0) {
    count.textContent = keys.length + " selected";
    bar.classList.add("visible");
  } else {
    bar.classList.remove("visible");
  }
}

function clearSelection() {
  selectedFiles = {};
  document.querySelectorAll(".fileCheck").forEach(function(cb) { cb.checked = false; });
  document.querySelectorAll(".fileRow").forEach(function(r) { r.classList.remove("selected"); });
  updateActionBar();
}

function makeThumb(name, ext, fileUrl) {
  var wrap = document.createElement("div");
  wrap.className = "fileThumb";
  if (isImageExt(ext)) {
    wrap.classList.add("clickable");
    if (isHeicExt(ext)) {
      var spinner = document.createElement("div");
      spinner.className = "heic-loading"; spinner.textContent = "HEIC...";
      wrap.appendChild(spinner);
      loadHeicUrl(fileUrl).then(function(url) {
        wrap.innerHTML = "";
        var img = document.createElement("img"); img.src = url; img.alt = name; img.className = "thumb-img";
        wrap.appendChild(img);
        wrap.appendChild(makePopup(url));
        wrap.onclick = function(e) { e.stopPropagation(); window.open(url, "_blank"); };
      }).catch(function() { wrap.innerHTML = "🖼"; });
    } else {
      var img = document.createElement("img"); img.src = fileUrl; img.alt = name; img.className = "thumb-img"; img.loading = "lazy";
      wrap.appendChild(img);
      wrap.appendChild(makePopup(fileUrl));
      wrap.onclick = function(e) { e.stopPropagation(); window.open(fileUrl, "_blank"); };
    }
  } else {
    wrap.textContent = fileIcon(name);
  }
  return wrap;
}

function makePopup(imgUrl) {
  var popup = document.createElement("div"); popup.className = "thumbPopup";
  var popImg = document.createElement("img"); popImg.src = imgUrl; popImg.alt = "";
  popup.appendChild(popImg); return popup;
}

function refreshList() {
  $("files").innerHTML = "";
  $("empty").style.display = "none";
  selectedFiles = {}; updateActionBar();
  setStatus("Loading files...");
  return fetch(mediaListUrl(BOX_ID, TOKEN), { cache: "no-store" })
    .then(function(res) {
      if (res.status === 401) throw new Error("unauthorized");
      if (!res.ok) throw new Error("list_failed");
      return res.json();
    })
    .then(function(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        $("empty").style.display = "block"; setStatus("No files in this box."); return;
      }
      setStatus(arr.length + " file" + (arr.length === 1 ? "" : "s"));
      arr.sort(function(a, b) { return (a.name || "").localeCompare(b.name || ""); });
      arr.forEach(function(it) {
        var name = it.name || "";
        var ext = name.split(".").pop().toLowerCase();
        var fileUrl = mediaFileUrl(BOX_ID, name, TOKEN);
        var row = document.createElement("div"); row.className = "fileRow";

        var cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "fileCheck";
        cb.addEventListener("change", function() {
          if (cb.checked) { selectedFiles[name] = true; row.classList.add("selected"); }
          else { delete selectedFiles[name]; row.classList.remove("selected"); }
          updateActionBar();
        });

        var thumb = makeThumb(name, ext, fileUrl);

        var mainDiv = document.createElement("div"); mainDiv.className = "fileMain";
        var nameDiv = document.createElement("div"); nameDiv.className = "fileName"; nameDiv.textContent = name;
        var metaDiv = document.createElement("div"); metaDiv.className = "fileMeta";
        metaDiv.textContent = fmtBytes(it.size) + (it.lastModified ? " · " + fmtDate(it.lastModified) : "");
        mainDiv.appendChild(nameDiv); mainDiv.appendChild(metaDiv);

        var btns = document.createElement("div"); btns.className = "fileBtns";
        var openBtn = document.createElement("a"); openBtn.className = "btn sm"; openBtn.href = fileUrl; openBtn.target = "_blank"; openBtn.rel = "noreferrer"; openBtn.textContent = "Open";
        var delBtn = document.createElement("button"); delBtn.className = "btn sm danger"; delBtn.textContent = "Delete";
        delBtn.onclick = function(e) {
          e.stopPropagation();
          if (!confirm("Delete \"" + name + "\"?")) return;
          setStatus("Deleting...");
          fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method: "DELETE" })
            .then(function(resp) { if (resp.status === 401) throw new Error("unauthorized"); if (!resp.ok) alert("Delete failed."); return refreshList(); })
            .catch(handleErr);
        };
        btns.appendChild(openBtn); btns.appendChild(delBtn);
        row.appendChild(cb); row.appendChild(thumb); row.appendChild(mainDiv); row.appendChild(btns);
        $("files").appendChild(row);
      });
    });
}

function deleteSelected() {
  var names = Object.keys(selectedFiles);
  if (names.length === 0) return;
  if (!confirm("Delete " + names.length + " selected file(s)? This cannot be undone.")) return;
  setStatus("Deleting " + names.length + " files...");
  $("actionBar").classList.remove("visible");
  var chain = Promise.resolve();
  names.forEach(function(name) {
    chain = chain.then(function() {
      return fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method: "DELETE" })
        .then(function(resp) { if (resp.status === 401) throw new Error("unauthorized"); });
    });
  });
  chain.then(function() { return refreshList(); }).catch(handleErr);
}

function uploadFiles(files) {
  if (!files || files.length === 0) return Promise.resolve();
  var maxBodyBytes = 95 * 1024 * 1024;
  var tooBig = null;
  Array.prototype.forEach.call(files, function(f) { if (f && f.size > maxBodyBytes && !tooBig) tooBig = f; });
  if (tooBig) { alert("File too large: " + tooBig.name + " — max 95 MB"); return Promise.resolve(); }
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
        xhr.onload = function() { if(xhr.status===401){reject(new Error("unauthorized"));return;} if(xhr.status>=200&&xhr.status<300){it.fill.style.width="100%";it.pct.textContent="100%";resolve();}else{alert("Upload failed: "+it.f.name);resolve();} };
        xhr.onerror = function() { alert("Network error: " + it.f.name); resolve(); };
        xhr.send(fd);
      });
    });
  });
  return chain.then(function() {
    $("uploadBtn").disabled = false; $("fileIn").disabled = false; $("fileIn").value = "";
    return refreshList();
  }).then(function() { setTimeout(function() { progHost.style.display = "none"; }, 800); });
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
      .then(function(res) { if(res.status===401) throw new Error("unauthorized"); if(!res.ok) alert("Clear failed."); return refreshList(); })
      .catch(handleErr);
  };
  $("actionDelete").onclick = function() { deleteSelected(); };
  $("actionCancel").onclick = function() { clearSelection(); };
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
    var row = null;
    boxes.forEach(function(b) { if (String(b.id||"").padStart(2,"0") === BOX_ID) row = b; });
    KV_KEY = row && typeof row.key === "string" ? row.key.trim() : "";
    var tags = (row && Array.isArray(row.tags)) ? row.tags : [];
    $("tags").innerHTML = "";
    tags.filter(Boolean).forEach(function(t) { var s=document.createElement("span"); s.className="tag"; s.textContent=String(t); $("tags").appendChild(s); });
    wireButtons(); wireDropzone();
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
  }).catch(function(e) { setStatus("Error: " + (e&&e.message?e.message:String(e))); console.error(e); });
}

main();
