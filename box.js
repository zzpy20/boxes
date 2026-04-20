// box.js v15 - folders
const WORKER_BASE="https://box-redirect.ausz.workers.dev/";
const TOKEN_STORAGE_KEY="boxes_auth_token";
const TOKEN_PARAM="t";

function getBoxIdFromUrl(){var p=new URLSearchParams(window.location.search);var id=(p.get("id")||"").trim();if(/^\d{1,2}$/.test(id))return id.padStart(2,"0");return null;}
async function loadBoxesJson(){var r=await fetch("../boxes.json",{cache:"no-store"});if(!r.ok)throw new Error("not found");return await r.json();}
function getSavedToken(){try{return(localStorage.getItem(TOKEN_STORAGE_KEY)||"").trim();}catch{return"";}}
function saveToken(t){try{localStorage.setItem(TOKEN_STORAGE_KEY,t.trim());}catch{}}
function clearToken(){try{localStorage.removeItem(TOKEN_STORAGE_KEY);}catch{}}
function baseUrl(){return WORKER_BASE.endsWith("/")?WORKER_BASE:(WORKER_BASE+"/");}

function workerCheckUrl(k,t){var u=new URL(baseUrl()+encodeURIComponent(k));u.searchParams.set(TOKEN_PARAM,t);u.searchParams.set("check","1");return u.toString();}
function mediaListUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/list");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaNoteGetUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/note");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaNotePostUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/note");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaMetaGetUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/_meta");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaMetaPostUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/_meta");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaUploadUrl(id,t,folder){var u=new URL(baseUrl()+"media/box-"+id+"/upload");u.searchParams.set(TOKEN_PARAM,t);if(folder)u.searchParams.set("folder",folder);return u.toString();}
function mediaClearUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id);u.searchParams.set("all","1");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaDeleteOneUrl(id,name,t){var u=new URL(baseUrl()+"media/box-"+id+"/file");u.searchParams.set("name",name);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaFileUrl(id,name,t){var encoded=name.split("/").map(encodeURIComponent).join("/");var u=new URL(baseUrl()+"media/box-"+id+"/"+encoded);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaRenameUrl(id,from,to,t){var u=new URL(baseUrl()+"media/box-"+id+"/rename");u.searchParams.set("from",from);u.searchParams.set("to",to);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaMoveUrl(id,from,to,t){var u=new URL(baseUrl()+"media/box-"+id+"/move");u.searchParams.set("from",from);u.searchParams.set("to",to);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaDeleteFolderUrl(id,name,t){var u=new URL(baseUrl()+"media/box-"+id+"/folder");u.searchParams.set("name",name);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function searchIndexGetUrl(t){var u=new URL(baseUrl()+"search-index");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function searchIndexPostUrl(t){var u=new URL(baseUrl()+"search-index");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}

function ensureModal(){
  if(document.getElementById("authOverlay"))return;
  var o=document.createElement("div");o.id="authOverlay";
  o.innerHTML=['<style>',
    '#authOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);z-index:9999;padding:18px}',
    '#authCard{width:min(400px,100%);background:var(--surface);border:1px solid var(--border-strong);border-radius:20px;overflow:hidden}',
    '#authHead{padding:24px 24px 16px}#authTitle{margin:0;font-size:18px;font-weight:600;font-family:var(--font)}',
    '#authSub{margin:6px 0 0;color:var(--muted);font-size:13px;line-height:1.5;font-family:var(--font)}',
    '#authBody{padding:0 24px 20px}#authRow{display:flex;gap:8px}',
    '#authInput{flex:1;padding:11px 14px;border-radius:10px;border:1px solid var(--border-strong);font-size:14px;outline:none;background:var(--bg);color:var(--text);font-family:var(--font)}',
    '#authInput:focus{border-color:var(--text)}',
    '#authBtn{padding:11px 18px;border-radius:10px;border:none;background:var(--accent);color:var(--accent-fg);font-size:14px;font-weight:600;cursor:pointer;font-family:var(--font)}',
    '#authBtn:disabled{opacity:.5}#authErr{margin-top:10px;color:var(--danger);font-size:13px;display:none}',
    '#authFoot{padding:14px 24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}',
    '#authLink{color:var(--muted);text-decoration:none;font-size:13px;font-family:var(--font)}',
    '#authClose{color:var(--muted);background:transparent;border:0;cursor:pointer;font-size:13px;font-family:var(--font)}',
    '</style>',
    "<div id='authCard'><div id='authHead'><h3 id='authTitle'>Enter passphrase</h3>",
    "<div id='authSub'>This box is protected. Your passphrase will be saved on this device.</div></div>",
    "<div id='authBody'><div id='authRow'><input id='authInput' type='password' autocomplete='current-password' placeholder='Passphrase...'/>",
    "<button id='authBtn'>Unlock</button></div><div id='authErr'>Incorrect passphrase, please try again.</div></div>",
    "<div id='authFoot'><a id='authLink' href='../index.html'>Back to All Boxes</a><button id='authClose'>Close</button></div></div>"
  ].join("");
  document.body.appendChild(o);
  o.addEventListener("click",function(e){if(e.target===o)hideModal();});
  document.getElementById("authClose").addEventListener("click",hideModal);
}
function showModal(opts){
  var onSubmit=opts&&opts.onSubmit;ensureModal();
  var o=document.getElementById("authOverlay"),inp=document.getElementById("authInput"),
      btn=document.getElementById("authBtn"),err=document.getElementById("authErr");
  err.style.display="none";o.style.display="flex";inp.value="";
  setTimeout(function(){inp.focus();},50);
  function submit(){var tok=(inp.value||"").trim();if(!tok)return;btn.disabled=true;
    onSubmit(tok).then(function(){hideModal();}).catch(function(){err.style.display="block";btn.disabled=false;inp.select();});}
  btn.onclick=submit;inp.onkeydown=function(e){if(e.key==="Enter")submit();};
}
function hideModal(){var o=document.getElementById("authOverlay");if(o)o.style.display="none";}

var BOX_ID=null,KV_KEY=null,TOKEN=null,META={};
var noteText="";
var currentPath="";
var allFiles=[];
var boxFolders=[];
var boxTrash=[];
var draggedFile=null;

function $(id){return document.getElementById(id);}
function setStatus(t){var el=$("status");if(el)el.textContent=t;}
function fmtBytes(b){if(b==null)return"";var u=["B","KB","MB","GB","TB"],i=0,n=Number(b)||0;while(n>=1024&&i<u.length-1){n/=1024;i++;}return n.toFixed(i===0?0:1)+" "+u[i];}
function fmtDate(iso){if(!iso)return"";return new Date(iso).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"});}
function fileIcon(name){var ext=(name||"").split(".").pop().toLowerCase();var map={jpg:"🖼",jpeg:"🖼",png:"🖼",gif:"🖼",webp:"🖼",heic:"🖼",avif:"🖼",mp4:"🎬",mov:"🎬",m4v:"🎬",webm:"🎬",mp3:"🎵",m4a:"🎵",aac:"🎵",wav:"🎵",flac:"🎵",ogg:"🎵",pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",csv:"📊",zip:"🗜",rar:"🗜",gz:"🗜",json:"⚙",js:"⚙",html:"🌐",css:"🎨",txt:"📃"};return map[ext]||"📎";}
function isImageExt(ext){return["jpg","jpeg","png","gif","webp","avif","heic"].indexOf(ext)>=0;}
function isHeicExt(ext){return ext==="heic";}

var heicCache={};
function loadHeicUrl(url){
  if(heicCache[url])return Promise.resolve(heicCache[url]);
  return fetch(url).then(function(r){return r.blob();})
    .then(function(b){return window.heic2any({blob:b,toType:"image/jpeg",quality:0.75});})
    .then(function(c){var u=URL.createObjectURL(c);heicCache[url]=u;return u;});
}
function checkToken(k,t){return fetch(workerCheckUrl(k,t),{method:"GET",cache:"no-store"}).then(function(r){return r.status===200;});}

function loadMeta(){
  return fetch(mediaMetaGetUrl(BOX_ID,TOKEN),{cache:"no-store"})
    .then(function(r){return r.ok?r.json():{};}).then(function(d){META=d||{};}).catch(function(){META={};});
}
function saveMeta(){
  return fetch(mediaMetaPostUrl(BOX_ID,TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(META)})
    .then(function(){return updateSearchIndex();});
}
function loadNote(){
  var el=$("notesEditor");if(!el)return Promise.resolve();var st=$("notesStatus");
  return fetch(mediaNoteGetUrl(BOX_ID,TOKEN),{cache:"no-store"})
    .then(function(r){return r.ok?r.text():"";})
    .then(function(html){
      el.innerHTML=html||"";
      noteText=(el.innerText||el.textContent||"").trim();
      if(st)st.textContent=html?"Note loaded":"No note yet";
      if(typeof updateNotesPreview==="function")updateNotesPreview();
    }).catch(function(){if(st)st.textContent="Could not load note";});
}
function saveNote(){
  var el=$("notesEditor");if(!el)return Promise.resolve();
  var st=$("notesStatus"),btn=$("saveNoteBtn");
  if(btn)btn.disabled=true;if(st)st.textContent="Saving...";
  noteText=(el.innerText||el.textContent||"").trim();
  return fetch(mediaNotePostUrl(BOX_ID,TOKEN),{method:"POST",headers:{"Content-Type":"text/html;charset=utf-8"},body:el.innerHTML})
    .then(function(r){if(st)st.textContent=r.ok?"Saved":"Save failed";if(typeof updateNotesPreview==="function")updateNotesPreview();return updateSearchIndex();})
    .catch(function(){if(st)st.textContent="Save failed";}).then(function(){if(btn)btn.disabled=false;});
}

function updateSearchIndex(){
  return Promise.all([
    fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];}),
    fetch(mediaListUrl(BOX_ID,TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[]; })
  ]).then(function(results){
    var idx=results[0],fileList=results[1];
    if(!Array.isArray(idx))idx=[];
    if(!Array.isArray(fileList))fileList=[];
    var files=fileList.map(function(f){var m=META[f.name]||{};return{name:f.name,caption:m.caption||"",tags:m.tags||[]};});
    var existing=idx.find(function(e){return e.boxId===BOX_ID;});
    var entry=Object.assign({},existing||{},{boxId:BOX_ID,boxNote:noteText,files:files});
    var found=false;
    for(var i=0;i<idx.length;i++){if(idx[i].boxId===BOX_ID){idx[i]=entry;found=true;break;}}
    if(!found)idx.push(entry);
    return fetch(searchIndexPostUrl(TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(idx)});
  }).catch(function(e){console.warn("Search index update failed:",e);});
}

// ── Rename ──────────────────────────────────────────────────────────────────
var renamingFile=null;
function openRenameModal(name){
  renamingFile=name;$("renameOldName").textContent=name;
  // Show only the filename part — folder prefix is preserved automatically in doRename
  var filename=name.includes("/")?name.slice(name.lastIndexOf("/")+1):name;
  $("renameNewName").value=filename;
  $("renameModal").classList.remove("hidden");
  setTimeout(function(){var inp=$("renameNewName");inp.focus();inp.select();},50);
}
function closeRenameModal(){$("renameModal").classList.add("hidden");renamingFile=null;}
function doRename(){
  if(!renamingFile)return;
  var newName=($("renameNewName").value||"").trim();
  var folder=renamingFile.includes("/")?renamingFile.slice(0,renamingFile.lastIndexOf("/")+1):"";
  var toPath=folder+newName;
  if(!newName||toPath===renamingFile){closeRenameModal();return;};
  setStatus("Renaming...");
  fetch(mediaRenameUrl(BOX_ID,renamingFile,toPath,TOKEN),{method:"POST"})
    .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)throw new Error("rename_failed");})
    .then(function(){if(META[renamingFile]){META[toPath]=META[renamingFile];delete META[renamingFile];}return saveMeta();})
    .then(function(){return refreshList();})
    .then(function(){closeRenameModal();})
    .catch(handleErr);
}

// ── Box Info (UID + Links) ───────────────────────────────────────────────────
function loadBoxInfo(){
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var entry=idx.find(function(e){return e.boxId===BOX_ID;})||{};
      $("infoUid").value=entry.boxUid||"";
      renderLinkRows(Array.isArray(entry.boxLinks)?entry.boxLinks:[]);
      updateInfoPreview(entry.boxUid||"",Array.isArray(entry.boxLinks)?entry.boxLinks:[]);
    }).catch(function(e){console.warn("loadBoxInfo failed:",e);});
}
function saveBoxInfo(){
  var uid=($("infoUid").value||"").trim();
  var links=getLinkRows();
  var st=$("infoStatus");if(st)st.textContent="Saving...";
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var existing=idx.find(function(e){return e.boxId===BOX_ID;});
      var entry=Object.assign({},existing||{},{boxId:BOX_ID,boxUid:uid,boxLinks:links});
      var found=false;
      for(var i=0;i<idx.length;i++){if(idx[i].boxId===BOX_ID){idx[i]=entry;found=true;break;}}
      if(!found)idx.push(entry);
      return fetch(searchIndexPostUrl(TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(idx)});
    }).then(function(){updateInfoPreview(uid,links);if(st)st.textContent="Saved ✓";})
    .catch(function(e){if(st)st.textContent="Save failed";console.warn(e);});
}
function updateInfoPreview(uid,links){
  var p=$("infoPreview");if(!p)return;
  var parts=[];if(uid)parts.push(uid);if(links&&links.length)parts.push(links.length+" link"+(links.length===1?"":"s"));
  p.textContent=parts.length?parts.join(" · "):"UID, links…";
}
function renderLinkRows(links){var c=$("linkRows");if(!c)return;c.innerHTML="";(links||[]).forEach(function(lk){addLinkRow(lk.label||"",lk.url||"");});}
function addLinkRow(label,url){
  var c=$("linkRows");if(!c)return;
  var row=document.createElement("div");row.className="link-row";
  var labelIn=document.createElement("input");labelIn.type="text";labelIn.className="editInput link-label";labelIn.placeholder="Label";labelIn.value=label||"";
  var urlIn=document.createElement("input");urlIn.type="url";urlIn.className="editInput link-url";urlIn.placeholder="https://…";urlIn.value=url||"";
  var openBtn=document.createElement("button");openBtn.className="link-icon-btn";openBtn.type="button";openBtn.title="Open link";openBtn.textContent="↗";
  openBtn.onclick=function(){var v=(urlIn.value||"").trim();if(v){if(!/^https?:\/\//i.test(v))v="https://"+v;window.open(v,"_blank");}};
  var removeBtn=document.createElement("button");removeBtn.className="link-icon-btn danger";removeBtn.type="button";removeBtn.title="Remove";removeBtn.textContent="✕";
  removeBtn.onclick=function(){row.remove();};
  row.appendChild(labelIn);row.appendChild(urlIn);row.appendChild(openBtn);row.appendChild(removeBtn);
  c.appendChild(row);
}
function getLinkRows(){
  var c=$("linkRows");if(!c)return[];
  var result=[];
  c.querySelectorAll(".link-row").forEach(function(row){
    var url=((row.querySelector(".link-url")||{}).value||"").trim();
    var label=((row.querySelector(".link-label")||{}).value||"").trim();
    if(url)result.push({label:label,url:url});
  });
  return result;
}

// ── Folders ──────────────────────────────────────────────────────────────────
function getFolderList(){
  var set=new Set(boxFolders);
  allFiles.forEach(function(f){var idx=f.name.indexOf("/");if(idx>0)set.add(f.name.slice(0,idx));});
  return Array.from(set).sort();
}
function loadFolders(){
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var entry=idx.find(function(e){return e.boxId===BOX_ID;})||{};
      boxFolders=Array.isArray(entry.boxFolders)?entry.boxFolders:[];
      boxTrash=Array.isArray(entry.boxTrash)?entry.boxTrash:[];
      updateTrashBtn();
    }).catch(function(){boxFolders=[];boxTrash=[];});
}
function saveTrash(){
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var existing=idx.find(function(e){return e.boxId===BOX_ID;});
      var entry=Object.assign({},existing||{},{boxId:BOX_ID,boxTrash:boxTrash});
      var found=false;
      for(var i=0;i<idx.length;i++){if(idx[i].boxId===BOX_ID){idx[i]=entry;found=true;break;}}
      if(!found)idx.push(entry);
      return fetch(searchIndexPostUrl(TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(idx)});
    });
}
function updateTrashBtn(){
  var btn=$("trashBtn");if(!btn)return;
  var n=boxTrash.length;
  btn.textContent="Trash"+(n>0?" ("+n+")":"");
  btn.className="btn"+(n>0?" danger":"");
}
function openTrashModal(){renderTrashModal();$("trashModal").classList.remove("hidden");}
function closeTrashModal(){$("trashModal").classList.add("hidden");}
function renderTrashModal(){
  var body=$("trashBody"),sub=$("trashSubtitle");
  if(!body)return;
  body.innerHTML="";
  if(sub)sub.textContent=boxTrash.length+" item"+(boxTrash.length===1?"":"s");
  if(!boxTrash.length){
    var p=document.createElement("p");p.style.cssText="color:var(--muted);font-size:13px;text-align:center;padding:20px 0";
    p.textContent="Trash is empty";body.appendChild(p);return;
  }
  boxTrash.forEach(function(item,idx){
    var row=document.createElement("div");row.className="trash-item";
    var icon=document.createElement("div");icon.className="trash-icon";icon.textContent=fileIcon(item.name);
    var info=document.createElement("div");info.className="trash-info";
    var name=document.createElement("div");name.className="trash-name";name.textContent=item.name;
    var meta=document.createElement("div");meta.className="trash-meta";
    var from=item.originalPath.includes("/")?("from "+item.originalPath.slice(0,item.originalPath.lastIndexOf("/"))):"root";
    meta.textContent=from+" · "+fmtDate(item.deletedAt);
    info.appendChild(name);info.appendChild(meta);
    var btns=document.createElement("div");btns.className="trash-btns";
    var restoreBtn=document.createElement("button");restoreBtn.className="btn sm";restoreBtn.textContent="Restore";
    restoreBtn.onclick=(function(i){return function(){restoreTrashItem(i);};})(idx);
    var delBtn=document.createElement("button");delBtn.className="btn sm danger";delBtn.textContent="Delete";
    delBtn.onclick=(function(i){return function(){permanentDeleteTrashItem(i);};})(idx);
    btns.appendChild(restoreBtn);btns.appendChild(delBtn);
    row.appendChild(icon);row.appendChild(info);row.appendChild(btns);
    body.appendChild(row);
  });
}
function restoreTrashItem(idx){
  var item=boxTrash[idx];if(!item)return;
  fetch(mediaMoveUrl(BOX_ID,item.trashedPath,item.originalPath,TOKEN),{method:"POST"})
    .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)throw new Error("restore_failed");
      if(item.meta)META[item.originalPath]=item.meta;
      boxTrash.splice(idx,1);
      return saveTrash().then(function(){return saveMeta();});
    }).then(function(){return refreshList();})
    .then(function(){return updateSearchIndex();})
    .then(function(){updateTrashBtn();renderTrashModal();})
    .catch(handleErr);
}
function permanentDeleteTrashItem(idx){
  var item=boxTrash[idx];if(!item)return;
  if(!confirm("Permanently delete \""+item.name+"\"? This cannot be undone."))return;
  fetch(mediaDeleteOneUrl(BOX_ID,item.trashedPath,TOKEN),{method:"DELETE"})
    .then(function(r){if(r.status===401)throw new Error("unauthorized");
      boxTrash.splice(idx,1);return saveTrash();
    }).then(function(){updateTrashBtn();renderTrashModal();})
    .catch(handleErr);
}
function emptyTrash(){
  if(!boxTrash.length)return;
  if(!confirm("Permanently delete all "+boxTrash.length+" item(s) in trash? This cannot be undone."))return;
  fetch(mediaDeleteFolderUrl(BOX_ID,"_trash",TOKEN),{method:"DELETE"})
    .then(function(r){if(r.status===401)throw new Error("unauthorized");
      boxTrash=[];return saveTrash();
    }).then(function(){updateTrashBtn();renderTrashModal();})
    .catch(handleErr);
}
function saveFolders(){
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"}).then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var existing=idx.find(function(e){return e.boxId===BOX_ID;});
      var entry=Object.assign({},existing||{},{boxId:BOX_ID,boxFolders:boxFolders});
      var found=false;
      for(var i=0;i<idx.length;i++){if(idx[i].boxId===BOX_ID){idx[i]=entry;found=true;break;}}
      if(!found)idx.push(entry);
      return fetch(searchIndexPostUrl(TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(idx)});
    });
}

function navigateToFolder(name){currentPath=name+"/";updateFolderNav();renderCurrentPath();}
function navigateUp(){currentPath="";updateFolderNav();renderCurrentPath();}
function updateFolderNav(){
  var nav=$("folderNav"),nameEl=$("folderNavName");if(!nav)return;
  if(currentPath){nav.classList.remove("hidden");if(nameEl)nameEl.textContent=currentPath.replace(/\/$/,"");}
  else{nav.classList.add("hidden");}
}

function openNewFolderModal(){
  $("newFolderName").value="";$("newFolderModal").classList.remove("hidden");
  setTimeout(function(){$("newFolderName").focus();},50);
}
function closeNewFolderModal(){$("newFolderModal").classList.add("hidden");}
function doCreateFolder(){
  var name=($("newFolderName").value||"").trim().replace(/[/\\]/g,"").slice(0,60);
  if(!name){closeNewFolderModal();return;}
  if(getFolderList().indexOf(name)>=0){alert("Folder '"+name+"' already exists.");return;}
  boxFolders.push(name);
  saveFolders().then(function(){renderCurrentPath();closeNewFolderModal();}).catch(handleErr);
}
function openRenameFolderModal(name){
  $("renameFolderOldName").textContent=name;
  $("renameFolderInput").value=name;
  $("renameFolderModal").classList.remove("hidden");
  setTimeout(function(){var inp=$("renameFolderInput");inp.focus();inp.select();},50);
  $("renameFolderModal")._folderName=name;
}
function closeRenameFolderModal(){$("renameFolderModal").classList.add("hidden");}
function doRenameFolder(){
  var modal=$("renameFolderModal");
  var oldName=modal._folderName;
  var newName=($("renameFolderInput").value||"").trim().replace(/[/\\]/g,"").slice(0,60);
  if(!newName||newName===oldName){closeRenameFolderModal();return;}
  if(getFolderList().indexOf(newName)>=0){alert("A folder named '"+newName+"' already exists.");return;}
  var filesToMove=allFiles.filter(function(f){return f.name.startsWith(oldName+"/");});
  setStatus("Renaming folder…");closeRenameFolderModal();
  var chain=Promise.resolve();
  filesToMove.forEach(function(f){
    chain=chain.then(function(){
      var filename=f.name.slice(oldName.length+1);
      var toPath=newName+"/"+filename;
      return fetch(mediaMoveUrl(BOX_ID,f.name,toPath,TOKEN),{method:"POST"})
        .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)throw new Error("move_failed");
          if(META[f.name]){META[toPath]=META[f.name];delete META[f.name];}
        });
    });
  });
  chain.then(function(){
    boxFolders=boxFolders.map(function(f){return f===oldName?newName:f;});
    return saveFolders().then(function(){return saveMeta();});
  }).then(function(){return refreshList();})
    .then(function(){return updateSearchIndex();})
    .catch(handleErr);
}

function doDeleteFolder(name,count){
  if(count===0){
    if(!confirm("Delete empty folder '"+name+"'?"))return;
    boxFolders=boxFolders.filter(function(f){return f!==name;});
    saveFolders().then(function(){renderCurrentPath();}).catch(handleErr);
    return;
  }
  if(!confirm("Move '"+name+"' and all "+count+" file"+(count===1?"":"s")+" inside to trash?"))return;
  setStatus("Moving to trash...");
  var filesToTrash=allFiles.filter(function(f){return f.name.startsWith(name+"/");});
  softDeleteFiles(filesToTrash.map(function(f){return f.name;}),function(){
    boxFolders=boxFolders.filter(function(f){return f!==name;});
    saveFolders().catch(handleErr);
  }).catch(handleErr);
}

function openMoveModal(){
  var names=Object.keys(selectedFiles);if(!names.length)return;
  var folders=getFolderList();
  $("moveSubtitle").textContent="Moving "+names.length+" file"+(names.length===1?"":"s");
  var body=$("moveBody");body.innerHTML="";
  function makeOpt(label,dest){
    var btn=document.createElement("button");btn.className="move-opt-btn";btn.type="button";btn.textContent=label;
    var allThere=names.every(function(n){return dest===""?n.indexOf("/")<0:n.startsWith(dest+"/");});
    if(allThere){btn.disabled=true;btn.style.opacity="0.4";}
    btn.onclick=function(){closeMoveModal();moveFiles(names,dest).catch(handleErr);};
    return btn;
  }
  body.appendChild(makeOpt("📦 Root (no folder)",""));
  folders.forEach(function(f){body.appendChild(makeOpt("📁 "+f,f));});
  if(!folders.length){var p=document.createElement("p");p.style.cssText="color:var(--muted);font-size:13px;margin:8px 0";p.textContent="No folders yet. Create a folder first.";body.appendChild(p);}
  $("moveModal").classList.remove("hidden");
}
function closeMoveModal(){$("moveModal").classList.add("hidden");}
function moveFiles(names,toFolder){
  setStatus("Moving...");
  var chain=Promise.resolve();
  names.forEach(function(name){
    chain=chain.then(function(){
      var parts=name.split("/");var filename=parts[parts.length-1];
      var toPath=toFolder?toFolder+"/"+filename:filename;
      if(toPath===name)return Promise.resolve();
      return fetch(mediaMoveUrl(BOX_ID,name,toPath,TOKEN),{method:"POST"})
        .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)throw new Error("move_failed");
          if(META[name]){META[toPath]=META[name];delete META[name];}
        });
    });
  });
  return chain.then(function(){clearSelection();return saveMeta();})
    .then(function(){return refreshList();}).then(function(){return updateSearchIndex();});
}

// ── Context menu ─────────────────────────────────────────────────────────────
var activeCtxMenu=null;
function closeCtxMenu(){if(activeCtxMenu){activeCtxMenu.remove();activeCtxMenu=null;}}
document.addEventListener("click",closeCtxMenu);
document.addEventListener("keydown",function(e){
  if(e.key==="Escape"){closeCtxMenu();closeEditModal();closeRenameModal();closeNewFolderModal();closeMoveModal();closeRenameFolderModal();closeTrashModal();}
});
function showCtxMenu(e,items){
  e.stopPropagation();closeCtxMenu();
  var menu=document.createElement("div");menu.className="ctxMenu";
  items.forEach(function(item){
    if(item==="divider"){var d=document.createElement("div");d.className="ctxDivider";menu.appendChild(d);}
    else{var el=document.createElement("div");el.className="ctxItem"+(item.danger?" danger":"");el.textContent=item.label;
      el.onclick=function(ev){ev.stopPropagation();closeCtxMenu();item.action();};menu.appendChild(el);}
  });
  document.body.appendChild(menu);activeCtxMenu=menu;
  var pw=180,ph=menu.offsetHeight||120,vw=window.innerWidth,vh=window.innerHeight;
  var left=e.clientX,top=e.clientY;
  if(left+pw>vw)left=vw-pw-8;if(top+ph>vh)top=vh-ph-8;
  menu.style.left=left+"px";menu.style.top=top+"px";
}

// ── Edit file info modal ──────────────────────────────────────────────────────
var editingFile=null;
function openEditModal(name){
  editingFile=name;var m=META[name]||{caption:"",tags:[]};
  $("editFilename").textContent=name;
  $("editCaption").value=m.caption||"";
  $("editTags").value=(m.tags||[]).join(", ");
  $("editModal").classList.remove("hidden");$("editCaption").focus();
}
function closeEditModal(){$("editModal").classList.add("hidden");editingFile=null;}
function saveEditModal(){
  if(!editingFile)return;
  META[editingFile]={caption:$("editCaption").value.trim(),tags:$("editTags").value.split(",").map(function(t){return t.trim();}).filter(Boolean)};
  saveMeta().then(function(){renderFileRow(editingFile);closeEditModal();}).catch(handleErr);
}

function openBulkTagModal(){$("bulkTagInput").value="";$("bulkTagModal").classList.remove("hidden");$("bulkTagInput").focus();}
function closeBulkTagModal(){$("bulkTagModal").classList.add("hidden");}
function saveBulkTags(){
  var newTags=$("bulkTagInput").value.split(",").map(function(t){return t.trim();}).filter(Boolean);
  if(!newTags.length){closeBulkTagModal();return;}
  Object.keys(selectedFiles).forEach(function(name){
    var m=META[name]||(META[name]={caption:"",tags:[]});
    newTags.forEach(function(tag){if(m.tags.indexOf(tag)<0)m.tags.push(tag);});
  });
  saveMeta().then(function(){Object.keys(selectedFiles).forEach(function(name){renderFileRow(name);});closeBulkTagModal();}).catch(handleErr);
}

// ── Selection ─────────────────────────────────────────────────────────────────
var selectedFiles={};
function updateActionBar(){
  var keys=Object.keys(selectedFiles);
  var bar=$("actionBar"),count=$("actionCount"),sc=$("selectCount");
  if(keys.length>0){count.textContent=keys.length+" selected";bar.classList.add("visible");}
  else{bar.classList.remove("visible");}
  if(sc)sc.textContent=keys.length+" selected";
}
function clearSelection(){
  selectedFiles={};
  document.querySelectorAll(".fileCheck").forEach(function(cb){cb.checked=false;});
  document.querySelectorAll(".fileRow").forEach(function(r){r.classList.remove("selected");});
  updateActionBar();
}
function selectAll(){
  document.querySelectorAll(".fileRow:not(.hidden):not([data-type='folder']) .fileCheck").forEach(function(cb){
    cb.checked=true;var row=cb.closest(".fileRow");if(row&&row.dataset.type!=="folder"){row.classList.add("selected");selectedFiles[row.dataset.name]=true;}
  });updateActionBar();
}

// ── Sort ──────────────────────────────────────────────────────────────────────
var sortField=localStorage.getItem("boxSortField")||"name";
var sortDir=localStorage.getItem("boxSortDir")||"asc";
function applySortToArray(arr){
  arr.sort(function(a,b){
    var av,bv;
    if(sortField==="size"){av=a.size||0;bv=b.size||0;return sortDir==="asc"?av-bv:bv-av;}
    if(sortField==="date"){av=a.lastModified||"";bv=b.lastModified||"";return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);}
    av=(a.name||"").toLowerCase();bv=(b.name||"").toLowerCase();
    return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);
  });
}
function setSortField(f){sortField=f;localStorage.setItem("boxSortField",f);updateSortUI();refreshList().catch(handleErr);}
function toggleSortDir(){sortDir=sortDir==="asc"?"desc":"asc";localStorage.setItem("boxSortDir",sortDir);updateSortUI();refreshList().catch(handleErr);}
function updateSortUI(){var sel=$("sortSelect");if(sel)sel.value=sortField;var btn=$("sortDirBtn");if(btn)btn.textContent=sortDir==="asc"?"▲":"▼";}

// ── Search ────────────────────────────────────────────────────────────────────
var searchTerm="";
function applySearch(){renderCurrentPath();}

// ── Thumbnails ────────────────────────────────────────────────────────────────
function makeThumb(name,ext,fileUrl){
  var wrap=document.createElement("div");wrap.className="fileThumb";
  if(isImageExt(ext)){
    wrap.classList.add("clickable");
    if(isHeicExt(ext)){
      var sp=document.createElement("div");sp.className="heic-loading";sp.textContent="HEIC...";wrap.appendChild(sp);
      loadHeicUrl(fileUrl).then(function(url){
        wrap.innerHTML="";
        var img=document.createElement("img");img.src=url;img.alt=name;img.className="thumb-img";wrap.appendChild(img);
        if(window.matchMedia("(hover:hover)").matches){var popup=makePopup(url);wrap.appendChild(popup);attachPopupFollow(wrap,popup);}
        wrap.onclick=function(e){e.stopPropagation();window.open(url,"_blank");};
      }).catch(function(){wrap.innerHTML="🖼";});
    }else{
      var img=document.createElement("img");img.src=fileUrl;img.alt=name;img.className="thumb-img";img.loading="lazy";wrap.appendChild(img);
      if(window.matchMedia("(hover:hover)").matches){var popup=makePopup(fileUrl);wrap.appendChild(popup);attachPopupFollow(wrap,popup);}
      wrap.onclick=function(e){e.stopPropagation();window.open(fileUrl,"_blank");};
    }
  }else{wrap.textContent=fileIcon(name);}
  return wrap;
}
function makePopup(imgUrl){var p=document.createElement("div");p.className="thumbPopup";var pi=document.createElement("img");pi.src=imgUrl;pi.alt="";p.appendChild(pi);return p;}
function attachPopupFollow(wrap,popup){
  wrap.addEventListener("mousemove",function(e){
    var pw=300,ph=300,vw=window.innerWidth,vh=window.innerHeight;
    var left=e.clientX+20,top=e.clientY-ph/2;
    if(left+pw>vw)left=e.clientX-pw-20;if(top<8)top=8;if(top+ph>vh-8)top=vh-ph-8;
    popup.style.left=left+"px";popup.style.top=top+"px";popup.style.transform="none";
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderFileRow(name){
  var existing=document.querySelector('.fileRow[data-name="'+CSS.escape(name)+'"]');if(!existing)return;
  var m=META[name]||{caption:"",tags:[]};
  var captionEl=existing.querySelector(".fileCaption");if(captionEl)captionEl.textContent=m.caption||"";
  var tagsEl=existing.querySelector(".fileTags");
  if(tagsEl){tagsEl.innerHTML="";(m.tags||[]).forEach(function(tag){var s=document.createElement("span");s.className="fileTag";s.textContent=tag;tagsEl.appendChild(s);});}
}

function renderCurrentPath(){
  var el=$("files");el.innerHTML="";$("empty").style.display="none";
  selectedFiles={};updateActionBar();

  var term=searchTerm.toLowerCase().trim();
  if(term){
    // Search mode: flat list across all folders
    var matches=allFiles.filter(function(f){
      var m=META[f.name]||{};
      return f.name.toLowerCase().includes(term)||
        (m.caption||"").toLowerCase().includes(term)||
        (m.tags||[]).join(" ").toLowerCase().includes(term)||
        noteText.toLowerCase().includes(term);
    });
    if(!matches.length){$("empty").style.display="block";setStatus("No results.");return;}
    setStatus(matches.length+" result"+(matches.length===1?"":"s"));
    var sorted=matches.slice();applySortToArray(sorted);
    sorted.forEach(function(f){el.appendChild(makeFileRowEl(f,true));});
    return;
  }

  // Normal navigation mode
  var filesHere;
  if(currentPath===""){
    filesHere=allFiles.filter(function(f){return f.name.indexOf("/")<0;});
  }else{
    filesHere=allFiles.filter(function(f){
      if(!f.name.startsWith(currentPath))return false;
      var rest=f.name.slice(currentPath.length);
      return rest.length>0&&rest.indexOf("/")<0;
    });
  }
  var foldersHere=currentPath===""?getFolderList():[];

  if(!foldersHere.length&&!filesHere.length){
    $("empty").style.display="block";
    setStatus(currentPath?"Folder is empty.":"No files in this box.");
    return;
  }
  setStatus(filesHere.length+" file"+(filesHere.length===1?"":"s")+(currentPath?" in this folder":""));

  foldersHere.forEach(function(name){
    var count=allFiles.filter(function(f){return f.name.startsWith(name+"/");}).length;
    el.appendChild(makeFolderRowEl(name,count));
  });
  var sorted=filesHere.slice();applySortToArray(sorted);
  sorted.forEach(function(f){el.appendChild(makeFileRowEl(f,false));});
}

function makeFolderRowEl(name,count){
  var row=document.createElement("div");row.className="fileRow folder-row";row.dataset.name=name;row.dataset.type="folder";

  var cbWrap=document.createElement("label");cbWrap.className="fileCheckWrap";
  var cb=document.createElement("input");cb.type="checkbox";cb.className="fileCheck";
  cb.addEventListener("change",function(){cb.checked=false;});
  cbWrap.appendChild(cb);

  var thumb=document.createElement("div");thumb.className="fileThumb";thumb.style.fontSize="22px";thumb.textContent="📁";

  var mainDiv=document.createElement("div");mainDiv.className="fileMain";
  mainDiv.onclick=function(e){if(e.target.closest(".fileCheckWrap"))return;navigateToFolder(name);};
  var nameDiv=document.createElement("div");nameDiv.className="fileName";nameDiv.textContent=name;
  var metaDiv=document.createElement("div");metaDiv.className="fileMeta";
  metaDiv.textContent=count+" item"+(count===1?"":"s");
  mainDiv.appendChild(nameDiv);mainDiv.appendChild(metaDiv);

  var menuBtn=document.createElement("button");menuBtn.className="menuBtn";menuBtn.textContent="⋯";menuBtn.title="More";
  menuBtn.onclick=function(e){
    showCtxMenu(e,[
      {label:"Rename folder",action:function(){openRenameFolderModal(name);}},
      "divider",
      {label:"Delete folder",danger:true,action:function(){doDeleteFolder(name,count);}}
    ]);
  };

  // Drop target for dragging files into this folder
  row.addEventListener("dragover",function(e){e.preventDefault();e.stopPropagation();row.classList.add("drag-over");});
  row.addEventListener("dragleave",function(e){if(!row.contains(e.relatedTarget))row.classList.remove("drag-over");});
  row.addEventListener("drop",function(e){
    e.preventDefault();e.stopPropagation();row.classList.remove("drag-over");
    if(draggedFile){moveFiles([draggedFile],name).catch(handleErr);draggedFile=null;}
  });

  row.appendChild(cbWrap);row.appendChild(thumb);row.appendChild(mainDiv);row.appendChild(menuBtn);
  return row;
}

function makeFileRowEl(it,showPath){
  var name=it.name||"",ext=name.split(".").pop().toLowerCase();
  var displayName=showPath?name:name.split("/").pop();
  var fileUrl=mediaFileUrl(BOX_ID,name,TOKEN);
  var m=META[name]||{caption:"",tags:[]};
  var row=document.createElement("div");row.className="fileRow";row.dataset.name=name;

  // Drag source for moving to folders
  row.draggable=true;
  row.addEventListener("dragstart",function(e){draggedFile=name;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",name);});
  row.addEventListener("dragend",function(){draggedFile=null;});

  var cbWrap=document.createElement("label");cbWrap.className="fileCheckWrap";cbWrap.title="Select";
  cbWrap.addEventListener("click",function(e){e.stopPropagation();});
  var cb=document.createElement("input");cb.type="checkbox";cb.className="fileCheck";
  cb.addEventListener("change",function(){
    if(cb.checked){selectedFiles[name]=true;row.classList.add("selected");}
    else{delete selectedFiles[name];row.classList.remove("selected");}
    updateActionBar();
  });
  cbWrap.appendChild(cb);

  var thumb=makeThumb(name,ext,fileUrl);

  var mainDiv=document.createElement("div");mainDiv.className="fileMain";mainDiv.style.cursor="pointer";
  mainDiv.onclick=function(e){if(e.target.closest(".fileCheckWrap"))return;window.open(fileUrl,"_blank");};
  var nameDiv=document.createElement("div");nameDiv.className="fileName";nameDiv.textContent=displayName;
  var metaDiv=document.createElement("div");metaDiv.className="fileMeta";
  metaDiv.textContent=fmtBytes(it.size)+(it.lastModified?" · "+fmtDate(it.lastModified):"");
  var captionDiv=document.createElement("div");captionDiv.className="fileCaption";captionDiv.textContent=m.caption||"";
  var tagsDiv=document.createElement("div");tagsDiv.className="fileTags";
  (m.tags||[]).forEach(function(tag){var s=document.createElement("span");s.className="fileTag";s.textContent=tag;tagsDiv.appendChild(s);});
  mainDiv.appendChild(nameDiv);mainDiv.appendChild(metaDiv);mainDiv.appendChild(captionDiv);mainDiv.appendChild(tagsDiv);

  var menuBtn=document.createElement("button");menuBtn.className="menuBtn";menuBtn.textContent="⋯";menuBtn.title="More";
  menuBtn.onclick=function(e){
    var items=[
      {label:"Open file",action:function(){window.open(fileUrl,"_blank");}},
      {label:"Edit info",action:function(){openEditModal(name);}},
      {label:"Rename",action:function(){openRenameModal(name);}}
    ];
    if(getFolderList().length){
      items.push({label:"Move to…",action:function(){clearSelection();selectedFiles[name]=true;updateActionBar();openMoveModal();}});
    }
    items.push("divider");
    items.push({label:"Delete",danger:true,action:function(){deleteFile(name);}});
    showCtxMenu(e,items);
  };

  row.appendChild(cbWrap);row.appendChild(thumb);row.appendChild(mainDiv);row.appendChild(menuBtn);
  return row;
}

// ── File operations ───────────────────────────────────────────────────────────
function refreshList(){
  setStatus("Loading files...");
  return fetch(mediaListUrl(BOX_ID,TOKEN),{cache:"no-store"})
    .then(function(res){if(res.status===401)throw new Error("unauthorized");if(!res.ok)throw new Error("list_failed");return res.json();})
    .then(function(arr){
      allFiles=Array.isArray(arr)?arr:[];
      renderCurrentPath();
      var st=$("selectToolbar");if(st)st.classList.remove("hidden");
    });
}

function softDeleteFiles(names,onDone){
  var newItems=[];
  var chain=Promise.resolve();
  names.forEach(function(name){
    chain=chain.then(function(){
      var trashPath="_trash/"+name;
      return fetch(mediaMoveUrl(BOX_ID,name,trashPath,TOKEN),{method:"POST"})
        .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)throw new Error("trash_failed");
          var m=META[name]||{};
          newItems.push({name:name.split("/").pop(),trashedPath:trashPath,originalPath:name,deletedAt:new Date().toISOString(),meta:{caption:m.caption||"",tags:m.tags||[]}});
          delete META[name];
        });
    });
  });
  return chain.then(function(){
    boxTrash=boxTrash.concat(newItems);
    return saveTrash().then(function(){return saveMeta();});
  }).then(function(){return refreshList();})
    .then(function(){return updateSearchIndex();})
    .then(function(){updateTrashBtn();if(onDone)onDone();});
}
function deleteFile(name){
  if(!confirm("Move \""+name+"\" to trash?"))return;
  setStatus("Moving to trash...");
  softDeleteFiles([name]).catch(handleErr);
}
function deleteSelected(){
  var names=Object.keys(selectedFiles);if(!names.length)return;
  if(!confirm("Move "+names.length+" file(s) to trash?"))return;
  $("actionBar").classList.remove("visible");setStatus("Moving to trash...");
  softDeleteFiles(names).catch(handleErr);
}

function uploadFiles(files){
  if(!files||files.length===0)return Promise.resolve();
  var maxBytes=95*1024*1024,tooBig=null;
  Array.prototype.forEach.call(files,function(f){if(f&&f.size>maxBytes&&!tooBig)tooBig=f;});
  if(tooBig){alert("File too large: "+tooBig.name+" — max 95 MB");return Promise.resolve();}
  var progHost=$("uploadProgress");progHost.innerHTML="";progHost.style.display="block";
  var items=Array.prototype.map.call(files,function(f){
    var row=document.createElement("div");row.className="progRow";
    row.innerHTML="<div class='progHeader'><div class='progName'>"+f.name+"</div><div class='progMeta'>"+fmtBytes(f.size)+"</div></div><div class='progBar'><div class='progFill'></div></div><div class='progPct'>0%</div>";
    progHost.appendChild(row);return{f:f,fill:row.querySelector(".progFill"),pct:row.querySelector(".progPct")};
  });
  // Upload into the currently open folder (strip trailing slash for query param)
  var folder=currentPath?currentPath.replace(/\/$/,""):"";
  setStatus("Uploading "+items.length+" file(s)...");$("uploadBtn").disabled=true;$("fileIn").disabled=true;
  var chain=Promise.resolve();
  items.forEach(function(it){chain=chain.then(function(){return new Promise(function(resolve,reject){
    var fd=new FormData();fd.append("files",it.f,it.f.name);
    var xhr=new XMLHttpRequest();xhr.open("POST",mediaUploadUrl(BOX_ID,TOKEN,folder),true);
    xhr.upload.onprogress=function(e){if(e.lengthComputable){var p=Math.round(e.loaded/e.total*100);it.fill.style.width=p+"%";it.pct.textContent=p+"%";}};
    xhr.onload=function(){if(xhr.status===401){reject(new Error("unauthorized"));return;}if(xhr.status>=200&&xhr.status<300){it.fill.style.width="100%";it.pct.textContent="100%";resolve();}else{alert("Upload failed: "+it.f.name);resolve();}};
    xhr.onerror=function(){alert("Network error: "+it.f.name);resolve();};xhr.send(fd);
  });});});
  return chain.then(function(){$("uploadBtn").disabled=false;$("fileIn").disabled=false;$("fileIn").value="";return refreshList();})
    .then(function(){
      setTimeout(function(){progHost.style.display="none";},800);
      return updateSearchIndex().then(function(){setStatus("Upload complete · search index updated ✓");});
    });
}

function wireDropzone(){
  var dz=$("dropzone");if(!dz)return;
  function prevent(e){e.preventDefault();e.stopPropagation();}
  ["dragenter","dragover","dragleave","drop"].forEach(function(ev){dz.addEventListener(ev,prevent,false);document.body.addEventListener(ev,prevent,false);});
  dz.addEventListener("dragenter",function(){dz.classList.add("hover");});
  dz.addEventListener("dragover",function(){dz.classList.add("hover");});
  dz.addEventListener("dragleave",function(){dz.classList.remove("hover");});
  dz.addEventListener("drop",function(e){dz.classList.remove("hover");var f=e.dataTransfer&&e.dataTransfer.files;if(f&&f.length)uploadFiles(f).catch(handleErr);});
}

function wireButtons(){
  $("logoutBtn").onclick=function(){clearToken();alert("Signed out.");location.reload();};
  var snb=$("saveNoteBtn");if(snb)snb.onclick=function(){saveNote().catch(handleErr);};
  $("refreshBtn").onclick=function(){refreshList().catch(handleErr);};
  $("fileIn").onchange=function(e){var f=e.target.files;if(f&&f.length)uploadFiles(f).catch(handleErr);};
  $("uploadBtn").onclick=function(){$("fileIn").click();};
  $("clearBtn").onclick=function(){
    if(!confirm("Delete ALL files in this box?"))return;setStatus("Clearing...");
    fetch(mediaClearUrl(BOX_ID,TOKEN),{method:"DELETE"})
      .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)alert("Clear failed.");return refreshList();})
      .then(function(){return updateSearchIndex();}).catch(handleErr);
  };
  $("actionDelete").onclick=function(){deleteSelected();};
  $("actionCancel").onclick=function(){clearSelection();};
  $("actionTag").onclick=function(){if(Object.keys(selectedFiles).length>0)openBulkTagModal();};
  var amv=$("actionMove");if(amv)amv.onclick=function(){openMoveModal();};
  var sab=$("selectAllBtn");if(sab)sab.onclick=function(){selectAll();};
  var dab=$("deselectAllBtn");if(dab)dab.onclick=function(){clearSelection();};
  $("editCancel").onclick=function(){closeEditModal();};
  $("editSave").onclick=function(){saveEditModal();};
  $("editModal").addEventListener("click",function(e){if(e.target===$("editModal"))closeEditModal();});
  $("bulkTagCancel").onclick=function(){closeBulkTagModal();};
  $("bulkTagSave").onclick=function(){saveBulkTags();};
  $("bulkTagModal").addEventListener("click",function(e){if(e.target===$("bulkTagModal"))closeBulkTagModal();});
  $("renameCancel").onclick=function(){closeRenameModal();};
  $("renameSave").onclick=function(){doRename();};
  $("renameModal").addEventListener("click",function(e){if(e.target===$("renameModal"))closeRenameModal();});
  var rni=$("renameNewName");if(rni)rni.addEventListener("keydown",function(e){if(e.key==="Enter")doRename();});
  var saib=$("saveInfoBtn");if(saib)saib.onclick=function(){saveBoxInfo().catch(handleErr);};
  var alb=$("addLinkBtn");if(alb)alb.onclick=function(){addLinkRow("","");};
  var ss=$("sortSelect");if(ss)ss.onchange=function(){setSortField(this.value);};
  var sdb=$("sortDirBtn");if(sdb)sdb.onclick=function(){toggleSortDir();};
  updateSortUI();
  var si=$("searchInput");if(si){si.addEventListener("input",function(){searchTerm=si.value;applySearch();});}
  var nfb=$("newFolderBtn");if(nfb)nfb.onclick=function(){openNewFolderModal();};
  var tb=$("trashBtn");if(tb)tb.onclick=function(){openTrashModal();};
  $("emptyTrashBtn").onclick=function(){emptyTrash();};
  $("trashClose").onclick=function(){closeTrashModal();};
  $("trashModal").addEventListener("click",function(e){if(e.target===$("trashModal"))closeTrashModal();});
  $("newFolderCancel").onclick=function(){closeNewFolderModal();};
  $("newFolderSave").onclick=function(){doCreateFolder();};
  $("newFolderModal").addEventListener("click",function(e){if(e.target===$("newFolderModal"))closeNewFolderModal();});
  var nfn=$("newFolderName");if(nfn)nfn.addEventListener("keydown",function(e){if(e.key==="Enter")doCreateFolder();});
  $("moveCancel").onclick=function(){closeMoveModal();};
  $("moveModal").addEventListener("click",function(e){if(e.target===$("moveModal"))closeMoveModal();});
  $("renameFolderCancel").onclick=function(){closeRenameFolderModal();};
  $("renameFolderSave").onclick=function(){doRenameFolder();};
  $("renameFolderModal").addEventListener("click",function(e){if(e.target===$("renameFolderModal"))closeRenameFolderModal();});
  var rfi=$("renameFolderInput");if(rfi)rfi.addEventListener("keydown",function(e){if(e.key==="Enter")doRenameFolder();});
  var fnb=$("folderNavBack");if(fnb)fnb.onclick=function(){navigateUp();};
}

function handleErr(e){
  var msg=(e&&e.message)?e.message:String(e||"");
  if(msg==="unauthorized"){clearToken();alert("Session expired.");location.reload();return;}
  console.error(e);setStatus("Error: "+msg);
}

function main(){
  BOX_ID=getBoxIdFromUrl();
  if(!BOX_ID){var h=document.querySelector("h1");if(h)h.textContent="Box not found";setStatus("No box ID. Use ?id=01");return;}
  $("boxTitle").textContent="BOX-"+BOX_ID;
  var bc=$("breadcrumbCurrent");if(bc)bc.textContent="BOX-"+BOX_ID;
  document.title="BOX-"+BOX_ID;

  loadBoxesJson().then(function(data){
    var boxes=Array.isArray(data.boxes)?data.boxes:[];
    var row=null;boxes.forEach(function(b){if(String(b.id||"").padStart(2,"0")===BOX_ID)row=b;});
    KV_KEY=row&&typeof row.key==="string"?row.key.trim():"";
    var tags=(row&&Array.isArray(row.tags))?row.tags:[];
    $("boxtags").innerHTML="";
    tags.filter(Boolean).forEach(function(t){var s=document.createElement("span");s.className="boxtag";s.textContent=String(t);$("boxtags").appendChild(s);});
    wireButtons();wireDropzone();
    var saved=getSavedToken();
    return checkToken(KV_KEY||"dummy",saved||"x").then(function(ok){
      if(ok&&saved){
        TOKEN=saved;$("authPill").textContent="Authenticated";$("authPill").className="pill ok";
        return Promise.all([loadMeta().then(function(){return refreshList();}),loadNote(),loadBoxInfo(),loadFolders()]);
      }else{
        if(saved)clearToken();
        return new Promise(function(resolve){
          showModal({onSubmit:function(tok){
            return checkToken(KV_KEY||"dummy",tok).then(function(ok2){
              if(!ok2)throw new Error("unauthorized");
              saveToken(tok);TOKEN=tok;$("authPill").textContent="Authenticated";$("authPill").className="pill ok";
              resolve();return Promise.all([loadMeta().then(function(){return refreshList();}),loadNote(),loadBoxInfo(),loadFolders()]);
            });
          }});
        });
      }
    });
  }).catch(function(e){setStatus("Error: "+(e&&e.message?e.message:String(e)));console.error(e);});
}

main();
