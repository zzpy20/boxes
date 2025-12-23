// box.js — Box page (preview + upload + clear) using Cloudflare Worker + R2 (private)
// Configure:
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/"; // must end with '/'
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
function saveToken(token) { try { localStorage.setItem(TOKEN_STORAGE_KEY, token.trim()); } catch {} }
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
  const u = new URL(baseUrl() + `media/box-${boxId}/list`);
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaUploadUrl(boxId, token) {
  const u = new URL(baseUrl() + `media/box-${boxId}/upload`);
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaClearUrl(boxId, token) {
  const u = new URL(baseUrl() + `media/box-${boxId}`);
  u.searchParams.set("all", "1");
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaDeleteOneUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + `media/box-${boxId}/file`);
  u.searchParams.set("name", filename);
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}
function mediaFileUrl(boxId, filename, token) {
  const u = new URL(baseUrl() + `media/box-${boxId}/${encodeURIComponent(filename)}`);
  u.searchParams.set(TOKEN_PARAM, token);
  return u.toString();
}

// ---------- modal auth UI ----------
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
        <div id="authSub">此页面需要授权。口令会保存在本机（记住登录）。</div>
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

  overlay.addEventListener("click", (e) => { if (e.target === overlay) hideModal(); });
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

// ---------- state ----------
let BOX_ID = null;
let KV_KEY = null;
let TOKEN = null;

let VIEW_MODE = (localStorage.getItem('boxes_view_mode') || 'list');
let SELECTED = new Set();
let FILES = [];

function $(id){ return document.getElementById(id); }
function setStatus(text){ const el=$("status"); if(el) el.textContent=text; }
function fmtBytes(bytes){
  if(bytes==null) return "";
  const u=["B","KB","MB","GB","TB"];
  let i=0, n=Number(bytes)||0;
  while(n>=1024 && i<u.length-1){ n/=1024; i++; }
  return `${n.toFixed(i===0?0:1)} ${u[i]}`;
}

function extOf(name){
  const s=String(name||"");
  const i=s.lastIndexOf(".");
  return (i>=0?s.slice(i+1):"").toLowerCase();
}
function supportsThumb(ext){ return ["jpg","jpeg","png","gif","webp","avif"].includes(ext); } // keep light
function setViewMode(mode){
  VIEW_MODE = (mode==="grid") ? "grid" : "list";
  localStorage.setItem("boxes_view_mode", VIEW_MODE);
  updateViewButtons();
  renderFiles();
}
function updateViewButtons(){
  const b1=document.getElementById("btnList");
  const b2=document.getElementById("btnGrid");
  if(b1) b1.classList.toggle("on", VIEW_MODE==="list");
  if(b2) b2.classList.toggle("on", VIEW_MODE==="grid");
  const host = $("files");
  if(host){
    host.classList.toggle("grid", VIEW_MODE==="grid");
    host.classList.toggle("list", VIEW_MODE!=="grid");
  }
}
function toggleSelected(name){
  if(SELECTED.has(name)) SELECTED.delete(name);
  else SELECTED.add(name);
  updateBulkBar();
}
function clearSelected(){ SELECTED.clear(); updateBulkBar(); renderFiles(); }
function selectAll(){ FILES.forEach(f=>SELECTED.add(f.name)); updateBulkBar(); renderFiles(); }
function updateBulkBar(){
  const el=document.getElementById("bulkCount");
  const del=document.getElementById("btnBulkDelete");
  const clr=document.getElementById("btnClearSel");
  if(el) el.textContent = `${SELECTED.size} selected`;
  if(del) del.disabled = SELECTED.size===0;
  if(clr) clr.disabled = SELECTED.size===0;
}
async function bulkDelete(){
  if(SELECTED.size===0) return;
  if(!confirm(`Delete ${SELECTED.size} file(s) in BOX-${BOX_ID}?`)) return;
  const names=[...SELECTED];
  setStatus(`Deleting ${names.length}…`);
  for(const n of names){
    try{ await fetch(mediaDeleteOneUrl(BOX_ID, n, TOKEN), { method:"DELETE" }); }catch(e){ console.warn(e); }
  }
  clearSelected();
  await refreshList();
  setStatus("Done.");
}
function wireViewAndBulk(){
  const host=document.getElementById("viewToolbar");
  if(host && !host.dataset.wired){
    host.dataset.wired="1";
    host.innerHTML = `
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn" id="btnList" type="button">List</button>
        <button class="btn" id="btnGrid" type="button">Grid</button>
        <span class="sep"></span>
        <button class="btn" id="btnSelectAll" type="button">Select all</button>
        <button class="btn" id="btnClearSel" type="button" disabled>Clear</button>
        <button class="btn danger" id="btnBulkDelete" type="button" disabled>Delete selected</button>
        <span class="muted" id="bulkCount">0 selected</span>
      </div>
    `;
  }
  document.getElementById("btnList")?.addEventListener("click", ()=>setViewMode("list"));
  document.getElementById("btnGrid")?.addEventListener("click", ()=>setViewMode("grid"));
  document.getElementById("btnSelectAll")?.addEventListener("click", ()=>selectAll());
  document.getElementById("btnClearSel")?.addEventListener("click", ()=>clearSelected());
  document.getElementById("btnBulkDelete")?.addEventListener("click", ()=>bulkDelete().catch(console.warn));
  updateViewButtons();
  updateBulkBar();
}

async function checkToken(kvKey, token){
  const res = await fetch(workerCheckUrl(kvKey, token), { method:"GET", cache:"no-store" });
  return res.status === 200;
}

// ---------- media UI ----------
function openPreview(name, fileUrl){
  // reuse existing preview renderer by simulating click; we will call existing logic in row builder below
  // This function is kept for future expansion.
}

function renderFiles(){
  const host = $("files");
  if(!host) return;
  host.innerHTML = "";
  $("empty").style.display = (FILES.length===0) ? "block" : "none";

  if(VIEW_MODE==="grid"){
    host.classList.add("grid"); host.classList.remove("list");
  }else{
    host.classList.add("list"); host.classList.remove("grid");
  }

  for(const it of FILES){
    const name = it.name || "";
    const size = fmtBytes(it.size);
    const lm = it.lastModified ? new Date(it.lastModified).toLocaleString() : "";
    const ext = extOf(name);
    const isImg = ["jpg","jpeg","png","gif","webp","heic","avif"].includes(ext);
    const isHeic = (ext==="heic");
    const isVid = ["mp4","mov","m4v","webm"].includes(ext);
    const isAud = ["mp3","m4a","aac","wav","flac","ogg"].includes(ext);
    const isPdf = (ext==="pdf");

    const fileUrl = mediaFileUrl(BOX_ID, name, TOKEN);

    if(VIEW_MODE==="grid"){
      const card=document.createElement("div");
      card.className="gridItem";

      const top=document.createElement("div");
      top.className="gridTop";

      const chk=document.createElement("input");
      chk.type="checkbox";
      chk.checked = SELECTED.has(name);
      chk.addEventListener("change", ()=>toggleSelected(name));
      top.appendChild(chk);

      const meta=document.createElement("div");
      meta.className="gridMeta";
      meta.textContent = `${size}${lm ? " · " + lm : ""}`;
      top.appendChild(meta);

      const thumb=document.createElement("div");
      thumb.className="thumb";
      if(supportsThumb(ext)){
        const img=new Image();
        img.loading="lazy";
        img.src=fileUrl;
        img.alt=name;
        thumb.appendChild(img);
      }else if(isPdf){
        thumb.textContent="PDF";
      }else{
        thumb.textContent=ext ? ext.toUpperCase() : "FILE";
      }

      const title=document.createElement("div");
      title.className="gridTitle";
      title.textContent=name;

      const actions=document.createElement("div");
      actions.className="fileBtns";
      actions.innerHTML = `
        <a class="btn" href="${fileUrl}" target="_blank" rel="noreferrer">打开/下载</a>
        <button class="btn" data-act="preview">预览</button>
        <button class="btn danger" data-act="del">删除</button>
      `;

      actions.querySelector('[data-act="preview"]').onclick = () => {
        // Use the same preview logic as list below
        const host = $("preview");
        host.innerHTML = "";
        const title = document.createElement("div");
        title.className = "previewTitle";
        title.textContent = `预览：${name}`;
        host.appendChild(title);

        if(isImg){
          if(isHeic){
            const p=document.createElement("div");
            p.className="previewHint";
            p.textContent="HEIC 在部分浏览器（Chrome/Edge）不支持直接预览。请点“打开/下载”，或用 Safari 查看。";
            host.appendChild(p);
            const a=document.createElement("a");
            a.href=fileUrl; a.target="_blank"; a.rel="noreferrer"; a.className="btn";
            a.textContent="打开/下载 HEIC";
            host.appendChild(a);
          } else {
            const img=document.createElement("img");
            img.src=fileUrl; img.alt=name; img.className="previewImg";
            host.appendChild(img);
          }
        } else if(isVid){
          const v=document.createElement("video");
          v.controls=true; v.playsInline=true; v.className="previewMedia";
          const s=document.createElement("source");
          s.src=fileUrl; v.appendChild(s); host.appendChild(v);
        } else if(isAud){
          const a=document.createElement("audio");
          a.controls=true; a.className="previewMedia";
          const s=document.createElement("source");
          s.src=fileUrl; a.appendChild(s); host.appendChild(a);
        } else if(isPdf){
          const iframe=document.createElement("iframe");
          iframe.src=fileUrl; iframe.className="previewFrame";
          host.appendChild(iframe);
        } else {
          const p=document.createElement("div");
          p.className="previewHint";
          p.textContent="该文件类型不支持内嵌预览，请点击“打开/下载”。";
          host.appendChild(p);
        }
        host.scrollIntoView({behavior:"smooth", block:"start"});
      };

      actions.querySelector('[data-act="del"]').onclick = async () => {
        if(!confirm(`确定删除：${name} ？`)) return;
        setStatus("Deleting…");
        const resp = await fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method:"DELETE" });
        if(resp.status===401){ throw new Error("unauthorized"); }
        if(!resp.ok){ alert("删除失败"); }
        await refreshList();
      };

      card.appendChild(top);
      card.appendChild(thumb);
      card.appendChild(title);
      card.appendChild(actions);
      $("files").appendChild(card);
    } else {
      const row=document.createElement("div");
      row.className="fileRow";

      row.innerHTML = `
        <div class="fileMain">
          <div class="fileLeft">
            <input type="checkbox" class="sel" ${SELECTED.has(name) ? "checked":""}/>
            <div class="fileInfo">
              <div class="fileName">${name}</div>
              <div class="fileMeta">${size}${lm ? " · " + lm : ""}</div>
            </div>
          </div>
        </div>
        <div class="fileBtns">
          <a class="btn" href="${fileUrl}" target="_blank" rel="noreferrer">打开/下载</a>
          <button class="btn" data-act="preview">预览</button>
          <button class="btn danger" data-act="del">删除</button>
        </div>
      `;

      row.querySelector("input.sel").addEventListener("change", ()=>toggleSelected(name));

      row.querySelector('[data-act="preview"]').onclick = () => {
        const host = $("preview");
        host.innerHTML = "";
        const title = document.createElement("div");
        title.className = "previewTitle";
        title.textContent = `预览：${name}`;
        host.appendChild(title);

        if(isImg){
          if(isHeic){
            const p=document.createElement("div");
            p.className="previewHint";
            p.textContent="HEIC 在部分浏览器（Chrome/Edge）不支持直接预览。请点“打开/下载”，或用 Safari 查看。";
            host.appendChild(p);
            const a=document.createElement("a");
            a.href=fileUrl; a.target="_blank"; a.rel="noreferrer"; a.className="btn";
            a.textContent="打开/下载 HEIC";
            host.appendChild(a);
          } else {
            const img=document.createElement("img");
            img.src=fileUrl; img.alt=name; img.className="previewImg";
            host.appendChild(img);
          }
        } else if(isVid){
          const v=document.createElement("video");
          v.controls=true; v.playsInline=true; v.className="previewMedia";
          const s=document.createElement("source");
          s.src=fileUrl; v.appendChild(s); host.appendChild(v);
        } else if(isAud){
          const a=document.createElement("audio");
          a.controls=true; a.className="previewMedia";
          const s=document.createElement("source");
          s.src=fileUrl; a.appendChild(s); host.appendChild(a);
        } else if(isPdf){
          const iframe=document.createElement("iframe");
          iframe.src=fileUrl; iframe.className="previewFrame";
          host.appendChild(iframe);
        } else {
          const p=document.createElement("div");
          p.className="previewHint";
          p.textContent="该文件类型不支持内嵌预览，请点击“打开/下载”。";
          host.appendChild(p);
        }
        host.scrollIntoView({behavior:"smooth", block:"start"});
      };

      row.querySelector('[data-act="del"]').onclick = async () => {
        if(!confirm(`确定删除：${name} ？`)) return;
        setStatus("Deleting…");
        const resp = await fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method:"DELETE" });
        if(resp.status===401){ throw new Error("unauthorized"); }
        if(!resp.ok){ alert("删除失败"); }
        await refreshList();
      };

      $("files").appendChild(row);
    }
  }

  updateBulkBar();
}

async function refreshList(){

  $("files").innerHTML = "";
  $("empty").style.display = "none";
  setStatus("Loading files…");
  const res = await fetch(mediaListUrl(BOX_ID, TOKEN), { cache:"no-store" });
  if(res.status===401){ throw new Error("unauthorized"); }
  if(!res.ok){ throw new Error("list_failed"); }
  const arr = await res.json();
  if(!Array.isArray(arr) || arr.length===0){
    $("empty").style.display = "block";
    setStatus("No files in this box.");
    return;
  }
  setStatus(`Loaded ${arr.length} files.`);
  arr.sort((a,b)=> (a.name||"").localeCompare(b.name||""));
  FILES = arr;
  renderFiles();
  return;

  for(const it of arr){
    const row = document.createElement("div");
    row.className = "fileRow";
    const name = it.name || "";
    const size = fmtBytes(it.size);
    const lm = it.lastModified ? new Date(it.lastModified).toLocaleString() : "";
    const ext = name.split(".").pop().toLowerCase();
    const isImg = ["jpg","jpeg","png","gif","webp","heic","avif"].includes(ext);
    const isHeic = (ext === "heic");
    const isVid = ["mp4","mov","m4v","webm"].includes(ext);
    const isAud = ["mp3","m4a","aac","wav","flac","ogg"].includes(ext);
    const isPdf = ext === "pdf";

    const fileUrl = mediaFileUrl(BOX_ID, name, TOKEN);

    row.innerHTML = `
      <div class="fileMain">
        <div class="fileName">${name}</div>
        <div class="fileMeta">${size}${lm ? " · " + lm : ""}</div>
      </div>
      <div class="fileBtns">
        <a class="btn" href="${fileUrl}" target="_blank" rel="noreferrer">打开/下载</a>
        <button class="btn" data-act="preview">预览</button>
        <button class="btn danger" data-act="del">删除</button>
      </div>
    `;

    row.querySelector('[data-act="preview"]').onclick = () => {
      const host = $("preview");
      host.innerHTML = "";
      const title = document.createElement("div");
      title.className = "previewTitle";
      title.textContent = `预览：${name}`;
      host.appendChild(title);

      if(isImg){
        if(isHeic){
          const p = document.createElement("div");
          p.className = "previewHint";
          p.textContent = "HEIC 在部分浏览器（Chrome/Edge）不支持直接预览。请点“打开/下载”，或用 Safari 查看。";
          host.appendChild(p);

          const a = document.createElement("a");
          a.href = fileUrl;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.className = "btn";
          a.textContent = "打开/下载 HEIC";
          host.appendChild(a);
        } else {
          const img = document.createElement("img");
          img.src = fileUrl; img.alt = name; img.className = "previewImg";
          host.appendChild(img);
        }
      } else if(isVid){
        const v = document.createElement("video");
        v.controls = true; v.playsInline = true; v.className = "previewMedia";
        const s = document.createElement("source");
        s.src = fileUrl;
        v.appendChild(s);
        host.appendChild(v);
      } else if(isAud){
        const a = document.createElement("audio");
        a.controls = true; a.className = "previewMedia";
        const s = document.createElement("source");
        s.src = fileUrl;
        a.appendChild(s);
        host.appendChild(a);
      } else if(isPdf){
        const iframe = document.createElement("iframe");
        iframe.src = fileUrl; iframe.className = "previewFrame";
        host.appendChild(iframe);
      } else {
        const p = document.createElement("div");
        p.className = "previewHint";
        p.textContent = "该文件类型不支持内嵌预览，请点击“打开/下载”。";
        host.appendChild(p);
      }
      host.scrollIntoView({behavior:"smooth", block:"start"});
    };

    row.querySelector('[data-act="del"]').onclick = async () => {
      if(!confirm(`确定删除：${name} ？`)) return;
      setStatus("Deleting…");
      const resp = await fetch(mediaDeleteOneUrl(BOX_ID, name, TOKEN), { method:"DELETE" });
      if(resp.status===401){ throw new Error("unauthorized"); }
      if(!resp.ok){ alert("删除失败"); }
      await refreshList();
    };

    $("files").appendChild(row);
  }
}

async function uploadFiles(files){
  if(!files || files.length===0) return;

  const maxBodyBytes = 95 * 1024 * 1024; // soft cap to avoid plan 100MB request body limit
  const tooBig = Array.from(files).find(f => (f && f.size) > maxBodyBytes);
  if(tooBig){
    alert(`单个文件过大：${tooBig.name}
大小：${fmtBytes(tooBig.size)}

Cloudflare Workers 入站请求体大小通常为 100MB（Free/Pro）。当前网页上传是一次请求完成，超过上限会被拒绝。

解决方案：
1) 压缩/裁剪视频到 < 95MB 再上传；
2) 以后我们可升级为“分片上传（multipart）”，可上传更大文件。`);
    return;
  }

  const progHost = $("uploadProgress");
  progHost.innerHTML = "";
  progHost.style.display = "block";

  const items = Array.from(files).map(f=>{
    const row = document.createElement("div");
    row.className = "progRow";
    row.innerHTML = `
      <div class="progName">${f.name}</div>
      <div class="progMeta">${fmtBytes(f.size)}</div>
      <div class="progBar"><div class="progFill" style="width:0%"></div></div>
      <div class="progPct">0%</div>
    `;
    progHost.appendChild(row);
    return { f, row, fill: row.querySelector(".progFill"), pct: row.querySelector(".progPct") };
  });

  setStatus(`Uploading ${items.length} file(s)…`);
  $("uploadBtn").disabled = true;
  $("fileIn").disabled = true;

  // Upload sequentially (per-file progress)
  for(const it of items){
    await new Promise((resolve, reject)=>{
      const fd = new FormData();
      fd.append("files", it.f, it.f.name);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", mediaUploadUrl(BOX_ID, TOKEN), true);

      xhr.upload.onprogress = (e)=>{
        if(e.lengthComputable){
          const p = Math.round((e.loaded / e.total) * 100);
          it.fill.style.width = `${p}%`;
          it.pct.textContent = `${p}%`;
        }
      };
      xhr.onload = ()=>{
        if(xhr.status === 401){ reject(new Error("unauthorized")); return; }
        if(xhr.status >= 200 && xhr.status < 300){
          it.fill.style.width = "100%";
          it.pct.textContent = "100%";
          resolve();
        } else {
          const msg = xhr.responseText || `HTTP ${xhr.status}`;
          alert(`上传失败：${it.f.name}
${msg}`);
          resolve();
        }
      };
      xhr.onerror = ()=>{ alert(`网络错误：${it.f.name}`); resolve(); };
      xhr.send(fd);
    });
  }

  $("uploadBtn").disabled = false;
  $("fileIn").disabled = false;
  $("fileIn").value = "";

  await refreshList();
  setTimeout(()=>{ progHost.style.display="none"; }, 800);
}


function wireDropzone(){
  const dz = $("dropzone");
  if(!dz) return;

  const prevent = (e)=>{ e.preventDefault(); e.stopPropagation(); };
  ["dragenter","dragover","dragleave","drop"].forEach(ev=>{
    dz.addEventListener(ev, prevent, false);
    document.body.addEventListener(ev, prevent, false);
  });

  dz.addEventListener("dragenter", ()=> dz.classList.add("hover"));
  dz.addEventListener("dragover",  ()=> dz.classList.add("hover"));
  dz.addEventListener("dragleave", ()=> dz.classList.remove("hover"));
  dz.addEventListener("drop", async (e)=>{
    dz.classList.remove("hover");
    const files = e.dataTransfer && e.dataTransfer.files;
    if(files && files.length){
      await uploadFiles(files).catch(handleErr);
    }
  });
}


function wireViewAndBulk(){
  // Inject toolbar if missing
  const host = document.getElementById("viewToolbar");
  if(host && !host.dataset.wired){
    host.dataset.wired = "1";
    host.innerHTML = `
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn" id="btnList" type="button">List</button>
        <button class="btn" id="btnGrid" type="button">Grid</button>
        <span class="sep"></span>
        <button class="btn" id="btnSelectAll" type="button">Select all</button>
        <button class="btn" id="btnClearSel" type="button" disabled>Clear</button>
        <button class="btn danger" id="btnBulkDelete" type="button" disabled>Delete selected</button>
        <span class="muted" id="bulkCount">0 selected</span>
      </div>
    `;
  }

  document.getElementById("btnList")?.addEventListener("click", ()=>setViewMode("list"));
  document.getElementById("btnGrid")?.addEventListener("click", ()=>setViewMode("grid"));
  document.getElementById("btnSelectAll")?.addEventListener("click", ()=>selectAll());
  document.getElementById("btnClearSel")?.addEventListener("click", ()=>clearSelected());
  document.getElementById("btnBulkDelete")?.addEventListener("click", ()=>bulkDelete().catch(handleErr));

  updateViewButtons();
  updateBulkBar();
}

function wireButtons(){

  $("logoutBtn").onclick = () => { clearToken(); alert("已清除本机授权。"); location.reload(); };

  $("openUrlBtn").onclick = async () => {
    if(!KV_KEY){ alert("此箱子未设置 key"); return; }
    if(!TOKEN){ alert("未登录"); return; }
    if(!confirm("确认跳转到该箱子的真实 URL 吗？")) return;
    location.href = workerRedirectUrl(KV_KEY, TOKEN);
  };

  $("refreshBtn").onclick = () => refreshList().catch(handleErr);

  $("fileIn").onchange = (e) => { const files = e.target.files; if(files && files.length) uploadFiles(files).catch(handleErr); };

  $("uploadBtn").onclick = () => $("fileIn").click();

  $("clearBtn").onclick = async () => {
    if(!confirm("确定清空本箱子所有文件吗？（不可恢复）")) return;
    setStatus("Clearing…");
    const res = await fetch(mediaClearUrl(BOX_ID, TOKEN), { method:"DELETE" });
    if(res.status===401){ throw new Error("unauthorized"); }
    if(!res.ok){ alert("清空失败"); }
    $("preview").innerHTML = "";
    await refreshList();
  };
}

function handleErr(e){
  const msg = (e && e.message) ? e.message : String(e||"");
  if(msg==="unauthorized"){
    clearToken();
    alert("口令失效/未授权，请重新输入口令。");
    location.reload();
    return;
  }
  console.error(e);
  setStatus("Error: " + msg);
  alert("发生错误：" + msg);
}

(async function main(){
  BOX_ID = getBoxIdFromPath();
  if(!BOX_ID){ setStatus("Invalid box path."); return; }
  $("boxTitle").textContent = `BOX-${BOX_ID}`;

  // Load metadata from boxes.json
  try{
    const data = await loadBoxesJson();
    const boxes = Array.isArray(data.boxes) ? data.boxes : [];
    const row = boxes.find(b => String(b.id||"").padStart(2,"0") === BOX_ID);
    KV_KEY = row && typeof row.key==="string" ? row.key.trim() : "";
    $("note").textContent = (row && row.note) ? String(row.note) : "";
    const tags = (row && Array.isArray(row.tags)) ? row.tags : [];
    $("tags").innerHTML = "";
    tags.filter(Boolean).forEach(t=>{
      const s=document.createElement("span");
      s.className="tag"; s.textContent=String(t);
      $("tags").appendChild(s);
    });
    $("kvKey").textContent = KV_KEY ? KV_KEY : "（未设置）";
  } catch(e){
    setStatus("读取 boxes.json 失败");
    return;
  }

  wireButtons();
  wireDropzone();
  wireViewAndBulk();

  // Auth: try saved token
  const saved = getSavedToken();
  if(saved && await checkToken(KV_KEY || "dummy", saved).catch(()=>false)){
    TOKEN = saved;
  } else {
    if(saved) clearToken();
    await new Promise((resolve) => {
      showModal({
        onSubmit: async (tok) => {
          const ok = await checkToken(KV_KEY || "dummy", tok);
          if(!ok) throw new Error("unauthorized");
          saveToken(tok);
          TOKEN = tok;
        }
      });
      const t0 = Date.now();
      const timer = setInterval(()=>{
        if(TOKEN){ clearInterval(timer); resolve(); }
        if(Date.now()-t0>10*60*1000){ clearInterval(timer); resolve(); }
      }, 120);
    });
  }

  if(!TOKEN){ setStatus("未登录"); return; }

  $("authPill").textContent = "Auth: ✅ 已登录（本机记住）";
  await refreshList();
})().catch(handleErr);
