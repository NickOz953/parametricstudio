'use strict';
importScripts('vendor/clipper.js','mandala-vectors.js','kaleidoscope-vectors.js');
let buffers;
function surface(w,h){const c=new OffscreenCanvas(w,h);c.getContext('2d',{willReadFrequently:true});return c;}
function reset(c){const ctx=c.getContext('2d');ctx.resetTransform();ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,c.width,c.height);return ctx;}
function drawStrokes(ctx,strokes){ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of strokes){ctx.beginPath();stroke.points.forEach((p,j)=>j?ctx.lineTo(p.X/1000,p.Y/1000):ctx.moveTo(p.X/1000,p.Y/1000));ctx.lineWidth=stroke.width;ctx.stroke();}}
function rotate(ctx,a,x,y){ctx.translate(x,y);ctx.rotate(a);ctx.translate(-x,-y);}
function morph(source,target,distance){
  const ctx=reset(target);ctx.drawImage(source,0,0);if(Math.abs(distance)<.25)return;
  ctx.globalCompositeOperation=distance>0?'source-over':'destination-in';
  // Raster-only dilation/erosion for interaction; exports always use exact polygon offsets.
  const r=Math.abs(distance);for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.drawImage(source,Math.cos(a)*r,Math.sin(a)*r);}ctx.globalCompositeOperation='source-over';
}
self.onmessage=({data})=>{
  try{
    const {kind,settings:s,width:w,height:h,border,colors,epoch}=data,scale=512/Math.max(w,h),pw=Math.max(1,Math.round(w*scale)),ph=Math.max(1,Math.round(h*scale));
    if(!buffers||buffers[0].width!==pw||buffers[0].height!==ph)buffers=Array.from({length:7},()=>surface(pw,ph));
    const [output,mask,changed,material,support,cornerMask,cornerChanged]=buffers,ctx=reset(output);reset(support);
    const model=kind==='mandalas'?MandalaVectors.previewModel(s,w,h,border):KaleidoscopeVectors.previewModel(s,w,h,border),layerMasks=[];
    let maskAngle;
    for(let i=0;i<s.count-1;i++){
      const angle=(kind==='mandalas'?i*(MandalaVectors.settings(s).spin||0):s.rotation+i*s.twirl)*Math.PI/180;
      if(angle!==maskAngle){const m=reset(mask);m.save();m.scale(scale,scale);
      if(kind==='mandalas'){
        if(model.cornerStrokes&&s.cornerLevel!==1)drawStrokes(m,MandalaVectors.cornerStrokes(model,w,h,border,angle));
        rotate(m,angle,w/2,h/2);drawStrokes(m,model.strokes);
      }else{rotate(m,angle,w/2,h/2);m.beginPath();for(const p of model.motifs){p.forEach((q,j)=>j?m.lineTo(q.X/1000,q.Y/1000):m.moveTo(q.X/1000,q.Y/1000));m.closePath();}m.fill();}
      m.restore();maskAngle=angle;}
      if(kind==='mandalas')morph(mask,changed,(s.reverse?-1:1)*i*model.step*scale);
      else{const delta=KaleidoscopeVectors.layerOffset(s,model.pitch,i);morph(mask,changed,(s.reverse?1:-1)*delta*scale);}
      if(kind==='mandalas'&&model.cornerStrokes&&s.cornerLevel===1&&i>=1){
        const c=reset(cornerMask);c.save();c.scale(scale,scale);drawStrokes(c,MandalaVectors.cornerStrokes(model,w,h,border,(i-1)*(s.spin||0)*Math.PI/180));c.restore();
        morph(cornerMask,cornerChanged,(i-1)*model.step*scale);changed.getContext('2d').drawImage(cornerChanged,0,0);
      }
      const mat=reset(material);mat.fillStyle='#000';mat.fillRect(border*scale,border*scale,(w-2*border)*scale,(h-2*border)*scale);
      mat.globalCompositeOperation=(kind==='mandalas'?s.reverse:!s.reverse)?'destination-out':'destination-in';mat.drawImage(changed,0,0);mat.globalCompositeOperation='source-over';mat.drawImage(support,0,0);
      reset(support).drawImage(material,0,0);
      const b=Math.min(kind==='kaleidoscope'&&i===0?s.topBorder:border,Math.min(w,h)/2-.5)*scale;
      if(s.frameEnabled!==false){mat.fillRect(0,0,pw,b);mat.fillRect(0,ph-b,pw,b);mat.fillRect(0,0,b,ph);mat.fillRect(pw-b,0,b,ph);}
      mat.globalCompositeOperation='source-in';mat.fillStyle=colors[i];mat.fillRect(0,0,pw,ph);mat.globalCompositeOperation='source-over';layerMasks.push(material.transferToImageBitmap());
    }
    if(s.backingEnabled!==false){ctx.fillStyle=colors[s.count-1];const b=s.frameEnabled===false?border*scale:0;ctx.fillRect(b,b,pw-2*b,ph-2*b);}for(let i=layerMasks.length-1;i>=0;i--){ctx.drawImage(layerMasks[i],0,0);layerMasks[i].close();}
    const bitmap=output.transferToImageBitmap();self.postMessage({epoch,bitmap},[bitmap]);
  }catch(e){self.postMessage({epoch:data.epoch,error:e.message});}
};
