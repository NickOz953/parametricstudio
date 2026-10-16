'use strict';
// Identify physical pieces, not holes, from the same final contours used for cutting.
function assemblyPieces(rings){
  const C=ClipperLib,t=new C.PolyTree(),c=new C.Clipper();
  c.AddPaths(rings.map(r=>r.map(([x,y])=>({X:Math.round(x*1000),Y:Math.round(y*1000)}))),C.PolyType.ptSubject,true);
  c.Execute(C.ClipType.ctUnion,t,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftEvenOdd);
  const pieces=[];
  for(let n=t.GetFirst();n;n=n.GetNext())if(!n.IsHole()){
    const paths=[n.Contour(),...n.Childs().map(h=>h.Contour())],outer=paths[0];
    const box=outer.reduce((b,p)=>({x:Math.min(b.x,p.X/1000),y:Math.min(b.y,p.Y/1000),right:Math.max(b.right,p.X/1000),bottom:Math.max(b.bottom,p.Y/1000)}),{x:Infinity,y:Infinity,right:-Infinity,bottom:-Infinity});
    const shape=paths.map(r=>r.map(p=>[p.X/1000,p.Y/1000]));
    // Scan between vertex heights to find a label anchor inside actual material,
    // including concave pieces and frames whose centre lies in a void.
    const ys=[...new Set(shape.flat().map(p=>p[1]))].sort((a,b)=>a-b);
    let anchor=null,best=-1;
    for(let k=0;k<ys.length-1;k+=Math.max(1,Math.ceil((ys.length-1)/64))){
      const y=(ys[k]+ys[k+1])/2,xs=[];
      for(const r of shape)for(let i=0;i<r.length;i++){const a=r[i],b=r[(i+1)%r.length];if((a[1]>y)!==(b[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      xs.sort((a,b)=>a-b);
      for(let i=0;i+1<xs.length;i+=2){const score=Math.min(xs[i+1]-xs[i],ys[k+1]-ys[k]);if(score>best){best=score;anchor=[(xs[i]+xs[i+1])/2,y];}}
    }
    if(!anchor)throw Error('A piece could not be numbered');
    const area=(Math.abs(C.Clipper.Area(outer))-paths.slice(1).reduce((sum,r)=>sum+Math.abs(C.Clipper.Area(r)),0))/1e6;
    pieces.push({rings:shape,box,anchor,area});
  }
  return pieces.sort((a,b)=>a.box.y-b.box.y||a.box.x-b.box.x||b.area-a.area);
}
function assemblyGuideDocument(){
  const pages=[],total=state.layers.length,f=n=>n.toFixed(2),svgPath=r=>r.map(p=>'M'+p.map(q=>q.join(',')).join('L')+'Z').join('');
  state.layers.slice().reverse().forEach((layer,step)=>{
    const id=cutLayerId(layer),rings=contours(layer),pieces=assemblyPieces(rings);
    if(!rings.length||cutCache.get(layer)?.error)throw Error('An empty or invalid layer cannot be included.');
    const batches=Math.ceil(pieces.length/8);
    for(let batch=0;batch<batches;batch++){
      const group=pieces.slice(batch*8,batch*8+8),margin=state.w*.16,unit=state.w/100;
      const labels=group.map((piece,j)=>{
        const number=batch*8+j+1,label=id+'-'+String(number).padStart(2,'0');
        const left=j%2===0,x=left?-margin*.52:state.w+margin*.52,y=(Math.floor(j/2)+.5)*state.h/4;
        return `<path d="${svgPath(piece.rings)}" fill="#cce8de" fill-rule="evenodd" stroke="#185f4c" stroke-width="${unit*.15}"/><path d="M${piece.anchor.join(',')}L${x},${y}" fill="none" stroke="#526b63" stroke-width="${unit*.12}"/><circle cx="${piece.anchor[0]}" cy="${piece.anchor[1]}" r="${unit*.35}" fill="#185f4c"/><rect x="${x-unit*6.9}" y="${y-unit*1.7}" width="${unit*13.8}" height="${unit*3.4}" fill="white"/><text x="${x}" y="${y}" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="${unit*1.9}">${label}</text>`;
      }).join('');
      const rows=group.map((p,j)=>{const b=p.box,pad=Math.max(b.right-b.x,b.bottom-b.y)*.05+.05;return `<tr><td><strong>${id}-${String(batch*8+j+1).padStart(2,'0')}</strong><svg viewBox="${b.x-pad} ${b.y-pad} ${b.right-b.x+pad*2} ${b.bottom-b.y+pad*2}" aria-label="Piece shape"><path d="${svgPath(p.rings)}" fill="#426e60" fill-rule="evenodd"/></svg></td><td>${f(b.x)}, ${f(b.y)}<small>${f(b.right-b.x)} &times; ${f(b.bottom-b.y)} mm<br>${f(p.area)} mm&sup2;</small></td></tr>`;}).join('');
      pages.push(`<section class="page"><header><div><p>ASSEMBLY GUIDE &middot; STEP ${step+1} OF ${total}</p><h1>${esc(layer.name)}</h1></div><strong>${id} &middot; ${batch+1}/${batches}</strong></header><p class="meta">${esc(state.name)} &middot; ${state.w} &times; ${state.h} mm &middot; ${esc(layer.material)} &middot; ${layer.thickness} mm thick</p><p>${step===0?'Place the solid backing face up.':'Glue this layer onto step '+step+', face up, keeping the top edges aligned.'} ${state.registration?'Align the shared registration holes.':'Use the top and left edges as the alignment reference.'}</p><div class="layout"><svg class="map" viewBox="${-margin} ${-state.h*.035} ${state.w+2*margin} ${state.h*1.07}" aria-label="Numbered placement map"><text x="${state.w/2}" y="${-state.h*.015}" text-anchor="middle" font-size="${unit*1.8}" font-family="Arial">TOP</text><rect width="${state.w}" height="${state.h}" fill="white" stroke="#aaa" stroke-width="${unit*.1}"/><path d="${svgPath(rings)}" fill="#ededed" fill-rule="evenodd" stroke="#888" stroke-width="${unit*.08}"/>${labels}</svg><table><thead><tr><th>Piece / shape</th><th>Top-left x, y (mm)</th></tr></thead><tbody>${rows}</tbody></table></div><footer>${pieces.length} pieces in this layer &middot; Front view, not mirrored &middot; Diagram not to scale<br>All layers included, even hidden layers. Numbers are guide references only, not engraved marks. Keep pieces grouped by layer. Dry-fit before gluing; let the adhesive hold before adding the next layer.</footer></section>`);
    }
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(state.name)} - Assembly guide</title><style>*{box-sizing:border-box}body{margin:0;background:#e9edeb;color:#172c25;font:14px Arial,sans-serif}.print{display:block;margin:16px auto;padding:10px 20px}.page{background:white;width:270mm;min-height:185mm;margin:16px auto;padding:10mm;break-after:page}.page:last-child{break-after:auto}header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px solid #abc;padding-bottom:10px}header p{font-size:11px;letter-spacing:0}h1{font-size:22px;margin:4px 0;overflow-wrap:anywhere;max-width:210mm}.meta{font-size:12px;overflow-wrap:anywhere}.layout{display:grid;grid-template-columns:minmax(0,1fr) 65mm;gap:6mm;align-items:start}.map{width:100%;height:116mm}table{border-collapse:collapse;width:100%;font-size:11px}th{text-align:left;font-size:10px}td,th{border-bottom:1px solid #ddd;padding:5px}td svg{display:block;width:48px;height:27px;margin-top:3px}small{display:block;margin-top:3px;font-size:10px;color:#48574f}footer{font-size:10px;line-height:1.5;margin-top:8px;color:#48574f}@page{size:A4 landscape;margin:8mm}@media print{body{background:white}.print{display:none}.page{margin:0;width:100%;min-height:0;padding:2mm;break-inside:avoid}}@media screen and (max-width:800px){.page{width:100%;padding:16px}.layout{grid-template-columns:minmax(0,1fr)}.map{height:70vh}h1{max-width:100%}table{font-size:13px}}</style></head><body><button class="print" onclick="window.print()">Print / Save as PDF</button>${pages.join('')}</body></html>`;
}
const guideButton=document.createElement('button');guideButton.type='button';guideButton.id='assemblyGuide';guideButton.className='wide';guideButton.innerHTML='<i data-lucide="book-open"></i>Numbered assembly guide';$('single').after(guideButton);
const guideDialog=document.createElement('dialog');guideDialog.id='assemblyGuideDialog';guideDialog.setAttribute('aria-label','Numbered assembly guide');guideDialog.style.cssText='width:min(1200px,96vw);max-width:96vw;padding:16px';guideDialog.innerHTML='<div class="dialog-title"><h2>Assembly guide</h2><button id="closeAssemblyGuide" aria-label="Close assembly guide"><i data-lucide="x"></i></button></div><div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><button id="printAssemblyGuide"><i data-lucide="printer"></i>Print / Save as PDF</button><button id="downloadAssemblyGuide"><i data-lucide="download"></i>Download guide</button></div><iframe title="Printable numbered assembly guide" sandbox="allow-same-origin allow-modals" style="width:100%;height:70vh;border:1px solid #ddd"></iframe>';document.body.append(guideDialog);
let currentAssemblyGuide='';
guideButton.onclick=()=>{
  if(importBusy||studioRendering.pending){message('Wait for the cut layers to finish updating.');return;}
  if(state.preset==='empty'){message('Generate cut layers first.');return;}
  if(state.source&&(state.w!==state.source.width||state.h!==state.source.height||state.border!==state.source.settings?.border)){message('Regenerate at the new dimensions before creating the guide.');return;}
  try{currentAssemblyGuide=assemblyGuideDocument();guideDialog.querySelector('iframe').srcdoc=currentAssemblyGuide.replace('</head>','<style>.print{display:none}</style></head>');guideDialog.showModal();}catch(error){message(error.message);}
};
$('closeAssemblyGuide').onclick=()=>guideDialog.close();
$('printAssemblyGuide').onclick=()=>guideDialog.querySelector('iframe').contentWindow.print();
$('downloadAssemblyGuide').onclick=()=>download(currentAssemblyGuide,slug(state.name)+'-assembly-guide.html','text/html');
icons();
