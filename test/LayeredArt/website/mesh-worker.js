'use strict';
importScripts('vendor/libtess.js','tessellate.js');
self.onmessage=({data:{rings,depth}})=>{
  try{
    const edges=rings.reduce((n,r)=>n+r.length,0);
    if(edges>300000)throw Error('This layer exceeds the 3D preview detail limit.');
    const triangles=tessellateContours(rings),capCount=triangles.length,vertices=capCount+edges*6;
    if(vertices>1800000)throw Error('This layer exceeds the 3D preview detail limit.');
    const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3);let at=0;
    function triangle(ax,ay,az,bx,by,bz,cx,cy,cz){
      positions[at]=ax;positions[at+1]=ay;positions[at+2]=az;
      positions[at+3]=bx;positions[at+4]=by;positions[at+5]=bz;
      positions[at+6]=cx;positions[at+7]=cy;positions[at+8]=cz;
      const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const length=Math.hypot(nx,ny,nz)||1;
      nx/=length;ny/=length;nz/=length;
      normals[at]=nx;normals[at+1]=ny;normals[at+2]=nz;
      normals[at+3]=nx;normals[at+4]=ny;normals[at+5]=nz;
      normals[at+6]=nx;normals[at+7]=ny;normals[at+8]=nz;at+=9;
    }
    for(let i=0;i<triangles.length;i+=6){const ax=triangles[i],ay=triangles[i+1],bx=triangles[i+2],by=triangles[i+3],cx=triangles[i+4],cy=triangles[i+5];triangle(ax,ay,depth,bx,by,depth,cx,cy,depth);triangle(cx,cy,0,bx,by,0,ax,ay,0);}
    for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];triangle(a[0],a[1],0,b[0],b[1],0,b[0],b[1],depth);triangle(a[0],a[1],0,b[0],b[1],depth,a[0],a[1],depth);}
    self.postMessage({positions,normals,capCount},[positions.buffer,normals.buffer]);
  }catch(e){self.postMessage({error:e.message});}
};
