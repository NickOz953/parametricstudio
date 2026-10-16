'use strict';
let preparation={brightness:0,contrast:0,shadows:0,highlights:0},toneThresholds=[],thresholdMode='auto',toneFrame,toneRefine,tonePreviewSide=720;
let autoArtifacts=false,artifactCache=null,autoToneLevels=[];
const prepPanel=document.createElement('details');prepPanel.id='preparationPanel';prepPanel.open=true;
prepPanel.innerHTML='<summary>Image preparation</summary>'+Object.keys(preparation).map(k=>`<label class="stack">${k[0].toUpperCase()+k.slice(1)}<div class="range"><input id="prep-${k}" aria-label="${k}" type="range" min="-100" max="100" value="0"><output id="prep-${k}-out">0</output></div></label>`).join('')+'<button id="resetPreparation" title="Reset image adjustments" aria-label="Reset image adjustments"><i data-lucide="rotate-ccw"></i></button>';
$('separation').closest('label').before(prepPanel);
prepPanel.querySelector('summary').textContent='Grayscale preparation';
const artifactControl=document.createElement('label');artifactControl.className='check';artifactControl.innerHTML='<input id="autoArtifacts" type="checkbox">Auto cleanup';artifactControl.title='Reduce small speckles and compression noise before posterizing';prepPanel.querySelector('summary').after(artifactControl);
const thresholdPanel=document.createElement('details');thresholdPanel.open=true;thresholdPanel.id='thresholdPanel';
thresholdPanel.innerHTML='<summary>Layer thresholds</summary><label class="stack">Layer boundaries<select id="thresholdMode" aria-controls="manualThresholds"><option value="auto">Automatic</option><option value="manual">Adjust manually</option></select></label><div id="manualThresholds" hidden><canvas id="toneHistogram" width="512" height="100" aria-label="Tone histogram"></canvas><div id="thresholdSliders"></div></div>';
$('colorCount').closest('label').after(thresholdPanel);
thresholdPanel.querySelector('summary').textContent='Posterize';
const tonePreview=document.createElement('div');tonePreview.id='tonePreview';tonePreview.innerHTML='<figure><figcaption>Source</figcaption><canvas id="originalTonePreview"></canvas></figure><figure><figcaption>Layer tones</figcaption><canvas id="preparedTonePreview"></canvas></figure>';$('stage').append(tonePreview);
$('originalTonePreview').previousElementSibling.textContent='Grayscale';$('preparedTonePreview').previousElementSibling.textContent='Posterized';
const baseToneSettings=settings;settings=function(){return {...baseToneSettings(),preparation:{...preparation},autoArtifacts,thresholdMode,thresholds:[...toneThresholds],toneLevels:thresholdMode==='auto'?[...autoToneLevels]:[]};};
const originalCroppedCanvas=croppedCanvas;croppedCanvas=function(maxSide=720){const c=originalCroppedCanvas(maxSide),ctx=c.getContext('2d'),im=ctx.getImageData(0,0,c.width,c.height);
  if(autoArtifacts){const key=JSON.stringify([c.width,c.height,baseToneSettings().crop]);if(artifactCache?.source!==sourceImage||artifactCache.key!==key){ToneTools.removeArtifacts(im.data,c.width,c.height);artifactCache={source:sourceImage,key,data:new Uint8ClampedArray(im.data)};}else im.data.set(artifactCache.data);}
  ToneTools.apply(im.data,preparation);ctx.putImageData(im,0,0);return c;};
function layerToneCanvas(maxSide=720){return croppedCanvas(maxSide);}
function syncThresholdVisibility(){$('manualThresholds').hidden=thresholdMode!=='manual';}
function syncPreparation(){for(const k of Object.keys(preparation)){$('prep-'+k).value=preparation[k];$('prep-'+k+'-out').value=preparation[k];}$('autoArtifacts').checked=autoArtifacts;$('thresholdMode').value=thresholdMode;syncThresholdVisibility();}
function renderThresholds(){
  syncThresholdVisibility();
  const root=$('thresholdSliders');if(root.children.length!==toneThresholds.length)root.innerHTML=toneThresholds.map((_,i)=>`<label class="threshold-row"><span>${i+1}</span><input type="range" data-threshold="${i}" aria-label="Tone boundary ${i+1}"><output></output></label>`).join('');
  [...root.children].forEach((row,i)=>{const input=row.querySelector('input');input.min=(toneThresholds[i-1]||0)+1;input.max=(toneThresholds[i+1]||255)-1;input.value=toneThresholds[i];input.disabled=importBusy;row.querySelector('output').value=toneThresholds[i];});
}
function toneHistogram(hist){const c=$('toneHistogram'),ctx=c.getContext('2d'),max=Math.max(1,...hist);ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#9bb2d8';hist.forEach((v,i)=>ctx.fillRect(i*2,100-v/max*90,2,v/max*90));ctx.strokeStyle='#183e85';for(const v of toneThresholds){ctx.beginPath();ctx.moveTo(v*2,0);ctx.lineTo(v*2,100);ctx.stroke();}}
updateCropPreview=function(){
  if(!sourceImage)return;
  try{
    const canvas=croppedCanvas(tonePreviewSide),ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height),blur=number('blur',0,3),image=blur?ImageTracer.blur(pixels,blur,64):pixels,hist=ToneTools.histogram(image.data),count=number('colorCount',2,12);
    const plan=thresholdMode==='auto'?ToneTools.levelPlan(hist,count):null;autoToneLevels=plan?.levels||[];
    if(thresholdMode==='auto'||!ToneTools.valid(toneThresholds,count))toneThresholds=plan?.cuts||ToneTools.automatic(hist,count);
    ToneTools.snapLevels(image.data,autoToneLevels);
    if(autoToneLevels.length)ToneTools.cleanLevelSpeckles(image.data,image.width,image.height);
    $('sourceThumb').src=canvas.toDataURL('image/jpeg',.85);$('sourceLarge').src=$('sourceThumb').src;
    const original=$('originalTonePreview'),prepared=$('preparedTonePreview');for(const c of [original,prepared]){c.width=canvas.width;c.height=canvas.height;}
    original.getContext('2d').drawImage(canvas,0,0);ToneTools.posterize(image.data,toneThresholds);prepared.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data),image.width,image.height),0,0);toneHistogram(hist);renderThresholds();
  }catch(e){$('conversionStatus').textContent=e.message;}
};
function scheduleTonePreview(){clearTimeout(toneRefine);if(!toneFrame)toneFrame=requestAnimationFrame(()=>{toneFrame=0;if(activeWorkflow!=='image')return;tonePreviewSide=360;dirty();showSource(true);tonePreviewSide=720;});toneRefine=setTimeout(()=>{if(activeWorkflow==='image')updateCropPreview();},250);}
for(const k of Object.keys(preparation))$('prep-'+k).oninput=()=>{preparation[k]=Number($('prep-'+k).value);$('prep-'+k+'-out').value=preparation[k];scheduleTonePreview();};
$('autoArtifacts').onchange=()=>{autoArtifacts=$('autoArtifacts').checked;scheduleTonePreview();};
$('resetPreparation').onclick=()=>{preparation={brightness:0,contrast:0,shadows:0,highlights:0};autoArtifacts=false;syncPreparation();scheduleTonePreview();};
$('thresholdMode').onchange=()=>{thresholdMode=$('thresholdMode').value;syncThresholdVisibility();scheduleTonePreview();};
$('thresholdSliders').oninput=e=>{const i=Number(e.target.dataset.threshold);if(!Number.isInteger(i))return;thresholdMode='manual';$('thresholdMode').value='manual';toneThresholds[i]=Number(e.target.value);scheduleTonePreview();};
const oldCountInput=$('colorCount').oninput;$('colorCount').oninput=()=>{oldCountInput();thresholdMode='auto';$('thresholdMode').value='auto';syncThresholdVisibility();scheduleTonePreview();};
const generatePrepared=$('generateLayers').onclick;$('generateLayers').onclick=()=>{cancelAnimationFrame(toneFrame);toneFrame=0;clearTimeout(toneRefine);tonePreviewSide=720;updateCropPreview();generatePrepared();};
const loadPrepared=loadImage;loadImage=async function(file){const previous=sourceImage;await loadPrepared(file);if(sourceImage!==previous){autoArtifacts=false;artifactCache=null;preparation={brightness:0,contrast:0,shadows:0,highlights:0};thresholdMode='auto';toneThresholds=[];syncPreparation();updateCropPreview();}};
const savePrepared=$('save').onclick;$('save').onclick=()=>{if(sourceImage){const count=number('colorCount',2,12);state.preparationDraft={autoArtifacts,preparation:{...preparation},thresholdMode,thresholds:ToneTools.valid(toneThresholds,count)?[...toneThresholds]:Array.from({length:count-1},(_,i)=>Math.round((i+1)*255/count)),count};}savePrepared();};
const openPrepared=$('fileInput').onchange;$('fileInput').onchange=async e=>{const old=state;await openPrepared(e);if(old!==state){const s=state.preparationDraft||state.source?.settings,wasDepth=s?.depthMode==='scene';autoArtifacts=s?.autoArtifacts===true;artifactCache=null;preparation={brightness:0,contrast:0,shadows:0,highlights:0,...s?.preparation};thresholdMode=wasDepth?'auto':s?.thresholdMode||'auto';toneThresholds=!wasDepth&&s?.thresholds?[...s.thresholds]:[];if(s?.count)$('colorCount').value=s.count;for(const saved of [state.preparationDraft,state.source?.settings])if(saved){delete saved.depthMode;delete saved.depthMap;delete saved.invertDepth;}syncPreparation();updateCropPreview();if(wasDepth)$('conversionStatus').textContent='Existing cut layers retained. Generate layers to replace them with grayscale posterization.';}};
const validatePrepared=validate;validate=function(s){for(const settings of [s?.source?.settings,s?.preparationDraft]){if(settings?.autoArtifacts!==undefined&&typeof settings.autoArtifacts!=='boolean')throw Error('Invalid auto cleanup');const p=settings?.preparation,cuts=settings?.thresholds;if(p&&Object.values(p).some(v=>!Number.isFinite(v)||v< -100||v>100))throw Error('Invalid image adjustment');if(cuts&&!ToneTools.valid(cuts,settings.count))throw Error('Invalid layer thresholds');}return validatePrepared(s);};
icons();
cropDialog.addEventListener('close',()=>{if(sourceImage&&!importBusy){updateCropPreview();showSource(true);}});
