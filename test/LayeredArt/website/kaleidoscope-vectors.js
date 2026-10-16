(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('clipper-lib'));else root.KaleidoscopeVectors=factory(root.ClipperLib);})(globalThis,C=>{
  'use strict';
  const S=1000,TAU=Math.PI*2;
  function boolean(a,b=[],op=C.ClipType.ctUnion,strict=true){const c=new C.Clipper(),out=[];c.StrictlySimple=strict;if(a.length)c.AddPaths(a,C.PolyType.ptSubject,true);if(b.length)c.AddPaths(b,C.PolyType.ptClip,true);c.Execute(op,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return out;}
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([x,y])=>({X:Math.round(x*S),Y:Math.round(y*S)}));
  function offset(p,d,tolerance=20){const c=new C.ClipperOffset(2,tolerance),out=[];c.AddPaths(p,C.JoinType.jtRound,C.EndType.etClosedPolygon);c.Execute(out,d*S);return out;}
  function createShape(s,w,h,border){
    let seed=s.seed>>>0;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const phase=random(),bend=.9+random()*.7,cx=w/2,cy=h/2,n=s.symmetry,width=s.width/100;
    const pitch=Math.min(w-2*border,h-2*border)/(1+s.rings*.4)*s.scale/100,radius=pitch*.72;
    // Overscan the board's diagonal so rotation never exposes an empty circular edge.
    const reach=Math.hypot(w,h)/2+radius,rows=Math.ceil(reach/(pitch*.866)),cols=Math.ceil(reach/pitch),motifs=[];
    for(let row=-rows;row<=rows;row++)for(let col=-cols;col<=cols;col++){
      const x=(col+(Math.abs(row)%2)*.5)*pitch,y=row*pitch*.866;
      if(Math.hypot(x,y)>reach)continue;
      if(motifs.length+n>1800)throw Error('Pattern is too dense. Increase motif scale or reduce repeats or symmetry.');
      const direction=(row+col)%2?-1:1,turn=(s.style==='prism'?.85:s.style==='ripple'?1.9:1.35)*bend;
      for(let k=0;k<n;k++){
        const points=[],samples=48,base=k*TAU/n+phase*TAU/n;
        for(const side of [-1,1])for(let j=0;j<=samples;j++){
          const t=side<0?j/samples:1-j/samples,r=radius*(.055+.945*t);
          const profile=s.style==='prism'?Math.pow(Math.sin(Math.PI*t),.45):s.style==='ripple'?.7+.3*Math.sin(TAU*t):Math.pow(Math.sin(Math.PI*t),.75);
          const half=(.16+width*.58)*Math.PI/n*profile,angle=base+direction*turn*(1-t)**1.3+side*half;
          points.push({X:Math.round((cx+x+r*Math.cos(angle))*S),Y:Math.round((cy+y+r*Math.sin(angle))*S)});
        }
        if(!C.Clipper.Orientation(points))points.reverse();motifs.push(points);
      }
    }
    return {motifs,pitch};
  }
  function layerOffset(s,pitch,i){
    const t=(s.lineThickness??100)/100;
    // Extend below the old minimum without changing saved designs at 50% and above.
    const thickness=(t-1)*.18;
    return (i/(s.count-1)*(.4+s.width/100*.4)+thickness)*pitch/s.symmetry;
  }
  function generate(s,w,h,border){
    const {motifs,pitch}=createShape(s,w,h,border),cx=w/2,cy=h/2,n=s.symmetry,width=s.width/100;
    // Apply the existing output tolerance before offsetting as well: redundant
    // tiny segments are especially expensive in dense, thin kaleidoscopes.
    const shape=boolean(C.Clipper.CleanPolygons(boolean(motifs),15)),outer=[rect(0,0,w,h)],inner=[rect(border,border,w-2*border,h-2*border)],layers=[];let supported=[];
    for(let i=0;i<s.count;i++){
      if(i===s.count-1){layers.push({polygons:[[[0,0],[1,0],[1,1],[0,1]]],pieces:1});continue;}
      const angle=(s.rotation+i*s.twirl)*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),rotated=shape.map(p=>p.map(q=>{const x=q.X-cx*S,y=q.Y-cy*S;return {X:Math.round(cx*S+x*cos-y*sin),Y:Math.round(cy*S+x*sin+y*cos)};}));
      // Grow retained material in either cutout mode, independently of motif proportions.
      const delta=layerOffset(s,pitch,i),margin=Math.abs(delta)+.1;
      // Geometry farther than the offset radius outside the sheet cannot affect
      // its cuts. Keep a rounding margin and avoid offsetting the entire overscan.
      const local=boolean(rotated,[rect(border-margin,border-margin,w-2*border+2*margin,h-2*border+2*margin)],C.ClipType.ctIntersection);
      const changed=delta?offset(local,s.reverse?delta:-delta):local;
      let material=s.reverse?boolean(changed,inner,C.ClipType.ctIntersection):boolean(inner,changed,C.ClipType.ctDifference);
      // Accumulate the upper silhouettes so rotated pieces always have glue support.
      // Resolve point contacts on the cleaned final output below, rather than
      // repeating Clipper's quadratic duplicate scan on this intermediate union.
      material=boolean(material.concat(supported),[],C.ClipType.ctUnion,false);supported=material;
      const b=Math.min(i===0?s.topBorder:border,Math.min(w,h)/2-.5),frame=boolean(outer,[rect(b,b,w-2*b,h-2*b)],C.ClipType.ctDifference);
      let geometry=boolean(C.Clipper.CleanPolygons(boolean(material.concat(frame),[],C.ClipType.ctUnion,false),15));
      // Resolve microscopic pinches in the extended thin range before cut validation.
      if((s.lineThickness??100)<50)geometry=boolean(offset(offset(geometry,.01,5),-.01,5));
      layers.push({polygons:geometry.map(p=>p.map(q=>[q.X/S/w,q.Y/S/h])),pieces:geometry.filter(p=>C.Clipper.Area(p)>0).length});
    }
    return layers;
  }
  return {generate,previewModel:createShape,layerOffset};
});
