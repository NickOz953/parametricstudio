'use strict';

// Connect neighboring material regions with a minimum spanning tree, then blend
// each connection into the local silhouette using a cubic curve and round joins.
function flowBridges(mask,w,h,widthMm,heightMm,bridgeWidth){
  const size=w*h,labels=new Int32Array(size),queue=new Int32Array(size);
  let count=0;
  for(let start=0;start<size;start++){
    if(!mask[start]||labels[start])continue;
    count++;let head=0,tail=1;queue[0]=start;labels[start]=count;
    while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;
      for(const q of [x?p-1:-1,x<w-1?p+1:-1,y?p-w:-1,y<h-1?p+w:-1])if(q>=0&&mask[q]&&!labels[q]){labels[q]=count;queue[tail++]=q;}
    }
  }
  if(count<2)return {bridged:0,lengthMm:0,addedPixels:0};
  const sx=widthMm/w,sy=heightMm/h,owner=labels.slice(),origin=new Int32Array(size);
  let head=0,tail=0;
  for(let p=0;p<size;p++)if(labels[p]){queue[tail++]=p;origin[p]=p;}
  const edges=new Map();
  // A multi-source wavefront finds nearby pairs without comparing every pixel pair.
  while(head<tail){const p=queue[head++],x=p%w,y=(p/w)|0;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if((!dx&&!dy)||x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;
      const q=p+dy*w+dx;
      if(!owner[q]){owner[q]=owner[p];origin[q]=origin[p];queue[tail++]=q;}
      else if(owner[q]!==owner[p]){
        const a=origin[p],b=origin[q],u=Math.min(owner[p],owner[q]),v=Math.max(owner[p],owner[q]);
        const distance=Math.hypot((a%w-b%w)*sx,(((a/w)|0)-((b/w)|0))*sy),key=u*(count+1)+v;
        const previous=edges.get(key);if(!previous||distance<previous.distance)edges.set(key,{a,b,u,v,distance});
      }
    }
  }
  const parent=Int32Array.from({length:count+1},(_,i)=>i);
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  const connections=[];
  for(const edge of [...edges.values()].sort((a,b)=>a.distance-b.distance||a.u-b.u||a.v-b.v)){
    const a=root(edge.u),b=root(edge.v);if(a===b)continue;
    parent[a]=b;connections.push(edge);if(connections.length===count-1)break;
  }
  const radius=bridgeWidth/2;let addedPixels=0,lengthMm=0;
  function outward(p,fallback){
    const x=p%w,y=(p/w)|0,r=Math.max(bridgeWidth*1.5,2*sx),rx=Math.ceil(r/sx),ry=Math.ceil(r/sy);let vx=0,vy=0;
    for(let yy=Math.max(0,y-ry);yy<=Math.min(h-1,y+ry);yy++)for(let xx=Math.max(0,x-rx);xx<=Math.min(w-1,x+rx);xx++){
      if(labels[yy*w+xx]!==labels[p])continue;const dx=(xx-x)*sx,dy=(yy-y)*sy,d=Math.hypot(dx,dy);if(!d||d>r)continue;
      const weight=1-d/r;vx-=dx*weight;vy-=dy*weight;
    }
    const n=Math.hypot(vx,vy);if(n){vx/=n;vy/=n;}else [vx,vy]=fallback;
    // Keep the local normal pointed across the gap, avoiding loops at sharp tips.
    if(vx*fallback[0]+vy*fallback[1]<.15)return fallback;
    vx=.6*vx+.4*fallback[0];vy=.6*vy+.4*fallback[1];const m=Math.hypot(vx,vy);return [vx/m,vy/m];
  }
  function disk(x,y,r){
    const rx=r/sx,ry=r/sy;
    for(let yy=Math.max(0,Math.floor(y-ry));yy<=Math.min(h-1,Math.ceil(y+ry));yy++)for(let xx=Math.max(0,Math.floor(x-rx));xx<=Math.min(w-1,Math.ceil(x+rx));xx++){
      if(((xx-x)*sx)**2+((yy-y)*sy)**2>r*r)continue;const p=yy*w+xx;if(!mask[p]){mask[p]=1;addedPixels++;}
    }
  }
  for(const edge of connections){
    const a=[edge.a%w,(edge.a/w)|0],b=[edge.b%w,(edge.b/w)|0],d=edge.distance;
    if(!d)continue;const direction=[(b[0]-a[0])*sx/d,(b[1]-a[1])*sy/d],na=outward(edge.a,direction),nb=outward(edge.b,[-direction[0],-direction[1]]);
    const reach=d*.34,c1=[a[0]+na[0]*reach/sx,a[1]+na[1]*reach/sy],c2=[b[0]+nb[0]*reach/sx,b[1]+nb[1]*reach/sy];
    const steps=Math.max(4,Math.ceil(d/Math.min(sx,sy)*3));let previous=a;
    for(let i=0;i<=steps;i++){
      const t=i/steps,u=1-t,x=u**3*a[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t**3*b[0],y=u**3*a[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t**3*b[1];
      lengthMm+=Math.hypot((x-previous[0])*sx,(y-previous[1])*sy);previous=[x,y];
      const flare=1+.45*(Math.exp(-t*9)+Math.exp(-u*9));
      disk(x,y,radius*flare+Math.max(sx,sy)*.55);
    }
  }
  return {bridged:connections.length,lengthMm,addedPixels};
}
if(typeof module!=='undefined')module.exports=flowBridges;
else self.flowBridges=flowBridges;
