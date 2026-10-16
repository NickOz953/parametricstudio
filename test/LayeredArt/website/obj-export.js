'use strict';
(()=>{
 for(const [value,label]of [['obj','OBJ + MTL · colored 3D model (ZIP)'],['stl','STL · 3D model (no colors)']]){const option=document.createElement('option');option.value=value;option.textContent=label;$('format').append(option);}
 const description=$('exportDialog').querySelector('form > p'),originalDescription=description.textContent;
 const oldOptions=exportOptions;exportOptions=function(){oldOptions();const format=$('format').value,model=format==='obj'||format==='stl';$('packaging').parentElement.hidden=model;$('exportLayout').parentElement.hidden=model||$('packaging').value!=='combined';description.textContent=model?'Assembled layers in millimeters. Separate layer shells; check gaps and supports before printing.':originalDescription;if(model){$('download').innerHTML='<i data-lucide="download"></i>Download '+(format==='obj'?'OBJ ZIP':'STL');icons();}};
 $('format').onchange=$('packaging').onchange=exportOptions;
 function mesh(rings,depth,signal,format){return new Promise((resolve,reject)=>{
  const worker=new Worker('mesh-worker.js');let done=false;
  const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();signal?.removeEventListener('abort',abort);err?reject(err):resolve(data);};
  const abort=()=>finish(Error(format+' export cancelled.'));
  const timer=setTimeout(()=>finish(Error(format+' geometry timed out. Try fewer layers or a simpler pattern.')),60000);
  worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data);worker.onerror=()=>finish(Error('Could not build '+format+' geometry.'));
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}worker.postMessage({rings,depth});
 });}
 async function* layerMeshes(layers,height,progress,signal,format){
  if(!layers.length)throw Error('No layers selected for export.');
  if(!Number.isFinite(height)||height<=0)throw Error('Invalid artboard height.');
  let z=0,total=0;
  for(let i=0;i<layers.length;i++){
   const l=layers[i];
   if(!Number.isFinite(l.thickness)||l.thickness<=0||!Number.isFinite(l.gap)||l.gap<0)throw Error('Invalid layer thickness or gap.');
   if(i)z+=l.gap;progress(i+1,layers.length);
   const {positions:p,normals:n}=await mesh(l.rings,l.thickness,signal,format);total+=p.length/3;if(total>6000000)throw Error(format+' export exceeds the geometry memory limit.');
   if(!p.length||p.length%9||n.length!==p.length||p.some(v=>!Number.isFinite(v))||n.some(v=>!Number.isFinite(v)))throw Error('Invalid or empty layer geometry.');
   yield {layer:l,positions:p,normals:n,z,index:i};z+=l.thickness;
  }
 }
 window.buildOBJFiles=async function(layers,height,progress=()=>{},signal){
  const obj=['# Layered Art Studio\n# Coordinates in millimeters; Z up\nmtllib artwork.mtl\ns off\n'],mtl=['# Layer colors\n'];let offset=1;
  for await(const {layer:l,positions:p,normals:n,z,index:i}of layerMeshes(layers,height,progress,signal,'OBJ')){
   const name=l.id+'_'+slug(l.name),material='material_'+i;obj.push(`o ${name}\nusemtl ${material}\n`);
   if(!/^#[0-9a-f]{6}$/i.test(l.color))throw Error('Invalid layer color.');
   const rgb=[1,3,5].map(k=>(parseInt(l.color.slice(k,k+2),16)/255).toFixed(6));mtl.push(`newmtl ${material}\nKd ${rgb.join(' ')}\nKa 0 0 0\nKs 0 0 0\nd 1\nillum 1\n\n`);
   // Rotate 180 degrees around X, as in the preview, retaining outward winding.
   for(let j=0;j<p.length;j+=3)obj.push(`v ${p[j]} ${height-p[j+1]} ${z+l.thickness-p[j+2]}\n`);
   for(let j=0;j<n.length;j+=3)obj.push(`vn ${n[j]} ${-n[j+1]} ${-n[j+2]}\n`);
   for(let j=0;j<p.length/3;j+=3){const a=offset+j;obj.push(`f ${a}//${a} ${a+1}//${a+1} ${a+2}//${a+2}\n`);}offset+=p.length/3;
  }
  return {'artwork.obj':fflate.strToU8(obj.join('')),'artwork.mtl':fflate.strToU8(mtl.join('')),'README.txt':fflate.strToU8('Layered Art Studio - OBJ export\nExtract all files into the same folder. Import artwork.obj with artwork.mtl beside it.\nCoordinates are millimeters (OBJ does not declare units). Z is up; X/Y are the artboard plane.\nObjects are ordered bottom to top. Layer thicknesses and physical gaps are included; preview separation is excluded.\nMTL supplies the assigned layer colors, not textures. Material support varies by importer.\nSeparate objects may contain disconnected pieces. This is not a fused, printer-ready solid; inspect supports, gaps and mesh suitability before fabrication.\n')};
 };
 window.buildSTLFile=async function(layers,height,progress=()=>{},signal){
  const parts=[],header=new Uint8Array(84);header.set(new TextEncoder().encode('Layered Art Studio | millimeters | Z up | assembled layers'));let triangles=0;
  for await(const {layer:l,positions:p,normals:n,z}of layerMeshes(layers,height,progress,signal,'STL')){
   const count=p.length/9,buffer=new ArrayBuffer(count*50),view=new DataView(buffer);let at=0;
   const write=value=>{view.setFloat32(at,value,true);at+=4;};
   // Binary STL: outward normal, three vertices, then a zero attribute byte count.
   for(let j=0;j<p.length;j+=9){
    write(n[j]);write(-n[j+1]);write(-n[j+2]);
    for(let k=j;k<j+9;k+=3){write(p[k]);write(height-p[k+1]);write(z+l.thickness-p[k+2]);}
    view.setUint16(at,0,true);at+=2;
   }
   triangles+=count;parts.push(buffer);
  }
  new DataView(header.buffer).setUint32(80,triangles,true);
  return new Blob([header,...parts],{type:'model/stl'});
 };
 let busy=false;const oldExport=exportLayers;exportLayers=function(single=false){const format=$('format').value;if(format!=='obj'&&format!=='stl')return oldExport(single);if(busy)return;
  if(studioRendering.pending||importBusy){message('Wait for layer generation to finish.');return;}
  if((activeWorkflow==='mandalas'&&state.mandalaPresetDraft)||(activeWorkflow==='topographic'&&state.topographyDraft)||(activeWorkflow==='kaleidoscope'&&state.kaleidoscopeDraft)){message('Generate cut layers before exporting.');return;}
  if(state.preset==='image'&&state.source&&(state.w!==state.source.width||state.h!==state.source.height||state.border!==state.source.settings?.border)){message('Regenerate layers at the new dimensions before exporting.');return;}
  const chosen=single?[state.layers[selected]]:bottomToTop(state.layers.filter(l=>!$('visibleOnly').checked||l.visible));if(!chosen.length||!chosen[0]){message('No layers selected for export.');return;}
  if(chosen.some(l=>l.kind==='text')&&!font){message('Lettering is still loading.');return;}
  if(!single&&supportBoard()&&!chosen.includes(state.layers.at(-1))){message('Include the bottom backing layer when exporting the assembly.');return;}
  let layers;try{layers=chosen.map(l=>{const rings=contours(l);if(!rings.length||cutCache.get(l)?.error)throw Error('An empty or invalid cut layer cannot be exported.');return {id:cutLayerId(l),name:l.name,color:l.color,thickness:l.thickness,gap:l.gap,rings:rings.map(r=>r.map(p=>p.slice()))};});}catch(e){message(e.message);return;}
  const height=state.h,filename=format==='obj'?slug(state.name)+'-3d.zip':(single?layers[0].id+'-'+slug(layers[0].name):slug(state.name))+'-3d.stl',controller=new AbortController(),cancel=()=>controller.abort();$('exportDialog').addEventListener('close',cancel,{once:true});busy=true;
  const controls=[$('download'),$('single'),$('format'),$('packaging'),$('visibleOnly')];controls.forEach(c=>c.disabled=true);
  const build=format==='obj'?buildOBJFiles:buildSTLFile;
  build(layers,height,(i,n)=>$('exportSummary').textContent=`Building ${format.toUpperCase()} layer ${i} of ${n}...`,controller.signal).then(result=>{if(controller.signal.aborted)return;if(format==='obj')download(fflate.zipSync(result),filename,'application/zip');else download(result,filename,'model/stl');message(format==='obj'?'OBJ and layer colors downloaded':'STL downloaded');}).catch(e=>message(e.message)).finally(()=>{busy=false;controls.forEach(c=>c.disabled=false);$('exportDialog').removeEventListener('close',cancel);exportOptions();summary();});
 };
})();
