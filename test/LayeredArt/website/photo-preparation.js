'use strict';
(()=>{
 const entry=document.createElement('div');entry.id='photoEntry';entry.innerHTML='<button id="openPhotoEditor"><i data-lucide="scan"></i>Simplify photo</button><button id="clearPhoto" title="Return to grayscale preparation" aria-label="Return to grayscale preparation" hidden><i data-lucide="rotate-ccw"></i></button><span id="photoActive" hidden>Guided photo tones applied</span>';$('conversionControls').prepend(entry);
 const dialog=document.createElement('dialog');dialog.id='photoEditor';dialog.setAttribute('aria-labelledby','photoTitle');
 dialog.innerHTML='<div class="photo-heading"><h2 id="photoTitle">Simplify photo</h2><button id="closePhoto" title="Cancel photo edits" aria-label="Cancel photo edits"><i data-lucide="x"></i></button></div><div class="photo-controls"><label>Levels<input id="photoCount" type="number" min="2" max="12" value="5"></label><label>Simplification<select id="photoSmooth"><option value="0">Fine</option><option value="1">Light</option><option value="2" selected>Balanced</option><option value="3">Strong</option></select></label><button id="rebuildPhoto"><i data-lucide="refresh-cw"></i>Regroup colors</button></div><div class="photo-canvases"><figure><figcaption>Original color</figcaption><canvas id="photoOriginal" aria-label="Original color photo"></canvas></figure><figure><figcaption>Layer regions</figcaption><canvas id="photoRegions" aria-label="Select a photo region" title="Click a region to select it"></canvas></figure></div><progress id="photoProgress" hidden></progress><p id="photoStatus" role="status"></p><div class="photo-controls"><label>Selection<select id="photoScope"><option value="region">Connected region</option><option value="tone">All matching tones</option></select></label><label>Assign to level<select id="photoTarget"></select></label><button id="assignPhoto">Assign region</button><button id="backgroundPhoto">Set as background</button></div><div class="photo-actions"><button id="undoPhoto" title="Undo region edit" aria-label="Undo region edit"><i data-lucide="undo-2"></i></button><button id="resetPhoto" title="Reset region edits" aria-label="Reset region edits"><i data-lucide="rotate-ccw"></i></button><button id="applyPhoto" class="primary"><i data-lucide="check"></i>Use layer tones</button></div>';
 document.body.append(dialog);
 const reverse=document.createElement('button');reverse.id='reversePhoto';reverse.title='Reverse all layer depths';reverse.innerHTML='<i data-lucide="arrow-down-up"></i>Reverse depth';$('rebuildPhoto').after(reverse);
 $('photoSmooth').closest('label').hidden=true;
 const refine=document.createElement('button');refine.id='refineSubject';refine.innerHTML='<i data-lucide="scan-user"></i>Refine subject';$('openPhotoEditor').after(refine);
 const subjectPanel=document.createElement('details');subjectPanel.id='photoSubject';subjectPanel.innerHTML='<summary>Refine subject</summary><div class="subject-toolbar"><div class="segmented" role="group" aria-label="Subject selection tool"><button type="button" data-subject-tool="box" aria-pressed="true" title="Draw a box around the subject"><i data-lucide="scan"></i>Box</button><button type="button" data-subject-tool="keep" aria-pressed="false" title="Mark areas to keep in the subject"><i data-lucide="brush"></i>Keep</button><button type="button" data-subject-tool="remove" aria-pressed="false" title="Mark areas as background"><i data-lucide="eraser"></i>Background</button></div><label>Brush size<input id="subjectBrush" type="range" min="3" max="40" value="12" aria-label="Subject brush size"></label><button type="button" id="findPhotoSubject" class="primary"><i data-lucide="scan-user"></i>Find subject</button><button type="button" id="clearPhotoSubject" title="Clear subject selection" aria-label="Clear subject selection"><i data-lucide="rotate-ccw"></i></button></div>';
 dialog.querySelector('.photo-canvases').before(subjectPanel);
 let worker,timer,raw,labels,initial,background=null,initialBackground=null,selection=[],history=[],w=0,h=0,count=5,applied=null,appliedSource=null,subjectBox=null,marks=null,subjectTool='box',stroke=null;
 function checkpoint(){history.push({labels:labels.slice(),background:background?.slice()||null,marks:marks?.slice()||null,box:subjectBox?.slice()||null});if(history.length>20)history.shift();}
 function encodeBackground(){if(!background)return undefined;let s='';for(let i=0;i<background.length;i+=8192)s+=String.fromCharCode(...background.subarray(i,i+8192));return btoa(s);}
 function decodeBackground(value,size){if(value===undefined)return null;const s=atob(value);if(s.length!==size)throw Error('Invalid background size');return Uint8Array.from(s,c=>c.charCodeAt(0));}
 const key=()=>JSON.stringify([settingsBase().crop,Number($('colorCount').value)]);
 const valid=()=>!!(applied&&appliedSource===sourceImage&&state.photoPreparation?.key===key());
 function status(){const on=valid();$('clearPhoto').hidden=!state.photoPreparation;$('photoActive').hidden=!state.photoPreparation;$('photoActive').textContent=on?(state.photoPreparation?.aiMaster?'AI layer map applied':'Guided photo tones applied'):'Photo tones need updating';$('preparedTonePreview').previousElementSibling.textContent=on&&state.photoPreparation?.aiMaster?'AI relief map':'Posterized';prepPanel.hidden=on;thresholdPanel.hidden=on;$('blur').closest('label').hidden=on;$('originalTonePreview').previousElementSibling.textContent=on?'Original color':'Grayscale';}
 function controls(running){$('photoProgress').hidden=!running;for(const id of ['applyPhoto','rebuildPhoto','photoCount','photoSmooth','resetPhoto','reversePhoto','findPhotoSubject','clearPhotoSubject'])$(id).disabled=running||!labels;subjectPanel.querySelectorAll('[data-subject-tool],input').forEach(el=>el.disabled=running);$('assignPhoto').disabled=$('backgroundPhoto').disabled=running||!selection.length;$('undoPhoto').disabled=running||!history.length;}
 function stop(){clearTimeout(timer);worker?.terminate();worker=null;controls(false);}
 function paintOriginal(){
   if(!raw)return;const c=$('photoOriginal'),ctx=c.getContext('2d'),pixels=new ImageData(new Uint8ClampedArray(raw.data),raw.width,raw.height);c.width=raw.width;c.height=raw.height;
   if(subjectPanel.open)for(let i=0;i<w*h;i++){
     if(background?.[i]){for(let k=0;k<3;k++)pixels.data[i*4+k]=Math.round(pixels.data[i*4+k]*.35);}
     if(marks?.[i]){const color=marks[i]===1?[34,116,240]:[230,73,105];for(let k=0;k<3;k++)pixels.data[i*4+k]=Math.round(pixels.data[i*4+k]*.25+color[k]*.75);}
   }
   ctx.putImageData(pixels,0,0);if(subjectPanel.open&&subjectBox){ctx.strokeStyle='#2d7fff';ctx.lineWidth=2;ctx.strokeRect(subjectBox[0]*w,subjectBox[1]*h,(subjectBox[2]-subjectBox[0])*w,(subjectBox[3]-subjectBox[1])*h);}
 }
 function paint(){if(!labels)return;reverse.title=background?'Reverse foreground depths; keep background recessed':'Reverse all layer depths';const c=$('photoRegions');c.width=w;c.height=h;const ctx=c.getContext('2d'),im=ctx.createImageData(w,h);for(let i=0;i<labels.length;i++){const g=Math.round(labels[i]*255/(count-1)),p=i*4;im.data[p]=im.data[p+1]=im.data[p+2]=g;im.data[p+3]=255;}for(const i of selection){const p=i*4;im.data[p]=245;im.data[p+1]=119;im.data[p+2]=55;im.data[p+3]=255;}ctx.putImageData(im,0,0);paintOriginal();controls(!!worker);}
 function targets(){$('photoTarget').innerHTML=Array.from({length:count},(_,i)=>`<option value="${i}">${i+1}${i===0?' - Base / background':i===count-1?' - Highest':''}</option>`).join('');}
 function build(segment=false,clearSubject=false){
  stop();const nextCount=Math.max(2,Math.min(12,Math.round(Number($('photoCount').value)||5)));$('photoCount').value=nextCount;selection=[];
  worker=new Worker('photo-worker.js');const job=worker;controls(true);$('photoProgress').max=100;$('photoProgress').value=0;$('photoStatus').textContent='Preparing photo locally...';
  timer=setTimeout(()=>{if(worker===job){stop();$('photoStatus').textContent='Preparation timed out. Try again.';$('photoCount').value=count;}},60000);
  job.onmessage=({data})=>{if(worker!==job)return;if(!data.error&&!data.done){$('photoProgress').value=data.progress;$('photoStatus').textContent=data.label;return;}stop();if(data.error){$('photoStatus').textContent=data.error;$('photoCount').value=count;return;}if(labels&&nextCount===count)checkpoint();else history=[];count=nextCount;w=data.width;h=data.height;labels=new Uint8Array(data.labels);background=data.background?new Uint8Array(data.background):null;if(!initial||initial.length!==labels.length||nextCount!==Number(initial.count)){initial=labels.slice();initial.count=count;initialBackground=background?.slice()||null;}if(segment||clearSubject){subjectBox=null;marks=new Uint8Array(w*h);}targets();paint();$('photoStatus').textContent=background?`${count} levels ready - subject raised`:`${count} levels ready`;};
  job.onerror=()=>{stop();$('photoStatus').textContent='Could not simplify this image. Try again.';$('applyPhoto').disabled=true;};
  job.postMessage({image:raw,count:nextCount,smooth:2,background:clearSubject?null:background,subject:segment?{box:subjectBox,marks}:undefined});
 }
 $('openPhotoEditor').onclick=()=>{
  subjectTool='box';subjectPanel.querySelectorAll('[data-subject-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.subjectTool==='box')));
  if(!sourceImage||importBusy)return;const b=cropBounds(),r=Math.min(1,720/Math.max(b.w,b.h)),c=$('photoOriginal');c.width=Math.max(16,Math.round(b.w*r));c.height=Math.max(16,Math.round(b.h*r));const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(sourceImage,b.x,b.y,b.w,b.h,0,0,c.width,c.height);raw=ctx.getImageData(0,0,c.width,c.height);w=raw.width;h=raw.height;marks=new Uint8Array(w*h);subjectBox=null;initial=null;labels=null;background=null;history=[];$('photoCount').value=$('colorCount').value;dialog.showModal();
  if(valid()){count=state.photoPreparation.count;w=applied.width;h=applied.height;const d=applied.getContext('2d').getImageData(0,0,w,h).data;labels=Uint8Array.from({length:w*h},(_,i)=>Math.round(d[i*4]*(count-1)/255));background=decodeBackground(state.photoPreparation.background,w*h);initialBackground=background?.slice()||null;initial=labels.slice();initial.count=count;selection=[];history=[];targets();paint();$('photoStatus').textContent='Saved region edits';}else build();
 };
 refine.onclick=()=>{$('openPhotoEditor').click();subjectPanel.open=true;paintOriginal();};
 subjectPanel.ontoggle=()=>{dialog.classList.toggle('subject-editing',subjectPanel.open);paintOriginal();};
 subjectPanel.querySelectorAll('[data-subject-tool]').forEach(button=>button.onclick=()=>{subjectTool=button.dataset.subjectTool;subjectPanel.querySelectorAll('[data-subject-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));});
 function canvasPoint(e){const rect=$('photoOriginal').getBoundingClientRect(),scale=Math.min(rect.width/w,rect.height/h),x=(e.clientX-rect.left-(rect.width-w*scale)/2)/scale,y=(e.clientY-rect.top-(rect.height-h*scale)/2)/scale;return [Math.max(0,Math.min(w-1,x)),Math.max(0,Math.min(h-1,y))];}
 function markLine(a,b){const radius=Number($('subjectBrush').value)/2,steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])));for(let s=0;s<=steps;s++){const cx=a[0]+(b[0]-a[0])*s/steps,cy=a[1]+(b[1]-a[1])*s/steps;for(let y=Math.max(0,Math.floor(cy-radius));y<=Math.min(h-1,Math.ceil(cy+radius));y++)for(let x=Math.max(0,Math.floor(cx-radius));x<=Math.min(w-1,Math.ceil(cx+radius));x++)if((x-cx)**2+(y-cy)**2<=radius**2)marks[y*w+x]=subjectTool==='keep'?1:2;}}
 $('photoOriginal').onpointerdown=e=>{if(!subjectPanel.open||worker||!labels||e.button!==0)return;e.preventDefault();checkpoint();stroke={id:e.pointerId,start:canvasPoint(e),last:canvasPoint(e)};e.currentTarget.setPointerCapture(e.pointerId);if(subjectTool==='box'){subjectBox=null;marks.fill(0);}else markLine(stroke.start,stroke.start);paint();};
 $('photoOriginal').onpointermove=e=>{if(!stroke||e.pointerId!==stroke.id)return;const p=canvasPoint(e);if(subjectTool==='box')subjectBox=[Math.min(stroke.start[0],p[0])/w,Math.min(stroke.start[1],p[1])/h,Math.max(stroke.start[0],p[0])/w,Math.max(stroke.start[1],p[1])/h];else markLine(stroke.last,p);stroke.last=p;paintOriginal();};
 const endStroke=e=>{if(!stroke||e.pointerId!==stroke.id)return;stroke=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);controls(false);};
 $('photoOriginal').onpointerup=endStroke;$('photoOriginal').onpointercancel=endStroke;
 $('findPhotoSubject').onclick=()=>build(true);
 $('clearPhotoSubject').onclick=()=>build(false,true);
 $('photoRegions').onclick=e=>{
  if(worker||!labels)return;const rect=e.currentTarget.getBoundingClientRect(),scale=Math.min(rect.width/w,rect.height/h),ox=(rect.width-w*scale)/2,oy=(rect.height-h*scale)/2,x=Math.floor((e.clientX-rect.left-ox)/scale),y=Math.floor((e.clientY-rect.top-oy)/scale);if(x<0||y<0||x>=w||y>=h)return;
  const start=y*w+x,tone=labels[start];selection=[];
  if($('photoScope').value==='tone'){for(let i=0;i<labels.length;i++)if(labels[i]===tone)selection.push(i);}else{const seen=new Uint8Array(labels.length);selection=[start];seen[start]=1;for(let k=0;k<selection.length;k++){const p=selection[k],px=p%w;for(const n of [px?p-1:-1,px<w-1?p+1:-1,p>=w?p-w:-1,p<w*(h-1)?p+w:-1])if(n>=0&&!seen[n]&&labels[n]===tone){seen[n]=1;selection.push(n);}}}
  $('photoTarget').value=tone;paint();$('photoStatus').textContent=`Selected ${selection.length.toLocaleString()} pixels at level ${tone+1}`;
 };
 function assign(level){if(!selection.length||worker)return;checkpoint();
  // Reserve the base for explicitly marked background; the darkest subject tone stays solid above it.
  if(level===0){background||=new Uint8Array(labels.length);for(const i of selection)background[i]=1;for(let i=0;i<labels.length;i++)labels[i]=background[i]?0:Math.max(1,labels[i]);}
  else for(const i of selection){labels[i]=level;if(background)background[i]=0;}
  selection=[];paint();$('photoStatus').textContent=level===0?'Background recessed; foreground raised':'Region assigned';}
 $('assignPhoto').onclick=()=>assign(Number($('photoTarget').value));$('backgroundPhoto').onclick=()=>assign(0);
 reverse.onclick=()=>{if(worker||!labels)return;checkpoint();for(let i=0;i<labels.length;i++)labels[i]=background?(background[i]?0:count-labels[i]):count-1-labels[i];selection=[];paint();$('photoStatus').textContent=background?'Foreground depth reversed; background retained':'Depth reversed';};
 $('undoPhoto').onclick=()=>{if(history.length){const previous=history.pop();labels=previous.labels;background=previous.background;marks=previous.marks||new Uint8Array(w*h);subjectBox=previous.box;selection=[];paint();}};
 $('resetPhoto').onclick=()=>{if(initial){checkpoint();labels=initial.slice();background=initialBackground?.slice()||null;subjectBox=null;marks.fill(0);selection=[];paint();}};
 $('rebuildPhoto').onclick=()=>{if(history.length&&!confirm('Regrouping replaces the region edits in this editor. Continue?'))return;build();};
 for(const id of ['photoCount','photoSmooth'])$(id).onchange=()=>{if(history.length&&!confirm('Changing grouping replaces the region edits in this editor. Continue?')){$('photoCount').value=count;return;}build();};
 $('closePhoto').onclick=()=>dialog.close();dialog.addEventListener('close',stop);
 $('applyPhoto').onclick=()=>{
  if(worker||!labels)return;selection=[];paint();applied=document.createElement('canvas');applied.width=w;applied.height=h;applied.getContext('2d').drawImage($('photoRegions'),0,0);appliedSource=sourceImage;$('colorCount').value=count;
  state.photoPreparation={image:applied.toDataURL('image/png'),source:sourceSnapshot(),name:sourceName,count,key:key(),background:encodeBackground(),pending:true};dialog.close();status();dirty();showSource(true);
 };
 $('clearPhoto').onclick=()=>{cancelRetone();delete state.photoPreparation;state.preparedImageMode=true;window.cancelPhotoImport?.();applied=null;status();dirty();};
 let retoneJob=null,retoneTimer;
 function cancelRetone(){clearTimeout(retoneTimer);retoneJob?.worker?.terminate();retoneJob=null;}
 window.cancelPhotoRefinement=()=>{if(retoneJob?.state===state&&state.photoPreparation)$('colorCount').value=state.photoPreparation.count;cancelRetone();};
 window.photoRefinementState=()=>retoneJob?.state===state?retoneJob:null;
 function retone(){
  const p=state.photoPreparation;if(!p||p.aiMaster||!applied||appliedSource!==sourceImage||JSON.stringify(JSON.parse(p.key)[0])!==JSON.stringify(settingsBase().crop))return;
  cancelRetone();const n=number('colorCount',2,12);if(n===p.count){updateCropPreview();updateImportUI();return;}
  const job=retoneJob={state,source:sourceImage,pending:true};p.pending=true;
  retoneTimer=setTimeout(()=>{
   if(retoneJob!==job||state!==job.state||sourceImage!==job.source)return;
   const c=document.createElement('canvas');c.width=applied.width;c.height=applied.height;const ctx=c.getContext('2d'),b=cropBounds();ctx.drawImage(sourceImage,b.x,b.y,b.w,b.h,0,0,c.width,c.height);
   job.worker=new Worker('photo-worker.js');
   const finish=error=>{if(retoneJob!==job)return;cancelRetone();if(state!==job.state||sourceImage!==job.source)return;if(error){$('colorCount').value=p.count;message(error);}updateCropPreview();updateImportUI();};
   retoneTimer=setTimeout(()=>finish('Photo preparation timed out. Try again.'),60000);
   job.worker.onerror=()=>finish('Photo preparation failed. Try again.');
   job.worker.onmessage=({data})=>{if(retoneJob!==job)return;if(state!==job.state||sourceImage!==job.source){cancelRetone();return;}if(data.error){finish(data.error);return;}if(!data.done)return;
    const pixels=ctx.createImageData(c.width,c.height);for(let i=0;i<data.labels.length;i++){const v=Math.round(data.labels[i]*255/(n-1)),index=i*4;pixels.data[index]=pixels.data[index+1]=pixels.data[index+2]=v;pixels.data[index+3]=255;}ctx.putImageData(pixels,0,0);applied=c;p.image=c.toDataURL();p.count=n;p.key=key();finish();dirty();
   };
   job.worker.postMessage({image:ctx.getImageData(0,0,c.width,c.height),count:n,smooth:2,background:decodeBackground(p.background,c.width*c.height)});
  },120);
  updateImportUI();
 }
 $('colorCount').addEventListener('input',retone);
 let aiApplyRevision=0;
 window.applyAILayerMap=async function(image,count){
  const revision=++aiApplyRevision,source=sourceImage,cropKey=JSON.stringify(settingsBase().crop);
  const bitmap=await createImageBitmap(await (await fetch(image)).blob());
  if(revision!==aiApplyRevision||source!==sourceImage||cropKey!==JSON.stringify(settingsBase().crop)){bitmap.close();return false;}
  const master=document.createElement('canvas'),ratio=Math.min(1,720/Math.max(bitmap.width,bitmap.height));master.width=Math.round(bitmap.width*ratio);master.height=Math.round(bitmap.height*ratio);master.getContext('2d').drawImage(bitmap,0,0,master.width,master.height);bitmap.close();
  const masterData=master.toDataURL('image/png'),pixels=master.getContext('2d').getImageData(0,0,master.width,master.height);
  for(let i=0;i<pixels.data.length;i+=4){const gray=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2],value=Math.round(Math.round(gray*(count-1)/255)*255/(count-1));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
  ToneTools.cleanLevelSpeckles(pixels.data,pixels.width,pixels.height);master.getContext('2d').putImageData(pixels,0,0);
  applied=master;appliedSource=source;$('colorCount').value=count;
  state.photoPreparation={image:master.toDataURL('image/png'),aiMaster:masterData,pending:true,source:sourceSnapshot(),name:sourceName,count,key:key()};
  status();dirty();showSource(true);return true;
 };
 $('colorCount').addEventListener('input',()=>{const p=state.photoPreparation;if(p?.aiMaster&&JSON.stringify(JSON.parse(p.key)[0])===JSON.stringify(settingsBase().crop))window.applyAILayerMap(p.aiMaster,Number($('colorCount').value));});
 const settingsBase=settings;settings=function(){const s=settingsBase();if(valid()){const n=state.photoPreparation.count;return {...s,blur:0,autoArtifacts:false,toneLevels:[],thresholdMode:'manual',thresholds:Array.from({length:n-1},(_,i)=>Math.round((i+.5)*255/(n-1)))};}return s;};
 const canvasBase=layerToneCanvas;layerToneCanvas=function(maxSide=720){if(window.photoRefinementState()?.pending)throw Error('Photo preparation is still running.');return valid()?applied:canvasBase(maxSide);};
 const previewBase=updateCropPreview;updateCropPreview=function(){status();if(!valid()&&!window.photoRefinementState()?.pending)return previewBase();const original=$('originalTonePreview'),prepared=$('preparedTonePreview'),b=cropBounds();for(const c of [original,prepared]){c.width=applied.width;c.height=applied.height;}const ctx=original.getContext('2d');ctx.drawImage(sourceImage,b.x,b.y,b.w,b.h,0,0,original.width,original.height);prepared.getContext('2d').drawImage(applied,0,0);$('sourceThumb').src=state.photoPreparation.image;$('sourceLarge').src=state.photoPreparation.image;$('colorCountOut').value=$('colorCount').value;};
 const loadBase=loadImage;loadImage=async function(file){cancelRetone();const old=sourceImage;await loadBase(file);if(sourceImage!==old){applied=null;appliedSource=null;delete state.photoPreparation;status();updateCropPreview();}};
 const openBase=$('fileInput').onchange;$('fileInput').onchange=async e=>{window.photoProjectLoading=true;window.cancelPhotoRefinement();updateImportUI();try{const old=state;await openBase(e);if(state===old)return;applied=null;appliedSource=null;const p=state.photoPreparation;if(p){try{
  if(p.source){const bitmap=await createImageBitmap(await (await fetch(p.source)).blob());if(bitmap.width>1440||bitmap.height>1440){bitmap.close();throw Error('Photo source too large');}sourceImage?.close();sourceImage=bitmap;sourceName=p.name||'Photo';}
  if(!sourceImage)throw Error('Photo source missing');
  const bitmap=await createImageBitmap(await (await fetch(p.image)).blob());if(bitmap.width>720||bitmap.height>720){bitmap.close();throw Error('Photo preparation too large');}applied=document.createElement('canvas');applied.width=bitmap.width;applied.height=bitmap.height;applied.getContext('2d').drawImage(bitmap,0,0);bitmap.close();count=p.count;appliedSource=sourceImage;
  decodeBackground(p.background,applied.width*applied.height);
  const [crop]=JSON.parse(p.key);['cropLeft','cropTop','cropRight','cropBottom'].forEach((id,i)=>$(id).value=crop[i]);$('colorCount').value=count;$('sourceName').textContent=sourceName;$('sourcePreview').hidden=false;$('conversionControls').hidden=false;
 }catch{delete state.photoPreparation;message('Photo edits could not be restored. Original image and cut layers retained.');}}status();updateCropPreview();}finally{window.photoProjectLoading=false;updateImportUI();}};
 const validateBase=validate;validate=function(s){const p=s?.photoPreparation;if(p){
  if(p.aiMaster!==undefined&&(typeof p.aiMaster!=='string'||p.aiMaster.length>4000000||!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(p.aiMaster)))throw Error('Invalid AI layer map');
  if(!Number.isInteger(p.count)||p.count<2||p.count>12||typeof p.key!=='string'||p.key.length>200||typeof p.image!=='string'||p.image.length>4000000||!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(p.image))throw Error('Invalid photo preparation');
  const k=JSON.parse(p.key);if(!Array.isArray(k)||k.length!==2||k[1]!==p.count||!Array.isArray(k[0])||k[0].length!==4||k[0].some(v=>!Number.isFinite(v)||v<0||v>94)||k[0][0]+k[0][2]>=95||k[0][1]+k[0][3]>=95)throw Error('Invalid photo crop');
  if(p.source!==undefined&&(typeof p.source!=='string'||p.source.length>12000000||!/^data:image\/(jpeg|png);base64,[a-zA-Z0-9+/=]+$/.test(p.source)))throw Error('Invalid photo source');
  if(p.name!==undefined&&(typeof p.name!=='string'||p.name.length>300))throw Error('Invalid photo name');
  if(p.background!==undefined){if(typeof p.background!=='string'||p.background.length>691200||!/^[a-zA-Z0-9+/=]+$/.test(p.background)||Array.from(atob(p.background)).some(c=>c.charCodeAt(0)>1))throw Error('Invalid photo background');}
 }return validateBase(s);};
 window.addEventListener('pagehide',()=>{stop();cancelRetone();});icons();
})();
