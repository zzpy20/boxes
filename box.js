// box.js v13 - bigger checkbox, multiline caption, search index
const WORKER_BASE = "https://box-redirect.ausz.workers.dev/";
const TOKEN_STORAGE_KEY = "boxes_auth_token";
const TOKEN_PARAM = "t";

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
function mediaUploadUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id+"/upload");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaClearUrl(id,t){var u=new URL(baseUrl()+"media/box-"+id);u.searchParams.set("all","1");u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaDeleteOneUrl(id,name,t){var u=new URL(baseUrl()+"media/box-"+id+"/file");u.searchParams.set("name",name);u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
function mediaFileUrl(id,name,t){var u=new URL(baseUrl()+"media/box-"+id+"/"+encodeURIComponent(name));u.searchParams.set(TOKEN_PARAM,t);return u.toString();}
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
    .then(function(html){el.innerHTML=html||"";noteText=(el.innerText||el.textContent||"").trim();if(st)st.textContent=html?"Note loaded":"No note yet";if(typeof updateNotesPreview==="function")updateNotesPreview();})
    .catch(function(){if($("notesStatus"))$("notesStatus").textContent="Could not load note";});
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

function buildIndexEntry(){
  var files=[];Object.keys(META).forEach(function(name){var m=META[name]||{};files.push({name:name,caption:m.caption||"",tags:m.tags||[]});});
  return{boxId:BOX_ID,boxNote:noteText,files:files};
}
function updateSearchIndex(){
  return fetch(searchIndexGetUrl(TOKEN),{cache:"no-store"})
    .then(function(r){return r.ok?r.json():[];})
    .then(function(idx){
      if(!Array.isArray(idx))idx=[];
      var found=false;
      for(var i=0;i<idx.length;i++){if(idx[i].boxId===BOX_ID){idx[i]=buildIndexEntry();found=true;break;}}
      if(!found)idx.push(buildIndexEntry());
      return fetch(searchIndexPostUrl(TOKEN),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(idx)});
    }).catch(function(e){console.warn("Search index update failed:",e);});
}

var activeCtxMenu=null;
function closeCtxMenu(){if(activeCtxMenu){activeCtxMenu.remove();activeCtxMenu=null;}}
document.addEventListener("click",closeCtxMenu);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){closeCtxMenu();closeEditModal();}});
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

var editingFile=null;
function openEditModal(name){
  editingFile=name;var m=META[name]||{caption:"",tags:[]};
  $("editFilename").textContent=name;$("editCaption").value=m.caption||"";$("editTags").value=(m.tags||[]).join(", ");
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
  document.querySelectorAll(".fileRow:not(.hidden) .fileCheck").forEach(function(cb){
    cb.checked=true;var row=cb.closest(".fileRow");if(row){row.classList.add("selected");selectedFiles[row.dataset.name]=true;}
  });updateActionBar();
}

var searchTerm="";
function applySearch(){
  var term=searchTerm.toLowerCase().trim();
  document.querySelectorAll(".fileRow").forEach(function(row){
    var name=(row.dataset.name||"").toLowerCase();
    var m=META[row.dataset.name]||{};
    var caption=(m.caption||"").toLowerCase();
    var tags=(m.tags||[]).join(" ").toLowerCase();
    var match=!term||name.includes(term)||caption.includes(term)||tags.includes(term)||noteText.toLowerCase().includes(term);
    row.classList.toggle("hidden",!match);
  });
}

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

function renderFileRow(name){
  var existing=document.querySelector('.fileRow[data-name="'+CSS.escape(name)+'"]');if(!existing)return;
  var m=META[name]||{caption:"",tags:[]};
  var captionEl=existing.querySelector(".fileCaption");if(captionEl)captionEl.textContent=m.caption||"";
  var tagsEl=existing.querySelector(".fileTags");
  if(tagsEl){tagsEl.innerHTML="";(m.tags||[]).forEach(function(tag){var s=document.createElement("span");s.className="fileTag";s.textContent=tag;tagsEl.appendChild(s);});}
}

function refreshList(){
  $("files").innerHTML="";$("empty").style.display="none";
  selectedFiles={};updateActionBar();setStatus("Loading files...");
  return fetch(mediaListUrl(BOX_ID,TOKEN),{cache:"no-store"})
    .then(function(res){if(res.status===401)throw new Error("unauthorized");if(!res.ok)throw new Error("list_failed");return res.json();})
    .then(function(arr){
      if(!Array.isArray(arr)||arr.length===0){$("empty").style.display="block";setStatus("No files in this box.");return;}
      setStatus(arr.length+" file"+(arr.length===1?"":"s"));
      arr.sort(function(a,b){return(a.name||"").localeCompare(b.name||"");});
      arr.forEach(function(it){
        var name=it.name||"",ext=name.split(".").pop().toLowerCase();
        var fileUrl=mediaFileUrl(BOX_ID,name,TOKEN);
        var m=META[name]||{caption:"",tags:[]};
        var row=document.createElement("div");row.className="fileRow";row.dataset.name=name;

        // Bigger checkbox wrapper for easier tapping
        var cbWrap=document.createElement("label");cbWrap.className="fileCheckWrap";cbWrap.onclick=function(e){e.stopPropagation();};
        var cb=document.createElement("input");cb.type="checkbox";cb.className="fileCheck";
        cb.addEventListener("change",function(){
          if(cb.checked){selectedFiles[name]=true;row.classList.add("selected");}
          else{delete selectedFiles[name];row.classList.remove("selected");}
          updateActionBar();
        });
        cbWrap.appendChild(cb);

        var thumb=makeThumb(name,ext,fileUrl);

        // Main area - click to open
        var mainDiv=document.createElement("div");mainDiv.className="fileMain";mainDiv.style.cursor="pointer";
        mainDiv.onclick=function(e){if(e.target.closest(".fileCheckWrap"))return;window.open(fileUrl,"_blank");};
        var nameDiv=document.createElement("div");nameDiv.className="fileName";nameDiv.textContent=name;
        var metaDiv=document.createElement("div");metaDiv.className="fileMeta";
        metaDiv.textContent=fmtBytes(it.size)+(it.lastModified?" · "+fmtDate(it.lastModified):"");
        var captionDiv=document.createElement("div");captionDiv.className="fileCaption";captionDiv.textContent=m.caption||"";
        var tagsDiv=document.createElement("div");tagsDiv.className="fileTags";
        (m.tags||[]).forEach(function(tag){var s=document.createElement("span");s.className="fileTag";s.textContent=tag;tagsDiv.appendChild(s);});
        mainDiv.appendChild(nameDiv);mainDiv.appendChild(metaDiv);mainDiv.appendChild(captionDiv);mainDiv.appendChild(tagsDiv);

        var menuBtn=document.createElement("button");menuBtn.className="menuBtn";menuBtn.textContent="⋯";menuBtn.title="More";
        menuBtn.onclick=function(e){
          showCtxMenu(e,[
            {label:"Open file",action:function(){window.open(fileUrl,"_blank");}},
            {label:"Edit info",action:function(){openEditModal(name);}},
            "divider",
            {label:"Delete",danger:true,action:function(){deleteFile(name);}}
          ]);
        };

        row.appendChild(cbWrap);row.appendChild(thumb);row.appendChild(mainDiv);row.appendChild(menuBtn);
        $("files").appendChild(row);
      });
      applySearch();
      var st=$("selectToolbar");if(st&&arr.length>0)st.classList.remove("hidden");
    });
}

function deleteFile(name){
  if(!confirm("Delete \""+name+"\"?"))return;setStatus("Deleting...");
  fetch(mediaDeleteOneUrl(BOX_ID,name,TOKEN),{method:"DELETE"})
    .then(function(r){if(r.status===401)throw new Error("unauthorized");if(!r.ok)alert("Delete failed.");return refreshList();})
    .then(function(){return updateSearchIndex();}).catch(handleErr);
}
function deleteSelected(){
  var names=Object.keys(selectedFiles);if(!names.length)return;
  if(!confirm("Delete "+names.length+" selected file(s)?"))return;
  $("actionBar").classList.remove("visible");setStatus("Deleting...");
  var chain=Promise.resolve();
  names.forEach(function(name){chain=chain.then(function(){return fetch(mediaDeleteOneUrl(BOX_ID,name,TOKEN),{method:"DELETE"}).then(function(r){if(r.status===401)throw new Error("unauthorized");});});});
  chain.then(function(){return refreshList();}).then(function(){return updateSearchIndex();}).catch(handleErr);
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
  setStatus("Uploading "+items.length+" file(s)...");$("uploadBtn").disabled=true;$("fileIn").disabled=true;
  var chain=Promise.resolve();
  items.forEach(function(it){chain=chain.then(function(){return new Promise(function(resolve,reject){
    var fd=new FormData();fd.append("files",it.f,it.f.name);
    var xhr=new XMLHttpRequest();xhr.open("POST",mediaUploadUrl(BOX_ID,TOKEN),true);
    xhr.upload.onprogress=function(e){if(e.lengthComputable){var p=Math.round(e.loaded/e.total*100);it.fill.style.width=p+"%";it.pct.textContent=p+"%";}};
    xhr.onload=function(){if(xhr.status===401){reject(new Error("unauthorized"));return;}if(xhr.status>=200&&xhr.status<300){it.fill.style.width="100%";it.pct.textContent="100%";resolve();}else{alert("Upload failed: "+it.f.name);resolve();}};
    xhr.onerror=function(){alert("Network error: "+it.f.name);resolve();};xhr.send(fd);
  });});});
  return chain.then(function(){$("uploadBtn").disabled=false;$("fileIn").disabled=false;$("fileIn").value="";return refreshList();})
    .then(function(){setTimeout(function(){progHost.style.display="none";},800);});
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
  var sab=$("selectAllBtn");if(sab)sab.onclick=function(){selectAll();};
  var dab=$("deselectAllBtn");if(dab)dab.onclick=function(){clearSelection();};
  $("editCancel").onclick=function(){closeEditModal();};
  $("editSave").onclick=function(){saveEditModal();};
  $("editModal").addEventListener("click",function(e){if(e.target===$("editModal"))closeEditModal();});
  $("bulkTagCancel").onclick=function(){closeBulkTagModal();};
  $("bulkTagSave").onclick=function(){saveBulkTags();};
  $("bulkTagModal").addEventListener("click",function(e){if(e.target===$("bulkTagModal"))closeBulkTagModal();});
  var si=$("searchInput");if(si){si.addEventListener("input",function(){searchTerm=si.value;applySearch();});}
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
        return Promise.all([loadMeta().then(function(){return refreshList();}),loadNote()]);
      }else{
        if(saved)clearToken();
        return new Promise(function(resolve){
          showModal({onSubmit:function(tok){
            return checkToken(KV_KEY||"dummy",tok).then(function(ok2){
              if(!ok2)throw new Error("unauthorized");
              saveToken(tok);TOKEN=tok;$("authPill").textContent="Authenticated";$("authPill").className="pill ok";
              resolve();return Promise.all([loadMeta().then(function(){return refreshList();}),loadNote()]);
            });
          }});
        });
      }
    });
  }).catch(function(e){setStatus("Error: "+(e&&e.message?e.message:String(e)));console.error(e);});
}
main();
