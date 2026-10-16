'use strict';
document.addEventListener('DOMContentLoaded',()=>{
  const tabs=workflowTabs.firstElementChild;
  $('tab-kaleidoscope').remove();$('panel-kaleidoscope').hidden=true;
  for(const id of ['mandalas','topographic','image'])tabs.append($('tab-'+id));
  const actions=document.createElement('div');actions.className='generate-actions';
  actions.setAttribute('role','toolbar');actions.setAttribute('aria-label','Generate cut layers');
  $('stage').append(actions);
  const buttons={mandalas:$('ornamental-generate'),topographic:$('topo-generate'),image:$('generateLayers')};
  for(const button of Object.values(buttons))actions.append(button);
  const calculation=document.createElement('div');calculation.id='calculationIndicator';calculation.hidden=true;
  calculation.innerHTML='<div role="status" aria-live="polite"><strong>Calculating</strong><span id="calculationPhase"></span></div><progress id="calculationProgress" aria-label="Calculation progress" max="100"></progress>';
  $('stage').append(calculation);
  function update(){
    for(const [workflow,button] of Object.entries(buttons))button.hidden=workflow!==activeWorkflow;
    if(activeWorkflow==='image')buttons.image.disabled=!sourceImage||importBusy;
    const draft=patternPaletteDraft();
    actions.hidden=!draft&&view==='cut';
    document.querySelector('[data-view="art"]').textContent=draft?'Pattern preview':'Composition';
    for(const button of document.querySelectorAll('[data-view]')){
      button.classList.toggle('active',button.dataset.view===(draft?'art':view));
      if(button.dataset.view!=='art'){button.disabled=!!draft||state.preset==='empty';button.title=draft?'Generate cut layers to open this view':'';}
    }
    syncPalette();
    let phase='',value;
    const liveDraft=draft&&((activeWorkflow==='topographic'&&!topoWorker)||(activeWorkflow==='mandalas'&&!buttons.mandalas.disabled));
    // Live drafts stay visible while background refinement finishes. Only explicit generation blocks the preview.
    if(liveDraft)phase='';
    else if(studioRendering.pending)phase='Checking cut paths';
    else if(importBusy){phase=$('conversionStatus').textContent;value=$('traceProgress').value;}
    else if(activeWorkflow==='topographic'&&topoWorker)phase=$('topo-status').textContent;
    else if(activeWorkflow==='mandalas'&&(ornamentalTask||state.mandalaPresetDraft&&/^Updating preset|^Creating cut layers/.test($('ornamental-status').textContent)))phase='Pattern geometry';
    else if(!draft&&view==='three'&&/^Building 3D/.test($('threeNotice')?.textContent||'')){
      phase=$('threeNotice').textContent;const match=phase.match(/layer (\d+) of (\d+)/);if(match)value=(Number(match[1])-1)/Number(match[2])*100;
    }
    if(value===undefined){const match=phase.match(/layer (\d+) of (\d+)/);if(match)value=(Number(match[1])-1)/Number(match[2])*100;}
    calculation.hidden=!phase;
    if($('calculationPhase').textContent!==phase)$('calculationPhase').textContent=phase;
    const progress=$('calculationProgress');if(Number.isFinite(value))progress.value=value;else progress.removeAttribute('value');
  }
  const observer=new MutationObserver(update);
  for(const id of ['ornamental-status','topo-status','conversionStatus','threeNotice'])if($(id))observer.observe($(id),{childList:true,characterData:true,subtree:true});
  observer.observe($('stage'),{attributes:true,attributeFilter:['class','aria-busy']});
  // Palette changes repaint the current geometry without restarting its calculation.
  window.repaintPatternPalette=()=>{
    if(activeWorkflow==='mandalas'){
      if(ornamentalCache?.key===ornamentalKey(ornamentalSettings)){ornamentalLive.cancel();paintOrnamental(ornamentalCache.layers);}else liveOrnamental();
    }else if(activeWorkflow==='topographic')paintTopographicPreview();
  };
  window.addEventListener('pagehide',()=>observer.disconnect());
  switchWorkflow('mandalas');update();
});
