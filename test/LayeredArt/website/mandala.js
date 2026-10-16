'use strict';

const mandalaStyles={
  lotus:{name:'Lotus mandala',petals:8,rings:4,curve:70,twist:12,reveal:55,palette:['#eeddb0','#bc825c','#8d504b','#48786f','#234e48','#182f32']},
  lace:{name:'Floral lace mandala',petals:12,rings:5,curve:100,twist:0,reveal:40,palette:['#e5d8bc','#c5a879','#a67d59','#6c6655','#455851','#263d39']},
  geometric:{name:'Geometric mandala',petals:8,rings:4,curve:15,twist:22,reveal:65,palette:['#ddbc71','#758da6','#23859c','#b65354','#408777','#233f42']}
};
const mandalaFields=[['petals','Petals',6,20,1],['rings','Pattern rings',2,6,1],['curve','Petal roundness',0,100,1],['twist','Ring rotation',-30,30,1],['reveal','Layer reveal',10,85,1]];
const mandalaPanel=document.createElement('section');
mandalaPanel.id='mandalaPanel';
mandalaPanel.innerHTML='<div class="section-title">MANDALA PRESETS <i data-lucide="flower-2"></i></div><div class="mandala-presets" role="group" aria-label="Mandala presets">'+Object.entries(mandalaStyles).map(([key,s])=>`<button data-mandala="${key}" title="${s.name}"><i data-lucide="${key==='lotus'?'flower':key==='lace'?'flower-2':'sparkles'}"></i>${key==='lotus'?'Lotus':key==='lace'?'Floral lace':'Geometric'}</button>`).join('')+'</div><div id="mandalaControls" hidden>'+mandalaFields.map(([key,label,min,max,step])=>`<label class="stack">${label}<div class="range"><input id="mandala-${key}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}"><output id="mandala-${key}-out"></output></div></label>`).join('')+'<label class="stack">Material layers<div class="range"><input id="mandalaLayers" aria-label="Mandala material layers" type="range" min="3" max="10" step="1" value="6"><output id="mandalaLayersOut">6</output></div></label></div>';
document.querySelector('.starter-presets').before(mandalaPanel);
const offsetDirections={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1],se:[Math.SQRT1_2,Math.SQRT1_2],sw:[-Math.SQRT1_2,Math.SQRT1_2],ne:[Math.SQRT1_2,-Math.SQRT1_2],nw:[-Math.SQRT1_2,-Math.SQRT1_2]};
const offsetControls=document.createElement('div');
offsetControls.innerHTML='<label class="stack">Spin per layer<div class="range"><input id="mandalaOffset" aria-label="Spin per layer in degrees" type="range" min="-30" max="30" step="0.25" value="0"><output id="mandalaOffsetOut">0°</output></div></label>';
$('mandalaLayers').closest('label').before(offsetControls);
function syncMandalaOffset(){const m=state.mandala||{};$('mandalaOffset').value=m.spin||0;$('mandalaOffsetOut').value=(m.spin||0)+'°';}
function updateMandalaOffset(){state.mandala.spin=number('mandalaOffset',-30,30);delete state.mandala.offset;delete state.mandala.offsetDirection;syncMandalaOffset();draw();}
$('mandalaOffset').oninput=updateMandalaOffset;
const patternWidthControl=document.createElement('label');patternWidthControl.className='stack';
patternWidthControl.innerHTML='Pattern width<div class="range"><input id="mandalaWidth" aria-label="Mandala pattern width" type="range" min="50" max="250" step="5" value="100"><output id="mandalaWidthOut">100%</output></div>';
$('mandala-curve').closest('label').after(patternWidthControl);
function syncPatternWidth(){const width=state.mandala?.patternWidth??100;$('mandalaWidth').value=width;$('mandalaWidthOut').value=width+'%';}
$('mandalaWidth').oninput=()=>{state.mandala.patternWidth=number('mandalaWidth',50,250);syncPatternWidth();draw();};
function mandalaBandWidth(feature){return Math.max(feature*1.1,feature*1.5*(state.mandala.patternWidth??100)/100);}

function startMandala(style){
  cancelTrace(false);
  const s=mandalaStyles[style];
  state.preset='mandala';state.name=s.name;
  state.mandala={style,...Object.fromEntries(mandalaFields.map(([k])=>[k,s[k]]))};
  state.layers=Array.from({length:6},(_,i)=>({...make(i===5?'Solid backing':`Pattern ${i+1}`,s.palette[i],i===5?'back':'mandala',Math.min(1,i/4)),gap:0}));
  selected=0;showSource(false);sync();render();message(s.name+' loaded');
}
mandalaPanel.querySelectorAll('[data-mandala]').forEach(b=>b.onclick=()=>startMandala(b.dataset.mandala));
for(const [key] of mandalaFields)$('mandala-'+key).oninput=()=>{
  state.mandala[key]=Number($('mandala-'+key).value);
  $('mandala-'+key+'-out').value=state.mandala[key]+(key==='twist'?'°':key==='curve'||key==='reveal'?'%':'');
  draw();
};
$('mandalaLayers').oninput=()=>{
  const count=Number($('mandalaLayers').value),old=state.layers;
  const reversed=old[0].kind==='back',patterns=old.filter(l=>l.kind==='mandala').slice().sort((a,b)=>a.level-b.level);
  const backing=old.find(l=>l.kind==='back')||{...make('Solid backing','#233f42','back'),gap:0};
  const palette=mandalaStyles[state.mandala.style].palette;
  state.layers=Array.from({length:count-1},(_,i)=>({...patterns[i]||{...make(`Pattern ${i+1}`,palette[Math.min(4,i)],'mandala'),gap:0},level:i/(count-2)}));
  state.layers.push(backing);if(reversed)state.layers.reverse();render();
};

// Disjoint apertures leave continuous radial ribs and circular webs on every sheet.
// Deeper apertures shrink inside the front apertures, revealing colored stepped edges.
function mandalaContours(layer){
  if(typeof decorationStats!=='undefined')decorationStats.set(layer,{omitted:0});
  const m=state.mandala,{w,h,border}=state;
  const radius=Math.max(5,Math.min(w,h)/2-border);
  const rx=m.circular?radius:Math.max(5,w/2-border),ry=m.circular?radius:Math.max(5,h/2-border),unit=Math.min(rx,ry);
  const rings=[rect(0,0,w,h)];
  const polar=(r,a)=>[w/2+rx*r*Math.cos(a),h/2+ry*r*Math.sin(a)];
  const feature=typeof cutFeature==='function'&&cutSettings().enabled?cutFeature():1.5;
  const bandWidth=mandalaBandWidth(feature);
  const pitch=2*Math.PI/m.petals,band=.89/m.rings,web=Math.max(.012,bandWidth/unit);
  const shrink=1-layer.level*(.22+m.reveal*.0045),curve=m.curve/100;
  for(let j=0;j<m.rings;j++){
    const middle=.08+band*(j+.5),half=(band-web)*.5*shrink;
    if(half*unit<feature*.6)continue;
    const phase=-Math.PI/2+(j%2)*pitch/2+j*m.twist*Math.PI/180/m.rings;
    for(let k=0;k<m.petals;k++){
      const center=phase+k*pitch,aperture=[];
      const angular=Math.max(0,pitch/2-Math.asin(Math.min(1,bandWidth*.5/((middle-half)*unit))))*shrink;
      if(angular*(middle-half)*unit<feature*.6)continue;
      for(let n=0;n<64;n++){
        const t=2*Math.PI*n/64,radial=Math.cos(t);
        const diamond=1-Math.abs(radial),oval=Math.sqrt(Math.max(0,1-radial*radial));
        const fullness=(1-curve)*diamond+curve*Math.pow(oval,.35);
        const angle=center+Math.sign(Math.sin(t))*angular*fullness*(m.style==='lotus'?.95+.05*radial:1);
        aperture.push(polar(middle+half*radial,angle));
      }
      rings.push(...(typeof decorateAperture==='function'?decorateAperture(aperture,center,'outer',j,layer,feature):[aperture]));
    }
  }
  for(let corner=0;corner<4;corner++){
    const stop=Math.max(.28,Math.min(.6,feature*2/unit)),points=[[1,1],[stop,1]];
    for(let n=0;n<=24;n++){const a=Math.acos(stop)* (1-n/24)+Math.asin(stop)*(n/24);points.push([Math.cos(a),Math.sin(a)]);}
    points.push([1,stop]);
    const sx=corner%2?-1:1,sy=corner<2?1:-1;
    const cx=points.reduce((s,p)=>s+p[0],0)/points.length,cy=points.reduce((s,p)=>s+p[1],0)/points.length;
    const cornerAperture=points.map(([x,y])=>[w/2+sx*rx*(cx+(x-cx)*shrink),h/2+sy*ry*(cy+(y-cy)*shrink)]);
    rings.push(...(typeof decorateAperture==='function'?decorateAperture(cornerAperture,Math.atan2(sy,sx),'corner',0,layer,feature):[cornerAperture]));
  }
  rings.push(Array.from({length:64},(_,i)=>polar(.055*shrink,2*Math.PI*i/64)));
  if(m.circular&&typeof mandalaGapContours==='function')rings.push(...mandalaGapContours(layer,feature,shrink));
  if(m.spin&&layer.level){
    const depth=layer.level*Math.max(1,state.layers.filter(l=>l.kind==='mandala').length-1),angle=m.spin*depth*Math.PI/180;
    const cs=Math.cos(angle),sn=Math.sin(angle);
    const C=ClipperLib,scale=1000,toPath=r=>r.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));
    const shifted=rings.slice(1).map(r=>toPath(r.map(([x,y])=>[w/2+(x-w/2)*cs-(y-h/2)*sn,h/2+(x-w/2)*sn+(y-h/2)*cs])));
    // Rotate apertures about the board center while keeping the frame and pins aligned.
    const clip=new C.Clipper(),out=[];clip.StrictlySimple=true;
    clip.AddPaths(shifted,C.PolyType.ptSubject,true);clip.AddPath(toPath(rect(border,border,w-2*border,h-2*border)),C.PolyType.ptClip,true);
    clip.Execute(C.ClipType.ctIntersection,out,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftEvenOdd);
    rings.splice(1,rings.length-1,...out.map(r=>r.map(p=>[p.X/scale,p.Y/scale])));
  }
  if(state.registration)for(const x of [state.inset,w-state.inset])for(const y of [state.inset,h-state.inset])rings.push(circle(x,y,state.diameter/2));
  return rings;
}
const beforeMandalaContours=contours;
contours=function(layer){return layer.kind==='mandala'?mandalaContours(layer):beforeMandalaContours(layer);};
const beforeMandalaRender=render;
render=function(){
  beforeMandalaRender();const active=state.preset==='mandala';
  $('mandalaControls').hidden=!active;
  mandalaPanel.querySelectorAll('[data-mandala]').forEach(b=>b.classList.toggle('active',active&&state.mandala.style===b.dataset.mandala));
  if(active){
    syncMandalaOffset();
    syncPatternWidth();
    for(const [k]of mandalaFields){$('mandala-'+k).value=state.mandala[k];$('mandala-'+k+'-out').value=state.mandala[k]+(k==='twist'?'°':k==='curve'||k==='reveal'?'%':'');}
    $('mandalaLayers').value=state.layers.length;$('mandalaLayersOut').value=state.layers.length;$('add').disabled=true;
  }
};
const beforeMandalaValidate=validate;
validate=function(s){
  if(s?.preset!=='mandala')return beforeMandalaValidate(s);
  const m=s.mandala;
  if(!m||!Object.hasOwn(mandalaStyles,m.style))throw Error('Invalid mandala style');
  if(m.patternWidth!==undefined&&(!Number.isFinite(m.patternWidth)||m.patternWidth<50||m.patternWidth>250))throw Error('Invalid mandala pattern width');
  if(m.spin!==undefined&&(!Number.isFinite(m.spin)||m.spin< -30||m.spin>30))throw Error('Invalid mandala spin');
  if(m.offset!==undefined&&(!Number.isFinite(m.offset)||m.offset<0||m.offset>8))throw Error('Invalid mandala offset');
  if(m.offsetDirection!==undefined&&!Object.hasOwn(offsetDirections,m.offsetDirection))throw Error('Invalid offset direction');
  for(const [key,,min,max]of mandalaFields)if(!Number.isInteger(m[key])||m[key]<min||m[key]>max)throw Error('Invalid mandala variation');
  beforeMandalaValidate({...s,preset:'geometric',layers:s.layers?.map(l=>({...l,kind:l.kind==='mandala'?'back':l.kind}))});
  if(!s.layers.every(l=>['mandala','back'].includes(l.kind)))throw Error('Invalid mandala layers');
  return s;
};
render();icons();
