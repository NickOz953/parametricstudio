'use strict';
const bridgeEditorButton=document.createElement('button');bridgeEditorButton.id='editBridges';bridgeEditorButton.className='wide';bridgeEditorButton.innerHTML='<i data-lucide="git-branch"></i>Edit bridges';$('cutCheck').before(bridgeEditorButton);
const bridgeDialog=document.createElement('dialog');bridgeDialog.id='bridgeEditor';bridgeDialog.setAttribute('aria-labelledby','bridgeEditorTitle');
bridgeDialog.innerHTML='<div class="crop-heading"><h2 id="bridgeEditorTitle">Edit bridges</h2><button id="closeBridgeEditor" aria-label="Cancel bridge editing" title="Cancel"><i data-lucide="x"></i></button></div><label class="stack">Layer<select id="bridgeLayer"></select></label><div class="bridge-tools"><button id="addManualBridge" aria-label="Add bridge" title="Add bridge: choose two material endpoints"><i data-lucide="plus"></i></button><button id="deleteManualBridge" aria-label="Delete selected bridge" title="Delete selected bridge"><i data-lucide="trash-2"></i></button><button id="undoManualBridge" aria-label="Undo bridge edit" title="Undo bridge edit"><i data-lucide="undo-2"></i></button><button id="resetManualBridges" title="Restore automatic bridges"><i data-lucide="rotate-ccw"></i>Automatic</button><select id="bridgeSelection" aria-label="Selected bridge"></select></div><svg id="bridgeCanvas" aria-label="Bridge editing canvas" role="img"></svg><div class="fields"><label class="stack">Width (mm)<input id="manualBridgeWidth" type="number" min="0.5" max="12" step="0.25" value="2"></label><label class="stack">Curve<div class="range"><input id="manualBridgeCurve" type="range" min="-50" max="50" value="0"><output id="manualBridgeCurveOut">0</output></div></label></div><p id="bridgeEditStatus" role="status"></p><button id="applyManualBridges" class="primary wide"><i data-lucide="check"></i>Apply bridges</button>';
document.body.append(bridgeDialog);
let bridgeDrafts=new Map(),bridgeActive=0,bridgeSelection=-1,bridgeAdding=false,bridgeStart=null,bridgeDrag=null,bridgeHistory=[],bridgeBase=[],bridgeBaseRevision=0;
const bridgeSvg=$('bridgeCanvas');
let bridgeView=null,bridgePan=null;
const bridgeTasks=new Set();
$('resetManualBridges').lastChild.textContent='Reset bridges';
function bridgePreviewJob(layer,options){
  const raw=preparedContours(layer),pins=state.registration&&layer.framed,worker=new Worker('cleanup-worker.js');
  return new Promise((resolve,reject)=>{
    const finish=(error,result)=>{clearTimeout(timer);worker.terminate();bridgeTasks.delete(cancel);error?reject(error):resolve(result);};
    const cancel=()=>finish(Error('Preview cancelled'));
    const timer=setTimeout(()=>finish(Error('Layer preview timed out')),60000);bridgeTasks.add(cancel);
    worker.onmessage=({data})=>data.results?.[0]?.error?finish(Error('Layer preview failed')):finish(null,data.results[0]);
    worker.onerror=()=>finish(Error('Layer preview failed'));
    worker.postMessage({jobs:[{rings:pins?raw.slice(0,-4):raw,holes:pins?raw.slice(-4):[],feature:cutFeature(),options}]});
  });
}
function activeBridgeLayer(){return state.layers[bridgeActive];}
function bridgeDraft(){return bridgeDrafts.get(activeBridgeLayer().id);}
function cloneBridges(a){return JSON.parse(JSON.stringify(a));}
function rememberBridgeEdit(){bridgeHistory.push(cloneBridges(bridgeDraft()));if(bridgeHistory.length>50)bridgeHistory.shift();}
function bridgeSvgPoint(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(bridgeSvg.getScreenCTM().inverse());return [Math.max(0,Math.min(1,p.x/state.w)),Math.max(0,Math.min(1,p.y/state.h))];}
function pointString(points){return points.map(([x,y])=>`${x*state.w},${y*state.h}`).join(' ');}
function curveBridge(b,amount){const a=b.points[0],z=b.points.at(-1),dx=z[0]*state.w-a[0]*state.w,dy=z[1]*state.h-a[1]*state.h;
  b.curve=amount;b.points=Array.from({length:65},(_,i)=>{const t=i/64,bend=4*t*(1-t)*amount/100;return [a[0]+(z[0]-a[0])*t-dy/state.w*bend,a[1]+(z[1]-a[1])*t+dx/state.h*bend];});
}
function paintBridgeEditor(){
  const draft=bridgeDraft()||[],b=draft[bridgeSelection];
  bridgeView ||= [-5,-5,state.w+10,state.h+10];bridgeSvg.setAttribute('viewBox',bridgeView.join(' '));
  bridgeSvg.innerHTML=`<path d="${path(bridgeBase)}" fill="#c1cfc8" fill-rule="evenodd" stroke="#607b6c" stroke-width=".2"/>`+draft.map((b,i)=>`<polyline data-bridge="${i}" points="${pointString(b.points)}" fill="none" stroke="${i===bridgeSelection?'#ed3d82':'#277865'}" stroke-width="${b.width}" stroke-linecap="round" stroke-linejoin="round"/><polyline data-bridge="${i}" points="${pointString(b.points)}" fill="none" stroke="transparent" stroke-width="12" vector-effect="non-scaling-stroke"/>`).join('')+(b?[b.points[0],b.points.at(-1)].map((p,i)=>`<circle data-endpoint="${i}" cx="${p[0]*state.w}" cy="${p[1]*state.h}" r="${Math.max(state.w,state.h)*.009}" fill="#fff" stroke="#ed3d82" stroke-width="1" vector-effect="non-scaling-stroke"/>`).join(''):'')+(bridgeStart?`<circle cx="${bridgeStart[0]*state.w}" cy="${bridgeStart[1]*state.h}" r="2" fill="#ed3d82"/>`:'');
  $('bridgeSelection').innerHTML='<option value="-1">Select bridge</option>'+draft.map((_,i)=>`<option value="${i}">Bridge ${i+1}</option>`).join('');$('bridgeSelection').value=String(bridgeSelection);
  $('manualBridgeWidth').disabled=$('manualBridgeCurve').disabled=$('deleteManualBridge').disabled=!b;
  if(b){$('manualBridgeWidth').value=b.width;$('manualBridgeCurve').value=b.curve||0;$('manualBridgeCurveOut').value=b.curve||0;}
  $('undoManualBridge').disabled=!bridgeHistory.length;$('addManualBridge').classList.toggle('active',bridgeAdding);$('addManualBridge').setAttribute('aria-pressed',String(bridgeAdding));
  $('bridgeEditStatus').textContent=bridgeAdding?(bridgeStart?'Choose the second endpoint.':'Choose the first endpoint.'):`${draft.length} bridges`;
}
async function loadBridgeLayer(){
  const revision=++bridgeBaseRevision,layer=activeBridgeLayer();for(const cancel of bridgeTasks)cancel();bridgeView=null;bridgeSelection=-1;bridgeAdding=false;bridgeStart=null;bridgeHistory=[];
  contours(layer);if(!bridgeDrafts.has(layer.id))bridgeDrafts.set(layer.id,layer.manualBridges?cloneBridges(layer.manualBridges):(cutCache.get(layer)?.bridgeDefinitions||[]).map(b=>({...b,points:b.points.map(([x,y])=>[x/state.w,y/state.h])})));
  $('bridgeEditStatus').textContent='Preparing layer...';$('applyManualBridges').disabled=true;
  try{const result=await bridgePreviewJob(layer,{...cutOptions(layer),bridgeWidth:0,manualBridges:[]});if(revision!==bridgeBaseRevision)return;bridgeBase=result.rings;paintBridgeEditor();$('applyManualBridges').disabled=false;}catch(e){if(revision===bridgeBaseRevision)$('bridgeEditStatus').textContent=e.message;}
}
bridgeEditorButton.onclick=()=>{if(state.preset!=='image'||studioRendering.pending||importBusy){message('Generate image layers and wait for the preview before editing bridges.');return;}bridgeDrafts=new Map();$('bridgeLayer').innerHTML=state.layers.map((l,i)=>l.kind==='image'?`<option value="${i}">${esc(l.name)}</option>`:'').join('');bridgeActive=state.layers[selected]?.kind==='image'?selected:state.layers.findIndex(l=>l.kind==='image');if(bridgeActive<0)return;$('bridgeLayer').value=String(bridgeActive);bridgeDialog.showModal();loadBridgeLayer();};
$('bridgeLayer').onchange=()=>{bridgeActive=Number($('bridgeLayer').value);loadBridgeLayer();};
$('bridgeSelection').onchange=()=>{bridgeSelection=Number($('bridgeSelection').value);paintBridgeEditor();};
$('addManualBridge').onclick=()=>{bridgeAdding=!bridgeAdding;bridgeStart=null;paintBridgeEditor();};
$('deleteManualBridge').onclick=()=>{if(bridgeSelection<0)return;rememberBridgeEdit();bridgeDraft().splice(bridgeSelection,1);bridgeSelection=-1;paintBridgeEditor();};
$('undoManualBridge').onclick=()=>{if(!bridgeHistory.length)return;bridgeDrafts.set(activeBridgeLayer().id,bridgeHistory.pop());bridgeSelection=-1;paintBridgeEditor();};
$('resetManualBridges').onclick=async()=>{const layer=activeBridgeLayer(),revision=++bridgeBaseRevision,options={...cutOptions(layer)};delete options.manualBridges;$('applyManualBridges').disabled=true;try{const result=await bridgePreviewJob(layer,options);if(revision!==bridgeBaseRevision)return;rememberBridgeEdit();bridgeDrafts.set(layer.id,(result.bridgeDefinitions||[]).map(b=>({...b,points:b.points.map(([x,y])=>[x/state.w,y/state.h])})));bridgeSelection=-1;paintBridgeEditor();}catch(e){if(revision===bridgeBaseRevision)$('bridgeEditStatus').textContent=e.message;}finally{if(revision===bridgeBaseRevision)$('applyManualBridges').disabled=false;}};
$('manualBridgeWidth').onchange=()=>{const b=bridgeDraft()[bridgeSelection],width=number('manualBridgeWidth',.5,12);if(!b||b.width===width)return;rememberBridgeEdit();b.width=width;paintBridgeEditor();};
$('manualBridgeCurve').onpointerdown=()=>{if(bridgeSelection>=0)rememberBridgeEdit();};
$('manualBridgeCurve').onkeydown=e=>{if(bridgeSelection>=0&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key))rememberBridgeEdit();};
$('manualBridgeCurve').oninput=()=>{const b=bridgeDraft()[bridgeSelection];if(b){curveBridge(b,Number($('manualBridgeCurve').value));paintBridgeEditor();}};
bridgeSvg.onpointerdown=e=>{
  if(e.button!==0||$('applyManualBridges').disabled)return;const p=bridgeSvgPoint(e);
  if(bridgeAdding){if(!bridgeStart)bridgeStart=p;else{rememberBridgeEdit();bridgeDraft().push({points:[bridgeStart,p],width:cutSettings().bridgeWidth,curve:0});bridgeSelection=bridgeDraft().length-1;curveBridge(bridgeDraft()[bridgeSelection],10);bridgeAdding=false;bridgeStart=null;}paintBridgeEditor();return;}
  const endpoint=e.target.dataset.endpoint,index=e.target.dataset.bridge;if(index!==undefined)bridgeSelection=Number(index);
  if(endpoint===undefined&&index===undefined){bridgePan={id:e.pointerId,x:e.clientX,y:e.clientY,matrix:bridgeSvg.getScreenCTM().inverse(),view:[...bridgeView]};bridgeSvg.setPointerCapture(e.pointerId);return;}if(bridgeSelection<0)return;
  if(endpoint!==undefined||index!==undefined){rememberBridgeEdit();bridgeDrag={id:e.pointerId,start:p,points:cloneBridges(bridgeDraft()[bridgeSelection].points),endpoint:endpoint===undefined?null:Number(endpoint)};bridgeSvg.setPointerCapture(e.pointerId);e.preventDefault();}paintBridgeEditor();
};
bridgeSvg.onpointermove=e=>{if(bridgePan?.id===e.pointerId){const d=bridgePan,a=new DOMPoint(d.x,d.y).matrixTransform(d.matrix),b=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.matrix);bridgeView=[d.view[0]+a.x-b.x,d.view[1]+a.y-b.y,d.view[2],d.view[3]];bridgeSvg.setAttribute('viewBox',bridgeView.join(' '));return;}if(!bridgeDrag||bridgeDrag.id!==e.pointerId)return;const p=bridgeSvgPoint(e),d=bridgeDrag,b=bridgeDraft()[bridgeSelection],dx=p[0]-d.start[0],dy=p[1]-d.start[1];b.points=d.points.map(([x,y],i)=>{const t=i/(d.points.length-1),weight=d.endpoint===null?1:d.endpoint===0?1-t:t;return [Math.max(0,Math.min(1,x+dx*weight)),Math.max(0,Math.min(1,y+dy*weight))];});paintBridgeEditor();};
bridgeSvg.addEventListener('wheel',e=>{e.preventDefault();if(!bridgeView)return;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(bridgeSvg.getScreenCTM().inverse()),factor=Math.max((state.w+10)/30/bridgeView[2],Math.min((state.w+10)*2/bridgeView[2],Math.exp(e.deltaY*.001)));bridgeView=[p.x+(bridgeView[0]-p.x)*factor,p.y+(bridgeView[1]-p.y)*factor,bridgeView[2]*factor,bridgeView[3]*factor];bridgeSvg.setAttribute('viewBox',bridgeView.join(' '));},{passive:false});
for(const event of ['pointerup','pointercancel','lostpointercapture'])bridgeSvg.addEventListener(event,e=>{if(bridgeDrag?.id===e.pointerId){bridgeDrag=null;if(bridgeSvg.hasPointerCapture(e.pointerId))bridgeSvg.releasePointerCapture(e.pointerId);}});
bridgeSvg.addEventListener('pointerup',()=>{bridgePan=null;});bridgeSvg.addEventListener('pointercancel',()=>{bridgePan=null;});
$('closeBridgeEditor').onclick=()=>bridgeDialog.close();bridgeDialog.addEventListener('close',()=>{bridgeBaseRevision++;bridgeDrag=null;bridgePan=null;for(const cancel of bridgeTasks)cancel();});
$('applyManualBridges').onclick=()=>{for(const l of state.layers)if(bridgeDrafts.has(l.id))l.manualBridges=cloneBridges(bridgeDrafts.get(l.id));bridgeDialog.close();showSource(false);render();message('Bridge edits applied. Checking connections...');};
const validateBridges=validate;validate=function(s){for(const l of s?.layers||[])if(l.manualBridges!==undefined&&(!Array.isArray(l.manualBridges)||l.manualBridges.length>600||!l.manualBridges.every(b=>Number.isFinite(b.width)&&b.width>=.5&&b.width<=12&&Array.isArray(b.points)&&b.points.length>=2&&b.points.length<=1000&&b.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=-1&&n<=2)))))throw Error('Invalid manual bridges');return validateBridges(s);};
icons();
