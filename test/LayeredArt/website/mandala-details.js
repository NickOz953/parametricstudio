'use strict';

const circularMandalaControls=document.createElement('div');
circularMandalaControls.innerHTML='<label class="check"><input id="mandalaCircular" type="checkbox"> Keep central mandala circular</label><div id="mandalaGapOptions" hidden><label class="stack">Fill extra space<select id="mandalaGapFill"><option value="none">None</option><option value="mandalas">Mini mandalas</option><option value="flowers">Flowers</option><option value="swirls">Swirls</option><option value="mixed">Mixed</option></select></label><label class="stack">Filler size<div class="range"><input id="mandalaFillerSize" aria-label="Filler size" type="range" min="30" max="150" step="5" value="70"><output id="mandalaFillerSizeOut">70 mm</output></div></label></div>';
mandalaPanel.before(circularMandalaControls);
function syncCircularMandala(){
  const m=state.mandala||{};
  circularMandalaControls.hidden=state.preset!=='mandala';
  $('mandalaCircular').checked=!!m.circular;$('mandalaGapOptions').hidden=!m.circular;
  $('mandalaGapFill').value=m.gapFill||'mixed';
  $('mandalaFillerSize').value=m.fillerSize||70;$('mandalaFillerSizeOut').value=(m.fillerSize||70)+' mm';
  $('mandalaFillerSize').disabled=m.gapFill==='none';
}
circularMandalaControls.oninput=()=>{
  if(state.preset!=='mandala')return;
  Object.assign(state.mandala,{circular:$('mandalaCircular').checked,gapFill:$('mandalaGapFill').value,fillerSize:number('mandalaFillerSize',30,150)});
  syncCircularMandala();draw();
};
const circularRender=render;
render=function(){circularRender();syncCircularMandala();};
const circularValidate=validate;
validate=function(s){
  circularValidate(s);const m=s.mandala;
  if(s.preset==='mandala'){
    if(m.circular!==undefined&&typeof m.circular!=='boolean')throw Error('Invalid circular mandala option');
    if(m.gapFill!==undefined&&!['none','mandalas','flowers','swirls','mixed'].includes(m.gapFill))throw Error('Invalid gap fill');
    if(m.fillerSize!==undefined&&(!Number.isFinite(m.fillerSize)||m.fillerSize<30||m.fillerSize>150))throw Error('Invalid filler size');
  }
  return s;
};

function mandalaGapContours(layer,feature,shrink){
  const {w,h,border,mandala:m}=state,mode=m.gapFill||'mixed',out=[];
  if(mode==='none'||w===h)return out;
  const wide=w>h,short=Math.min(w,h),band=(Math.max(w,h)-short)/2;
  const gap=feature*2,available=band-gap*2;
  if(available<feature*14)return out;
  const across=Math.max(1,Math.ceil(available/(m.fillerSize||70))),cell=available/across;
  const length=short-2*border-2*gap,along=Math.max(1,Math.ceil(length/cell)),step=length/along;
  const radius=(Math.min(cell,step)-gap)/2;
  if(radius<feature*6)return out;
  // Each motif occupies its own cell; solid webs connect every cell to the frame.
  for(let side=0;side<2;side++)for(let a=0;a<across;a++)for(let b=0;b<along;b++){
    const u=border+gap+(a+.5)*cell,v=border+gap+(b+.5)*step;
    const long=side?Math.max(w,h)-u:u,cx=wide?long:v,cy=wide?v:long;
    const type=mode==='mixed'?['mandalas','flowers','swirls'][(a+b)%3]:mode;
    if(type==='swirls'){
      out.push(...decorateAperture(circle(cx,cy,radius*shrink),0,'corner',0,layer,feature,{...decorationDefaults,swirls:true,placement:'corners',size:85}));
      continue;
    }
    const count=type==='flowers'||radius<feature*10?6:8,rows=type==='mandalas'&&radius>feature*12?2:1;
    const centerRadius=Math.max(feature*.65,radius*.10)*shrink;
    if(centerRadius>=feature*.55)out.push(circle(cx,cy,centerRadius));
    for(let row=0;row<rows;row++){
      const inner=radius*(rows===2?(row? .56:.19):.23),outer=radius*(rows===2?(row?.94:.49):.94);
      const widthChange=mandalaBandWidth(feature)-feature*1.5;
      const mid=(inner+outer)/2,radial=Math.max(0,(outer-inner-widthChange)/2)*shrink;
      const angular=Math.min(Math.PI/count*.68,(Math.PI/count-(feature+widthChange*.5)/mid))*shrink;
      if(radial<feature*.6||angular*inner<feature*.55)continue;
      for(let k=0;k<count;k++)out.push(Array.from({length:48},(_,n)=>{
        const t=n*Math.PI*2/48,r=mid+radial*Math.cos(t),angle=k*Math.PI*2/count+row*Math.PI/count+angular*Math.sin(t);
        return [cx+r*Math.cos(angle),cy+r*Math.sin(angle)];
      }));
    }
  }
  return out;
}

const decorationDefaults={swirls:false,leaves:false,ornaments:false,placement:'corners',density:1,size:85,curl:65};
const decorationStats=new WeakMap();
const decorationSettings=()=>({...decorationDefaults,...state.mandala?.decoration});
const decorationPanel=document.createElement('div');decorationPanel.id='decorationPanel';
decorationPanel.innerHTML='<div class="section-title">DECORATIVE GEOMETRY</div><div class="decoration-toggles">'+[['swirls','Swirls','wind'],['leaves','Leaves','leaf'],['ornaments','Ornaments','sparkles']].map(([id,label,icon])=>`<label><input type="checkbox" id="decor-${id}"><i data-lucide="${icon}"></i>${label}</label>`).join('')+'</div><div id="decorationOptions" hidden><label class="stack">Placement<select id="decor-placement"><option value="corners">Corners</option><option value="outer">Outer rings</option><option value="all">All rings</option><option value="both">Corners + outer rings</option></select></label>'+[['density','Density',1,3],['size','Motif size',40,100],['curl','Swirl curl',25,100]].map(([id,label,min,max])=>`<label class="stack">${label}<div class="range"><input type="range" id="decor-${id}" aria-label="${label}" min="${min}" max="${max}" step="1"><output id="decor-${id}-out"></output></div></label>`).join('')+'</div>';
$('mandalaControls').append(decorationPanel);
const decorationFit=document.createElement('p');decorationFit.className='note';decorationFit.hidden=true;decorationPanel.append(decorationFit);
function syncDecorations(){
  const s=decorationSettings();
  for(const k of ['swirls','leaves','ornaments'])$('decor-'+k).checked=s[k];
  $('decorationOptions').hidden=!s.swirls&&!s.leaves&&!s.ornaments;
  $('decor-placement').value=s.placement;
  for(const k of ['density','size','curl']){$('decor-'+k).value=s[k];$('decor-'+k+'-out').value=s[k]+(k==='density'?'':'%');}
  $('decor-curl').disabled=!s.swirls;$('decor-density').disabled=s.placement==='all';
}
function updateDecorations(){
  state.mandala.decoration={swirls:$('decor-swirls').checked,leaves:$('decor-leaves').checked,ornaments:$('decor-ornaments').checked,placement:$('decor-placement').value,density:number('decor-density',1,3),size:number('decor-size',40,100),curl:number('decor-curl',25,100)};
  syncDecorations();draw();
}
decorationPanel.querySelectorAll('input[type=checkbox],select').forEach(el=>el.onchange=updateDecorations);
decorationPanel.querySelectorAll('input[type=range]').forEach(el=>el.oninput=updateDecorations);

// Subtract attached material motifs from each aperture using boolean geometry.
// Every stem starts outside its aperture, so motifs join the existing sheet.
function decorateAperture(aperture,angle,zone,ringIndex,layer,feature,settings){
  const s=settings||decorationSettings(),types=['swirls','leaves','ornaments'].filter(k=>s[k]);
  if(!types.length||s.placement==='corners'&&zone!=='corner'||['outer','all'].includes(s.placement)&&zone!=='outer')return [aperture];
  if(zone==='outer'&&s.placement!=='all'&&ringIndex<state.mandala.rings-s.density)return [aperture];
  const C=ClipperLib,scale=1000,cs=Math.cos(angle),sn=Math.sin(angle);
  const local=aperture.map(([x,y])=>[-sn*x+cs*y,cs*x+sn*y]);
  const xmin=Math.min(...local.map(p=>p[0])),xmax=Math.max(...local.map(p=>p[0])),ymin=Math.min(...local.map(p=>p[1])),ymax=Math.max(...local.map(p=>p[1]));
  const halfX=(xmax-xmin)/2,halfY=(ymax-ymin)/2,cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
  const width=Math.max(feature*1.1,(feature*1.7+layer.level*(1+state.mandala.reveal*.035))*(state.mandala.patternWidth??100)/100);
  const count=zone==='corner'?s.density+types.length-1:1;
  if(halfX*2/count<width*4||halfY*2<width*5){const stats=decorationStats.get(layer);if(stats)stats.omitted++;return [aperture];}
  const toPath=p=>p.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));
  const material=[];
  for(let index=0;index<count;index++){
    const type=types[(index+(zone==='outer'?ringIndex:0))%types.length];
    const offsetX=(index-(count-1)/2)*2/count,spread=.92/count,size=s.size/100;
    const map=([x,y])=>{const u=cx+(offsetX+x*spread)*halfX,v=cy+y*halfY;return [-sn*u+cs*v,cs*u+sn*v];};
    const stroke=points=>{const out=[],o=new C.ClipperOffset(2,25);o.AddPath(toPath(points.map(map)),C.JoinType.jtRound,C.EndType.etOpenRound);o.Execute(out,width*scale/2);material.push(...out);};
    const fill=points=>{const p=toPath(points.map(map));if(!C.Clipper.Orientation(p))p.reverse();material.push(p);};
    if(type==='swirls'){
      const turns=.72+s.curl/100*.48,points=[[0,-1.3]],n=88;
      for(let i=0;i<=n;i++){const t=i/n,a=-Math.PI/2+t*Math.PI*2*turns,r=.80*size*(1-.83*t);points.push([r*Math.cos(a),.08+r*Math.sin(a)]);}
      stroke(points);
    }else if(type==='leaves'){
      stroke([[0,-1.3],[0,.65*size]]);
      for(const [side,y]of [[-1,-.48],[1,-.32],[-1,.18],[1,.34]]){
        const leaf=[];
        for(let i=0;i<48;i++){const t=i/48*Math.PI*2,u=(1-Math.cos(t))/2;leaf.push([side*(.02+.64*u)*size,(y+.20*u+Math.sin(t)*.24)*size]);}
        fill(leaf);
      }
    }else{
      stroke([[0,-1.3],[0,.72*size]]);
      for(const side of [-1,1]){
        const points=[];
        for(let i=0;i<=48;i++){const t=i/48;points.push([side*.78*Math.sin(Math.PI*t)*size,(-.42+1.12*t)*size]);}
        stroke(points);
      }
      fill(Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return [.26*Math.cos(a)*size,(.73+.23*Math.sin(a))*size];}));
    }
  }
  const union=new C.Clipper(),joined=[];union.AddPaths(material,C.PolyType.ptSubject,true);union.Execute(C.ClipType.ctUnion,joined,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
  const clip=new C.Clipper(),out=[];clip.StrictlySimple=true;clip.AddPath(toPath(aperture),C.PolyType.ptSubject,true);clip.AddPaths(joined,C.PolyType.ptClip,true);
  clip.Execute(C.ClipType.ctDifference,out,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftNonZero);
  return out.map(r=>r.map(p=>[p.X/scale,p.Y/scale]));
}
const beforeDecorationRender=render;render=function(){beforeDecorationRender();syncDecorations();};
const beforeDecorationDraw=draw;draw=function(){beforeDecorationDraw();const omitted=decorationStats.get(state.layers[selected])?.omitted||0;decorationFit.hidden=!omitted;decorationFit.textContent=`${omitted} openings too small for these motifs at the current cut settings.`;};
const beforeDecorationValidate=validate;validate=function(s){
  const d=s?.mandala?.decoration;
  if(d){
    if(['swirls','leaves','ornaments'].some(k=>typeof d[k]!=='boolean')||!['corners','outer','both','all'].includes(d.placement))throw Error('Invalid decorative geometry');
    for(const [key,min,max]of [['density',1,3],['size',40,100],['curl',25,100]])if(!Number.isInteger(d[key])||d[key]<min||d[key]>max)throw Error('Invalid decoration setting');
  }
  return beforeDecorationValidate(s);
};
syncDecorations();icons();
