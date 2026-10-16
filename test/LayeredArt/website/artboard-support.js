'use strict';
function clipToArtwork(rings){
 const C=ClipperLib,scale=1000,b=state.border,paths=rings.map(r=>r.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}))),clip=new C.Clipper(),result=[];
 clip.StrictlySimple=true;clip.AddPaths(paths,C.PolyType.ptSubject,true);clip.AddPath([[b,b],[state.w-b,b],[state.w-b,state.h-b],[b,state.h-b]].map(([x,y])=>({X:x*scale,Y:y*scale})),C.PolyType.ptClip,true);
 clip.Execute(C.ClipType.ctIntersection,result,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftNonZero);return result.map(r=>r.map(p=>[p.X/scale,p.Y/scale]));
}
(()=>{
 const controls=document.createElement('div');controls.innerHTML='<label class="check"><input id="artboardFrame" type="checkbox" checked> Frame</label><label class="check"><input id="artboardBacking" type="checkbox" checked> Backing layer</label><p id="supportWarning" class="note" role="status" hidden>Without the frame or backing, detached pieces may need separate support and placement.</p>';$('border').closest('label').after(controls);
 const signature=()=>state.layers.map(l=>l.id).join('|'),handled=new WeakSet();
 function reconcile(){
  if(state.backingEnabled===false){
   if(!handled.has(state.layers)&&state.layers.length>1&&state.trimmedLayerIds!==signature())state.removedBacking=state.layers.pop();
   state.trimmedLayerIds=signature();
  }else if(state.removedBacking){if(state.trimmedLayerIds===signature())state.layers.push(state.removedBacking);delete state.removedBacking;delete state.trimmedLayerIds;}
  if(state.backingEnabled===false)handled.add(state.layers);else handled.delete(state.layers);
  selected=Math.max(0,Math.min(selected,state.layers.length-1));
  $('artboardFrame').checked=state.frameEnabled!==false;$('artboardBacking').checked=state.backingEnabled!==false;$('supportWarning').hidden=state.frameEnabled!==false&&state.backingEnabled!==false;
 }
 const oldSync=sync;sync=function(){reconcile();oldSync();};const oldRender=render;render=function(){reconcile();oldRender();};
 function update(){state.frameEnabled=$('artboardFrame').checked;state.backingEnabled=$('artboardBacking').checked;reconcile();render();if(activeWorkflow==='mandalas'&&state.mandalaPresetDraft)previewOrnamental();else if(activeWorkflow==='topographic'&&state.topographyDraft)paintTopographicPreview();}
 $('artboardFrame').onchange=$('artboardBacking').onchange=update;
 const oldValidate=validate;validate=function(s){for(const key of ['frameEnabled','backingEnabled'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('Invalid artboard support option');if(s.removedBacking){if(s.backingEnabled!==false||s.trimmedLayerIds!==s.layers.map(l=>l.id).join('|'))throw Error('Invalid saved backing');oldValidate({...s,layers:[...s.layers,s.removedBacking],removedBacking:undefined});}return oldValidate(s);};
 reconcile();
})();
