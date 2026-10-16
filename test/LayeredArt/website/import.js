'use strict';
let sourceImage=null,sourceName='',traceWorker=null,lastSettings=null,importBusy=false,traceTimeout;
function sourceSnapshot(){const c=document.createElement('canvas'),r=Math.min(1,1440/Math.max(sourceImage.width,sourceImage.height));c.width=Math.round(sourceImage.width*r);c.height=Math.round(sourceImage.height*r);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(sourceImage,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.94);}
const importPanel=document.createElement('section');importPanel.className='import-panel';
importPanel.innerHTML=`<div class="section-title">IMAGE TO LAYERS <i data-lucide="scan-line"></i></div>
<button class="upload-target" id="uploadImage"><i data-lucide="image-plus"></i><span>Upload artwork</span><small>PNG, JPG, WebP · up to 20 MB</small></button><input id="imageFile" type="file" accept="image/png,image/jpeg,image/webp" hidden>
<div class="source-preview" id="sourcePreview" hidden><img id="sourceThumb" alt="Uploaded source artwork"><span id="sourceName"></span></div>
<div id="conversionControls" hidden><input id="cropLeft" type="hidden" value="0"><input id="cropTop" type="hidden" value="0"><input id="cropRight" type="hidden" value="0"><input id="cropBottom" type="hidden" value="0">
<label class="stack" hidden>Separation<select id="separation"><option value="stacked">Stacked silhouettes</option></select></label>
<label class="stack">Color layers<div class="range"><input id="colorCount" type="range" min="2" max="12" value="5"><output id="colorCountOut">5</output></div></label>
<div class="fields"><label>Smoothing<select id="smoothing"><option value="0.2">Fine</option><option value="1" selected>Balanced</option><option value="2.5">Soft</option></select></label><label>Image cleanup<select id="blur"><option value="0">None</option><option value="1" selected>Light</option><option value="3">Strong</option></select></label></div>
<label class="stack">Minimum detail area (mm²)<input id="minArea" type="number" min="0" max="100" step="0.5" value="6"></label>
<label class="check"><input id="matchAspect" type="checkbox" checked> Match image proportions</label><label class="check"><input id="includeFrame" type="checkbox" checked> Shared outer frame</label>
<button class="primary wide" id="generateLayers"><i data-lucide="layers-3"></i>Generate cut layers</button><button class="wide" id="cancelTrace" hidden>Cancel conversion</button><progress id="traceProgress" max="100" value="0" hidden></progress><p class="conversion-status" id="conversionStatus">Ready to separate colors and trace contours.</p></div>`;
document.querySelector('.left .panel-heading').after(importPanel);
const presets=document.querySelector('.presets'),details=document.createElement('details');details.className='starter-presets';details.innerHTML='<summary>Start from a template</summary>';presets.replaceWith(details);details.append(presets);
const empty=document.createElement('div');empty.id='emptyCanvas';empty.className='empty-canvas';empty.innerHTML='<i data-lucide="image-up"></i><h1>From image to layered art</h1><p>Upload your artwork to create a set of cut layers.</p><button class="primary" id="canvasUpload"><i data-lucide="upload"></i>Choose an image</button>';$('stage').append(empty);
const sourceLarge=document.createElement('img');sourceLarge.id='sourceLarge';sourceLarge.alt='Cropped source artwork';$('stage').append(sourceLarge);
const sourceButton=document.createElement('button');sourceButton.id='sourceToggle';sourceButton.title='Compare source image';sourceButton.setAttribute('aria-label','Compare source image');sourceButton.innerHTML='<i data-lucide="image"></i>';sourceButton.disabled=true;$('fit').before(sourceButton);
const review=document.createElement('div');review.id='cutReview';review.hidden=true;document.querySelector('.right section').append(review);
const originalRender=render;render=function(){originalRender();updateImportUI();};
function updateImportUI(){
  const imported=state.preset==='image',s=state.layers[selected];$('emptyCanvas').hidden=state.preset!=='empty';$('canvas').style.visibility=state.preset==='empty'?'hidden':'visible';$('export').disabled=state.preset==='empty'||importBusy||!!window.studioRendering?.pending;
  $('cutReview').hidden=!imported;if(imported){const loose=Math.max(0,(s.pieces||1)-(s.framed?1:0));$('cutReview').classList.toggle('warn',loose>0);$('cutReview').textContent=`${s.polygons?.length||1} closed contours · ${s.pieces||1} separate pieces. `+(loose?`${loose} loose pieces need placement and support. `:'')+'CNC: set cutter diameter and toolpaths in your CAM software.';}
  $('sourceToggle').disabled=!sourceImage;$('border').disabled=false;$('add').disabled=imported||state.preset==='empty'||state.layers.length>=16;
  $('registration').disabled=imported&&!state.layers.some(l=>l.framed);$('colorCountOut').value=$('colorCount').value;
}
function settings(){return {count:number('colorCount',2,12),mode:'stacked',smooth:number('smoothing',.2,2.5),blur:number('blur',0,3),minArea:number('minArea',0,100),frame:$('includeFrame').checked,bridges:false,bridgeWidth:2,width:state.w,height:state.h,border:state.border,crop:['cropLeft','cropTop','cropRight','cropBottom'].map(id=>number(id,0,94))};}
function dirty(){if(importBusy)return;$('conversionStatus').textContent=lastSettings?'Settings changed. Generate again to update the cut layers.':'Ready to generate cut layers.';$('conversionStatus').classList.toggle('warn',!!lastSettings);$('colorCountOut').value=$('colorCount').value;updateCropPreview();}
for(const el of importPanel.querySelectorAll('input:not([type=file]),select'))el.addEventListener('change',dirty);$('colorCount').oninput=()=>{$('colorCountOut').value=$('colorCount').value;};
function cropBounds(){const [l,t,r,b]=settings().crop;if(l+r>=95||t+b>=95)throw Error('Crop must leave at least 5% of the image.');return {x:sourceImage.width*l/100,y:sourceImage.height*t/100,w:sourceImage.width*(100-l-r)/100,h:sourceImage.height*(100-t-b)/100};}
function croppedCanvas(maxSide=720){const c=cropBounds(),canvas=document.createElement('canvas'),ratio=Math.min(1,maxSide/Math.max(c.w,c.h));canvas.width=Math.max(16,Math.round(c.w*ratio));canvas.height=Math.max(16,Math.round(c.h*ratio));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(sourceImage,c.x,c.y,c.w,c.h,0,0,canvas.width,canvas.height);
  // Preview and tracing share the same tonal source; retain the original bitmap.
  const image=ctx.getImageData(0,0,canvas.width,canvas.height),pixels=image.data;
  for(let i=0;i<pixels.length;i+=4){const gray=Math.round(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]);pixels[i]=pixels[i+1]=pixels[i+2]=gray;}
  ctx.putImageData(image,0,0);return canvas;
}
function updateCropPreview(){if(!sourceImage)return;try{const canvas=croppedCanvas(900);$('sourceThumb').src=canvas.toDataURL('image/jpeg',.85);$('sourceLarge').src=$('sourceThumb').src;}catch(e){$('conversionStatus').textContent=e.message;}}
async function loadImage(file){if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){message('Choose a PNG, JPG, or WebP image.');return;}if(file.size>20*1024*1024){message('Image must be smaller than 20 MB.');return;}cancelTrace(false);let bitmap;try{bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>80000000){bitmap.close();throw Error('Choose an image smaller than 80 megapixels.');}if(sourceImage)sourceImage.close();sourceImage=bitmap;sourceName=file.name;lastSettings=null;for(const id of ['cropLeft','cropTop','cropRight','cropBottom'])$(id).value=0;$('sourceName').textContent=file.name;$('sourcePreview').hidden=false;$('conversionControls').hidden=false;state.name=file.name.replace(/\.[^.]+$/,'').slice(0,80);state.h=Math.max(80,Math.min(1000,Math.round((state.w-2*state.border)*bitmap.height/bitmap.width+2*state.border)));sync();updateCropPreview();$('conversionStatus').textContent='Image loaded. Adjust the crop or generate your layers.';sourceButton.disabled=false;showSource(true);$('emptyCanvas').hidden=true;message('Artwork loaded locally');}catch(e){message(e.message||'Could not read this image.');}}
function showSource(show){$('stage').classList.toggle('source-mode',show);$('sourceToggle').classList.toggle('active',show);$('emptyCanvas').hidden=show||state.preset!=='empty';}
$('uploadImage').onclick=$('canvasUpload').onclick=()=>$('imageFile').click();$('imageFile').onchange=e=>{loadImage(e.target.files[0]);e.target.value='';};sourceButton.onclick=()=>showSource(!$('stage').classList.contains('source-mode'));
for(const target of [$('uploadImage'),$('stage')]){target.addEventListener('dragover',e=>{e.preventDefault();$('uploadImage').classList.add('dragging');});target.addEventListener('dragleave',()=>$('uploadImage').classList.remove('dragging'));target.addEventListener('drop',e=>{e.preventDefault();$('uploadImage').classList.remove('dragging');loadImage(e.dataTransfer.files[0]);});}
document.querySelectorAll('[data-view],[data-preset]').forEach(b=>b.addEventListener('click',()=>{showSource(false);updateImportUI();}));
function busy(on){importBusy=on;$('generateLayers').disabled=on;$('cancelTrace').hidden=!on;$('traceProgress').hidden=!on;$('stage').setAttribute('aria-busy',String(on));for(const el of importPanel.querySelectorAll('input,select'))el.disabled=on;updateImportUI();}
function cancelTrace(notify=true){clearTimeout(traceTimeout);if(traceWorker){traceWorker.terminate();traceWorker=null;busy(false);if(notify)$('conversionStatus').textContent='Conversion cancelled. Your previous layers are unchanged.';}}
$('cancelTrace').onclick=()=>cancelTrace();
$('generateLayers').onclick=()=>{if(!sourceImage)return;try{cancelTrace(false);const s=settings(),cropped=layerToneCanvas(720),ctx=cropped.getContext('2d');if(s.crop[0]+s.crop[2]>=95||s.crop[1]+s.crop[3]>=95)throw Error('Crop leaves too little artwork.');const c=cropBounds();if($('matchAspect').checked)s.height=Math.max(80,Math.min(1000,Math.round((s.width-(s.frame?2*s.border:0))*c.h/c.w+(s.frame?2*s.border:0))));const factor=720/Math.max(s.width,s.height),w=Math.max(64,Math.round(s.width*factor)),h=Math.max(64,Math.round(s.height*factor));busy(true);$('traceProgress').value=0;$('conversionStatus').classList.remove('warn');$('conversionStatus').textContent='Separating colors…';traceWorker=new Worker('trace-worker.js');
  traceTimeout=setTimeout(()=>{cancelTrace(false);$('conversionStatus').textContent='Conversion stopped because it took too long. Your previous layers are unchanged. Try Strong image cleanup or fewer colors.';},90000);
  traceWorker.onmessage=({data})=>{if(data.error){cancelTrace(false);$('conversionStatus').textContent='Conversion failed: '+data.error+' Your previous layers are unchanged.';return;}if(!data.done){$('traceProgress').value=data.progress;$('conversionStatus').textContent=data.label;return;}if(!data.layers.length){cancelTrace(false);$('conversionStatus').textContent='No contours found. Reduce cleanup and try again.';return;}
state.preset='image';state.w=s.width;state.h=s.height;state.registration=s.frame&&state.registration;state.layers=data.layers.map((l,i)=>({...make('Color '+(i+1),l.color,'image'),...l,framed:s.frame,gap:0}));if(s.mode==='pieces')state.layers.push({...make('Solid backing','#e8e2ce','back'),gap:0});state.source={name:sourceName,settings:s,width:s.width,height:s.height,image:sourceSnapshot()};selected=0;lastSettings=s;view='three';window.dispatchEvent(new Event('cutlayersgenerated'));document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='three'));sync();showSource(false);cancelTrace(false);render();$('conversionStatus').textContent=`${data.layers.length} color layers generated${s.mode==='pieces'?' + backing':''}. Inspect the final cut cleanup results before cutting.`;message('Image converted to cut layers');
    if(data.simplified){$('conversionStatus').textContent+=' Fine detail was reduced to keep the cut file manageable. Review before cutting.';$('conversionStatus').classList.add('warn');}
  };traceWorker.onerror=()=>{cancelTrace(false);$('conversionStatus').textContent='Conversion failed. Try fewer colors or a smaller image.';};traceWorker.postMessage({image:ctx.getImageData(0,0,cropped.width,cropped.height),w,h,settings:s});
}catch(e){cancelTrace(false);message(e.message);}};
for(const id of ['width','height','border'])$(id).addEventListener('change',()=>{if(state.preset==='image'){$('conversionStatus').textContent='Dimensions changed. Regenerate before exporting.';$('conversionStatus').classList.add('warn');}});
const originalExport=exportLayers;exportLayers=function(single=false){if(state.preset==='image'&&state.source&&(state.w!==state.source.width||state.h!==state.source.height||state.border!==state.source.settings?.border)){message('Regenerate the layers at the new size before exporting.');return;}originalExport(single);};
const originalOpen=$('fileInput').onchange;
$('fileInput').onchange=async e=>{cancelTrace(false);await originalOpen(e);if(state.preset!=='image')return;try{if(sourceImage)sourceImage.close();sourceImage=null;const src=state.source?.image;if(typeof src==='string'&&/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(src)&&src.length<12000000){sourceImage=await createImageBitmap(await (await fetch(src)).blob());sourceName=state.source.name||'Imported image';const s=state.source.settings;if(s){$('colorCount').value=s.count;$('separation').value=s.mode;$('smoothing').value=s.smooth;$('blur').value=s.blur;$('minArea').value=s.minArea;$('includeFrame').checked=s.frame;['cropLeft','cropTop','cropRight','cropBottom'].forEach((id,i)=>$(id).value=s.crop?.[i]||0);}lastSettings=s;updateCropPreview();$('sourceName').textContent=sourceName;$('sourcePreview').hidden=false;$('conversionControls').hidden=false;$('conversionStatus').textContent='Project restored with source image and cut layers.';}else{$('sourcePreview').hidden=true;$('conversionControls').hidden=true;message('Cut layers restored. Upload the source image to regenerate.');}showSource(false);updateImportUI();}catch{message('Cut layers restored; source image could not be reopened.');}};
state.preset='empty';state.name='Untitled artwork';state.layers=[make('Backing',colors[5],'back')];state.layers[0].gap=0;sync();render();icons();

const cropDialog=document.createElement('dialog');cropDialog.id='imageCropDialog';cropDialog.setAttribute('aria-labelledby','cropTitle');
cropDialog.innerHTML='<div class="crop-heading"><h2 id="cropTitle">Crop image</h2><button id="closeImageCrop" aria-label="Cancel crop" title="Cancel crop"><i data-lucide="x"></i></button></div><div class="crop-surface"><canvas id="cropCanvas" aria-label="Image crop selection"></canvas></div><div class="crop-values">'+['Left','Top','Right','Bottom'].map(name=>`<label>${name} %<input id="visualCrop${name}" type="number" min="0" max="95" step="0.1" value="0"></label>`).join('')+'</div><div class="crop-actions"><button id="resetImageCrop"><i data-lucide="maximize"></i>Full image</button><button id="applyImageCrop" class="primary"><i data-lucide="check"></i>Apply crop</button></div>';
document.body.append(cropDialog);
const cropCanvas=$('cropCanvas'),cropContext=cropCanvas.getContext('2d'),cropSides=['Left','Top','Right','Bottom'];
cropSides.forEach(side=>$('crop'+side).max=94);
let cropBox={x:0,y:0,w:1,h:1},cropBackground,cropDrag;
function paintCrop(){
  if(!cropBackground)return;
  const w=cropCanvas.width,h=cropCanvas.height,{x,y,w:rw,h:rh}=cropBox;
  cropContext.clearRect(0,0,w,h);cropContext.drawImage(cropBackground,0,0);
  cropContext.fillStyle='#152642b3';cropContext.beginPath();cropContext.rect(0,0,w,h);cropContext.rect(x*w,y*h,rw*w,rh*h);cropContext.fill('evenodd');
  cropContext.strokeStyle='#fff';cropContext.lineWidth=2;cropContext.strokeRect(x*w,y*h,rw*w,rh*h);
  cropContext.fillStyle='#fff';for(const px of [x,x+rw])for(const py of [y,y+rh])cropContext.fillRect(px*w-5,py*h-5,10,10);
  [x,y,1-x-rw,1-y-rh].forEach((v,i)=>$('visualCrop'+cropSides[i]).value=(Math.max(0,v)*100).toFixed(1));
}
function openImageCrop(){
  if(!sourceImage||importBusy)return;
  const ratio=Math.min(1,900/Math.max(sourceImage.width,sourceImage.height));cropCanvas.width=Math.round(sourceImage.width*ratio);cropCanvas.height=Math.round(sourceImage.height*ratio);
  cropBackground=document.createElement('canvas');cropBackground.width=cropCanvas.width;cropBackground.height=cropCanvas.height;
  const ctx=cropBackground.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cropCanvas.width,cropCanvas.height);ctx.drawImage(sourceImage,0,0,cropCanvas.width,cropCanvas.height);
  const image=ctx.getImageData(0,0,cropCanvas.width,cropCanvas.height),d=image.data;for(let i=0;i<d.length;i+=4)d[i]=d[i+1]=d[i+2]=Math.round(.2126*d[i]+.7152*d[i+1]+.0722*d[i+2]);ctx.putImageData(image,0,0);
  const [l,t,r,b]=settings().crop;cropBox=l+r<95&&t+b<95?{x:l/100,y:t/100,w:1-(l+r)/100,h:1-(t+b)/100}:{x:0,y:0,w:1,h:1};
  cropDialog.showModal();paintCrop();
}
function cropPoint(e){const r=cropCanvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
cropCanvas.onpointerdown=e=>{
  if(e.button!==0)return;e.preventDefault();const p=cropPoint(e),r=cropCanvas.getBoundingClientRect(),b=cropBox;
  const left=Math.abs(p.x-b.x)*r.width<16,right=Math.abs(p.x-b.x-b.w)*r.width<16,top=Math.abs(p.y-b.y)*r.height<16,bottom=Math.abs(p.y-b.y-b.h)*r.height<16;
  const inside=p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
  cropDrag={id:e.pointerId,start:p,box:{...b},left,right,top,bottom,mode:left||right||top||bottom?'resize':inside?'move':'new'};cropCanvas.setPointerCapture(e.pointerId);
};
cropCanvas.onpointermove=e=>{
  if(!cropDrag||cropDrag.id!==e.pointerId)return;
  const p=cropPoint(e),d=cropDrag,b=d.box,dx=p.x-d.start.x,dy=p.y-d.start.y;
  if(d.mode==='move')cropBox={...b,x:Math.max(0,Math.min(1-b.w,b.x+dx)),y:Math.max(0,Math.min(1-b.h,b.y+dy))};
  else{let l=b.x,t=b.y,r=b.x+b.w,bt=b.y+b.h;
    if(d.mode==='new'){l=Math.min(d.start.x,p.x);t=Math.min(d.start.y,p.y);r=Math.max(d.start.x,p.x);bt=Math.max(d.start.y,p.y);}
    else{if(d.left)l=Math.min(r-.06,p.x);if(d.right)r=Math.max(l+.06,p.x);if(d.top)t=Math.min(bt-.06,p.y);if(d.bottom)bt=Math.max(t+.06,p.y);}
    cropBox={x:Math.max(0,Math.min(.94,l)),y:Math.max(0,Math.min(.94,t)),w:Math.max(.06,r-l),h:Math.max(.06,bt-t)};cropBox.w=Math.min(cropBox.w,1-cropBox.x);cropBox.h=Math.min(cropBox.h,1-cropBox.y);
  }paintCrop();
};
function endCropDrag(e){if(cropDrag?.id===e.pointerId){cropDrag=null;if(cropCanvas.hasPointerCapture(e.pointerId))cropCanvas.releasePointerCapture(e.pointerId);}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])cropCanvas.addEventListener(event,endCropDrag);
for(const side of cropSides)$('visualCrop'+side).onchange=()=>{const v=cropSides.map(s=>Math.max(0,Math.min(94,Number($('visualCrop'+s).value)||0))/100);v[2]=Math.min(v[2],.94-v[0]);v[3]=Math.min(v[3],.94-v[1]);cropBox={x:v[0],y:v[1],w:1-v[0]-v[2],h:1-v[1]-v[3]};paintCrop();};
$('resetImageCrop').onclick=()=>{cropBox={x:0,y:0,w:1,h:1};paintCrop();};
$('closeImageCrop').onclick=()=>cropDialog.close();
cropDialog.addEventListener('close',()=>{cropDrag=null;cropBackground=null;});
$('applyImageCrop').onclick=()=>{cropSides.forEach(side=>$('crop'+side).value=$('visualCrop'+side).value);dirty();showSource(true);cropDialog.close();};
const editCropButton=document.createElement('button');editCropButton.id='editImageCrop';editCropButton.className='wide';editCropButton.innerHTML='<i data-lucide="crop"></i>Crop image';$('conversionControls').prepend(editCropButton);editCropButton.onclick=openImageCrop;
const loadBeforeVisualCrop=loadImage;loadImage=async function(file){const previous=sourceImage;await loadBeforeVisualCrop(file);if(sourceImage&&sourceImage!==previous)openImageCrop();};icons();
