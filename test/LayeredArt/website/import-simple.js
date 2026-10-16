'use strict';
(()=>{
 // Reorder the tab panel, not its contents, so workflow visibility remains intact.
 document.querySelector('.left .panel-heading').after(imageWorkspace);
 const root=$('conversionControls'),main=document.createElement('div');main.id='imageMainControls';root.prepend(main);
 const count=$('colorCount').closest('label');count.id='imageLayerCount';main.append(count,$('photoEntry'));
 count.firstChild.textContent='Layer levels';
 $('colorCount').setAttribute('aria-label','Layer levels');
 $('colorCount').addEventListener('input',()=>{state.imageLevelsOverride=true;});
 const badge=document.createElement('p');badge.className='note';badge.id='automaticImageStatus';main.append(badge);
 const advanced=document.createElement('details');advanced.id='advancedImageControls';advanced.open=true;advanced.innerHTML='<summary>Advanced</summary>';
 main.after(advanced);
 for(const el of [$('preparedImageStatus'),$('editImageCrop'),prepPanel,thresholdPanel,$('smoothing').closest('.fields'),$('minArea').closest('label'),$('softnessControl'),$('matchAspect').closest('label'),$('includeFrame').closest('label')])if(el)advanced.append(el);
 importPanel.prepend($('aiImport'));
 $('imagePrompt').before($('copyImagePrompt'));
 const auto=()=>true;
 function syncSimple(){
   const s=settings(),exact=s.preparedImage&&s.preparedLevels&&!readNormalized();
   const photo=window.photoRefinementState?.()||window.photoImportState?.();
   count.hidden=false;$('colorCount').disabled=importBusy||!!window.photoProjectLoading;
   if(exact&&!state.imageLevelsOverride){$('colorCount').value=s.count;$('colorCountOut').value=s.count;}
   for(const id of ['smoothing','blur','minArea','softness'])$(id).disabled=importBusy||auto();
   for(const el of [$('smoothing').closest('.fields'),$('minArea').closest('label'),$('softnessControl')])el.hidden=true;
   badge.textContent=photo?.pending?'Preparing photo locally...':photo?.error|| (exact?`${s.count} original levels retained. Automatic smoothing and cleanup.`:'Automatic smoothing and cleanup');
   $('generateLayers').disabled=importBusy||!!photo?.pending||!!photo?.error||!!window.photoProjectLoading;
   $('openPhotoEditor').disabled=$('refineSubject').disabled=importBusy||!!window.photoRefinementState?.()?.pending||!!window.photoProjectLoading;
 }
 function readNormalized(){return $('preparedImageStatus').textContent.startsWith('Automatically prepared');}
 const originalSettings=settings;settings=function(){const s=originalSettings();return auto()?{...s,smooth:1,minArea:2,blur:s.preparedImage||state.photoPreparation?0:1}:s;};
 const originalPreview=updateCropPreview;updateCropPreview=function(){originalPreview();syncSimple();};
 const originalUI=updateImportUI;updateImportUI=function(){originalUI();syncSimple();};
 const simplify=$('openPhotoEditor').onclick;$('openPhotoEditor').onclick=()=>{state.roundness=55;$('photoSmooth').value='2';simplify();};
 const originalLoad=loadImage;loadImage=async function(file){const previous=sourceImage;await originalLoad(file);if(previous!==sourceImage){state.automaticImageCleanup=true;state.roundness=55;syncSimple();}};
 const originalGenerate=$('generateLayers').onclick;$('generateLayers').onclick=()=>{if(auto())state.roundness=55;originalGenerate();};
 syncSimple();
})();
