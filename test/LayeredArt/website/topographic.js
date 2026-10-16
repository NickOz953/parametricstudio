'use strict';
const topoTab=document.createElement('button');topoTab.id='tab-topographic';topoTab.dataset.workflow='topographic';topoTab.setAttribute('role','tab');topoTab.setAttribute('aria-controls','panel-topographic');topoTab.innerHTML='<i data-lucide="waves"></i>Topographic';workflowTabs.firstElementChild.append(topoTab);
const topoPanel=document.createElement('section');topoPanel.id='panel-topographic';topoPanel.hidden=true;topoPanel.setAttribute('role','tabpanel');topoPanel.setAttribute('aria-labelledby','tab-topographic');
const topoDefaults={style:'flowing',count:5,basins:4,spread:55,detail:35,seed:17342,twist:0,rotation:0,width:100,height:100};let topoSettings={...topoDefaults},topoTimer,topoWorker,topoCanvas,topoPending=false,topoFrame,topoFieldCache;
topoPanel.innerHTML='<div class="section-title">TOPOGRAPHIC</div><label class="stack">Landscape<select id="topo-style"><option value="flowing">Flowing contours</option><option value="organic">Organic basins</option><option value="terraces">Broad terraces</option><option value="lake">Lake depths</option><option value="islands">Island contours</option><option value="terrain">Rolling terrain</option></select></label>'+[['count','Contour layers',2,12],['basins','Terrain features',1,8],['spread','Shape size',20,80],['detail','Contour detail',0,100],['twist','Twist',-180,180],['rotation','Rotation',0,360],['width','Width',25,200],['height','Height',25,200]].map(([id,label,min,max])=>`<label class="stack">${label}<div class="range"><input id="topo-${id}" type="range" min="${min}" max="${max}" value="${topoDefaults[id]}" aria-label="${label}"><output id="topo-${id}-out">${topoDefaults[id]}</output></div></label>`).join('')+'<label class="stack">Seed<input id="topo-seed" type="number" min="1" max="999999" value="17342"></label><button id="topo-random" class="wide"><i data-lucide="shuffle"></i>New landscape</button><button id="topo-generate" class="primary wide"><i data-lucide="layers-3"></i>Generate cut layers</button><p id="topo-status" class="conversion-status" role="status"></p>';
imageWorkspace.after(topoPanel);
const topoReset=document.createElement('button');topoReset.id='topo-reset';topoReset.title='Reset sliders';topoReset.setAttribute('aria-label','Reset topographic sliders');topoReset.innerHTML='<i data-lucide="rotate-ccw"></i>';topoPanel.querySelector('.section-title').append(topoReset);
const topoPreview=document.createElement('canvas');topoPreview.id='topoPreview';topoPreview.setAttribute('aria-label','Topographic contour preview');$('stage').append(topoPreview);
// Reuse the same pointer-centered zoom and drag camera as the other pattern previews.
document.addEventListener('DOMContentLoaded',()=>{
  new LivePatternPreview('topographic',topoPreview,()=>activeWorkflow==='topographic'&&$('stage').classList.contains('topo-preview')&&!topoWorker);
});
function topographicField(s,width,height,maxSide=420){const image=TopographicField.generate(s,width,height,maxSide),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').putImageData(new ImageData(image.data,image.width,image.height),0,0);return canvas;}
function topographicPreviewField(maxSide=420){
  const key=JSON.stringify([topoSettings.style,topoSettings.basins,topoSettings.spread,topoSettings.detail,topoSettings.seed,topoSettings.twist,topoSettings.rotation,topoSettings.width,topoSettings.height,state.w,state.h,state.border,maxSide]);
  if(topoFieldCache?.key!==key)topoFieldCache={key,canvas:topographicField(topoSettings,state.w-2*state.border,state.h-2*state.border,maxSide)};
  return topoFieldCache.canvas;
}
function topoUnit(key){return ['twist','rotation'].includes(key)?' deg':['width','height'].includes(key)?'%':'';}
function paintTopographicPreview(){
  if(!topoCanvas)return;
  topoPreview.style.borderWidth=state.frameEnabled===false?'0px':'8px';
  const im=topoCanvas.getContext('2d').getImageData(0,0,topoCanvas.width,topoCanvas.height),cuts=Array.from({length:topoSettings.count-1},(_,i)=>Math.round((i+1)*255/topoSettings.count));
  const palette=studioPalettes.find(p=>p.id===(state.paletteId||'ocean'))||studioPalettes[2],colors=paletteColors(palette,topoSettings.count).map(hex=>[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16)));
  // Quantize the 256 possible shades once, then color the image in one pass.
  const shades=new Uint8ClampedArray(256*4),lookup=new Uint8ClampedArray(256*4),backing=state.backingEnabled!==false;
  for(let v=0;v<256;v++)shades[v*4]=v;ToneTools.posterize(shades,cuts);
  for(let v=0;v<256;v++){const gray=shades[v*4],c=colors[topoSettings.count-1-Math.round(gray*(topoSettings.count-1)/255)];lookup.set(c,v*4);lookup[v*4+3]=gray===0?0:255;}
  for(let i=0;i<im.data.length;i+=4){const j=im.data[i]*4;if(!backing&&lookup[j+3]===0)im.data[i+3]=0;im.data[i]=lookup[j];im.data[i+1]=lookup[j+1];im.data[i+2]=lookup[j+2];}
  topoPreview.style.width=Math.round(420*im.width/Math.max(im.width,im.height))+'px';topoPreview.width=im.width;topoPreview.height=im.height;topoPreview.getContext('2d').putImageData(im,0,0);
}
function previewTopography(maxSide=420){
  if(activeWorkflow!=='topographic')return;stopTopography();topoCanvas=topographicPreviewField(maxSide);
  paintTopographicPreview();$('stage').classList.add('topo-preview');showSource(false);$('topo-status').textContent='Landscape ready';topoPending=true;state.topographyDraft={...topoSettings};$('export').disabled=true;$('previewLabel').textContent='Contour preview';$('designLabel').textContent='TOPOGRAPHIC';
}
function stopTopography(){if(topoWorker){topoWorker.terminate();topoWorker=null;}$('topo-generate').disabled=false;}
window.cancelTopography=()=>{cancelAnimationFrame(topoFrame);topoFrame=0;clearTimeout(topoTimer);stopTopography();$('stage').classList.remove('topo-preview');};
window.syncTopography=()=>{
  $('stage').classList.remove('topo-preview');if(activeWorkflow!=='topographic')return;
  topoSettings={...topoDefaults,...state.topography,...state.topographyDraft};for(const key of Object.keys(topoSettings)){if($('topo-'+key))$('topo-'+key).value=topoSettings[key];if($('topo-'+key+'-out'))$('topo-'+key+'-out').value=topoSettings[key]+topoUnit(key);}
  if(!state.topography||state.topographyDraft)previewTopography();else topoPending=false;
};
for(const key of Object.keys(topoDefaults))$('topo-'+key).addEventListener('input',()=>{const el=$('topo-'+key);topoSettings[key]=key==='style'?el.value:Math.max(Number(el.min),Math.min(Number(el.max),Number.isFinite(Number(el.value))?Number(el.value):Number(el.min)));if($('topo-'+key+'-out'))$('topo-'+key+'-out').value=topoSettings[key]+topoUnit(key);stopTopography();state.topographyDraft={...topoSettings};$('export').disabled=true;clearTimeout(topoTimer);if(!topoFrame)topoFrame=requestAnimationFrame(()=>{topoFrame=0;previewTopography(240);});topoTimer=setTimeout(()=>previewTopography(),250);});
function applyTopographicControls(next){
  cancelAnimationFrame(topoFrame);topoFrame=0;clearTimeout(topoTimer);stopTopography();
  topoSettings=next;state.topographyDraft={...next};window.syncTopography();
}
topoReset.onclick=()=>applyTopographicControls({...topoDefaults,style:topoSettings.style,seed:topoSettings.seed});
$('topo-random').onclick=()=>{
  const styles=[...$('topo-style').options].map(o=>o.value).filter(value=>value!==topoSettings.style),next={...topoSettings,style:styles[Math.floor(Math.random()*styles.length)]};
  for(const input of topoPanel.querySelectorAll('input[type="range"],#topo-seed')){
    const key=input.id.slice(5),min=Number(input.min),max=Number(input.max),previous=topoSettings[key];
    let value=min+Math.floor(Math.random()*(max-min+1));
    if(value===previous)value=value===max?min:value+1;
    next[key]=value;
  }
  applyTopographicControls(next);
};
for(const id of ['width','height','border'])$(id).addEventListener('change',()=>{if(activeWorkflow==='topographic')previewTopography();});
$('topo-generate').onclick=()=>{
  cancelAnimationFrame(topoFrame);topoFrame=0;
  clearTimeout(topoTimer);stopTopography();topoCanvas=topographicPreviewField();const s={count:topoSettings.count,mode:'stacked',topographic:true,smooth:4,blur:0,minArea:1,frame:true,bridges:false,width:state.w,height:state.h,border:state.border,crop:[0,0,0,0],thresholds:Array.from({length:topoSettings.count-1},(_,i)=>Math.round((i+1)*255/topoSettings.count))},saved={...topoSettings},factor=600/Math.max(state.w,state.h);
  const worker=topoWorker=new Worker('trace-worker.js');$('topo-generate').disabled=true;$('topo-status').textContent='Creating contours...';
  worker.onmessage=({data})=>{if(worker!==topoWorker)return;if(data.error){stopTopography();$('topo-status').textContent=data.error;return;}if(!data.done){$('topo-status').textContent=data.label;return;}
    if(!data.layers.length){stopTopography();$('topo-status').textContent='No contours found. Try another landscape.';return;}
    const palette=studioPalettes.find(p=>p.id===(state.paletteId||'ocean'))||studioPalettes[2],colors=paletteColors(palette,data.layers.length);
    state.preset='image';state.name=$('topo-style').selectedOptions[0].textContent;state.topography=saved;delete state.topographyDraft;state.paletteId=palette.id;
    state.layers=data.layers.map((l,i)=>({...make('Contour '+(i+1),colors[i],'image'),...l,color:colors[i],framed:true,gap:0}));state.source={name:'Generated topography',width:state.w,height:state.h,settings:s,image:topoCanvas.toDataURL('image/png')};selected=0;view='three';topoPending=false;stopTopography();$('stage').classList.remove('topo-preview');showSource(false);window.dispatchEvent(new Event('cutlayersgenerated'));sync();render();$('topo-status').textContent=`${state.layers.length} cut layers generated`;rememberWorkflow();
  };worker.onerror=()=>{stopTopography();$('topo-status').textContent='Could not generate contours. Try again.';};worker.postMessage({image:topoCanvas.getContext('2d').getImageData(0,0,topoCanvas.width,topoCanvas.height),w:Math.round(state.w*factor),h:Math.round(state.h*factor),settings:s});
};
const validateTopo=validate;validate=function(s){for(const t of [s?.topography,s?.topographyDraft])if(t){if(!['lake','islands','terrain','flowing','organic','terraces'].includes(t.style))throw Error('Invalid landscape');for(const [key,min,max] of [['twist',-180,180],['rotation',0,360],['width',25,200],['height',25,200]])if(t[key]!==undefined&&(!Number.isInteger(t[key])||t[key]<min||t[key]>max))throw Error('Invalid landscape transform');for(const [key,min,max]of [['count',2,12],['basins',1,8],['spread',20,80],['detail',0,100],['seed',1,999999]])if(!Number.isInteger(t[key])||t[key]<min||t[key]>max)throw Error('Invalid topographic settings');}return validateTopo(s);};
const topoLoadImage=loadImage;loadImage=async function(file){const previous=sourceImage;await topoLoadImage(file);if(sourceImage!==previous&&activeWorkflow==='image'){delete state.topography;delete state.topographyDraft;}};
const topoImportUI=updateImportUI;updateImportUI=function(){topoImportUI();if(activeWorkflow==='topographic'&&state.topographyDraft)$('export').disabled=true;};
const topoExport=exportLayers;exportLayers=function(single=false){if(activeWorkflow==='topographic'&&state.topographyDraft){message('Generate cut layers for this landscape before exporting.');return;}return topoExport(single);};
const topoOpen=$('fileInput').onchange;$('fileInput').onchange=async e=>{window.cancelTopography();await topoOpen(e);};
syncWorkflow();icons();
