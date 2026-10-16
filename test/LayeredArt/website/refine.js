'use strict';
const roundingCache=new WeakMap();
function roundRing(ring,amount,limit,maxSamples=1000,frame=null){
  if(!amount||ring.length<3)return ring;
  // Uniform arc-length samples make smoothing independent of tracing point density.
  const lengths=ring.map((p,i)=>Math.hypot(p[0]-ring[(i+1)%ring.length][0],p[1]-ring[(i+1)%ring.length][1]));
  const perimeter=lengths.reduce((a,b)=>a+b,0);if(perimeter<.1)return ring;
  const radius=amount/100*3,step=Math.max(Math.min(.5+radius*.65,Number.isFinite(limit)?Math.max(.4,limit):Infinity),perimeter/maxSamples),n=Math.max(6,Math.ceil(perimeter/step)),spacing=perimeter/n,samples=[];
  let edge=0,base=0;for(let i=0;i<n;i++){const d=i*spacing;while(edge<ring.length-1&&base+lengths[edge]<d){base+=lengths[edge++];}const t=lengths[edge]?(d-base)/lengths[edge]:0,a=ring[edge],b=ring[(edge+1)%ring.length];samples.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  const windowSize=Math.max(1,Math.min(Math.floor(n/4),Math.ceil(radius*2/spacing))),sigma=Math.max(.15,radius*.65);
  const weights=Array.from({length:windowSize*2+1},(_,j)=>Math.exp(-.5*((j-windowSize)*spacing/sigma)**2)),total=weights.reduce((a,b)=>a+b,0);
  const sides=frame?[[0,frame.border],[0,frame.width-frame.border],[1,frame.border],[1,frame.height-frame.border]]:[];
  const tolerance=frame?Math.max(.6,Math.max(frame.width,frame.height)/640):0;
  const locks=samples.map(p=>{let side=-1,d=tolerance;for(let j=0;j<sides.length;j++){const [axis,value]=sides[j],distance=Math.abs(p[axis]-value);if(distance<=d){side=j;d=distance;}}return side;});
  const controls=samples.map((p,i)=>{let x=0,y=0;for(let j=-windowSize;j<=windowSize;j++){const weight=weights[j+windowSize],q=samples[(i+j+n)%n];x+=q[0]*weight;y+=q[1]*weight;}x/=total;y/=total;const d=Math.hypot(x-p[0],y-p[1]),bound=Math.min(radius,limit);if(d>bound){x=p[0]+(x-p[0])*bound/d;y=p[1]+(y-p[1])*bound/d;}const result=[x,y];if(locks[i]>=0){const [axis,value]=sides[locks[i]];result[axis]=value;}return result;});
  // Meeting frame sides use their exact rectangular corner. Artwork junctions
  // still use the ordinary smooth transition when either control is unlocked.
  const midpoint=(i,j)=>{const a=controls[i],b=controls[j],p=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(locks[i]>=0&&locks[j]>=0&&sides[locks[i]][0]!==sides[locks[j]][0]){for(const k of [i,j]){const [axis,value]=sides[locks[k]];p[axis]=value;}}return p;};
  // Quadratic splines are used directly in SVG and sampled for DXF and 3D.
  const result=[];for(let i=0;i<n;i++){const p=controls[i],a=midpoint((i+n-1)%n,i),b=midpoint(i,(i+1)%n);for(let k=0;k<3;k++){const t=k/3,u=1-t;result.push([u*u*a[0]+2*u*t*p[0]+t*t*b[0],u*u*a[1]+2*u*t*p[1]+t*t*b[1]]);}}
  if(!frame)result.curveControls=controls;return result;
}
function roundedPath(ring){const c=ring.curveControls;if(!c)return 'M'+ring.map(q=>q.map(n=>n.toFixed(3)).join(',')).join('L')+'Z';const f=p=>p.map(v=>v.toFixed(3)).join(',');return 'M'+f([(c.at(-1)[0]+c[0][0])/2,(c.at(-1)[1]+c[0][1])/2])+c.map((p,i)=>'Q'+f(p)+' '+f([(p[0]+c[(i+1)%c.length][0])/2,(p[1]+c[(i+1)%c.length][1])/2])).join('')+'Z';}
const rawContours=contours;
contours=function(layer){const amount=state.roundness||0;if(layer.kind!=='image')return rawContours(layer);const key=[amount,state.w,state.h,state.border,layer.framed,state.registration,state.diameter,state.inset].join('|'),cached=roundingCache.get(layer);if(cached&&cached.key===key&&cached.polygons===layer.polygons)return cached.rings;const raw=rawContours(layer),pins=state.registration&&layer.framed?raw.slice(-4):[],material=pins.length?raw.slice(0,-4):raw,rings=[...CutCleanup.prepare(material),...pins],holeStart=rings.length-pins.length;
  const limit=state.source?.settings?.bridges?(state.source.settings.bridgeWidth||2)*.15:Infinity;
  const sampleBudget=Math.max(6,Math.min(1000,Math.floor(5000/Math.max(1,holeStart))));
  const result=rings.map((ring,i)=>{if(i>=holeStart)return ring;const outer=ring.every(p=>Math.min(Math.abs(p[0]),Math.abs(p[1]),Math.abs(p[0]-state.w),Math.abs(p[1]-state.h))<.03);const area=ring.reduce((sum,p,j)=>{const q=ring[(j+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0);const frame=layer.framed&&area<0?{width:state.w,height:state.h,border:state.border}:null;return outer?ring:roundRing(ring,amount,limit,sampleBudget,frame);});roundingCache.set(layer,{key,polygons:layer.polygons,rings:result});return result;};
const softness=document.createElement('label');softness.className='stack';softness.id='softnessControl';softness.innerHTML='Contour softness<div class="range"><input id="softness" type="range" min="0" max="100" value="55" aria-label="Contour softness"><output id="softnessOut">55%</output></div>';$('minArea').parentElement.after(softness);
state.roundness=55;let softnessFrame;
$('softness').oninput=()=>{state.roundness=Number($('softness').value);$('softnessOut').value=state.roundness+'%';showSource(false);cancelAnimationFrame(softnessFrame);softnessFrame=requestAnimationFrame(()=>{draw();$('status').textContent='Contour softness · '+state.roundness+'%';});};
const oldSync=sync;sync=function(){oldSync();$('softness').value=state.roundness||0;$('softnessOut').value=(state.roundness||0)+'%';};
// This control edits generated vectors; it must not trigger an image retrace notice.
$('softness').addEventListener('change',e=>e.stopPropagation());
const packaging=document.createElement('label');packaging.className='stack';packaging.innerHTML='Export as<select id="packaging"><option value="combined">All layers in one file</option><option value="separate">Separate files in ZIP</option></select>';$('format').parentElement.before(packaging);
const layout=document.createElement('label');layout.className='stack';layout.innerHTML='Arrangement<select id="exportLayout"><option value="sheet">Side by side</option><option value="stack">Aligned stack</option></select>';$('format').parentElement.after(layout);
$('visibleOnly').checked=false;document.querySelector('#exportDialog p').textContent='Named layers at full size in millimeters.';
function exportOptions(){const combined=$('packaging').value==='combined';layout.hidden=!combined;const both=$('format').querySelector('[value="both"]');both.disabled=combined;if(combined&&$('format').value==='both')$('format').value='svg';$('download').innerHTML='<i data-lucide="download"></i>'+(combined?'Download '+$('format').value.toUpperCase():'Download ZIP');icons();}
$('packaging').onchange=$('format').onchange=exportOptions;
function combinedExport(layers,format,arrangement){layers=bottomToTop(layers);const cols=arrangement==='sheet'?Math.ceil(Math.sqrt(layers.length)):1,rows=arrangement==='sheet'?Math.ceil(layers.length/cols):1,gap=10,width=cols*state.w+(cols-1)*gap,height=rows*state.h+(rows-1)*gap;const items=layers.map((l,i)=>({l,name:cutLayerId(l)+'_'+slug(l.name),x:arrangement==='sheet'?(i%cols)*(state.w+gap):0,y:arrangement==='sheet'?Math.floor(i/cols)*(state.h+gap):0}));
  if(format==='svg')return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>${esc(state.name)}</title>${items.map(({l,name,x,y})=>`<g id="${name}" inkscape:groupmode="layer" inkscape:label="${cutLayerId(l)} ${esc(l.name)}" data-thickness-mm="${l.thickness}" transform="translate(${x} ${y})"><path d="${path(contours(l))}" fill="none" stroke="${l.color}" stroke-width="0.1"/></g>`).join('')}</svg>`;
  const a=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1018','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','TABLES','0','TABLE','2','LAYER','70',String(items.length)];
  for(const {l,name}of items)a.push('0','LAYER','100','AcDbSymbolTableRecord','100','AcDbLayerTableRecord','2',name,'70','0','62','7','420',String(parseInt(l.color.slice(1),16)),'6','CONTINUOUS');a.push('0','ENDTAB','0','ENDSEC','0','SECTION','2','ENTITIES');
  for(const {l,name,x,y}of items)for(const ring of contours(l)){a.push('0','LWPOLYLINE','100','AcDbEntity','8',name,'100','AcDbPolyline','90',String(ring.length),'70','1');for(const p of ring)a.push('10',(p[0]+x).toFixed(4),'20',(height-y-p[1]).toFixed(4));}a.push('0','ENDSEC','0','EOF');return a.join('\r\n')+'\r\n';
}
const separateExport=exportLayers;exportLayers=function(single=false){if(single||$('packaging').value==='separate')return separateExport(single);if(state.preset==='image'&&(state.w!==state.source.width||state.h!==state.source.height||state.border!==state.source.settings?.border)){message('Regenerate at the new dimensions before exporting.');return;}if(state.layers.some(l=>l.kind==='text')&&!font){message('Lettering is still loading.');return;}const layers=state.layers.filter(l=>!$('visibleOnly').checked||l.visible);if(!layers.length){message('No layers selected for export.');return;}const format=$('format').value;download(combinedExport(layers,format,$('exportLayout').value),slug(state.name)+'-all-layers.'+format,format==='svg'?'image/svg+xml':'application/dxf');message('All layers exported in one '+format.toUpperCase()+' file');};
const openExport=$('export').onclick;$('export').onclick=()=>{openExport();exportOptions();summary();};
function summary(){$('exportSummary').textContent=state.layers.filter(l=>!$('visibleOnly').checked||l.visible).length+' layers · '+state.w+' × '+state.h+' mm each';}$('visibleOnly').onchange=summary;exportOptions();
const reverseButton=document.createElement('button');reverseButton.id='reverseLayers';reverseButton.title='Reverse front-to-back layer order';reverseButton.setAttribute('aria-label','Reverse layer order');reverseButton.innerHTML='<i data-lucide="arrow-down-up"></i>';
const layerActions=document.createElement('div'),addLayerButton=$('add');layerActions.style.display='flex';layerActions.style.gap='6px';addLayerButton.replaceWith(layerActions);layerActions.append(reverseButton,addLayerButton);
reverseButton.onclick=()=>{
  if(state.layers.length<2||importBusy)return;
  const selectedId=state.layers[selected].id,gaps=state.layers.map(l=>l.gap),n=state.layers.length;
  state.layers.reverse();
  // Gaps belong between neighboring sheets; reverse those intervals with the stack.
  state.layers.forEach((l,i)=>{l.gap=i<n-1?gaps[n-2-i]:gaps[n-1];});
  selected=state.layers.findIndex(l=>l.id===selectedId);render();message('Layer order reversed');
};
const renderBeforeReverse=render;render=function(){renderBeforeReverse();reverseButton.disabled=state.layers.length<2||state.preset==='empty'||importBusy;};
render();
