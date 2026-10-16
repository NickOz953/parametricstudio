(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('clipper-lib'));else root.MandalaVectors=factory(root.ClipperLib);})(globalThis,C=>{
  'use strict';
  const presets=[{id:'ornamental-lotus',name:'Ornamental Lotus',n:8,kind:'lotus'},{id:'scroll-garden',name:'Scroll Garden',n:6,kind:'scroll'},{id:'sunflower',name:'Sunflower',n:16,kind:'sun'},{id:'crystal-star',name:'Crystal Star',n:12,kind:'star'},{id:'scalloped-lace',name:'Scalloped Lace',n:10,kind:'lace'},{id:'deco-fan',name:'Deco Fan',n:8,kind:'deco'},{id:'fern-rosette',name:'Fern Rosette',n:8,kind:'fern'},{id:'paisley-wheel',name:'Paisley Wheel',n:8,kind:'paisley'},{id:'rose-window',name:'Rose Window',n:12,kind:'rose'},{id:'arabesque',name:'Arabesque',n:8,kind:'arabesque'},{id:'snowflake',name:'Snowflake',n:6,kind:'snow'},{id:'woven-rings',name:'Woven Rings',n:9,kind:'woven'}];
  presets.push(
    {id:'paisley-crown',name:'Paisley Crown',n:12,kind:'paisley-crown'},
    {id:'botanical-bloom',name:'Botanical Bloom',n:12,kind:'botanical-bloom'},
    {id:'tulip-lace',name:'Tulip Lace',n:10,kind:'tulip-lace'},
    {id:'tiered-lotus',name:'Tiered Lotus',n:8,kind:'tiered-lotus'},
    {id:'petal-labyrinth',name:'Petal Labyrinth',n:10,kind:'petal-labyrinth'},
    {id:'marigold-skull',name:'Marigold Skull',n:12,kind:'marigold-skull'}
  );
  const S=1000,TAU=Math.PI*2;
  const cornerPresets=[{id:'corner-leaves',name:'Leaf Sprig'},{id:'corner-laurel',name:'Laurel Branch'},{id:'corner-finial',name:'Ornamental Finial'},{id:'corner-foliage',name:'Curling Foliage'}];
  const path=p=>p.map(([x,y])=>({X:Math.round(x*S),Y:Math.round(y*S)}));
  const rect=(x,y,w,h)=>path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
  function boolean(a,b=[],op=C.ClipType.ctUnion){const c=new C.Clipper(),out=[];c.StrictlySimple=true;if(a.length)c.AddPaths(a,C.PolyType.ptSubject,true);if(b.length)c.AddPaths(b,C.PolyType.ptClip,true);c.Execute(op,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);return out;}
  function offset(p,d,closed=true){const c=new C.ClipperOffset(2,25),out=[];c.AddPaths(p,C.JoinType.jtRound,closed?C.EndType.etClosedPolygon:C.EndType.etOpenRound);c.Execute(out,d*S);return out;}
  function createMotif(s,w,h,border,draft=false){
    const preset=presets.find(p=>p.id===s.preset);if(!preset)throw Error('Unknown mandala preset');
    const radius=Math.min(w-2*border,h-2*border)*.48*s.scale/100,f=radius/100,cx=w/2,cy=h/2,parts=[];
    const repeats=s.radialRepeats??preset.n,sx=(s.width??100)/100,sy=(s.height??100)/100,thickness=(s.lineThickness??100)/100,twist=(s.twist??0)*Math.PI/180;
    const transform=(points,a=0,x=0,y=0)=>{
      // Subdivide straight segments before the radial warp so facets curl smoothly too.
      const dense=[];for(let i=0;i<points.length;i++){const p=points[i],next=points[i+1],steps=next&&twist?Math.max(1,Math.ceil(Math.hypot(next[0]-p[0],next[1]-p[1])/2)):1;for(let j=0;j<steps;j++)dense.push(next?[p[0]+(next[0]-p[0])*j/steps,p[1]+(next[1]-p[1])*j/steps]:p);}
      return path(dense.map(([u,v])=>{const px=x+u*Math.cos(a)-v*Math.sin(a),py=y+u*Math.sin(a)+v*Math.cos(a),angle=twist*Math.hypot(px,py)/100;return [cx+(px*Math.cos(angle)-py*Math.sin(angle))*f*sx,cy+(px*Math.sin(angle)+py*Math.cos(angle))*f*sy];}));
    };
    function stroke(points,width,a=0,x=0,y=0){const p=transform(points,a,x,y),r=Math.max(.75,width*f/2)*thickness;if(draft)parts.push({points:p,width:r*2});else parts.push(...offset([p],r,false));}
    function loop(points,width,a=0,x=0,y=0){stroke([...points,points[0]],width,a,x,y);}
    const circle=(r,x=0,y=0)=>Array.from({length:96},(_,i)=>[x+r*Math.cos(i*TAU/96),y+r*Math.sin(i*TAU/96)]);
    function leaf(lo,hi,width,a,line=2.2){const points=[];for(let side of [-1,1])for(let i=0;i<=32;i++){const t=side===-1?i/32:1-i/32;points.push([lo+(hi-lo)*t,side*width*Math.sin(Math.PI*t)**.85]);}loop(points,line,a);}
    function scroll(a,sign=1,x=0,y=0){const p=[];for(let i=0;i<=80;i++){const t=i/80,angle=sign*(t*TAU*1.25),r=16*(1-t)+1.5;p.push([74+r*Math.cos(angle),r*Math.sin(angle)]);}stroke(p,2.5,a,x,y);}
    if(ornament(preset.kind,repeats,{stroke,loop,circle,leaf}))return {motif:draft?parts:boolean(parts),radius,f};
    loop(circle(8),3);loop(circle(28),2.4);
    for(let i=0;i<repeats;i++){
      const a=i*TAU/repeats-Math.PI/2;
      leaf(9,27,preset.kind==='sun'?2.4:4.5,a,1.8);
      if(preset.kind==='lotus'){leaf(31,94,14,a,3);leaf(45,86,8,a,2);scroll(a+Math.PI/repeats);}
      if(preset.kind==='scroll'){leaf(30,91,17,a,3);scroll(a+.22);scroll(a-.22,-1);leaf(48,79,7,a,2);}
      if(preset.kind==='sun'){leaf(30,97,6,a,2.8);leaf(43,87,3,a,1.8);}
      if(preset.kind==='star'){loop([[31,0],[57,-12],[97,0],[57,12]],2.5,a);loop([[47,0],[61,-6],[82,0],[61,6]],1.8,a);}
      if(preset.kind==='lace'){loop(circle(17,65,0),2.8,a);loop(circle(10,65,0),2,a);leaf(29,49,6,a);leaf(80,99,6,a);}
      if(preset.kind==='deco'){for(let j=0;j<4;j++)leaf(31+j*8,96-j*5,18-j*4,a,2.2);}
      if(preset.kind==='fern'){
        stroke([[30,0],[96,0]],2.8,a);
        for(let j=0;j<4;j++)for(const side of [-1,1]){const p=[],r=38+j*12;for(const edge of [-1,1])for(let k=0;k<=20;k++){const t=edge<0?k/20:1-k/20;p.push([r+16*t,side*(12*t+edge*4*Math.sin(Math.PI*t))]);}loop(p,2,a);}
        leaf(82,99,4,a,2);
      }
      if(preset.kind==='paisley'){
        loop(Array.from({length:96},(_,j)=>{const t=j*TAU/96;return [62+29*Math.cos(t),16*Math.sin(t)*(1+.45*Math.cos(t))];}),2.8,a);
        scroll(a);leaf(34,60,7,a,2);
      }
      if(preset.kind==='rose'){
        loop(circle(22,66,0),2.8,a);loop(circle(15,66,0),2,a);
        loop([[29,0],[39,-7],[48,0],[39,7]],2.2,a);leaf(86,99,4,a,2);
      }
      if(preset.kind==='arabesque'){
        for(const side of [-1,1])stroke(Array.from({length:80},(_,j)=>{const t=j/79;return [30+66*t,side*13*Math.sin(TAU*t)];}),2.8,a);
        leaf(44,79,5,a,2);loop(circle(4,90,0),2,a);
      }
      if(preset.kind==='snow'){
        stroke([[29,0],[99,0]],3,a);
        for(const r of [48,67,85])stroke([[r+9,-11],[r,0],[r+9,11]],2.8,a);
        loop([[30,0],[49,-15],[62,0],[49,15]],2.4,a);
      }
      if(preset.kind==='woven'){
        loop(Array.from({length:96},(_,j)=>{const t=j*TAU/96;return [62+32*Math.cos(t),20*Math.sin(t)];}),3,a);
        loop(Array.from({length:96},(_,j)=>{const t=j*TAU/96;return [62+23*Math.cos(t),12*Math.sin(t)];}),2,a);
      }
    }
    loop(circle(preset.kind==='sun'?40:48),2.8);
    if(preset.kind==='lace'){loop(circle(84),2.8);for(let i=0;i<repeats*4;i++)loop(circle(3,93*Math.cos(i*TAU/(repeats*4)),93*Math.sin(i*TAU/(repeats*4))),1.6);}
    if(preset.kind==='star')loop(Array.from({length:repeats*2},(_,i)=>{const a=i*TAU/(repeats*2),r=i%2?80:99;return [r*Math.cos(a),r*Math.sin(a)];}),2.5);
    if(preset.kind==='rose'){loop(circle(89),3);loop(circle(98),2.4);}
    if(preset.kind==='snow')loop(Array.from({length:repeats*2},(_,i)=>{const a=i*TAU/(repeats*2),r=i%2?36:57;return [r*Math.cos(a),r*Math.sin(a)];}),2.5);
    if(preset.kind==='woven')loop(circle(96),3);
    return {motif:draft?parts:boolean(parts),radius,f};
  }
  function ornament(kind,n,{stroke,loop,circle,leaf}){
    if(!['paisley-crown','botanical-bloom','tulip-lace','tiered-lotus','petal-labyrinth','marigold-skull'].includes(kind))return false;
    const angle=i=>i*TAU/n-Math.PI/2;
    const cubic=(start,...segments)=>{
      const points=[start];let a=start;
      for(const [b,c,d]of segments){for(let i=1;i<=20;i++){const t=i/20,u=1-t;points.push([u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]]);}a=d;}
      return points;
    };
    const petal=(lo,hi,width,a,line=2.2)=>loop(cubic([lo,0],[[lo+(hi-lo)*.2,-width],[hi-(hi-lo)*.25,-width],[hi,0]],[[hi-(hi-lo)*.25,width],[lo+(hi-lo)*.2,width],[lo,0]]),line,a);
    const ellipse=(x,y,rx,ry)=>Array.from({length:48},(_,i)=>[x+rx*Math.cos(i*TAU/48),y+ry*Math.sin(i*TAU/48)]);
    function flower(x,y,r,petals=7,line=1.8){
      for(let i=0;i<petals;i++)loop(ellipse(r*.56,0,r*.44,r*.19),line,i*TAU/petals,x,y);
      loop(circle(r*.2,x,y),line);
    }
    function center(){loop(circle(4),2.2);for(let i=0;i<n;i++)petal(7,23,4.8,angle(i),2);loop(circle(25),2.4);}
    if(kind==='paisley-crown'){
      center();
      for(let i=0;i<n;i++){
        const a=angle(i);
        petal(26,49,10,a,2.6);petal(30,44,4,a,1.8);
        stroke(cubic([48,-7],[[59,-20],[79,-17],[82,-2]],[[86,13],[64,19],[58,9]],[[52,-1],[63,-7],[68,0]],[[74,8],[66,12],[65,6]]),2.8,a);
        petal(77,99,12,a,3);petal(83,97,4.2,a,1.9);
        loop(circle(2.5,49,0),1.8,a+Math.PI/n);
        leaf(55,68,3.5,a+Math.PI/n,2);
      }
      loop(circle(49),2.4);
    }
    if(kind==='botanical-bloom'){
      loop(circle(4),2.4);
      for(let tier=0;tier<4;tier++)for(let i=0;i<n;i++){
        const a=angle(i)+(tier%2)*Math.PI/n,lo=5+tier*11,hi=22+tier*13,width=4.5+tier*3;
        petal(lo,hi,width,a,tier===3?2.8:2);
        if(tier>1)stroke([[hi-14,0],[hi-3,0]],1.6,a);
      }
      for(let i=0;i<n;i++){
        const a=angle(i);petal(65,98,14,a,2.8);petal(72,97,5,a,1.8);
        loop(circle(5.8,65,0),2,a+Math.PI/n);
        stroke(cubic([68,0],[[74,-9],[83,-9],[85,-2]],[[88,4],[81,7],[80,2]]),2,a+Math.PI/n);
      }
    }
    if(kind==='tulip-lace'){
      center();
      for(let i=0;i<n;i++){
        const a=angle(i),bud=cubic([81,0],[[74,-12],[91,-14],[96,0]],[[91,14],[74,12],[81,0]]);
        petal(26,53,10,a,2.6);petal(32,50,4,a,1.8);
        for(const side of [-1,1])stroke(cubic([51,0],[[60,side*18],[76,side*18],[77,side*7]],[[76,side*1],[70,side*2],[70,side*6]]),2.4,a);
        stroke(cubic([58,0],[[65,-5],[70,5],[81,0]]),2.2,a);
        loop(bud,2.6,a);petal(82,96,4,a,1.8);
        loop(ellipse(68,-6,7,2.8),1.8,a-.18);
        petal(54,73,5,a+Math.PI/n,2);
      }
      loop(circle(53),2.8);
      for(let i=0;i<n*3;i++)loop(circle(2.3,57*Math.cos(i*TAU/(n*3)),57*Math.sin(i*TAU/(n*3))),1.7);
    }
    if(kind==='tiered-lotus'){
      for(let i=0;i<n;i++){
        const a=angle(i);
        for(let j=0;j<3;j++)petal(40+j*6,99-j*7,24-j*5,a,2.4);
        for(let j=0;j<3;j++)petal(15+j*7,76-j*7,20-j*4.4,a+Math.PI/n,2.4);
        petal(5,30,6,a,2.4);
      }
      loop(circle(4),2.6);
    }
    if(kind==='petal-labyrinth'){
      for(let tier=0;tier<7;tier++){
        const r=12+tier*11,amplitude=5+tier*.95;
        const points=Array.from({length:n*32},(_,i)=>{const a=i*TAU/(n*32)-Math.PI/2,v=r+amplitude*Math.pow((1+Math.cos(n*(a+Math.PI/2)))/2,.7);return [v*Math.cos(a),v*Math.sin(a)];});
        loop(points,tier%2?2:3);
      }
      for(let i=0;i<n;i++)petal(70,99,12,angle(i)+Math.PI/n,2.8);
      loop(circle(4),2.6);
    }
    if(kind==='marigold-skull'){
      // Keep the face bilateral while growing the floral stems from its actual outline.
      const outline=cubic([0,-68],[[-36,-70],[-54,-46],[-51,-13]],[[-51,5],[-43,13],[-33,18]],[[-29,30],[-29,48],[-19,55]],[[-10,62],[10,62],[19,55]],[[29,48],[29,30],[33,18]],[[43,13],[51,5],[51,-13]],[[54,-46],[36,-70],[0,-68]]);
      loop(outline,3.6);
      const rootAt=a=>{
        const dx=Math.cos(a),dy=Math.sin(a);let radius=0;
        for(let i=1;i<outline.length;i++){
          const [x,y]=outline[i-1],ex=outline[i][0]-x,ey=outline[i][1]-y,den=dx*ey-dy*ex;
          if(Math.abs(den)<1e-8)continue;
          const r=(x*ey-y*ex)/den,t=(x*dy-y*dx)/den;
          if(r>radius&&t>=0&&t<=1)radius=r;
        }
        return radius;
      };
      const bloom=(x,y,r,petals,a=0)=>{
        for(let i=0;i<petals;i++)loop(cubic([r*.17,0],[[r*.36,-r*.56],[r*.94,-r*.42],[r,0]],[[r*.94,r*.42],[r*.36,r*.56],[r*.17,0]]),2,a+i*TAU/petals,x,y);
        loop(circle(r*.22,x,y),2.2);
      };
      const lance=(lo,hi,width,a=0,x=0,y=0,line=2)=>loop(cubic([lo,0],[[lo+(hi-lo)*.3,-width],[hi-3,-width*.65],[hi,0]],[[hi-3,width*.65],[lo+(hi-lo)*.3,width],[lo,0]]),line,a,x,y);
      for(const x of [-24,24]){
        loop(Array.from({length:144},(_,i)=>{const a=i*TAU/144,r=17+1.4*Math.cos(12*a);return [x+r*Math.cos(a),-7+r*Math.sin(a)];}),2.5);
        loop(circle(13.2,x,-7),1.9);
        bloom(x,-7,10.8,7,-Math.PI/2);
      }
      loop(cubic([0,7],[[-3,15],[-13,20],[-9,26]],[[-5,31],[-2,25],[0,25]],[[2,25],[5,31],[9,26]],[[13,20],[3,15],[0,7]]),2.6);
      loop(cubic([-24,33],[[-12,37],[12,37],[24,33]],[[27,52],[-27,52],[-24,33]]),2.8);
      stroke(cubic([-23,41],[[-10,45],[10,45],[23,41]]),2);
      for(const x of [-16,-8,0,8,16])stroke(cubic([x,35],[[x-1,40],[x+1,45],[x,48]]),1.9);
      for(let i=-2;i<=2;i++)lance(0,i===0?30:26,6.2,-Math.PI/2+i*.43,0,-32,2.3);
      loop(circle(3,0,-32),2.2);
      for(const side of [-1,1]){
        stroke(cubic([side*8,-39],[[side*21,-63],[side*42,-59],[side*42,-43]],[[side*43,-32],[side*28,-31],[side*29,-40]],[[side*30,-47],[side*37,-45],[side*35,-40]]),2.1);
        lance(0,15,3.8,side<0?-2.45:-.69,side*19,-46,1.9);
        stroke(cubic([side*38,10],[[side*51,17],[side*45,30],[side*36,29]],[[side*27,27],[side*34,18],[side*39,22]]),2.2);
        lance(0,11,3,side<0?2.3:.84,side*18,17,1.9);
        stroke(cubic([side*27,45],[[side*37,38],[side*42,49],[side*33,56]],[[side*28,61],[side*23,56],[side*27,53]]),2);
        lance(0,13,3.8,side<0?-2.65:-.49,0,57,1.9);
      }
      const spacing=Math.min(1,12/n);
      for(let i=0;i<n;i++){
        const a=angle(i),r=rootAt(a),flowerRadius=(i%2?11:13)*spacing,center=84;
        stroke(cubic([r,0],[[r+8,-7*spacing],[center-12,7*spacing],[center,0]]),2.6,a);
        bloom(center*Math.cos(a),center*Math.sin(a),flowerRadius,i%2?6:8,a);
        for(const side of [-1,1]){
          stroke(cubic([r+1,0],[[r+9,side*16*spacing],[77,side*20*spacing],[81,side*11*spacing]],[[83,side*5*spacing],[74,side*4*spacing],[75,side*10*spacing]]),2.1,a);
          lance(0,12*spacing,3.8*spacing,a+side*.85,(r+8)*Math.cos(a),(r+8)*Math.sin(a),1.9);
        }
        const b=a+Math.PI/n,root=rootAt(b);
        lance(root,98,8.5*spacing,b,0,0,2.5);
        stroke(cubic([root,0],[[root+12,-2],[87,3],[98,0]]),1.8,b);
        lance(root+9,91,3.6*spacing,b,0,0,1.8);
      }
      loop(Array.from({length:n*32},(_,i)=>{const a=angle(i/32),r=95+2.5*Math.cos(2*n*(a+Math.PI/2));return [r*Math.cos(a),r*Math.sin(a)];}),2.3);
    }
    return true;
  }
  function rotate(paths,angle,cx,cy,dx=0,dy=0){return paths.map(p=>p.map(q=>{const x=q.X-cx*S,y=q.Y-cy*S;return {X:Math.round((cx+dx)*S+x*Math.cos(angle)-y*Math.sin(angle)),Y:Math.round((cy+dy)*S+x*Math.sin(angle)+y*Math.cos(angle))};}));}
  function cornerMotif(s,r,reach){
    const strokes=[],thickness=(s.lineThickness??100)/100;
    const stroke=(points,width=2.3)=>strokes.push({points:path(points.map(([u,v])=>[r+(u-v)*reach/Math.SQRT2,r+(u+v)*reach/Math.SQRT2])),width:Math.max(.8,r*width/100)*thickness});
    const leaf=(u,v,length,width,angle)=>{const points=[];for(const side of [-1,1])for(let j=0;j<=24;j++){const t=side<0?j/24:1-j/24,x=t*length,y=side*width*Math.sin(Math.PI*t);points.push([u+x*Math.cos(angle)-y*Math.sin(angle),v+x*Math.sin(angle)+y*Math.cos(angle)]);}stroke(points.concat([points[0]]));};
    const stem=Array.from({length:65},(_,j)=>{const t=j/64;return [.04+1.18*t,.07*Math.sin(Math.PI*t)];});
    stroke(stem,2.8);
    if(s.cornerPreset==='corner-finial'){
      leaf(.28,0,.86,.19,0);leaf(.51,0,.52,.09,0);
      for(const side of [-1,1]){
        stroke(Array.from({length:81},(_,j)=>{const t=j/80,a=t*TAU*1.1,rad=.27*(1-t)+.015;return [.45+rad*Math.cos(a),side*(.22+rad*Math.sin(a))];}),2.6);
        leaf(.17,0,.42,.085,side*.85);
      }
    }else{
      const laurel=s.cornerPreset==='corner-laurel',foliage=s.cornerPreset==='corner-foliage',count=laurel?6:4;
      for(let j=0;j<count;j++)for(const side of [-1,1]){
        const u=.13+j*(laurel?.14:.22),v=.07*Math.sin(Math.PI*(u-.04)/1.18),length=laurel?.26:.36;
        leaf(u,v,length,laurel?.055:.085,side*(laurel?.78:.98));
        if(foliage)stroke(Array.from({length:49},(_,k)=>{const t=k/48,a=t*TAU*1.15,rad=.14*(1-t);return [u+.16+rad*Math.cos(a),v+side*(.3+rad*Math.sin(a))];}),1.8);
      }
      leaf(.98,0,.3,.065,0);
    }
    return strokes;
  }
  // Scale the exposed bands as well as the top lines, retaining a small reveal at thin settings.
  function settings(s){return s.spin===undefined?{...s,spin:s.offset??0,offset:0}:s;}
  function layerStep(s,f){return Math.max(.3,Math.max(.6,f*1.6)*(s.lineThickness??100)/100)+(s.offset??0);}
  // Clip centerlines before expanding strokes, so reserved-space ends get real round caps.
  function cornerStrokes(model,w,h,border,angle){
    const output=[],cos=Math.cos(angle),sin=Math.sin(angle),cx=w/2,cy=h/2;
    for(const x of [border,w-border])for(const y of [border,h-border])for(const stroke of model.cornerStrokes){
      const source=model.cornerDirectional?stroke.points.map(p=>({X:model.cornerRadius*S+(p.X-model.cornerRadius*S)*(x===border?1:-1),Y:model.cornerRadius*S+(p.Y-model.cornerRadius*S)*(y===border?1:-1)})):stroke.points;
      const points=rotate([source],angle,model.cornerRadius,model.cornerRadius,x-model.cornerRadius,y-model.cornerRadius)[0];
      const rx=(model.reserved[0]+stroke.width/2)*S,ry=(model.reserved[1]+stroke.width/2)*S;
      const local=p=>{const dx=p.X-cx*S,dy=p.Y-cy*S;return [(dx*cos+dy*sin)/rx,(-dx*sin+dy*cos)/ry];};
      const chunks=[];let chunk=[];
      const finish=()=>{if(chunk.length>1)chunks.push(chunk);chunk=[];};
      for(let j=1;j<points.length;j++){
        const p=points[j-1],q=points[j],a=local(p),b=local(q),dx=b[0]-a[0],dy=b[1]-a[1],A=dx*dx+dy*dy,B=2*(a[0]*dx+a[1]*dy),D=B*B-4*A*(a[0]*a[0]+a[1]*a[1]-1),ts=[0,1];
        if(A>0&&D>0)for(const t of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(t>0&&t<1)ts.push(t);
        ts.sort((a,b)=>a-b);
        const point=t=>({X:Math.round(p.X+(q.X-p.X)*t),Y:Math.round(p.Y+(q.Y-p.Y)*t)});
        for(let k=1;k<ts.length;k++){
          const mid=(ts[k-1]+ts[k])/2;
          if((a[0]+dx*mid)**2+(a[1]+dy*mid)**2>=1){if(!chunk.length)chunk.push(point(ts[k-1]));chunk.push(point(ts[k]));}else finish();
        }
      }
      finish();
      const first=chunks[0],last=chunks.at(-1);
      if(chunks.length>1&&first[0].X===last.at(-1).X&&first[0].Y===last.at(-1).Y){chunks[0]=last.concat(first.slice(1));chunks.pop();}
      for(const points of chunks)output.push({points,width:stroke.width});
    }
    return output;
  }
  function generate(s,w,h,border){
    s=settings(s);
    const mixed=!!s.cornerPreset&&s.cornerPreset!=='none',cx=w/2,cy=h/2;
    const {motif,radius,f}=createMotif(s,w,h,border);
    const outer=[rect(0,0,w,h)],interior=[rect(border,border,w-2*border,h-2*border)],layers=[];
    const cornerModel=mixed?previewModel(s,w,h,border):null;
    const b=Math.min(border,Math.min(w,h)/2-.5),frame=boolean(outer,[rect(b,b,w-2*b,h-2*b)],C.ClipType.ctDifference);
    const drop=s.cornerLevel===1?1:0;
    let support=[],stationaryBase,stationaryCorners,filled=false;
    for(let i=0;i<s.count;i++){
      if(i===s.count-1||filled){layers.push({polygons:[[[0,0],[1,0],[1,1],[0,1]]],pieces:1});continue;}
      const angle=i*(s.spin??0)*Math.PI/180;
      let base=stationaryBase;
      if(!base){
        let rotated=angle?rotate(motif,angle,cx,cy):motif;
        if(mixed&&!drop){
          const groups=new Map();for(const stroke of cornerStrokes(cornerModel,w,h,border,angle)){if(!groups.has(stroke.width))groups.set(stroke.width,[]);groups.get(stroke.width).push(stroke.points);}
          const corners=[];for(const [width,paths] of groups)corners.push(...offset(paths,width/2,false));
          rotated=boolean(rotated.concat(corners));
        }
        const clipped=boolean(rotated,interior,C.ClipType.ctIntersection);base=s.reverse?boolean(interior,clipped,C.ClipType.ctDifference):clipped;
        // Remove redundant sub-0.015 mm segments before offsetting, not just
        // after it: dense intersections otherwise multiply the offset workload.
        base=boolean(C.Clipper.CleanPolygons(base,15));
        if(!s.spin)stationaryBase=base;
      }
      // Successive round dilations compose. Reuse the previous silhouette when
      // stationary, avoiding repeated large offsets of already-buried fine detail.
      const expanded=i?offset(s.spin?base:support,(s.spin?i:1)*layerStep(s,f)):base;
      // Each lower layer retains the material above it for gluing; the frame never rotates.
      let combined=expanded;
      if(mixed&&drop&&i>=drop){
        let corners=stationaryCorners;
        if(!corners){const groups=new Map();for(const stroke of cornerStrokes(cornerModel,w,h,border,(i-drop)*(s.spin??0)*Math.PI/180)){if(!groups.has(stroke.width))groups.set(stroke.width,[]);groups.get(stroke.width).push(stroke.points);}corners=[];for(const [width,paths] of groups)corners.push(...offset(paths,width/2,false));corners=boolean(corners);if(!s.spin)stationaryCorners=corners;}
        combined=boolean(expanded.concat(i>drop?offset(corners,(i-drop)*layerStep(s,f)):corners));
      }
      const material=boolean(combined,interior,C.ClipType.ctIntersection);
      support=s.spin?boolean(material.concat(support)):boolean(C.Clipper.CleanPolygons(material,15));
      // Once the interior is completely supported, all deeper silhouettes are solid.
      filled=support.reduce((area,p)=>area+C.Clipper.Area(p),0)===C.Clipper.Area(interior[0]);
      const geometry=boolean(C.Clipper.CleanPolygons(boolean(support.concat(frame)),15));
      layers.push({polygons:geometry.map(p=>p.map(q=>[q.X/S/w,q.Y/S/h])),pieces:geometry.filter(p=>C.Clipper.Area(p)>0).length});
    }
    return layers;
  }
  function previewModel(s,w,h,border){
    s=settings(s);
    const mixed=!!s.cornerPreset&&s.cornerPreset!=='none',main=createMotif(s,w,h,border,true),model={strokes:main.motif,step:layerStep(s,main.f)};
    if(mixed){
      const r=Math.min(w-2*border,h-2*border)*.48,margin=Math.max(2,main.f*2)*(s.lineThickness??100)/100;
      model.cornerRadius=r;model.reserved=[main.radius*(s.width??100)/100+margin,main.radius*(s.height??100)/100+margin];model.cornerDirectional=cornerPresets.some(p=>p.id===s.cornerPreset);
      const reach=Math.max(r*1.15,Math.max(w-2*border,h-2*border)*.48);
      model.cornerStrokes=model.cornerDirectional?cornerMotif(s,r,reach):createMotif({...s,preset:s.cornerPreset,radialRepeats:undefined,scale:100,width:100,height:100},r*2,r*2,0,true).motif;
    }
    return model;
  }
  return {presets,cornerPresets,generate,previewModel,settings,cornerStrokes};
});
