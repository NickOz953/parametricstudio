'use strict';
importScripts('vendor/imagetracer.js');
importScripts('flow-bridges.js');
importScripts('tone-tools.js');
const complexityError='This image has too much fine detail. Choose Strong image cleanup, increase minimum island area, or use fewer colors, then try again.';

// Work on binary material masks, then use ImageTracer's contour fitting.
function components(mask,w,h,minArea){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let count=0,removed=0,bridged=0;
  for(let start=0;start<mask.length;start++){
    if(!mask[start]||seen[start])continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;let edge=false,closest=start,distance=Infinity;
    while(head<tail){const p=queue[head++],x=p%w,y=Math.floor(p/w),d=Math.min(x,w-1-x,y,h-1-y);if(d<distance){distance=d;closest=p;}if(d===0)edge=true;
      for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]&&!seen[q]){seen[q]=1;queue[tail++]=q;}
    }
    if(!edge&&tail<minArea){for(let k=0;k<tail;k++)mask[queue[k]]=0;removed++;continue;}
    count++;
  }
  return {pieces:count,removed,bridged};
}

function flatten(p,w,h){const points=[];for(const s of p.segments){if(!points.length)points.push([s.x1/w,s.y1/h]);if(s.type==='L')points.push([s.x2/w,s.y2/h]);else{const steps=Math.max(2,Math.min(40,Math.ceil((Math.hypot(s.x2-s.x1,s.y2-s.y1)+Math.hypot(s.x3-s.x2,s.y3-s.y2))/2)));for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;points.push([(u*u*s.x1+2*u*t*s.x2+t*t*s.x3)/w,(u*u*s.y1+2*u*t*s.y2+t*t*s.y3)/h]);}}}if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7)points.pop();return points;}

// Adaptive quadratic sampling keeps more points only where a contour actually bends.
function flattenTopography(p,w,h,s){
  const points=[],sx=s.width/w,sy=s.height/h,tolerance=.12;
  function curve(a,b,c,depth=0){
    const dx=c[0]-a[0],dy=c[1]-a[1],length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((b[0]-a[0])*dx+(b[1]-a[1])*dy)/length)):0;
    if(depth>=14||Math.hypot(b[0]-a[0]-t*dx,b[1]-a[1]-t*dy)<=tolerance){points.push(c);return;}
    const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],mid=[(ab[0]+bc[0])/2,(ab[1]+bc[1])/2];curve(a,ab,mid,depth+1);curve(mid,bc,c,depth+1);
  }
  for(const segment of p.segments){const a=[segment.x1*sx,segment.y1*sy],b=[segment.x2*sx,segment.y2*sy];if(!points.length)points.push(a);if(segment.type==='L')points.push(b);else curve(a,b,[segment.x3*sx,segment.y3*sy]);}
  if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-7)points.pop();
  return smoothTopography(points,s,sx,sy).map(([x,y])=>[x/s.width,y/s.height]);
}

function smoothTopography(points,s,sx,sy){
  if(points.length<4)return points;
  const atEdge=p=>[0,s.width,s.border,s.width-s.border].some(x=>Math.abs(p[0]-x)<sx*.8)||[0,s.height,s.border,s.height-s.border].some(y=>Math.abs(p[1]-y)<sy*.8);
  // Corner cutting removes tangent breaks left by independent raster curve fits.
  // Keep frame contact points fixed, including the four outer board corners.
  let ring=points;
  for(let pass=0;pass<3;pass++){
    const next=[];for(let i=0;i<ring.length;i++){
      const p=ring[i],a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
      if(atEdge(p))next.push(p);else next.push([.75*p[0]+.25*a[0],.75*p[1]+.25*a[1]],[.75*p[0]+.25*b[0],.75*p[1]+.25*b[1]]);
    }ring=next;
  }
  // Simplify each arc between pinned points in millimeters, never across a frame corner.
  const keep=new Set([0]),anchors=[0];for(let i=1;i<ring.length;i++)if(atEdge(ring[i])){anchors.push(i);keep.add(i);}anchors.push(ring.length);ring.push(ring[0]);
  if(anchors.length===2){let far=1,d=0;for(let i=1;i<ring.length-1;i++){const v=Math.hypot(ring[i][0]-ring[0][0],ring[i][1]-ring[0][1]);if(v>d){d=v;far=i;}}anchors.splice(1,0,far);keep.add(far);}
  for(let k=1;k<anchors.length;k++){
    const stack=[[anchors[k-1],anchors[k]]];while(stack.length){const [start,end]=stack.pop(),a=ring[start],b=ring[end],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;let best=-1,max=.08*.08;
      for(let i=start+1;i<end;i++){const p=ring[i],t=len?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len)):0,d=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;if(d>max){max=d;best=i;}}
      if(best>=0){keep.add(best);stack.push([start,best],[best,end]);}
    }
  }
  const result=[...keep].sort((a,b)=>a-b).map(i=>ring[i]);return result.length>=3?result:points;
}

self.onmessage=({data:job})=>{try{
  const {image,w,h,settings:s}=job;
  const options=ImageTracer.checkoptions({numberofcolors:s.count,colorsampling:2,colorquantcycles:5,mincolorratio:0,blurradius:s.blur,blurdelta:64});
  let indexed;
  if(s.preparedImage&&Array.isArray(s.preparedLevels)){
    const tones=s.preparedLevels;
    if(tones.length<2||tones.length>12||tones.some((v,i)=>!Number.isInteger(v)||v<0||v>255||(i>0&&v<=tones[i-1])))throw Error('Invalid prepared image levels.');
    const indices=new Map(tones.map((v,i)=>[v,i]));
    indexed={palette:tones.map(v=>({r:v,g:v,b:v,a:255})),array:Array.from({length:image.height+2},(_,y)=>Array.from({length:image.width+2},(_,x)=>{
      if(x===0||y===0||x===image.width+1||y===image.height+1)return -1;
      const at=((y-1)*image.width+x-1)*4,gray=Math.round(.2126*image.data[at]+.7152*image.data[at+1]+.0722*image.data[at+2]),index=indices.get(gray);
      if(index===undefined)throw Error('Prepared image levels changed. Import it again.');return index;
    }))};
  }else if(ToneTools.valid(s.thresholds,s.count)){
    const tonal=s.blur?ImageTracer.blur(image,s.blur,64):image;
    ToneTools.snapLevels(tonal.data,s.toneLevels);
    if(s.toneLevels?.length)ToneTools.cleanLevelSpeckles(tonal.data,tonal.width,tonal.height);
    indexed={palette:Array.from({length:s.count},(_,i)=>{const v=Math.round(i*255/(s.count-1));return {r:v,g:v,b:v,a:255};}),array:Array.from({length:image.height+2},(_,y)=>Array.from({length:image.width+2},(_,x)=>x===0||y===0||x===image.width+1||y===image.height+1?-1:ToneTools.band(tonal.data[((y-1)*image.width+x-1)*4],s.thresholds)))};
  }else indexed=ImageTracer.colorquantization(image,options);
  const counts=new Array(indexed.palette.length).fill(0);
  for(let y=1;y<=image.height;y++)for(let x=1;x<=image.width;x++)counts[indexed.array[y][x]]++;
  const order=indexed.palette.map((c,i)=>({c,i,n:counts[i]})).filter(v=>v.n>0).sort((a,b)=>(.2126*b.c.r+.7152*b.c.g+.0722*b.c.b)-(.2126*a.c.r+.7152*a.c.g+.0722*a.c.b));
  const ranks=Object.fromEntries(order.map((v,i)=>[v.i,i]));const padX=s.frame?Math.round(s.border/s.width*w):0,padY=s.frame?Math.round(s.border/s.height*h):0;
  const layers=[];let totalPoints=0;
  for(let rank=0;rank<order.length;rank++){
    self.postMessage({progress:Math.round(rank/order.length*95),label:`Tracing layer ${rank+1} of ${order.length}`});
    const mask=new Uint8Array(w*h);
    const top=rank===0&&Number.isFinite(s.topBorder),frameX=top?Math.round(s.topBorder/s.width*w):padX,frameY=top?Math.round(s.topBorder/s.height*h):padY;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      if(x<frameX||x>=w-frameX||y<frameY||y>=h-frameY){mask[y*w+x]=s.frame?1:0;continue;}
      if(x<padX||x>=w-padX||y<padY||y>=h-padY)continue;
      const ix=Math.min(image.width-1,Math.floor((x-padX)/(w-2*padX)*image.width)),iy=Math.min(image.height-1,Math.floor((y-padY)/(h-2*padY)*image.height)),r=ranks[indexed.array[iy+1][ix+1]];
      mask[y*w+x]=s.mode==='stacked'?(r<=rank?1:0):(r===rank?1:0);
    }
    const minArea=s.minArea*w*h/(s.width*s.height);
    const stats=components(mask,w,h,minArea);
    // Remove tiny enclosed voids as well as isolated material specks.
    const inverse=Uint8Array.from(mask,v=>1-v);
    components(inverse,w,h,minArea);
    for(let i=0;i<mask.length;i++)if(!mask[i]&&!inverse[i])mask[i]=1;
    if(components(mask,w,h,0).pieces>600)throw Error(complexityError);
    // Build connections after both cleanup passes, using the finished silhouette.
    if(s.bridges&&s.frame)stats.bridged=flowBridges(mask,w,h,s.width,s.height,s.bridgeWidth).bridged;
    const ii={array:Array.from({length:h+2},(_,y)=>Array.from({length:w+2},(_,x)=>x===0||y===0||x===w+1||y===h+1?-1:mask[(y-1)*w+x-1])),palette:[{r:0,g:0,b:0,a:255},{r:255,g:255,b:255,a:255}]};
    const tolerance=s.bridges?Math.min(s.smooth,.2):s.smooth;
    const fit=ImageTracer.checkoptions({ltres:tolerance,qtres:tolerance,rightangleenhance:false});
    const scanned=ImageTracer.pathscan(ImageTracer.layeringstep(ii,1),0);
    if(scanned.length>600||scanned.reduce((n,p)=>n+p.points.length,0)>120000)throw Error(complexityError);
    const traced=ImageTracer.batchtracepaths(ImageTracer.internodes(scanned,fit),fit.ltres,fit.qtres);
    const polygons=traced.map(p=>s.topographic?flattenTopography(p,w,h,s):flatten(p,w,h)).filter(p=>p.length>=3);
    const points=polygons.reduce((n,p)=>n+p.length,0);totalPoints+=points;
    if(points>60000||totalPoints>180000)throw Error(complexityError);
    if(polygons.length)layers.push({color:'#'+[order[rank].c.r,order[rank].c.g,order[rank].c.b].map(v=>v.toString(16).padStart(2,'0')).join(''),polygons,pieces:traced.filter(p=>!p.isholepath&&p.segments.length>=2).length,removed:stats.removed,bridged:stats.bridged,holes:traced.filter(p=>p.isholepath).length});
  }
  self.postMessage({layers,done:true,simplified:!!job.simplified});
}catch(e){
  if(e.message===complexityError&&Math.max(job.w,job.h)>320){
    self.postMessage({progress:0,label:'Reducing fine detail for a manageable cut file...'});
    const ratio=.7,source=new OffscreenCanvas(job.image.width,job.image.height),target=new OffscreenCanvas(Math.max(16,Math.round(job.image.width*ratio)),Math.max(16,Math.round(job.image.height*ratio)));
    source.getContext('2d').putImageData(job.image,0,0);const ctx=target.getContext('2d');ctx.drawImage(source,0,0,target.width,target.height);
    const image=ctx.getImageData(0,0,target.width,target.height);source.width=source.height=target.width=target.height=1;
    setTimeout(()=>self.onmessage({data:{...job,image,w:Math.max(16,Math.round(job.w*ratio)),h:Math.max(16,Math.round(job.h*ratio)),simplified:true}}),0);
  }else self.postMessage({error:e.message||'Image conversion failed'});
}};
