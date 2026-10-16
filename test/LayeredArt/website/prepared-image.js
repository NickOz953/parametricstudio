'use strict';
(()=>{
 const note=document.createElement('p');note.id='preparedImageStatus';note.className='note';note.setAttribute('role','status');$('conversionControls').prepend(note);
 let cache=null,worker,timer;
 function stopPhoto(){clearTimeout(timer);worker?.terminate();worker=null;}
 function preparePhoto(record,image,count){
   record.pending=true;
   timer=setTimeout(()=>{
     if(cache!==record)return;
     worker=new Worker('photo-worker.js');const job=worker;
     const finish=error=>{if(cache!==record||worker!==job)return;stopPhoto();record.pending=false;record.error=error||'';updateCropPreview();updateImportUI();};
     timer=setTimeout(()=>finish('Photo preparation timed out. Use Simplify photo to retry.'),60000);
     job.onerror=()=>finish('Photo preparation failed. Use Simplify photo to retry.');
     job.onmessage=({data})=>{
       if(cache!==record||worker!==job)return;
       if(data.error){finish(data.error);return;}if(!data.done)return;
       const pixels=record.canvas.getContext('2d').createImageData(data.width,data.height),tones=new Set();
       for(let i=0;i<data.labels.length;i++){const g=Math.round(data.labels[i]*255/(count-1)),p=i*4;pixels.data[p]=pixels.data[p+1]=pixels.data[p+2]=g;pixels.data[p+3]=255;tones.add(g);}
       record.canvas.getContext('2d').putImageData(pixels,0,0);record.levels=[...tones].sort((a,b)=>a-b);
       finish(record.levels.length<2?'At least two gray levels are needed to create layered relief.':'');
     };
     job.postMessage({image,count,smooth:2});
   },120);
 }
 const enabled=()=>state.preparedImageMode!==false&&!state.photoPreparation;
 function read(){
   if(!sourceImage)return null;
   const crop=['cropLeft','cropTop','cropRight','cropBottom'].map(id=>Number($(id).value)||0),count=number('colorCount',2,12),key=JSON.stringify([crop,count,!!state.imageLevelsOverride]);
   if(cache?.source===sourceImage&&cache.key===key)return cache;
   const [l,t,r,b]=crop,sw=sourceImage.width*(100-l-r)/100,sh=sourceImage.height*(100-t-b)/100;
   if(sw<=0||sh<=0)throw Error('Crop must leave some artwork.');
   const c=document.createElement('canvas'),ratio=Math.min(1,720/Math.max(sw,sh));c.width=Math.max(1,Math.round(sw*ratio));c.height=Math.max(1,Math.round(sh*ratio));
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;ctx.fillStyle='#000';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(sourceImage,sourceImage.width*l/100,sourceImage.height*t/100,sw,sh,0,0,c.width,c.height);
   const raw=ctx.getImageData(0,0,c.width,c.height),im=new ImageData(new Uint8ClampedArray(raw.data),c.width,c.height),levels=new Set();
   // Convert color without quantizing: preview and tracing use the same grayscale pixels.
   for(let i=0;i<im.data.length;i+=4){const gray=Math.round(.2126*im.data[i]+.7152*im.data[i+1]+.0722*im.data[i+2]);im.data[i]=im.data[i+1]=im.data[i+2]=gray;levels.add(gray);}
   let tones=[...levels].sort((a,b)=>a-b),normalized=false;const photo=tones.length>12;
   // Prepared raster artwork can have antialiasing and texture around otherwise flat bands.
   // Keep exact palettes untouched; normalize extra shades to the user's chosen count.
   if(tones.length>12||state.imageLevelsOverride&&tones.length>count){tones=ToneTools.quantizedLevels(ToneTools.histogram(im.data),count);ToneTools.snapLevels(im.data,tones);normalized=true;}
   ctx.putImageData(im,0,0);
   const error=tones.length<2?'At least two gray levels are needed to create layered relief.':'';
   stopPhoto();cache={source:sourceImage,key,canvas:c,levels:tones,error,normalized,photo};
   if(photo)preparePhoto(cache,raw,count);return cache;
 }
 window.photoImportState=()=>enabled()&&sourceImage?read():null;
 window.cancelPhotoImport=()=>{stopPhoto();cache=null;};
 function controls(){const on=enabled();prepPanel.hidden=on||!!state.photoPreparation;thresholdPanel.hidden=on||!!state.photoPreparation;$('colorCount').closest('label').hidden=on&&!read()?.normalized;$('blur').closest('label').hidden=on||!!state.photoPreparation;note.hidden=!on;}
 const baseSettings=settings;settings=function(){const s=baseSettings();if(!enabled()||!sourceImage)return s;const p=read();if(p.error)return {...s,preparedImage:true};return {...s,count:p.levels.length,preparedImage:true,preparedLevels:p.levels,blur:0,autoArtifacts:false,toneLevels:[],thresholdMode:'manual',thresholds:p.levels.slice(1).map((v,i)=>Math.floor((p.levels[i]+v)/2))};};
 const baseCanvas=layerToneCanvas;layerToneCanvas=function(maxSide){if(!enabled())return baseCanvas(maxSide);const p=read();if(p?.pending)throw Error('Photo preparation is still running.');if(!p||p.error)throw Error(p?.error||'Import an image first.');return p.canvas;};
 const basePreview=updateCropPreview;updateCropPreview=function(){controls();if(!enabled())return basePreview();if(!sourceImage)return;const p=read();note.textContent=p.pending?'Preparing photo locally...':p.error||(p.normalized?`Automatically prepared ${p.levels.length} grayscale levels.`:`${p.levels.length} original grayscale levels. No posterization.`);
   for(const id of ['originalTonePreview','preparedTonePreview']){const c=$(id);c.width=p.canvas.width;c.height=p.canvas.height;c.getContext('2d').drawImage(p.canvas,0,0);}
   $('originalTonePreview').previousElementSibling.textContent='Imported image';$('preparedTonePreview').previousElementSibling.textContent=p.normalized?'Detected levels':'Original levels';$('sourceThumb').src=p.canvas.toDataURL('image/png');$('sourceLarge').src=$('sourceThumb').src;
 };
 let editorMode;
 const openPhoto=$('openPhotoEditor').onclick;$('openPhotoEditor').onclick=()=>{if(!sourceImage||importBusy||window.photoProjectLoading||window.photoRefinementState?.()?.pending)return;editorMode=state.preparedImageMode;window.cancelPhotoImport();state.preparedImageMode=false;updateCropPreview();openPhoto();};
 $('photoEditor').addEventListener('close',()=>{if(!state.photoPreparation){state.preparedImageMode=editorMode;updateCropPreview();updateImportUI();}});
 const baseLoad=loadImage;loadImage=async function(file){const previous=sourceImage;await baseLoad(file);if(previous!==sourceImage){state.preparedImageMode=true;delete state.imageLevelsOverride;cache=null;updateCropPreview();}};
 const baseGenerate=$('generateLayers').onclick;$('generateLayers').onclick=()=>{if(enabled()&&sourceImage){const p=read();if(p.pending||p.error){message(p.pending?'Photo preparation is still running.':p.error);return;}}baseGenerate();};
 const baseSnapshot=sourceSnapshot;sourceSnapshot=function(){if(!enabled())return baseSnapshot();const c=document.createElement('canvas'),ratio=Math.min(1,1440/Math.max(sourceImage.width,sourceImage.height));c.width=Math.round(sourceImage.width*ratio);c.height=Math.round(sourceImage.height*ratio);const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(sourceImage,0,0,c.width,c.height);return c.toDataURL('image/png');};
 const baseOpen=$('fileInput').onchange;$('fileInput').onchange=async e=>{const old=state;await baseOpen(e);if(old!==state){state.preparedImageMode=state.preparedImageMode===true||state.source?.settings?.preparedImage===true;cache=null;updateCropPreview();}};
 window.addEventListener('pagehide',stopPhoto);controls();
})();
