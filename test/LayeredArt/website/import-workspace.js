'use strict';
document.addEventListener('DOMContentLoaded',()=>{
 const aiDialog=document.createElement('dialog');aiDialog.id='imagePromptDialog';aiDialog.setAttribute('aria-labelledby','imagePromptTitle');
 aiDialog.innerHTML='<div class="image-dialog-heading"><div><h2 id="imagePromptTitle">Prepare with your AI</h2><span class="image-recommended">Recommended</span></div><button id="closeImagePrompt" title="Close" aria-label="Close AI prompt"><i data-lucide="x"></i></button></div>';
 aiDialog.append($('aiImport'));document.body.append(aiDialog);
 const aiButton=document.createElement('button');aiButton.id='openImagePrompt';aiButton.innerHTML='<i data-lucide="sparkles"></i><span>Prepare with your AI<small>Recommended</small></span><i data-lucide="arrow-up-right"></i>';
 importPanel.querySelector('.section-title').textContent='IMAGE';
 const sourceActions=document.createElement('div');sourceActions.id='imageSourceActions';importPanel.querySelector('.section-title').after(sourceActions);
 sourceActions.append($('uploadImage'),$('editImageCrop'));sourceActions.after($('sourcePreview'),aiButton);
 $('editImageCrop').innerHTML='<i data-lucide="crop"></i>';$('editImageCrop').title='Crop image';$('editImageCrop').setAttribute('aria-label','Crop image');
 aiButton.onclick=()=>{$('promptLevels').value=$('colorCount').value;$('promptLevels').dispatchEvent(new Event('input'));aiDialog.showModal();};
 $('closeImagePrompt').onclick=()=>aiDialog.close();
 aiDialog.addEventListener('click',e=>{if(e.target===aiDialog){const r=aiDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)aiDialog.close();}});
 const board=$('artboardSection'),boardAnchor=document.createComment('Artboard position'),boardDetails=document.createElement('details');boardDetails.id='imageBoardSettings';boardDetails.open=true;boardDetails.innerHTML='<summary>Artboard &amp; frame</summary>';board.before(boardAnchor);imageWorkspace.append(boardDetails);
 const previewModes=document.createElement('div');previewModes.id='imagePreviewModes';previewModes.className='segmented';previewModes.setAttribute('role','group');previewModes.setAttribute('aria-label','Image preview');
 previewModes.innerHTML='<button data-image-preview="layers" aria-pressed="true">Layer preview</button><button data-image-preview="original" aria-pressed="false">Original</button><button data-image-preview="compare" aria-pressed="false">Compare</button>';
 document.querySelector('.canvas-toolbar').prepend(previewModes);
 let mode='layers',lastSource,originalSource,originalCrop;
 function setMode(value){mode=value;$('tonePreview').dataset.imageView=value;previewModes.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.imagePreview===value)));}
 previewModes.onclick=e=>{const button=e.target.closest('[data-image-preview]');if(button)setMode(button.dataset.imagePreview);};
 function syncLayout(){
   const image=activeWorkflow==='image',loaded=!!sourceImage,draft=image&&(state.preset==='empty'||$('stage').classList.contains('source-mode'));
   document.body.classList.toggle('image-workspace',image);document.body.classList.toggle('image-draft',draft);
   document.body.classList.toggle('image-empty',image&&!loaded);
   previewModes.hidden=!image||!loaded||!$('stage').classList.contains('source-mode');
   const sourceButton=$('sourceToggle'),sourceLabel=draft?'Back to layers':'Edit image';
   sourceButton.hidden=!image||!loaded||state.preset==='empty';
   if(sourceButton.dataset.label!==sourceLabel){sourceButton.dataset.label=sourceLabel;sourceButton.innerHTML='<i data-lucide="'+(draft?'layers':'image')+'"></i><span>'+sourceLabel+'</span>';sourceButton.title=sourceLabel;sourceButton.setAttribute('aria-label',sourceLabel);icons();}
   $('editImageCrop').disabled=!loaded||importBusy;
   const uploadText=loaded?'Replace image':'Import image';
   if($('uploadImage').dataset.label!==uploadText){$('uploadImage').dataset.label=uploadText;$('uploadImage').innerHTML='<i data-lucide="'+(loaded?'image-plus':'upload')+'"></i><span>'+uploadText+'</span>';icons();}
   if(image&&board.parentNode!==boardDetails)boardDetails.append(board);
   else if(!image&&board.parentNode===boardDetails)boardAnchor.after(board);
   if(lastSource!==sourceImage){lastSource=sourceImage;setMode('layers');}
   if(!image&&aiDialog.open)aiDialog.close();
 }
 function drawOriginal(){
   if(!sourceImage)return;const c=$('originalTonePreview'),b=cropBounds(),ratio=Math.min(1,900/Math.max(b.w,b.h)),key=JSON.stringify(b);
   // The preparation pipeline may redraw this canvas, so restore the cached original after each update.
   if(originalSource!==sourceImage||originalCrop?.key!==key){const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(b.w*ratio));canvas.height=Math.max(1,Math.round(b.h*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(sourceImage,b.x,b.y,b.w,b.h,0,0,canvas.width,canvas.height);originalSource=sourceImage;originalCrop={key,canvas};}
   c.width=originalCrop.canvas.width;c.height=originalCrop.canvas.height;c.getContext('2d').drawImage(originalCrop.canvas,0,0);c.previousElementSibling.textContent='Original';$('preparedTonePreview').previousElementSibling.textContent='Layer preview';
 }
 const previousPreview=updateCropPreview;updateCropPreview=function(){previousPreview();drawOriginal();syncLayout();};
 const previousUI=updateImportUI;updateImportUI=function(){previousUI();syncLayout();};
 const previousSource=showSource;showSource=function(value){previousSource(value);syncLayout();};
 const previousWorkflow=syncWorkflow;syncWorkflow=function(){previousWorkflow();syncLayout();};
 $('emptyCanvas').querySelector('h1').textContent='Import your image';
 $('emptyCanvas').querySelector('p').textContent='PNG, JPG or WebP';
 setMode(mode);syncLayout();icons();
});
