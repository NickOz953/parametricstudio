'use strict';
class LivePatternPreview{
  constructor(kind,canvas,active){this.kind=kind;this.canvas=canvas;this.active=active;this.epoch=0;this.frames=0;this.navigation();addEventListener('pagehide',()=>{this.cancel();this.worker?.terminate();});}
  navigation(){
    const canvas=this.canvas,stage=canvas.parentElement,camera={x:0,y:0,zoom:1};this.camera=camera;let drag;
    canvas.style.touchAction='none';canvas.style.cursor='grab';
    const apply=()=>{canvas.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;if(this.active())document.getElementById('zoomLabel').value=Math.round(camera.zoom*100)+'%';};
    const eligible=e=>this.active()&&!e.target.closest('button,input,select,label,a,[role="toolbar"]');
    stage.addEventListener('wheel',e=>{
      if(!eligible(e))return;e.preventDefault();e.stopPropagation();
      const box=canvas.getBoundingClientRect(),old=camera.zoom,next=Math.max(.25,Math.min(20,old*Math.exp(-e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1)*.0015)));
      camera.x+=(e.clientX-box.x-box.width/2)*(1-next/old);camera.y+=(e.clientY-box.y-box.height/2)*(1-next/old);camera.zoom=next;apply();
    },{passive:false});
    stage.addEventListener('pointerdown',e=>{if(!eligible(e)||![0,1].includes(e.button)||!e.isPrimary)return;e.preventDefault();drag={id:e.pointerId,x:e.clientX,y:e.clientY};stage.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
    stage.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;camera.x+=e.clientX-drag.x;camera.y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;apply();});
    const end=e=>{if(drag?.id!==e.pointerId)return;drag=null;canvas.style.cursor='grab';if(stage.hasPointerCapture(e.pointerId))stage.releasePointerCapture(e.pointerId);};
    for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,end);
    document.getElementById('fit').addEventListener('click',()=>{camera.x=0;camera.y=0;camera.zoom=1;apply();});
  }
  request(settings,width,height,border,colors){
    this.canvas.style.width=Math.round(720*width/Math.max(width,height))+'px';
    this.pending={kind:this.kind,settings:{...settings,frameEnabled:state.frameEnabled!==false,backingEnabled:state.backingEnabled!==false},width,height,border,colors,epoch:this.epoch};
    if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.flush();});
  }
  flush(){
    if(this.busy||!this.pending)return;
    if(!this.worker){this.worker=new Worker('live-pattern-worker.js');this.worker.onmessage=({data})=>{
      this.busy=false;
      if(data.bitmap){if(data.epoch===this.epoch&&this.active()){this.canvas.width=data.bitmap.width;this.canvas.height=data.bitmap.height;this.canvas.getContext('2d').drawImage(data.bitmap,0,0);this.frames++;}data.bitmap.close();}
      this.flush();
    };this.worker.onerror=()=>{this.worker.terminate();this.worker=null;this.busy=false;this.pending=null;};}
    this.busy=true;this.worker.postMessage(this.pending);this.pending=null;
  }
  cancel(){this.epoch++;this.pending=null;cancelAnimationFrame(this.frame);this.frame=0;}
}
