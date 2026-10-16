(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TopographicField=factory();})(globalThis,()=>{
  'use strict';
  function random(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
  function centers(s,width,height){
    const rand=random(s.seed),ratio=Math.sqrt(width/height),all=[];
    // Generate a fixed sequence so increasing the count adds peaks without moving earlier ones.
    for(let i=0;i<8;i++){
      let best,score=-1;for(let j=0;j<(i?64:1);j++){
        const p={x:((i?.15:.4)+rand()*(i?.7:.2)-.5)*ratio,y:((i?.15:.4)+rand()*(i?.7:.2)-.5)/ratio};
        const distance=i?Math.min(...all.map(c=>Math.hypot(p.x-c.x,p.y-c.y))):1;
        if(distance>score){best=p;score=distance;}
      }all.push(best);
    }
    const selected=all.slice(0,s.basins);
    return selected.map((c,i)=>{const nearest=Math.min(...selected.filter((_,j)=>i!==j).map(p=>Math.hypot(p.x-c.x,p.y-c.y)));return {...c,r:Math.min(.34,nearest*.42)*(.35+s.spread/125),phase:rand()*Math.PI*2};});
  }
  function generate(s,width,height,maxSide=420){
    if(['flowing','organic','terraces'].includes(s.style))return continuous(s,width,height,maxSide);
    const scale=maxSide/Math.max(width,height),w=Math.max(32,Math.round(width*scale)),h=Math.max(32,Math.round(height*scale)),data=new Uint8ClampedArray(w*h*4),peaks=centers(s,width,height);
    const ratio=Math.sqrt(width/height),angle=-(s.rotation??0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),sx=(s.width??100)/100,sy=(s.height??100)/100,twist=-(s.twist??0)*Math.PI/180,detail=s.detail/100;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=(x/(w-1)-.5)*ratio,py=(y/(h-1)-.5)/ratio,rx=(px*cos-py*sin)/sx,ry=(px*sin+py*cos)/sy;
      const a=twist*Math.hypot(rx,ry)*2,u=rx*Math.cos(a)-ry*Math.sin(a),v=rx*Math.sin(a)+ry*Math.cos(a);
      let z=0;for(const c of peaks){const dx=u-c.x,dy=v-c.y,t=Math.atan2(dy,dx),r=c.r*(1+detail*(.12*Math.sin(3*t+c.phase)+.06*Math.sin(5*t-c.phase)))*(s.style==='terrain'?1+.13*Math.cos(2*t+c.phase):1);z=Math.max(z,Math.exp(-(dx*dx+dy*dy)/(r*r)));}
      const shade=Math.round((s.style==='islands'?z:1-z)*255),i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;
    }
    return {width:w,height:h,data};
  }
  // A continuous, smoothly warped height field gives shared contours rather than isolated bowls.
  function continuous(s,width,height,maxSide){
    const scale=maxSide/Math.max(width,height),w=Math.max(32,Math.round(width*scale)),h=Math.max(32,Math.round(height*scale)),data=new Uint8ClampedArray(w*h*4),values=new Float32Array(w*h);
    const rand=random(s.seed),ox=rand()*100,oy=rand()*100,ratio=Math.sqrt(width/height),angle=-(s.rotation??0)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),twist=-(s.twist??0)*Math.PI/180,detail=s.detail/100;
    const frequency=(2.4+s.basins*.45)*(100/(s.spread+45)),sx=(s.width??100)/100,sy=(s.height??100)/100;
    const hash=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^s.seed;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
    const fade=t=>t*t*t*(t*(t*6-15)+10),mix=(a,b,t)=>a+(b-a)*t;
    const gradients=[[1,0],[-1,0],[0,1],[0,-1],[.707,.707],[-.707,.707],[.707,-.707],[-.707,-.707]];
    const dot=(ix,iy,x,y)=>{const g=gradients[Math.min(7,Math.floor(hash(ix,iy)*8))];return g[0]*x+g[1]*y;};
    const noise=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),dx=x-ix,dy=y-iy,fx=fade(dx),fy=fade(dy);return .5+.7*mix(mix(dot(ix,iy,dx,dy),dot(ix+1,iy,dx-1,dy),fx),mix(dot(ix,iy+1,dx,dy-1),dot(ix+1,iy+1,dx-1,dy-1),fx),fy);};
    let low=Infinity,high=-Infinity;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const px=(x/(w-1)-.5)*ratio,py=(y/(h-1)-.5)/ratio,rx=(px*cos-py*sin)/sx,ry=(px*sin+py*cos)/sy,a=twist*Math.hypot(rx,ry)*2;
      let u=(rx*Math.cos(a)-ry*Math.sin(a))*frequency,v=(rx*Math.sin(a)+ry*Math.cos(a))*frequency;
      if(s.style==='flowing'){u*=.65;v*=1.5;}else if(s.style==='terraces'){u*=.75;v*=.75;}
      const warp=.55+detail*.8,du=noise(u*.8+ox+31,v*.8+oy)-.5,dv=noise(u*.8+ox,v*.8+oy+47)-.5;
      u+=du*warp;v+=dv*warp;
      let z=noise(u+ox,v+oy);
      z+=detail*.22*(noise(u*2.1+ox+13,v*2.1+oy+7)-.5);
      if(s.style==='organic')z=.7*z+.3*noise(u*1.7+ox+29,v*1.7+oy+19);
      values[y*w+x]=z;low=Math.min(low,z);high=Math.max(high,z);
    }
    const span=Math.max(1e-6,high-low);
    for(let j=0;j<values.length;j++){const t=Math.max(0,Math.min(1,(values[j]-low)/span)),shade=Math.round(255*Math.pow(t,s.style==='terraces'?.8:1));const i=j*4;data[i]=data[i+1]=data[i+2]=shade;data[i+3]=255;}
    return {width:w,height:h,data};
  }
  return {generate,centers};
});
