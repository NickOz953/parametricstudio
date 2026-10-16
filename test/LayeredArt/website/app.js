'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors=['#234f46','#437666','#83a18b','#c9cba8','#e5b85d','#eeeadb','#b57460','#527d97'];
let state={name:'Alpine morning',preset:'landscape',w:300,h:240,border:5,registration:false,diameter:3,inset:5,text:'WANDER',layers:[]}, selected=0, view='art',zoom=1,font;
const make=(name,color,kind,level=0)=>({id:crypto.randomUUID(),name,color,kind,level,material:'Birch plywood',thickness:3,gap:3,visible:true});
function preset(type){state.preset=type;state.name=type==='landscape'?'Alpine morning':type==='geometric'?'Concentric rhythm':'Wander sign';state.layers=type==='landscape'?[make('Forest edge',colors[0],'terrain',.78),make('Rolling foothills',colors[1],'terrain',.63),make('Alpine ridge',colors[2],'terrain',.43),make('Distant peaks',colors[3],'terrain',.30),make('Golden sun',colors[4],'sun'),make('Sky backing',colors[5],'back')]:type==='geometric'?[make('Inner aperture',colors[0],'geo',.27),make('Middle aperture',colors[1],'geo',.39),make('Outer aperture',colors[4],'geo',.52),make('Wide aperture',colors[6],'geo',.65),make('Backing',colors[5],'back')]:[make('Lettering',colors[5],'text'),make('Border',colors[4],'frame'),make('Backing',colors[0],'back')];state.layers.at(-1).gap=0;selected=0;sync();render();}
const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
const circle=(x,y,r)=>Array.from({length:96},(_,i)=>[x+Math.cos(i/96*Math.PI*2)*r,y+Math.sin(i/96*Math.PI*2)*r]);
function textContours(){if(!font)return [];const raw=font.getPath(state.text||' ',0,0,100),bb=raw.getBoundingBox(),scale=Math.min((state.w-2*state.border-20)/Math.max(1,bb.x2-bb.x1),(state.h*.32)/Math.max(1,bb.y2-bb.y1));let contours=[],points=[],cur=[0,0];const push=()=>{if(points.length>2)contours.push(points);points=[];};for(const c of raw.commands){if(c.type==='M'){push();cur=[c.x,c.y];points.push(cur);}else if(c.type==='L'){cur=[c.x,c.y];points.push(cur);}else if(c.type==='Q'||c.type==='C'){const start=cur;for(let i=1;i<=24;i++){const t=i/24,u=1-t;points.push(c.type==='Q'?[u*u*start[0]+2*u*t*c.x1+t*t*c.x,u*u*start[1]+2*u*t*c.y1+t*t*c.y]:[u**3*start[0]+3*u*u*t*c.x1+3*u*t*t*c.x2+t**3*c.x,u**3*start[1]+3*u*u*t*c.y1+3*u*t*t*c.y2+t**3*c.y]);}cur=[c.x,c.y];}else if(c.type==='Z')push();}push();return contours.map(p=>p.map(([x,y])=>[(x-(bb.x1+bb.x2)/2)*scale+state.w/2,(y-(bb.y1+bb.y2)/2)*scale+state.h/2]));}
function contours(l){if(l.kind==='image'){const p=l.polygons.map(r=>r.map(([x,y])=>[x*state.w,y*state.h]));if(state.registration&&l.framed)for(const x of [state.inset,state.w-state.inset])for(const y of [state.inset,state.h-state.inset])p.push(circle(x,y,state.diameter/2));return p;}const {w,h,border:b}=state;let p=[rect(0,0,w,h)];if(l.kind==='frame'||l.kind==='sun')p.push(rect(b,b,w-2*b,h-2*b));if(l.kind==='sun')p.push(circle(w*.69,h*.26,Math.min(w,h)*.115));if(l.kind==='terrain'){const profile=[];for(let i=0;i<=12;i++){const x=b+(w-2*b)*i/12, wave=(Math.sin(i*1.65+l.level*9)*.075+Math.cos(i*.78)*.045);profile.push([x,Math.max(b+6,Math.min(h-b-5,h*(l.level+wave)))]);}p.push([[b,b],[w-b,b],...profile.reverse()]);}if(l.kind==='geo'){const r=Math.min(w-2*b,h-2*b)*(.92-l.level);p.push(Array.from({length:8},(_,i)=>[w/2+Math.cos(i*Math.PI/4+Math.PI/8)*r*.7,h/2+Math.sin(i*Math.PI/4+Math.PI/8)*r*.7]));}if(l.kind==='text')return textContours();if(state.registration)for(const x of [state.inset,w-state.inset])for(const y of [state.inset,h-state.inset])p.push(circle(x,y,state.diameter/2));return p;}
const svgPathCache=new WeakMap();
const path=p=>{if(svgPathCache.has(p))return svgPathCache.get(p);const d=p.map(r=>typeof roundedPath==='function'?roundedPath(r):'M'+r.map(q=>q.map(n=>n.toFixed(3)).join(',')).join('L')+'Z').join('');svgPathCache.set(p,d);return d;};
const shapeLabel=document.createElement('label');shapeLabel.className='stack';shapeLabel.innerHTML='Contour position<div class="range"><input id="contour" type="range" min="0.15" max="0.85" step="0.01" aria-label="Contour position"></div>';$('layerName').parentElement.after(shapeLabel);
$('contour').oninput=()=>{state.layers[selected].level=Number($('contour').value);draw();};
function sync(){fitRegistrationToFrame();for(const [id,key]of Object.entries({projectName:'name',width:'w',height:'h',border:'border',diameter:'diameter',inset:'inset',lettering:'text'}))$(id).value=state[key];$('registration').checked=state.registration;document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===state.preset));$('signOptions').hidden=state.preset!=='sign';}
function icons(){lucide.createIcons({attrs:{'stroke-width':1.6}});}
function render(){fitRegistrationToFrame();selected=Math.max(0,Math.min(selected,state.layers.length-1));const s=state.layers[selected],visible=state.layers.filter(l=>l.visible);$('borderOut').value=state.border+' mm';$('designLabel').textContent=state.name.toUpperCase();$('sizeLabel').textContent=state.w+' × '+state.h+' mm';$('layerCount').textContent=state.layers.length+' layers';$('layerList').innerHTML=state.layers.map((l,i)=>`<div class="layer ${i===selected?'active':''}" tabindex="0" role="button" aria-label="Select ${esc(l.name)}" data-layer="${i}"><span class="swatch" style="background:${l.color}"></span><div class="info"><strong>${esc(l.name)}</strong><small>${String(state.layers.length-i).padStart(2,'0')} · ${l.thickness} mm</small></div><button data-eye="${i}" title="${l.visible?'Hide':'Show'} layer" aria-label="${l.visible?'Hide':'Show'} ${esc(l.name)}"><i data-lucide="${l.visible?'eye':'eye-off'}"></i></button></div>`).join('');$('selectedHeading').innerHTML=`<span style="background:${s.color}"></span>${esc(s.name)}`;for(const [id,key]of Object.entries({layerName:'name',material:'material',color:'color',thickness:'thickness',gap:'gap'}))$(id).value=s[key];$('up').disabled=selected===0;$('down').disabled=selected===state.layers.length-1;$('remove').disabled=state.layers.length===1;$('gap').disabled=selected===state.layers.length-1;$('add').disabled=state.layers.length>=16;$('duplicate').disabled=state.layers.length>=16;$('previewLabel').textContent=view==='art'?'Full composition':view==='exploded'?'Exploded assembly':'Selected layer · '+s.name;$('zoomLabel').value=Math.round(zoom*100)+'%';draw();icons();}
let lastCanvasMarkup='';
const compositionCamera={x:0,y:0};
function updateCompositionCamera(){const vw=(state.w+56)/zoom,vh=(state.h+56)/zoom;$('canvas').setAttribute('viewBox',`${(state.w-vw)/2+compositionCamera.x} ${(state.h-vh)/2+compositionCamera.y} ${vw} ${vh}`);$('zoomLabel').value=Math.round(zoom*100)+'%';}
function updatePointerCamera(){if(view==='cut')updateCutCamera();else updateCompositionCamera();}
function setCanvasMarkup(markup){if(markup!==lastCanvasMarkup){$('canvas').innerHTML=markup;lastCanvasMarkup=markup;}}
function draw(){
  $('stage').classList.toggle('cut-layout-mode',view==='cut');shapeLabel.hidden=!['terrain','geo'].includes(state.layers[selected].kind);$('contour').value=state.layers[selected].level;
  $('stage').classList.toggle('composition-mode',view==='art');
  if(view==='three')return;
  if(view==='cut'){drawCutLayout();return;}
  $('canvas').setAttribute('aria-label','Layered artwork preview');
  const layers=state.layers.filter(l=>l.visible),w=state.w,h=state.h,spread=view==='exploded'?layers.length*22:0,pad=28,vw=(w+pad*2+spread)/zoom,vh=(h+pad*2+spread)/zoom;
  $('canvas').setAttribute('viewBox',`${(w+spread-vw)/2} ${(h+spread-vh)/2} ${vw} ${vh}`);
  if(view==='art')updateCompositionCamera();
  setCanvasMarkup('<defs><filter id="shadow" x="-30%" y="-30%" width="180%" height="180%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#173729" flood-opacity=".18"/></filter></defs>'+layers.slice().reverse().map((l,i)=>{
    const offset=view==='exploded'?i*22:0;
    return `<g transform="translate(${offset} ${spread-offset})" ${!(state.roundness&&state.preset==='image')?'filter="url(#shadow)"':''}><path d="${path(contours(l))}" fill="${l.color}" fill-rule="evenodd" stroke="#00000018" stroke-width=".3"/>${typeof bridgeHighlightMarkup==='function'?bridgeHighlightMarkup(l):''}${view==='exploded'?`<text x="${w+5}" y="${h-8}" font-size="7" fill="#4c6558">${layers.length-i}</text>`:''}</g>`;
  }).join(''));
}
const cutCamera={x:0,y:0,width:1,height:1,key:''};
function updateCutCamera(){
  const vw=(cutCamera.width+36)/zoom,vh=(cutCamera.height+36)/zoom;
  $('canvas').setAttribute('viewBox',`${(cutCamera.width-vw)/2+cutCamera.x} ${(cutCamera.height-vh)/2+cutCamera.y} ${vw} ${vh}`);
  $('zoomLabel').value=Math.round(zoom*100)+'%';
}
function fitRegistrationToFrame(){
  if(!state.registration)return;
  // Reserve a 0.5 mm margin around registration holes in narrow frames.
  state.diameter=Math.min(state.diameter,state.border-1);
  const radius=state.diameter/2;
  state.inset=Math.max(radius+.5,Math.min(state.inset,state.border-radius-.5));
  $('diameter').value=state.diameter;$('inset').value=state.inset;
}
function cutLayerId(layer){return 'L'+String(state.layers.length-state.layers.indexOf(layer)).padStart(2,'0');}
function bottomToTop(layers){return [...layers].sort((a,b)=>state.layers.indexOf(b)-state.layers.indexOf(a));}
function drawCutLayout(){
  const layers=bottomToTop(state.layers),cols=Math.min(innerWidth<560?2:4,Math.ceil(Math.sqrt(layers.length))),rows=Math.ceil(layers.length/cols);
  const label=state.w*.045,gap=18,pad=18,stepX=state.w+gap,stepY=state.h+label*3+gap;
  $('stage').style.setProperty('--cut-rows',rows);
  const width=cols*stepX-gap,height=rows*stepY-gap,key=[width,height,cols,layers.length].join('|');
  if(cutCamera.key!==key){cutCamera.x=0;cutCamera.y=0;cutCamera.key=key;}
  Object.assign(cutCamera,{width,height});updateCutCamera();
  $('canvas').setAttribute('aria-label','Cut paths, bottom to top, for all '+layers.length+' layers');
  setCanvasMarkup(layers.map((l,i)=>{
    const x=(i%cols)*stepX,y=Math.floor(i/cols)*stepY,name=l.name.length>28?l.name.slice(0,27)+'…':l.name,id=cutLayerId(l),position=layers.length===1?'Bottom / top':i===0?'Bottom':i===layers.length-1?'Top':'Layer '+(i+1);
    return `<g data-cut-layer="${state.layers.indexOf(l)}" data-cut-id="${id}" transform="translate(${x} ${y})"><title>${id} · ${esc(l.name)}${l.visible?'':' (hidden in composition)'}</title><text x="0" y="${label}" font-size="${label}" font-weight="600" fill="#354d40">${id} · ${position}</text><text x="0" y="${label*2.1}" font-size="${label*.85}" fill="#354d40">${esc(name)}</text><g transform="translate(0 ${label*3})">${typeof bridgeHighlightMarkup==='function'?bridgeHighlightMarkup(l):''}<path d="${path(contours(l))}" fill="none" stroke="#206e54" stroke-width="0.85" vector-effect="non-scaling-stroke"/></g></g>`;
  }).join(''));
  $('previewLabel').textContent='Cut layout · Bottom to top · '+layers.length+' layers';
}
addEventListener('resize',()=>{if(view==='cut')draw();});
let cutDrag=null;
const cutSvg=$('canvas');
cutSvg.addEventListener('wheel',e=>{
  if(!['cut','art'].includes(view)||state.preset==='empty')return;e.preventDefault();
  const matrix=cutSvg.getScreenCTM();if(!matrix)return;
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?cutSvg.clientHeight:1);
  const previous=zoom;zoom=Math.max(.25,Math.min(20,zoom*Math.exp(-Math.max(-500,Math.min(500,delta))*.0015)));
  const ratio=previous/zoom;
  const camera=view==='cut'?cutCamera:compositionCamera,w=view==='cut'?cutCamera.width:state.w,h=view==='cut'?cutCamera.height:state.h;
  camera.x+=(p.x-w/2-camera.x)*(1-ratio);
  camera.y+=(p.y-h/2-camera.y)*(1-ratio);
  updatePointerCamera();
},{passive:false});
cutSvg.addEventListener('pointerdown',e=>{
  if(!['cut','art'].includes(view)||state.preset==='empty'||e.button!==0||!e.isPrimary)return;
  e.preventDefault();cutDrag={id:e.pointerId,x:e.clientX,y:e.clientY};cutSvg.setPointerCapture(e.pointerId);cutSvg.classList.add('panning');
});
cutSvg.addEventListener('pointermove',e=>{
  if(!cutDrag||cutDrag.id!==e.pointerId||!['cut','art'].includes(view))return;
  const matrix=cutSvg.getScreenCTM();if(!matrix)return;
  const inverse=matrix.inverse(),a=new DOMPoint(cutDrag.x,cutDrag.y).matrixTransform(inverse),b=new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse);
  const camera=view==='cut'?cutCamera:compositionCamera;camera.x+=a.x-b.x;camera.y+=a.y-b.y;cutDrag.x=e.clientX;cutDrag.y=e.clientY;updatePointerCamera();
});
function stopCutDrag(e){if(cutDrag?.id!==e.pointerId)return;cutDrag=null;cutSvg.classList.remove('panning');if(cutSvg.hasPointerCapture(e.pointerId))cutSvg.releasePointerCapture(e.pointerId);}
for(const event of ['pointerup','pointercancel','lostpointercapture'])cutSvg.addEventListener(event,stopCutDrag);
$('fit').addEventListener('click',()=>{if(['cut','art'].includes(view)){const camera=view==='cut'?cutCamera:compositionCamera;camera.x=0;camera.y=0;zoom=1;updatePointerCamera();}});
function message(s){$('toast').textContent=s;$('toast').classList.add('show');clearTimeout(message.timer);message.timer=setTimeout(()=>$('toast').classList.remove('show'),2600);$('status').textContent=s;}
function number(id,min,max){const n=Number($(id).value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
for(const [id,key,min,max]of [['width','w',80,1000],['height','h',80,1000],['border','border',5,30],['diameter','diameter',1,6],['inset','inset',2,6]])$(id).addEventListener('change',()=>{state[key]=number(id,min,max);sync();render();});$('border').addEventListener('input',()=>{state.border=number('border',5,30);render();});$('projectName').oninput=()=>{state.name=$('projectName').value.slice(0,80);$('designLabel').textContent=state.name.toUpperCase();};$('lettering').oninput=()=>{state.text=$('lettering').value;draw();};$('registration').onchange=()=>{state.registration=$('registration').checked;render();};
for(const [id,key]of [['layerName','name'],['material','material'],['color','color']])$(id).addEventListener('change',()=>{state.layers[selected][key]=$(id).value.slice(0,80);render();});$('color').oninput=()=>{state.layers[selected].color=$('color').value;draw();};for(const [id,key,min]of [['thickness','thickness',.1],['gap','gap',0]])$(id).onchange=()=>{state.layers[selected][key]=number(id,min,30);render();};
$('layerList').onclick=e=>{const eye=e.target.closest('[data-eye]');if(eye){const l=state.layers[Number(eye.dataset.eye)];l.visible=!l.visible;}else{const row=e.target.closest('[data-layer]');if(row)selected=Number(row.dataset.layer);}render();};$('layerList').onkeydown=e=>{if(e.target.matches('[data-layer]')&&['Enter',' '].includes(e.key)){e.preventDefault();selected=Number(e.target.dataset.layer);render();}};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{if(state.preset!==b.dataset.preset)preset(b.dataset.preset);});document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el===b));render();});
$('palette').innerHTML=colors.map(c=>`<button style="background:${c}" data-color="${c}" title="Apply ${c}" aria-label="Apply color ${c}"></button>`).join('');$('palette').onclick=e=>{const b=e.target.closest('[data-color]');if(b){state.layers[selected].color=b.dataset.color;render();}};
$('add').onclick=()=>{if(state.layers.length>=16)return;state.layers.unshift(make('New layer',colors[1],state.preset==='geometric'?'geo':state.preset==='sign'?'frame':'terrain',.7));selected=0;render();};$('duplicate').onclick=()=>{if(state.layers.length>=16)return;const l=state.layers[selected];state.layers.splice(selected,0,{...l,id:crypto.randomUUID(),name:l.name+' copy'});render();};$('remove').onclick=()=>{if(state.layers.length>1){state.layers.splice(selected,1);render();}};for(const [id,delta]of [['up',-1],['down',1]])$(id).onclick=()=>{const to=selected+delta;if(to>=0&&to<state.layers.length){[state.layers[selected],state.layers[to]]=[state.layers[to],state.layers[selected]];selected=to;render();}};for(const [id,delta]of [['zoomIn',.1],['zoomOut',-.1]])$(id).onclick=()=>{zoom=Math.max(.5,Math.min(2,zoom+delta));render();};$('fit').onclick=()=>{zoom=1;render();};
const slug=s=>s.replace(/[^a-z0-9_-]/gi,'-').replace(/-+/g,'-').slice(0,70)||'artwork';function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
for(const [id,factor]of [['zoomIn',1.15],['zoomOut',1/1.15]]){
  const previous=$(id).onclick;$(id).onclick=()=>{if(view!=='cut')return previous();zoom=Math.max(.25,Math.min(20,zoom*factor));updateCutCamera();};
}
function svg(l){return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${state.w}mm" height="${state.h}mm" viewBox="0 0 ${state.w} ${state.h}"><title>${cutLayerId(l)} ${esc(l.name)}</title><path id="${cutLayerId(l)}" d="${path(contours(l))}" fill="none" stroke="#000000" stroke-width="0.1"/></svg>`;}
function dxf(l){let a=['0','SECTION','2','HEADER','9','$ACADVER','1','AC1015','9','$INSUNITS','70','4','0','ENDSEC','0','SECTION','2','ENTITIES'];for(const p of contours(l)){a.push('0','LWPOLYLINE','100','AcDbEntity','8',cutLayerId(l)+'_'+slug(l.name),'100','AcDbPolyline','90',String(p.length),'70','1');for(const [x,y]of p)a.push('10',x.toFixed(4),'20',(state.h-y).toFixed(4));}a.push('0','ENDSEC','0','EOF');return a.join('\r\n')+'\r\n';}
function schedule(layers=state.layers.filter(l=>l.visible)){return 'Order front to back,Layer,Material,Thickness mm,Gap behind mm,Support\r\n'+layers.map((l,i)=>[i+1,'"'+l.name.replace(/"/g,'""')+'"',l.material,l.thickness,i===layers.length-1?0:l.gap,l.kind==='image'?(l.pieces+' pieces; inspect support'):['sun','text'].includes(l.kind)?'Individual support pads':'4 corner posts'].join(',')).join('\r\n');}
$('save').onclick=()=>{download(JSON.stringify({version:1,...state},null,2),slug(state.name)+'.json','application/json');message('Project saved');};$('open').onclick=()=>$('fileInput').click();
function validate(s){if(s?.roundness!==undefined&&(!Number.isFinite(s.roundness)||s.roundness<0||s.roundness>100))throw Error('Invalid softness');if(!s||!['landscape','geometric','sign','image','empty'].includes(s.preset)||typeof s.name!=='string'||s.name.length>80||typeof s.text!=='string'||s.text.length>16||typeof s.registration!=='boolean')throw Error('Invalid project');for(const [k,min,max]of [['w',80,1000],['h',80,1000],['border',5,30],['diameter',1,6],['inset',2,6]])if(!Number.isFinite(s[k])||s[k]<min||s[k]>max)throw Error('Invalid dimensions');if(!Array.isArray(s.layers)||s.layers.length<1||s.layers.length>16)throw Error('Invalid layers');for(const l of s.layers)if(typeof l.name!=='string'||l.name.length>80||!/^#[0-9a-f]{6}$/i.test(l.color)||!['terrain','geo','frame','sun','text','back','image'].includes(l.kind)||!['Birch plywood','MDF','Acrylic','Cardstock'].includes(l.material)||!Number.isFinite(l.thickness)||l.thickness<.1||l.thickness>30||!Number.isFinite(l.gap)||l.gap<0||l.gap>30||!Number.isFinite(l.level)||l.level<0||l.level>1||typeof l.visible!=='boolean')throw Error('Invalid layer');for(const l of s.layers){if(l.kind==='image'&&(!Array.isArray(l.polygons)||l.polygons.length>20000||typeof l.framed!=='boolean'||!l.polygons.every(p=>Array.isArray(p)&&p.length>=3&&p.length<=200000&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(n=>Number.isFinite(n)&&n>=-.01&&n<=1.01)))))throw Error('Invalid contours');}if(s.preset==='image'&&(!s.source||!Number.isFinite(s.source.width)||!Number.isFinite(s.source.height)))throw Error('Invalid source dimensions');return s;}
$('fileInput').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>20000000)throw Error('File too large');state=validate(JSON.parse(await f.text()));selected=0;sync();render();message('Project opened');}catch{message('Could not open this project file');}e.target.value='';};
$('export').onclick=()=>{$('exportSummary').textContent=state.layers.filter(l=>l.visible).length+' visible layers · '+state.w+' × '+state.h+' mm';$('exportDialog').showModal();};
function exportLayers(single=false){if(state.layers.some(l=>l.kind==='text')&&!font){message('Lettering is still loading. Please try again.');return;}const layers=single?[state.layers[selected]]:bottomToTop(state.layers.filter(l=>!$('visibleOnly').checked||l.visible));if(!layers.length){message('Show a layer before exporting');return;}const formats=$('format').value==='both'?['svg','dxf']:[$('format').value];if(single&&formats.length===1){const f=formats[0];download(f==='svg'?svg(layers[0]):dxf(layers[0]),cutLayerId(layers[0])+'-'+slug(layers[0].name)+'.'+f,f==='svg'?'image/svg+xml':'application/dxf');}else{const files={};layers.forEach(l=>formats.forEach(f=>files[cutLayerId(l)+'-'+slug(l.name)+'.'+f]=fflate.strToU8(f==='svg'?svg(l):dxf(l))));files['README.txt']=fflate.strToU8('Layered Art Studio\nAssembly order: L01 is the bottom layer; continue upward in number order. Numbers match the cut preview and assembly guide. Units: millimeters. Shared artboard origin. DXF uses Y-up; SVG uses Y-down. Curves are sampled as closed polylines. No kerf compensation. Registration holes are included on framed layers only. Detached parts require individual support and placement using the backing. Image layers are color-based vector traces, not recovered 3D geometry. Check disconnected pieces and narrow features. CNC: these are design contours, not machine toolpaths; set cutter compensation, tabs, depths and feeds in CAM. Curves are flattened; verify dimensions and perform a test cut.');download(fflate.zipSync(files),slug(state.name)+'-layers.zip','application/zip');}message('Export downloaded');}
$('download').onclick=()=>exportLayers();$('single').onclick=()=>exportLayers(true);
preset('landscape');fetch('vendor/lettering.woff').then(r=>{if(!r.ok)throw Error();return r.arrayBuffer();}).then(b=>{font=opentype.parse(b);draw();}).catch(()=>message('Lettering font unavailable; landscape and geometric exports are ready.'));
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'read_layered_art_project',description:'Read the current artboard and ordered material layers.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>JSON.parse(JSON.stringify(state))});}catch(e){console.warn('Project tool unavailable',e);}}
