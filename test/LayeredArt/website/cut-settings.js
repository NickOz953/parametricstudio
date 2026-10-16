'use strict';
const cutDefaults={enabled:true,feature:2,machine:'laser',tool:3.175,preserveDetail:true};
const cutSettings=()=>({...cutDefaults});
const cutFeature=()=>cutSettings().feature;
const cutCache=new WeakMap();
const bridgeHighlightCache=new WeakMap(),emptyBridgeRings=[];
let showBridgeVoids=false;
function bridgeHighlights(layer){
  if(!showBridgeVoids)return emptyBridgeRings;
  const index=state.layers.indexOf(layer),below=state.layers[index+1];
  if(!below)return emptyBridgeRings;
  const bridges=cutCache.get(layer)?.bridgeRings;
  if(!bridges?.length)return emptyBridgeRings;
  const lower=contours(below),cached=bridgeHighlightCache.get(layer);
  if(cached?.bridges===bridges&&cached.lower===lower)return cached.rings;
  const rings=CutCleanup.unsupported(bridges,lower);bridgeHighlightCache.set(layer,{bridges,lower,rings});return rings;
}
function bridgeHighlightMarkup(layer){const rings=bridgeHighlights(layer);return rings.length?`<path data-bridge-highlight="true" d="${path(rings)}" fill="#ef3d83" fill-rule="evenodd" stroke="none" pointer-events="none"/>`:'';}
const cutPanel=document.createElement('section');cutPanel.id='cutSettingsPanel';
cutPanel.hidden=true;
cutPanel.innerHTML='<div class="section-title">CUT CLEANUP <input id="cutCleanup" type="checkbox" aria-label="Cut cleanup" checked></div><label class="stack">Minimum detail (mm)<div class="range"><input id="cutFeature" aria-label="Minimum detail in millimeters" type="range" min="1" max="8" step="0.25" value="2"><output id="cutFeatureOut">2 mm</output></div></label><p id="cutCheck" class="note" role="status"></p>';
document.querySelector('.right section').after(cutPanel);
const detailControl=document.createElement('label');detailControl.className='check';detailControl.innerHTML='<input id="preserveDetail" type="checkbox" checked> Preserve image detail';$('cutCheck').before(detailControl);
function cutOptions(layer){const s=cutSettings(),preset=state.mandalaPreset?null:state.kaleidoscope,top=!!preset&&layer===state.layers[0]&&Number.isFinite(preset.topBorder);return {preserveDetail:!s.enabled||layer.kind==='back'||layer.kind==='image'&&s.preserveDetail,positiveFill:layer.kind==='image',allowConnections:false,requireConnected:false,bridgeWidth:0,frame:state.frameEnabled!==false&&layer.kind==='image'&&layer.framed?{width:state.w,height:state.h,border:top?preset.topBorder:state.border}:undefined};}
function syncCutSettings(){const s=cutSettings();if(state.cutSettings)state.cutSettings=s;$('cutCleanup').checked=s.enabled;$('cutFeature').value=s.feature;$('cutFeatureOut').value=s.feature+' mm';$('preserveDetail').checked=s.preserveDetail;$('preserveDetail').disabled=!s.enabled;detailControl.hidden=state.preset!=='image';$('cutFeature').disabled=state.preset==='image'&&s.preserveDetail;}
function updateCutSettings(){state.cutSettings={enabled:$('cutCleanup').checked,machine:'laser',feature:number('cutFeature',1,8),tool:cutDefaults.tool,preserveDetail:$('preserveDetail').checked};syncCutSettings();showSource(false);draw();}
$('cutFeature').oninput=updateCutSettings;
for(const id of ['cutCleanup','preserveDetail'])$(id).onchange=updateCutSettings;
const beforeCutContours=contours;
function localCutKey(layer){return JSON.stringify([state.w,state.h,state.border,state.frameEnabled,state.backingEnabled,state.kaleidoscope?.topBorder,layer===state.layers[0],state.registration,state.diameter,state.inset,state.roundness,state.text,state.mandala,state.cutSettings,state.layers.length,layer.level,layer.kind,layer.framed,layer.kind==='text'&&!!font]);}
function cutGeometryKey(layer){return state.preset==='image'?JSON.stringify(state.layers.map(l=>[previewObjectId(l),previewObjectId(l.polygons),localCutKey(l)])):localCutKey(layer);}
function supportBoard(){return state.preset==='image'?{width:state.w,height:state.h,backing:state.backingEnabled!==false,inset:state.frameEnabled===false?state.border:0}:null;}
function cutJob(layer){const raw=preparedContours(layer),pins=state.frameEnabled!==false&&state.registration&&layer.kind!=='text'&&(layer.kind!=='image'||layer.framed);return {rings:pins?raw.slice(0,-4):raw,holes:pins?raw.slice(-4):[],feature:cutFeature(),options:cutOptions(layer)};}
function flushStack(){if(state.preset==='image'){state.layers.forEach(l=>l.gap=0);$('gap').value=0;$('gap').disabled=true;}}
const rawGeometryCache=new WeakMap();
function preparedContours(layer){
  const key=localCutKey(layer),cached=rawGeometryCache.get(layer);
  if(cached?.key===key&&cached.polygons===layer.polygons)return cached.rings;
  let rings=beforeCutContours(layer);if(state.frameEnabled===false){const pins=state.registration&&layer.kind!=='text'&&(layer.kind!=='image'||layer.framed);rings=clipToArtwork(pins?rings.slice(0,-4):rings);}rawGeometryCache.set(layer,{key,polygons:layer.polygons,rings});return rings;
}
const studioRendering=window.studioRendering={pending:false};
let previewWorker,previewTimer,previewDeadline,previewRevision=0,previewSignature='',previewPaint;
const previewObjectIds=new WeakMap();let previewNextId=0;
function previewObjectId(value){if(!value)return 0;if(!previewObjectIds.has(value))previewObjectIds.set(value,++previewNextId);return previewObjectIds.get(value);}
function previewBusy(on){studioRendering.pending=on;$('stage').setAttribute('aria-busy',String(on||importBusy));$('export').disabled=on||importBusy||state.preset==='empty';$('download').disabled=on;}
function requestStudioDraw(paint){
  flushStack();
  previewPaint=paint;
  let jobs=state.layers.map(layer=>({layer,key:cutGeometryKey(layer),polygons:layer.polygons}));
  const dirty=jobs.filter(j=>{const c=cutCache.get(j.layer);return c?.key!==j.key||c.polygons!==j.polygons;});
  if(!dirty.length)jobs=[];else if(!supportBoard())jobs=dirty;
  const signature=jobs.map(j=>previewObjectId(j.layer)+':'+previewObjectId(j.polygons)+':'+j.key).join('|');
  if(studioRendering.pending&&signature===previewSignature)return;
  const revision=++previewRevision;previewSignature=signature;clearTimeout(previewTimer);clearTimeout(previewDeadline);previewWorker?.terminate();previewWorker=null;
  if(!jobs.length){previewBusy(false);paint();return;}
  previewBusy(true);$('status').textContent='Updating cut geometry...';
  // Coalesce rapid slider events; never display a completed obsolete job.
  previewTimer=setTimeout(async()=>{
    const work=[];
    for(const job of jobs){
      if(revision!==previewRevision)return;
      try{
        work.push(cutJob(job.layer));
      }catch(error){work.push({rings:[],holes:[],feature:cutFeature(),invalid:true});}
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(revision!==previewRevision)return;
    const finish=results=>{
      if(revision!==previewRevision)return;
      clearTimeout(previewDeadline);previewWorker?.terminate();previewWorker=null;
      jobs.forEach((j,i)=>cutCache.set(j.layer,{...results[i],key:j.key,polygons:j.polygons}));
      previewBusy(false);previewPaint();updateImportUI();$('status').textContent=results.some(r=>r.error)?'Cut cleanup failed. Adjust the detail setting.':'Preview up to date';
    };
    try{
      previewWorker=new Worker('cleanup-worker.js');
      previewWorker.onmessage=({data})=>finish(data.results);
      previewWorker.onerror=()=>finish(jobs.map(()=>({rings:[],error:true})));
      previewDeadline=setTimeout(()=>finish(jobs.map(()=>({rings:[],error:true}))),60000);
      previewWorker.postMessage({jobs:work,board:supportBoard()});
    }catch(error){finish(jobs.map(()=>({rings:[],error:true})));}
  },65);
}
addEventListener('pagehide',()=>{previewWorker?.terminate();clearTimeout(previewTimer);clearTimeout(previewDeadline);});
contours=function(layer){
  const key=cutGeometryKey(layer);
  const cached=cutCache.get(layer);if(cached?.key===key&&cached.polygons===layer.polygons)return cached.rings;
  if(supportBoard()){
    const jobs=state.layers.map(l=>{try{return cutJob(l);}catch(error){return {invalid:true};}});
    const results=CutCleanup.stack(jobs,supportBoard());
    state.layers.forEach((l,i)=>cutCache.set(l,{...results[i],key:cutGeometryKey(l),polygons:l.polygons}));
    return cutCache.get(layer)?.rings||[];
  }
  try{
    const raw=preparedContours(layer),hasHoles=state.frameEnabled!==false&&state.registration&&layer.kind!=='text'&&(layer.kind!=='image'||layer.framed);
    const result=CutCleanup.clean(hasHoles?raw.slice(0,-4):raw,cutFeature(),hasHoles?raw.slice(-4):[],false,cutOptions(layer));
    cutCache.set(layer,{...result,key,polygons:layer.polygons});return result.rings;
  }catch(error){cutCache.set(layer,{key,polygons:layer.polygons,rings:[],error:true});return [];}
};
function showCutCheck(){
  const layer=state.layers[selected],s=cutSettings();
  contours(layer);
  const result=cutCache.get(layer);
  let text=result?.error?'Cleanup failed. This layer cannot be exported.':!s.enabled?'Detail cleanup off. Overlapping cut paths resolved.':result&&!result.rings.length?'No material remains at this detail size. Reduce minimum detail.':layer.kind==='image'&&s.preserveDetail?'Original image detail retained.':`Rounded cleanup: ${cutFeature().toFixed(2)} mm detail threshold.`;
  if(result?.supported)text+=result.backing?' Solid backing layer.':state.backingEnabled===false&&layer===state.layers.at(-1)?' No backing below this layer; detached pieces need separate support.':' Full material support on the layer below. Glue layers without spacers.';
  else if(s.enabled&&result?.pieces>1)text+=` ${result.pieces} separate pieces remain; check their support.`;
  if(result?.smallPiecesRemoved)text+=` ${result.smallPiecesRemoved} pieces below 2 mm\u00b2 removed.`;
  if(result?.smallCutoutsRemoved)text+=' Microscopic cutouts below 2 mm\u00b2 filled; registration holes retained.';
  if(result?.touching)text+=' Some contours touch at a point; inspect these in CAM.';
  if(state.registration&&layer.framed&&state.inset+state.diameter/2>state.border)text+=' Registration holes may reach the inner frame edge; check their placement before cutting.';
  text+=' Check kerf, material strength and toolpaths before cutting.';
  $('cutCheck').textContent=text;
}
const beforeCutDraw=draw;draw=function(){beforeCutDraw();showCutCheck();};
const beforeCutImportUI=updateImportUI;updateImportUI=function(){
  beforeCutImportUI();
  const l=state.layers[selected],c=cutCache.get(l);
  if(state.preset==='image'&&cutSettings().enabled&&c){$('cutReview').textContent=c.error?'Cut cleanup failed.':`${c.rings.length} cut contours; ${c.pieces===1?'1 connected piece':c.pieces+' separate pieces'}. Check narrow features before cutting.`;$('cutReview').classList.toggle('warn',!!c.error||c.pieces!==1);}
};
const beforeCutSchedule=schedule;schedule=function(layers=state.layers.filter(l=>l.visible)){
  return beforeCutSchedule(layers.map(l=>{if(l.kind!=='image'||!cutSettings().enabled)return l;contours(l);return {...l,pieces:cutCache.get(l)?.pieces||0};}));
};
const beforeCutSync=sync;sync=function(){beforeCutSync();syncCutSettings();};
const beforeCutValidate=validate;validate=function(s){
  const c=s?.cutSettings;
  if(c&&(['preserveDetail','connectIslands'].some(k=>c[k]!==undefined&&typeof c[k]!=='boolean')||c.bridgeWidth!==undefined&&(!Number.isFinite(c.bridgeWidth)||c.bridgeWidth<.5||c.bridgeWidth>6)))throw Error('Invalid connection settings');
  if(c?.removeDetached!==undefined&&typeof c.removeDetached!=='boolean')throw Error('Invalid detached-piece setting');
  if(c&&(typeof c.enabled!=='boolean'||!['laser','cnc'].includes(c.machine)||!Number.isFinite(c.feature)||c.feature<1||c.feature>8||!Number.isFinite(c.tool)||c.tool<.5||c.tool>12))throw Error('Invalid cut settings');
  const valid=beforeCutValidate(s);if(valid.cutSettings){valid.cutSettings.machine='laser';valid.cutSettings.tool=cutDefaults.tool;}return valid;
};
const beforeCutExport=exportLayers;exportLayers=function(single=false){
  if(studioRendering.pending){message('Wait for the cut preview to finish updating.');return;}
  const layers=single?[state.layers[selected]]:state.layers.filter(l=>!$('visibleOnly').checked||l.visible);
  if(!single&&supportBoard()&&!layers.includes(state.layers.at(-1))){message('Include the bottom backing layer when exporting the assembly.');return;}
  if(layers.some(l=>!contours(l).length)){message('An empty or invalid cut layer cannot be exported. Reduce cleanup or remove that layer.');return;}
  beforeCutExport(single);
};
syncCutSettings();render();
const assemblyGuideScript=document.createElement('script');assemblyGuideScript.src='assembly-guide.js';document.head.append(assemblyGuideScript);
