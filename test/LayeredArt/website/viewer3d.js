import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';

const stage=document.getElementById('stage');
const tab=document.createElement('button');tab.id='view3d';tab.dataset.view='three';tab.textContent='3D';document.querySelector('.segmented').append(tab);
const host=document.createElement('div');host.id='viewer3d';host.setAttribute('aria-label','Interactive 3D composition');stage.append(host);
const toolbar=document.createElement('div');toolbar.id='threeTools';toolbar.innerHTML=`<label>Layer separation<input id="separate3d" type="range" min="0" max="100" step="1" value="0" aria-label="Preview layer separation"><output id="separate3dOut">0 mm</output></label>`;stage.append(toolbar);
host.title='Left-drag to orbit; hold the mouse wheel and drag to pan; scroll to zoom. Right-drag or Shift + left-drag also pans.';
const notice=document.createElement('div');notice.id='threeNotice';notice.setAttribute('role','status');stage.append(notice);
let renderer,scene,camera,controls,model,light,active=false,signature='',buildTimer,resetPending=true,fitDistance=1;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionFrame=0,motionTime=0,stoppingMotion=false;
function scheduleMotion(){
  if(motionFrame||stoppingMotion||!active||document.hidden||studioRendering.pending||!controls?.enableDamping||renderer.getContext().isContextLost())return;
  if(!motionTime)motionTime=performance.now();
  motionFrame=requestAnimationFrame(time=>{
    motionFrame=0;if(!active||document.hidden||studioRendering.pending)return;
    controls.dampingFactor=1-Math.pow(.84,Math.max(4,Math.min(64,time-motionTime))/(1000/60));motionTime=time;
    const changed=controls.update();controls.dampingFactor=.16;if(!changed)stopMotion();
  });
}
function stopMotion(){
  cancelAnimationFrame(motionFrame);motionFrame=0;motionTime=0;if(!controls)return;
  // Flush OrbitControls' remaining momentum without moving the current view.
  const position=camera.position.clone(),target=controls.target.clone();stoppingMotion=true;controls.enableDamping=false;
  controls.update();camera.position.copy(position);controls.target.copy(target);controls.update();
  controls.enableDamping=!reducedMotion.matches;stoppingMotion=false;
}
reducedMotion.addEventListener('change',stopMotion);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
const cache=new Map();
function disposeEntry(entry){entry.mesh.traverse(obj=>{obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach(m=>m.dispose());else obj.material?.dispose();});model.remove(entry.mesh);}
const geometryIds=new WeakMap();let nextGeometryId=0;
function previewContours(layer){return cutCache.get(layer)?.error?preparedContours(layer):contours(layer);}
function geometryId(rings){if(!geometryIds.has(rings))geometryIds.set(rings,++nextGeometryId);return geometryIds.get(rings);}
let buildRevision=0,cancelMesh;
function cancelBuild(){buildRevision++;cancelMesh?.();cancelMesh=null;}
function extrude(rings,depth){
  return new Promise((resolve,reject)=>{
    const worker=new Worker('mesh-worker.js');
    const finish=(error,data)=>{clearTimeout(timer);worker.terminate();if(cancelMesh===cancel)cancelMesh=null;if(error){reject(error);return;}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));geometry.addGroup(0,data.capCount,0);geometry.addGroup(data.capCount,data.positions.length/3-data.capCount,1);resolve(geometry);
    };
    const cancel=()=>finish(Error('Cancelled')),timer=setTimeout(()=>finish(Error('3D preview timed out. Try fewer layers or a simpler pattern.')),45000);cancelMesh=cancel;
    worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data);worker.onerror=()=>finish(Error('3D geometry could not be loaded.'));
    worker.postMessage({rings,depth});
  });
}
function paint(){if(!active||!renderer||renderer.getContext().isContextLost()||!host.clientWidth)return;renderer.render(scene,camera);document.getElementById('zoomLabel').value=Math.round(fitDistance/camera.position.distanceTo(controls.target)*100)+'%';}
let renderWidth=0,renderHeight=0;
function resize(){if(!renderer||!host.clientWidth||!host.clientHeight)return;if(renderWidth!==host.clientWidth||renderHeight!==host.clientHeight){renderWidth=host.clientWidth;renderHeight=host.clientHeight;renderer.setSize(renderWidth,renderHeight,false);camera.aspect=renderWidth/renderHeight;camera.updateProjectionMatrix();}paint();}
function init(){if(renderer)return;renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0xf1f3ef,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','3D artwork. Arrow keys rotate; Shift and arrows pan; plus and minus zoom.');host.append(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.1,10000);model=new THREE.Group();scene.add(model);
  scene.add(new THREE.HemisphereLight(0xffffff,0x67705f,2.1));light=new THREE.DirectionalLight(0xffffff,2.3);light.position.set(-200,350,500);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.bias=-.0001;light.shadow.normalBias=.15;scene.add(light);const fill=new THREE.DirectionalLight(0xe4edf7,1.2);fill.position.set(300,-100,-200);scene.add(fill);
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=!reducedMotion.matches;controls.dampingFactor=.16;controls.screenSpacePanning=true;controls.enablePan=true;controls.minDistance=10;controls.maxDistance=15000;controls.addEventListener('change',()=>{if(stoppingMotion)return;paint();scheduleMotion();});controls.touches.ONE=THREE.TOUCH.ROTATE;controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;controls.mouseButtons.MIDDLE=THREE.MOUSE.PAN;
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();stopMotion();cancelBuild();signature='';host.dataset.ready='false';notice.textContent='3D graphics paused. Waiting for the graphics device to recover.';});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{signature='';refresh();});
  renderer.domElement.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(e.key))return;e.preventDefault();if(['+','=','-'].includes(e.key)){dolly(e.key==='-'?1.15:1/1.15);return;}const horizontal=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,vertical=e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0;if(e.shiftKey){const delta=new THREE.Vector3(horizontal,vertical,0).applyQuaternion(camera.quaternion).multiplyScalar(camera.position.distanceTo(controls.target)*.04);camera.position.add(delta);controls.target.add(delta);}else{const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);spherical.theta+=horizontal*.12;spherical.phi=Math.max(.05,Math.min(Math.PI-.05,spherical.phi-vertical*.12));camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));}controls.update();paint();});
  new ResizeObserver(resize).observe(host);resize();
}
function positionLayers(){if(!model)return;const visible=state.layers.filter(l=>l.visible),extra=Number(document.getElementById('separate3d').value);let z=0;
  visible.slice().reverse().forEach((l,i)=>{if(i)z+=l.gap+extra;const mesh=cache.get(l.id)?.mesh;if(mesh)mesh.position.z=z;z+=l.thickness;});model.position.z=-z/2;model.userData.depth=z;model.userData.physicalDepth=z-extra*Math.max(0,visible.length-1);document.getElementById('separate3dOut').value=extra+' mm';renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;paint();
}
function fit(front=false){if(!renderer)return;stopMotion();resize();const radius=Math.hypot(state.w,state.h,model.userData.depth||1)/2,half=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Math.min(1,camera.aspect));fitDistance=radius/Math.sin(half)*1.12;controls.target.set(0,0,0);const dir=front?new THREE.Vector3(0,0,1):new THREE.Vector3(.38,.24,1).normalize();camera.position.copy(dir.multiplyScalar(fitDistance));camera.near=Math.max(.1,fitDistance/1000);camera.far=fitDistance*20;camera.updateProjectionMatrix();controls.minDistance=radius*.15;controls.maxDistance=fitDistance*8;controls.update();paint();}
function dolly(factor){if(!camera)return;const offset=camera.position.clone().sub(controls.target);offset.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,offset.length()*factor)));camera.position.copy(controls.target).add(offset);controls.update();paint();}
async function build(){if(!active||view!=='three'||studioRendering.pending){signature='';return;}const revision=buildRevision;try{init();host.dataset.ready='false';const current=new Set(state.layers.filter(l=>l.visible).map(l=>l.id));let meshCount=0,vertices=0;
  for(const [id,entry]of cache)if(!current.has(id)){disposeEntry(entry);cache.delete(id);}
  for(const layer of state.layers){if(!layer.visible)continue;if(revision!==buildRevision)return;notice.textContent='Building 3D layer '+(meshCount+1)+' of '+current.size+'...';const rings=previewContours(layer),highlights=bridgeHighlights(layer),key=[state.w,state.h,layer.thickness,geometryId(rings),geometryId(highlights)].join('|');let entry=cache.get(layer.id);
    if(!entry||entry.key!==key){if(entry){disposeEntry(entry);cache.delete(layer.id);}
      const geometry=await extrude(rings,layer.thickness);if(revision!==buildRevision){geometry.dispose();return;}if(vertices+geometry.attributes.position.count>6000000){geometry.dispose();throw Error('This design exceeds the 3D preview memory limit. Try fewer layers.');}geometry.rotateX(Math.PI);geometry.translate(-state.w/2,state.h/2,layer.thickness);const materials=[new THREE.MeshStandardMaterial({roughness:.85}),new THREE.MeshStandardMaterial({roughness:.95,side:THREE.DoubleSide})];const mesh=new THREE.Mesh(geometry,materials);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.layerId=layer.id;model.add(mesh);entry={key,mesh};cache.set(layer.id,entry);
      if(highlights.length){const overlay=await extrude(highlights,.02);if(revision!==buildRevision){overlay.dispose();return;}overlay.rotateX(Math.PI);overlay.translate(-state.w/2,state.h/2,layer.thickness+.04);const color=new THREE.MeshBasicMaterial({color:'#ef3d83',side:THREE.DoubleSide});mesh.add(new THREE.Mesh(overlay,[color,color]));}
    }
    entry.mesh.material[0].color.set(layer.color);entry.mesh.material[1].color.set(layer.color).multiplyScalar(.65);entry.mesh.material[0].roughness=layer.material==='Acrylic'?.35:.85;meshCount++;vertices+=entry.mesh.geometry.attributes.position.count;
  }
  for(const [id,entry]of cache)if(!current.has(id)){disposeEntry(entry);cache.delete(id);}
  renderer.shadowMap.enabled=vertices<600000;
  const span=Math.max(state.w,state.h);light.position.set(-span,span*1.3,span*2);Object.assign(light.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:1,far:span*5});light.shadow.camera.updateProjectionMatrix();positionLayers();if(resetPending){fit();resetPending=false;}const invalid=state.layers.find(l=>l.visible&&cutCache.get(l)?.error);notice.textContent=invalid?'Unvalidated 3D preview: '+(cutCache.get(invalid).reason||'cut cleanup failed')+' Cut exports remain blocked.':meshCount?'':'No visible layers';host.dataset.ready='true';host.dataset.layerCount=String(meshCount);paint();
}catch(e){if(revision!==buildRevision)return;signature='';host.dataset.ready='false';for(const [id,entry]of cache){disposeEntry(entry);cache.delete(id);}notice.textContent=e.message+(state.layers.some(l=>cutCache.get(l)?.error)?' Cut exports are blocked until validation passes.':' The 2D views and exports remain available.');paint();}}
function refresh(){active=view==='three'&&state.preset!=='empty'&&!stage.matches('.ornamental-preview,.topo-preview,.kaleido-preview');stage.classList.toggle('three-mode',active);tab.disabled=state.preset==='empty';if(!active||studioRendering.pending){stopMotion();clearTimeout(buildTimer);cancelBuild();signature='';return;}document.getElementById('previewLabel').textContent='3D composition';const next=JSON.stringify([state.w,state.h,showBridgeVoids,state.layers.map(l=>[l.id,l.visible,l.color,l.material,l.thickness,l.gap,l.visible?geometryId(previewContours(l)):0])]);if(next!==signature){cancelBuild();host.dataset.ready='false';signature=next;notice.textContent='Building 3D layers…';clearTimeout(buildTimer);buildTimer=setTimeout(build,40);}else{resize();}}
const previousDraw=draw;draw=function(){requestStudioDraw(()=>{previousDraw();refresh();});};
const patternVisibility=new MutationObserver(()=>{const expected=view==='three'&&state.preset!=='empty'&&!stage.matches('.ornamental-preview,.topo-preview,.kaleido-preview');if(active!==expected)refresh();});
patternVisibility.observe(stage,{attributes:true,attributeFilter:['class']});
window.addEventListener('pagehide',()=>patternVisibility.disconnect());
tab.onclick=()=>{view='three';showSource(false);document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b===tab));render();};
window.addEventListener('cutlayersgenerated',()=>{resetPending=true;signature='';});
document.getElementById('separate3d').oninput=()=>{
  if(!model){document.getElementById('separate3dOut').value=document.getElementById('separate3d').value+' mm';return;}
  // Separation only moves layers; preserve the user's zoom, orbit, and pan.
  positionLayers();
};
for(const [id,factor]of [['zoomIn',1/1.15],['zoomOut',1.15]]){const old=document.getElementById(id).onclick;document.getElementById(id).onclick=()=>active?dolly(factor):old();}const oldFit=document.getElementById('fit').onclick;document.getElementById('fit').onclick=()=>active?fit():oldFit();
window.addEventListener('pagehide',()=>{stopMotion();reducedMotion.removeEventListener('change',stopMotion);cancelBuild();for(const entry of cache.values())disposeEntry(entry);cache.clear();controls?.dispose();renderer?.dispose();});
window.layered3D={snapshot:()=>({active,inertiaActive:!!motionFrame,meshes:cache.size,depth:model?.userData.physicalDepth,previewDepth:model?.userData.depth,camera:camera?.position.toArray(),target:controls?.target.toArray(),triangles:renderer?.info.render.triangles}),render:paint};
icons();refresh();
