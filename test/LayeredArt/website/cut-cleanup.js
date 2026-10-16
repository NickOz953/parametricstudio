(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('clipper-lib'));
  else root.CutCleanup=factory(root.ClipperLib);
})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const scale=1000;
  function convert(rings){
    const seen=new Set(),out=[];
    for(const ring of rings){
      const p=[];
      for(const [x,y] of ring){
        if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Invalid cut coordinate');
        const q={X:Math.round(x*scale),Y:Math.round(y*scale)},last=p.at(-1);
        if(!last||last.X!==q.X||last.Y!==q.Y)p.push(q);
      }
      if(p.length>1&&p[0].X===p.at(-1).X&&p[0].Y===p.at(-1).Y)p.pop();
      if(p.length<3)continue;
      // Ignore duplicate closed outlines regardless of start vertex or winding.
      const key=p.map((a,i)=>{const b=p[(i+1)%p.length],u=a.X+','+a.Y,v=b.X+','+b.Y;return u<v?u+':'+v:v+':'+u;}).sort().join('|');
      if(!seen.has(key)){seen.add(key);out.push(p);}
    }
    return out;
  }
  function tree(paths,clip=[],fill=C.PolyFillType.pftEvenOdd){
    const c=new C.Clipper(),out=new C.PolyTree();c.StrictlySimple=true;
    if(!paths.length)return out;
    c.AddPaths(paths,C.PolyType.ptSubject,true);
    if(clip.length)c.AddPaths(clip,C.PolyType.ptClip,true);
    if(!c.Execute(clip.length?C.ClipType.ctDifference:C.ClipType.ctUnion,out,fill,C.PolyFillType.pftEvenOdd))throw Error('Could not resolve cut contours');
    return out;
  }
  function offset(paths,distance){
    if(!paths.length)return [];
    const c=new C.ClipperOffset(2,20),out=[];
    c.AddPaths(paths,C.JoinType.jtRound,C.EndType.etClosedPolygon);c.Execute(out,distance*scale);return out;
  }
  function uncovered(paths,below){
    // Both inputs are already normalized material. This result is only inspected
    // for missing support, so splitting every coincident vertex is unnecessary.
    const c=new C.Clipper(),out=new C.PolyTree();
    c.AddPaths(paths,C.PolyType.ptSubject,true);c.AddPaths(below,C.PolyType.ptClip,true);
    if(!c.Execute(C.ClipType.ctDifference,out,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero))throw Error('Could not check layer support');
    return out;
  }
  function prune(t,area,stats){
    const out=[];
    function visit(node){
      const p=node.Contour(),hole=node.IsHole();
      const net=Math.abs(C.Clipper.Area(p))-(hole?0:node.Childs().reduce((sum,c)=>sum+Math.abs(C.Clipper.Area(c.Contour())),0));
      if(net<area){if(hole)stats.holes++;else stats.islands++;return;}
      out.push(p);node.Childs().forEach(visit);
    }
    t.Childs().forEach(visit);return out;
  }
  function bounds(items){const box={loX:Infinity,loY:Infinity,hiX:-Infinity,hiY:-Infinity};for(const e of items){box.loX=Math.min(box.loX,e.loX);box.loY=Math.min(box.loY,e.loY);box.hiX=Math.max(box.hiX,e.hiX);box.hiY=Math.max(box.hiY,e.hiY);}return box;}
  function indexEdges(edges){
    const box=bounds(edges);if(edges.length<=8)return {...box,edges};
    const axis=box.hiX-box.loX>box.hiY-box.loY?'X':'Y';edges.sort((a,b)=>(a['lo'+axis]+a['hi'+axis])-(b['lo'+axis]+b['hi'+axis]));const mid=edges.length>>1;
    return {...box,left:indexEdges(edges.slice(0,mid)),right:indexEdges(edges.slice(mid))};
  }
  function pointBox(p,b){return Math.max(b.loX-p.X,0,p.X-b.hiX)**2+Math.max(b.loY-p.Y,0,p.Y-b.hiY)**2;}
  function validateSegments(paths){
    const edges=[];paths.forEach((r,ring)=>r.forEach((a,i)=>{const b=r[(i+1)%r.length];edges.push({id:edges.length,ring,i,count:r.length,a,b,loX:Math.min(a.X,b.X),hiX:Math.max(a.X,b.X),loY:Math.min(a.Y,b.Y),hiY:Math.max(a.Y,b.Y)});}));
    if(!edges.length)return;
    const index=indexEdges([...edges]),cross=(a,b,c)=>(b.X-a.X)*(c.Y-a.Y)-(b.Y-a.Y)*(c.X-a.X),opposite=(a,b)=>a<0&&b>0||a>0&&b<0;
    const overlaps=(a,b)=>a.loX<=b.hiX&&a.hiX>=b.loX&&a.loY<=b.hiY&&a.hiY>=b.loY;
    function visit(a,node){
      if(!overlaps(a,node))return;
      if(!node.edges){visit(a,node.left);visit(a,node.right);return;}
      for(const b of node.edges){if(b.id<=a.id||!overlaps(a,b))continue;
        const x=cross(a.a,a.b,b.a),y=cross(a.a,a.b,b.b),z=cross(b.a,b.b,a.a),w=cross(b.a,b.b,a.b);
        if(x===0&&y===0){const axis=a.hiX-a.loX>a.hiY-a.loY?'X':'Y';if(Math.min(a['hi'+axis],b['hi'+axis])>Math.max(a['lo'+axis],b['lo'+axis]))throw Error('Overlapping cut segments remain');}
        const adjacent=a.ring===b.ring&&(Math.abs(a.i-b.i)===1||Math.abs(a.i-b.i)===a.count-1);
        if(!adjacent&&(opposite(x,y)||x===0||y===0)&&(opposite(z,w)||z===0||w===0))throw Error('Intersecting cut segments remain');
      }
    }
    for(const e of edges)visit(e,index);
  }
  function nearestPoint(p,node,best,reverse){
    if(pointBox(p,node)>=best.distance)return;
    if(node.edges){for(const e of node.edges){
      if(pointBox(p,e)>=best.distance)continue;
      const dx=e.b.X-e.a.X,dy=e.b.Y-e.a.Y,t=Math.max(0,Math.min(1,((p.X-e.a.X)*dx+(p.Y-e.a.Y)*dy)/(dx*dx+dy*dy||1)));
      const q={X:e.a.X+t*dx,Y:e.a.Y+t*dy},d=(p.X-q.X)**2+(p.Y-q.Y)**2;
      if(d<best.distance){best.distance=d;best.a=reverse?q:p;best.b=reverse?p:q;}
    }}else{
      const first=pointBox(p,node.left)<pointBox(p,node.right)?node.left:node.right;
      nearestPoint(p,first,best,reverse);nearestPoint(p,first===node.left?node.right:node.left,best,reverse);
    }
  }
  function connectMaterial(input,width,addedPaths,definitions){
    const groups=[];
    for(let n=input.GetFirst();n;n=n.GetNext())if(!n.IsHole()){
      const paths=[n.Contour(),...n.Childs().map(h=>h.Contour())],edges=[];
      for(const path of paths)for(let i=0;i<path.length;i++){const a=path[i],b=path[(i+1)%path.length];edges.push({a,b,loX:Math.min(a.X,b.X),loY:Math.min(a.Y,b.Y),hiX:Math.max(a.X,b.X),hiY:Math.max(a.Y,b.Y)});}
      groups.push({points:paths.flat(),edges,index:indexEdges(edges)});
    }
    if(groups.length<2)return {result:input,bridged:0};
    if(groups.length>600)throw Error('Too many separate pieces to connect. Increase image cleanup slightly.');
    // Exact nearest boundary connections, including hole boundaries around nested islands.
    const edges=[];
    for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
      const best={distance:Infinity,i,j};
      for(const p of groups[i].points)nearestPoint(p,groups[j].index,best,false);
      for(const p of groups[j].points)nearestPoint(p,groups[i].index,best,true);
      edges.push(best);
    }
    edges.sort((a,b)=>a.distance-b.distance);
    const parent=groups.map((_,i)=>i),root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},bridges=[];
    function normal(point,group,fallback,radius){
      let x=0,y=0;
      for(const edge of group.edges){
        if(pointBox(point,edge)>radius*radius)continue;
        const dx=edge.b.X-edge.a.X,dy=edge.b.Y-edge.a.Y,length=Math.hypot(dx,dy);if(!length)continue;
        const t=Math.max(0,Math.min(1,((point.X-edge.a.X)*dx+(point.Y-edge.a.Y)*dy)/(length*length)));
        const distance=Math.hypot(point.X-edge.a.X-t*dx,point.Y-edge.a.Y-t*dy),weight=Math.max(0,1-distance/radius)*Math.min(length,radius);
        x+=dy/length*weight;y-=dx/length*weight;
      }
      const length=Math.hypot(x,y);if(!length)return fallback;x/=length;y/=length;
      if(x*fallback.X+y*fallback.Y<.2)return fallback;
      x=x*.7+fallback.X*.3;y=y*.7+fallback.Y*.3;const size=Math.hypot(x,y);return {X:x/size,Y:y/size};
    }
    function flowingBridge(e){
      const distance=Math.sqrt(e.distance),radius=width*scale/2;
      if(distance<1)return [e.a,e.b];
      const direction={X:(e.b.X-e.a.X)/distance,Y:(e.b.Y-e.a.Y)/distance},neighborhood=Math.max(radius*4,distance*.15);
      const na=normal(e.a,groups[e.i],direction,neighborhood),nb=normal(e.b,groups[e.j],{X:-direction.X,Y:-direction.Y},neighborhood);
      const reach=distance*.34,bend=Math.min(distance*.14,radius*2),steps=Math.min(400,Math.max(24,Math.ceil(distance/(radius*.15))));
      const c1={X:e.a.X+na.X*reach,Y:e.a.Y+na.Y*reach},c2={X:e.b.X+nb.X*reach,Y:e.b.Y+nb.Y*reach},line=[];
      for(let i=0;i<=steps;i++){
        const t=i/steps,u=1-t,arch=16*t*t*u*u*bend;
        line.push({X:Math.round(u*u*u*e.a.X+3*u*u*t*c1.X+3*u*t*t*c2.X+t*t*t*e.b.X-direction.Y*arch),Y:Math.round(u*u*u*e.a.Y+3*u*u*t*c1.Y+3*u*t*t*c2.Y+t*t*t*e.b.Y+direction.X*arch)});
      }
      // A tapered shoulder blends the bridge into each silhouette; the core below
      // retains the chosen width throughout, independent of the shoulder shape.
      const sides=48;
      for(let i=0;i<line.length;i++){
        const t=i/steps;
        const r=radius*(1+.6*(Math.exp(-t*10)+Math.exp(-(1-t)*10)));
        const disk=Array.from({length:sides},(_,j)=>{const angle=j*2*Math.PI/sides;return {X:Math.round(line[i].X+Math.cos(angle)*r),Y:Math.round(line[i].Y+Math.sin(angle)*r)};});
        bridges.push(disk);
      }
      return line;
    }
    let bridged=0;
    for(const e of edges){const a=root(e.i),b=root(e.j);if(a===b)continue;parent[a]=b;
      const out=[],o=new C.ClipperOffset(2,20);
      const line=flowingBridge(e).map(p=>({X:Math.round(p.X),Y:Math.round(p.Y)}));
      definitions?.push({points:line.map(p=>[p.X/scale,p.Y/scale]),width});
      o.AddPath(line,C.JoinType.jtRound,C.EndType.etOpenRound);o.Execute(out,width*scale/2);
      for(const p of out){if(!C.Clipper.Orientation(p))p.reverse();bridges.push(p);}bridged++;
      if(bridged===groups.length-1)break;
    }
    const c=new C.Clipper(),result=new C.PolyTree();c.StrictlySimple=true;
    c.AddPaths([...C.Clipper.PolyTreeToPaths(input),...bridges],C.PolyType.ptSubject,true);
    c.Execute(C.ClipType.ctUnion,result,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    addedPaths?.push(...bridges);
    return {result,bridged};
  }
  function manualConnections(input,definitions,addedPaths){
    const bridges=[];
    for(const item of definitions){
      if(!Array.isArray(item.points)||item.points.length<2||item.points.length>1000||!Number.isFinite(item.width)||item.width<.5||item.width>12||!item.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))throw Error('Invalid manual bridge');
      const line=item.points.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)})),o=new C.ClipperOffset(2,20),out=[];
      // Match the automatic bridges' rounded shoulders when editing their centerlines.
      for(let i=0;i<line.length;i++){const t=i/(line.length-1),r=item.width*scale/2*(1+.6*(Math.exp(-t*10)+Math.exp(-(1-t)*10)));bridges.push(Array.from({length:48},(_,j)=>{const a=j*Math.PI/24;return {X:Math.round(line[i].X+Math.cos(a)*r),Y:Math.round(line[i].Y+Math.sin(a)*r)};}));}
      o.AddPath(line,C.JoinType.jtRound,C.EndType.etOpenRound);o.Execute(out,item.width*scale/2);
      for(const p of out){if(!C.Clipper.Orientation(p))p.reverse();bridges.push(p);}
    }
    const c=new C.Clipper(),result=new C.PolyTree();c.StrictlySimple=true;c.AddPaths([...C.Clipper.PolyTreeToPaths(input),...bridges],C.PolyType.ptSubject,true);c.Execute(C.ClipType.ctUnion,result,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);addedPaths.push(...bridges);return result;
  }
  function junctions(input){
    const seen=new Set(),contacts=new Map();
    for(const ring of C.Clipper.PolyTreeToPaths(input))for(const p of ring){
      const key=p.X+','+p.Y;if(seen.has(key))contacts.set(key,p);else seen.add(key);
    }
    return [...contacts.values()];
  }
  function weldJunctions(input,width,addedPaths){
    const contacts=junctions(input);if(!contacts.length)return input;
    const radius=Math.max(.5,width)*scale/2;
    const disks=contacts.map(p=>Array.from({length:48},(_,i)=>{const a=i*Math.PI/24;return {X:Math.round(p.X+Math.cos(a)*radius),Y:Math.round(p.Y+Math.sin(a)*radius)};}));
    addedPaths?.push(...disks);
    const c=new C.Clipper(),result=new C.PolyTree();c.StrictlySimple=true;
    c.AddPaths([...C.Clipper.PolyTreeToPaths(input),...disks],C.PolyType.ptSubject,true);
    c.Execute(C.ClipType.ctUnion,result,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    return result;
  }
  function rectangularFrame(input,frame){
    const {width,height,border}=frame;
    if(![width,height,border].every(Number.isFinite)||width<=0||height<=0||border<0)throw Error('Invalid frame dimensions');
    const rectangle=(x,y,w,h)=>convert([[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]])[0];
    const outer=rectangle(0,0,width,height),inner=rectangle(border,border,width-2*border,height-2*border);
    if(border*2>=Math.min(width,height))return tree([outer]);
    const clip=new C.Clipper(),cropped=new C.PolyTree();
    // Align sub-0.05 mm frame-edge slivers before union; otherwise a long,
    // nearly collinear tip can keep creating new point contacts after cleanup.
    const snap=(v,edges)=>edges.reduce((n,e)=>Math.abs(n-e)<=50?e:n,v);
    const fitted=C.Clipper.PolyTreeToPaths(input).map(r=>r.map(p=>({
      X:border?snap(p.X,[Math.round(border*scale),Math.round((width-border)*scale)]):p.X,
      Y:border?snap(p.Y,[Math.round(border*scale),Math.round((height-border)*scale)]):p.Y
    })));
    clip.AddPaths(fitted,C.PolyType.ptSubject,true);
    clip.AddPath(outer,C.PolyType.ptClip,true);
    clip.Execute(C.ClipType.ctIntersection,cropped,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    if(!border)return cropped;
    inner.reverse();
    const union=new C.Clipper(),result=new C.PolyTree();union.StrictlySimple=true;
    union.AddPaths([...C.Clipper.PolyTreeToPaths(cropped),outer,inner],C.PolyType.ptSubject,true);
    union.Execute(C.ClipType.ctUnion,result,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    return result;
  }
  function clean(rings,feature,protectedHoles=[],keepConnected=false,options={}){
    if(!rings.length)return {rings:[],pieces:0,islands:0,holes:0};
    const stats={islands:0,holes:0},minArea=feature*feature*scale*scale;
    const normalized=tree(convert(rings),[],options.positiveFill?C.PolyFillType.pftPositive:C.PolyFillType.pftEvenOdd);
    let paths=options.preserveDetail?C.Clipper.PolyTreeToPaths(normalized):prune(normalized,minArea,stats);
    const radius=feature/2;
    // Closing fills needle-shaped slots; opening trims needle-shaped material.
    // Round offset joins create physical tip radii, not merely cosmetic SVG strokes.
    if(!options.preserveDetail){
      paths=offset(offset(paths,radius),-radius);
      paths=offset(offset(paths,-radius),radius);
      paths=prune(tree(paths),minArea,stats);
    }
    let result=paths.length?tree(paths):new C.PolyTree();
    if(options.frame)result=rectangularFrame(result,options.frame);
    result=tree(C.Clipper.PolyTreeToPaths(result),convert(protectedHoles));
    const beforeConnections=C.Clipper.PolyTreeToPaths(result),addedPaths=[],bridgeDefinitions=[];
    // Boolean splitting alone leaves X-shaped, zero-width point contacts.
    // Add a physical rounded joint instead of sending both touching loops to CAM.
    if(options.allowConnections!==false)result=weldJunctions(result,options.bridgeWidth||feature,addedPaths);
    let bridged=0;
    if(options.allowConnections!==false&&Array.isArray(options.manualBridges)){
      if(options.manualBridges.length>600)throw Error('Too many manual bridges');
      bridgeDefinitions.push(...options.manualBridges);result=manualConnections(result,bridgeDefinitions,addedPaths);bridged=bridgeDefinitions.length;
    }else if(options.allowConnections!==false&&options.bridgeWidth){const connected=connectMaterial(result,options.bridgeWidth,addedPaths,bridgeDefinitions);result=tree(C.Clipper.PolyTreeToPaths(connected.result),convert(protectedHoles));bridged=connected.bridged;}
    // Remove sub-0.02 mm sampling chatter from merged rounded connectors.
    if(options.requireConnected)result=tree(C.Clipper.CleanPolygons(C.Clipper.PolyTreeToPaths(result),.02*scale));
    // Curved bridges may bow outside their endpoints. The frame stays rectangular.
    if(options.frame)result=tree(C.Clipper.PolyTreeToPaths(rectangularFrame(result,options.frame)),convert(protectedHoles));
    else if(protectedHoles.length)result=tree(C.Clipper.PolyTreeToPaths(result),convert(protectedHoles));
    if(options.ignoreMicroscopic)result=fillSmallCutouts(result,convert(protectedHoles)).material;
    for(let pass=0;options.allowConnections!==false&&pass<3&&junctions(result).length;pass++){
      result=weldJunctions(result,options.bridgeWidth||feature,addedPaths);
      if(options.frame)result=rectangularFrame(result,options.frame);
      result=tree(C.Clipper.PolyTreeToPaths(result),convert(protectedHoles));
    }
    // Separate zero-width contacts by subtraction only: never reconnect islands.
    // A 0.05 mm opening removes the ambiguous X without changing the frame sides.
    if(options.allowConnections===false)for(let pass=0;pass<4;pass++){
      const contacts=junctions(result);if(!contacts.length)break;
      const radius=(.025+pass*.005)*scale,disks=contacts.map(p=>Array.from({length:24},(_,i)=>{const a=i*Math.PI/12;return {X:Math.round(p.X+Math.cos(a)*radius),Y:Math.round(p.Y+Math.sin(a)*radius)};}));
      const c=new C.Clipper(),next=new C.PolyTree();c.StrictlySimple=true;c.AddPaths(C.Clipper.PolyTreeToPaths(result),C.PolyType.ptSubject,true);c.AddPaths(disks,C.PolyType.ptClip,true);c.Execute(C.ClipType.ctDifference,next,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);result=next;
    }
    if(options.ignoreMicroscopic)result=fillSmallCutouts(result,convert(protectedHoles)).material;
    const touching=junctions(result).length;
    if(touching)throw Error('Cut contours still touch. Adjust contour softness or image cleanup.');
    let pieces=0;for(let n=result.GetFirst();n;n=n.GetNext())if(!n.IsHole())pieces++;
    let detached=0;
    if(keepConnected&&pieces>1){
      // Keep the enclosing sheet and its holes, not material islands nested in those holes.
      // This runs after offsets and registration subtraction, which can sever narrow webs.
      const main=result.Childs().reduce((a,b)=>Math.abs(C.Clipper.Area(a.Contour()))>Math.abs(C.Clipper.Area(b.Contour()))?a:b);
      result=tree([main.Contour(),...main.Childs().map(n=>n.Contour())]);
      detached=pieces-1;pieces=1;
    }
    const output=C.Clipper.PolyTreeToPaths(result),toRings=paths=>paths.map(r=>r.map(p=>[p.X/scale,p.Y/scale]));
    validateSegments(output);
    const added=new C.PolyTree(),bridgeClip=new C.Clipper();bridgeClip.StrictlySimple=true;
    if(addedPaths.length){
      bridgeClip.AddPaths(addedPaths,C.PolyType.ptSubject,true);
      bridgeClip.AddPaths(beforeConnections,C.PolyType.ptClip,true);
      bridgeClip.Execute(C.ClipType.ctDifference,added,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    }
    const clippedBridges=new C.PolyTree(),finalClip=new C.Clipper();finalClip.StrictlySimple=true;
    if(addedPaths.length){
      finalClip.AddPaths(C.Clipper.PolyTreeToPaths(added),C.PolyType.ptSubject,true);
      finalClip.AddPaths(output,C.PolyType.ptClip,true);
      finalClip.Execute(C.ClipType.ctIntersection,clippedBridges,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
    }
    return {rings:toRings(output),bridgeRings:toRings(C.Clipper.PolyTreeToPaths(clippedBridges)),bridgeDefinitions,pieces,detached,bridged,touching,...stats};
  }
  function unsupported(bridges,below){return C.Clipper.PolyTreeToPaths(tree(convert(bridges),convert(below))).map(r=>r.map(p=>[p.X/scale,p.Y/scale]));}
  function prepare(rings){return C.Clipper.PolyTreeToPaths(tree(convert(rings))).map(r=>r.map(p=>[p.X/scale,p.Y/scale]));}
  function fillSmallCutouts(material,pins){
    const paths=[];let removed=0;
    function visit(node){
      if(node.IsHole()&&Math.abs(C.Clipper.Area(node.Contour()))<2*scale*scale&&!pins.some(p=>C.Clipper.PointInPolygon(p[0],node.Contour())!==0)){removed++;return;}
      paths.push(node.Contour());for(const child of node.Childs())visit(child);
    }
    for(const child of material.Childs())visit(child);
    // Registration is intentional, even when smaller than the cut-area threshold.
    return {material:tree(paths,pins),removed};
  }
  function stack(jobs,board){
    const toRings=t=>C.Clipper.PolyTreeToPaths(t).map(r=>r.map(p=>[p.X/scale,p.Y/scale]));
    try{
      const results=jobs.map(j=>{if(j.invalid)throw Error('Invalid layer');return clean(j.rings,j.feature,j.holes,false,{...j.options,ignoreMicroscopic:true});});
      if(!board||!results.length)return results;
      // Registration is a through-stack operation, including formerly unframed layers.
      const holes=convert(jobs.flatMap(j=>j.holes||[]));
      const pins=C.Clipper.PolyTreeToPaths(tree(holes,[],C.PolyFillType.pftNonZero));
      let above=[];
      for(let i=0;i<results.length;i++){
        const backing=board.backing!==false&&i===results.length-1;
        const inset=board.inset||0;
        const own=backing?convert([[[inset,inset],[board.width-inset,inset],[board.width-inset,board.height-inset],[inset,board.height-inset]]]):convert(results[i].rings);
        // A 0.01 mm overlap allowance avoids slivers from integer-grid rounding
        // at boolean intersections. Keep the artboard outline exactly rectangular.
        const frame=jobs[i].options?.frame;
        let supportSource=above;
        if(frame&&above.length){
          // A one-micron inset avoids coincident frame edges; the exact upper
          // silhouette is also unioned below so this cannot remove its support.
          const b=(frame.border+.001)*scale,w=frame.width*scale,h=frame.height*scale,c=new C.Clipper(),inside=new C.PolyTree();
          c.StrictlySimple=true;c.AddPaths(above,C.PolyType.ptSubject,true);
          c.AddPath([{X:b,Y:b},{X:w-b,Y:b},{X:w-b,Y:h-b},{X:b,Y:h-b}],C.PolyType.ptClip,true);
          c.Execute(C.ClipType.ctIntersection,inside,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
          supportSource=C.Clipper.PolyTreeToPaths(inside);
        }
        const support=supportSource.length?offset(supportSource,.01):[];
        let material=tree([...own,...above,...support],pins,C.PolyFillType.pftNonZero);
        material=tree(C.Clipper.PolyTreeToPaths(rectangularFrame(material,{...board,border:0})),pins);
        // Union can create a zero-width junction. Add a tiny rounded support
        // shoulder here; subtraction would remove backing required by the layer above.
        for(let pass=0;pass<4;pass++){
          const points=junctions(material);if(!points.length)break;
          const radius=25+pass*10,disks=points.map(p=>Array.from({length:24},(_,k)=>{const a=k*Math.PI/12;return {X:Math.round(p.X+radius*Math.cos(a)),Y:Math.round(p.Y+radius*Math.sin(a))};}));
          material=tree([...C.Clipper.PolyTreeToPaths(material),...disks],pins,C.PolyFillType.pftNonZero);
          material=tree(C.Clipper.PolyTreeToPaths(rectangularFrame(material,{...board,border:0})),pins);
        }
        const filled=fillSmallCutouts(material,pins);material=filled.material;
        // Measure physical area, not line width. Nested islands remain independent.
        const kept=[];let smallPiecesRemoved=0;
        for(let n=material.GetFirst();n;n=n.GetNext())if(!n.IsHole()){
          const holes=n.Childs().map(h=>h.Contour());
          const area=Math.abs(C.Clipper.Area(n.Contour()))-holes.reduce((sum,h)=>sum+Math.abs(C.Clipper.Area(h)),0);
          if(area<2*scale*scale)smallPiecesRemoved++;
          else kept.push(n.Contour(),...holes);
        }
        material=tree(kept);
        // Boolean rounding can leave one-grid-unit slivers along a supported edge.
        // Repair the missing material, rather than tolerating an unsupported export.
        for(let pass=0;above.length&&pass<4;pass++){
          const missing=C.Clipper.PolyTreeToPaths(uncovered(above,C.Clipper.PolyTreeToPaths(material)));
          if(!missing.length)break;
          material=tree([...C.Clipper.PolyTreeToPaths(material),...offset(missing,.005*(pass+1))],pins,C.PolyFillType.pftNonZero);
          material=tree(C.Clipper.PolyTreeToPaths(rectangularFrame(material,{...board,border:0})),pins);
        }
        const finalFill=fillSmallCutouts(material,pins);material=finalFill.material;
        const paths=C.Clipper.PolyTreeToPaths(material);
        validateSegments(paths);
        if(junctions(material).length)throw Error('Ambiguous support junction');
        if(above.length&&C.Clipper.PolyTreeToPaths(uncovered(above,paths)).length)throw Error('Incomplete layer support');
        let pieces=0;for(let n=material.GetFirst();n;n=n.GetNext())if(!n.IsHole())pieces++;
        if(jobs[i].options?.requireConnected&&pieces!==1)throw Error('Top layer must be connected to its border. Increase the top border width.');
        results[i]={...results[i],rings:toRings(material),pieces,supported:true,backing,smallPiecesRemoved,smallCutoutsRemoved:filled.removed+finalFill.removed};
        above=paths;
      }
      return results;
    }catch(error){return jobs.map(()=>({rings:[],error:true,supported:false,reason:error.message}));}
  }
  return {clean,unsupported,prepare,stack};
});
