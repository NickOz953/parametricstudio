'use strict';
document.querySelector('[data-view="exploded"]').remove();
const layerSection=document.querySelector('.layer-section');
document.querySelector('.right').prepend(layerSection);
$('selectedHeading').hidden=true;

const workflowTabs=document.createElement('nav');
workflowTabs.className='workflow-tabs';workflowTabs.setAttribute('aria-label','Studio functions');
workflowTabs.innerHTML='<div role="tablist" aria-label="Design workflow"><button role="tab" id="tab-image" data-workflow="image" aria-controls="panel-image" aria-selected="true"><i data-lucide="image"></i>Import Image</button></div>';
document.querySelector('header').after(workflowTabs);
const designSidebar=document.querySelector('.left'),artboardSection=$('width').closest('section');
artboardSection.id='artboardSection';designSidebar.prepend(artboardSection);
designSidebar.querySelector('.panel-heading').hidden=true;
// Retain legacy project rendering, but suspend mandala creation and its controls.
const mandalaWorkspace=document.createElement('div');mandalaWorkspace.id='panel-mandalas';mandalaWorkspace.hidden=true;
const imageWorkspace=document.createElement('div');imageWorkspace.id='panel-image';imageWorkspace.setAttribute('role','tabpanel');imageWorkspace.setAttribute('aria-labelledby','tab-image');
artboardSection.after(mandalaWorkspace,imageWorkspace);
mandalaWorkspace.append(circularMandalaControls,mandalaPanel);
document.querySelector('.starter-presets').remove();
imageWorkspace.append(importPanel);

let activeWorkflow='image';
let workflowImageLoading=false;
const workflowDrafts={mandalas:null,image:null};
function rememberWorkflow(){workflowDrafts[activeWorkflow]={state,selected,view,zoom,sourceVisible:$('stage').classList.contains('source-mode')};}
function syncWorkflow(){
  for(const b of workflowTabs.querySelectorAll('[role=tab]')){const active=b.dataset.workflow===activeWorkflow;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  const list=workflowTabs.firstElementChild,tab=list.querySelector('[aria-selected="true"]');
  if(tab){const a=tab.getBoundingClientRect(),b=list.getBoundingClientRect();if(a.left<b.left)list.scrollLeft+=a.left-b.left;else if(a.right>b.right)list.scrollLeft+=a.right-b.right;}
  mandalaWorkspace.hidden=true;imageWorkspace.hidden=activeWorkflow!=='image';
  if($('panel-topographic'))$('panel-topographic').hidden=activeWorkflow!=='topographic';
  if($('panel-kaleidoscope'))$('panel-kaleidoscope').hidden=activeWorkflow!=='kaleidoscope';
  if($('panel-mandala-presets'))$('panel-mandala-presets').hidden=activeWorkflow!=='mandalas';
  $('sourceToggle').hidden=activeWorkflow!=='image';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function switchWorkflow(next){
  if(!['mandalas','topographic','image'].includes(next)||next===activeWorkflow||workflowImageLoading)return;
  window.cancelMandalaPreset?.();
  window.cancelTopography?.();
  window.cancelKaleidoscope?.();
  window.cancelPhotoImport?.();
  window.cancelPhotoRefinement?.();
  cancelTrace(false);rememberWorkflow();activeWorkflow=next;
  let draft=workflowDrafts[next];
  if(!draft){
    draft={state:{name:'Untitled image',preset:'empty',w:state.w,h:state.h,border:state.border,registration:state.registration,diameter:state.diameter,inset:state.inset,text:'',roundness:55,cutSettings:{...cutSettings()},layers:[{...make('Backing',colors[5],'back'),gap:0}]},selected:0,view:'art',zoom:1,sourceVisible:false};
  }
  state=draft.state;selected=draft.selected;view=draft.view;zoom=draft.zoom;
  sync();render();showSource(draft.sourceVisible);syncWorkflow();designSidebar.scrollTop=0;
  window.syncTopography?.();
  window.syncKaleidoscope?.();
  window.syncMandalaPreset?.();
}
workflowTabs.onclick=e=>{const b=e.target.closest('[data-workflow]');if(b)switchWorkflow(b.dataset.workflow);};
workflowTabs.onkeydown=e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
  const tabs=['mandalas','topographic','image'],next=e.key==='Home'?tabs[0]:e.key==='End'?tabs.at(-1):tabs[(tabs.indexOf(activeWorkflow)+(e.key==='ArrowLeft'?tabs.length-1:1))%tabs.length];
  switchWorkflow(next);$('tab-'+next).focus();
};
// A dropped file enters the image workflow before any existing draft is mutated.
const workflowLoadImage=loadImage;loadImage=async function(file){
  if(file&&activeWorkflow!=='image')switchWorkflow('image');
  workflowImageLoading=true;workflowTabs.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{return await workflowLoadImage(file);}finally{workflowImageLoading=false;workflowTabs.querySelectorAll('button').forEach(b=>b.disabled=false);}
};
const workflowOpen=$('fileInput').onchange;
$('fileInput').onchange=async e=>{
  rememberWorkflow();const old=state;await workflowOpen(e);
  if(state!==old){activeWorkflow=state.mandalaPreset||state.mandalaPresetDraft?'mandalas':state.topography||state.topographyDraft?'topographic':'image';rememberWorkflow();showSource(false);syncWorkflow();render();window.syncTopography?.();window.syncKaleidoscope?.();window.syncMandalaPreset?.();}
};

const studioPalettes=[
  {id:'natural',name:'Natural timber',colors:['#eeddb6','#d5bc87','#b68d61','#906748','#604837','#342e29']},
  {id:'forest',name:'Forest canopy',colors:['#e2e5cb','#b8c99b','#83a589','#4e7e6b','#30584d','#1b3433']},
  {id:'ocean',name:'Ocean glass',colors:['#e7eeeb','#9bd3d1','#48abae','#287d97','#315a79','#203d53']},
  {id:'sunset',name:'Desert sunset',colors:['#f3dfad','#e9b66e','#d88c64','#b85f62','#794963','#3e3449']},
  {id:'jewel',name:'Jewel tones',colors:['#d9b563','#3b9e9f','#3d6b9a','#98527c','#44765c','#293d47']},
  {id:'botanical',name:'Botanical blush',colors:['#efe1cf','#d5aaa2','#b6747b','#99ab82','#547c69','#2e5049']},
  {id:'mineral',name:'Mineral layers',colors:['#eee9df','#c3cccf','#889fa5','#647e86','#485f6c','#303b45']},
  {id:'mono',name:'Black & white',colors:['#f5f5f1','#d7dad7','#aeb5b1','#7c8884','#4b5854','#202c29']}
];
function paletteColors(p,count){
  return Array.from({length:count},(_,i)=>{
    const t=count===1?0:i*(p.colors.length-1)/(count-1),a=Math.floor(t),b=Math.min(a+1,p.colors.length-1),f=t-a;
    const rgb=hex=>[1,3,5].map(j=>parseInt(hex.slice(j,j+2),16)),c=rgb(p.colors[a]),d=rgb(p.colors[b]);
    return '#'+c.map((v,j)=>Math.round(v+(d[j]-v)*f).toString(16).padStart(2,'0')).join('');
  });
}
const colorSection=$('palette').closest('section');colorSection.id='layerColorsSection';
colorSection.querySelector('.section-title').textContent='LAYER COLORS';colorSection.querySelector('.note')?.remove();
const paletteChooser=document.createElement('div');paletteChooser.className='palette-chooser';
paletteChooser.innerHTML='<label class="stack">Suggested palette<select id="paletteSelect"><option value="custom" disabled>Current colors</option>'+studioPalettes.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')+'</select></label><div class="palette-navigation"><button id="palettePrevious" aria-label="Previous palette" title="Previous palette"><i data-lucide="chevron-left"></i></button><output id="palettePosition" aria-live="polite"></output><button id="paletteNext" aria-label="Next palette" title="Next palette"><i data-lucide="chevron-right"></i></button></div>';
$('palette').before(paletteChooser);$('palette').onclick=null;
// Keep palette selection next to the artwork in every preview mode.
$('stage').append(colorSection);
$('paletteSelect').setAttribute('aria-label','Layer color palette');
function matchedPalette(){
  if(patternPaletteDraft())return studioPalettes.find(p=>p.id===(state.paletteId||(activeWorkflow==='mandalas'?'mono':'ocean')));
  const p=studioPalettes.find(p=>p.id===state.paletteId);
  return p&&paletteColors(p,state.layers.length).every((c,i)=>c===state.layers[i].color.toLowerCase())?p:null;
}
let paletteMarkup;
function syncPalette(){
  const draft=patternPaletteDraft(),p=matchedPalette(),empty=state.preset==='empty'&&!draft,hidden=empty||view==='cut';
  colorSection.hidden=hidden;$('stage').classList.toggle('has-palette',!hidden);
  $('paletteSelect').value=p?.id||'custom';$('palettePosition').value=p?`${studioPalettes.indexOf(p)+1} / ${studioPalettes.length}`:'Custom';
  for(const id of ['paletteSelect','palettePrevious','paletteNext'])$(id).disabled=empty;
  const layers=draft&&p?paletteColors(p,draft.count).map((color,i)=>({color,name:'Layer '+(i+1)})):state.layers;
  const markup=layers.map(l=>`<span style="background:${l.color}" title="${esc(l.name)}: ${l.color}" aria-label="${esc(l.name)}: ${l.color}"></span>`).join('');
  if(markup!==paletteMarkup){$('palette').innerHTML=markup;paletteMarkup=markup;}
}
function patternPaletteDraft(){return activeWorkflow==='mandalas'&&(state.preset==='empty'||state.mandalaPresetDraft)?state.mandalaPresetDraft||{count:5}:activeWorkflow==='topographic'&&(state.preset==='empty'||state.topographyDraft)?state.topographyDraft||{count:5}:null;}
function applyStudioPalette(id){
  const p=studioPalettes.find(p=>p.id===id);if(!p||state.preset==='empty'&&!patternPaletteDraft())return;
  const next=paletteColors(p,state.layers.length);state.layers.forEach((l,i)=>l.color=next[i]);state.paletteId=id;
  if(patternPaletteDraft()){window.repaintPatternPalette?.();syncPalette();}else render();message(p.name+' palette applied');
}
$('paletteSelect').onchange=()=>applyStudioPalette($('paletteSelect').value);
for(const [id,step]of [['palettePrevious',-1],['paletteNext',1]])$(id).onclick=()=>{
  const p=matchedPalette(),index=p?studioPalettes.indexOf(p):step===1?-1:0;
  applyStudioPalette(studioPalettes[(index+step+studioPalettes.length)%studioPalettes.length].id);
};
const workflowRender=render;render=function(){workflowRender();syncWorkflow();syncPalette();};
const workflowDraw=draw;draw=function(){workflowDraw();syncPalette();};
rememberWorkflow();syncWorkflow();icons();
