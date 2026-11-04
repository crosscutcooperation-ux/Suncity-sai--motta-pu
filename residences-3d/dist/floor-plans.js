import {ApartmentSelector} from './apartment-selector.js?v=furnished-2';
import {BUILDINGS,resolvePlan,SOURCE_URL} from './floor-plan-data.js?v=block-floors-1';
const $=selector=>document.querySelector(selector);
const dialog=$('#floor-plan-dialog'),buildingSelect=$('#plan-building'),floorSelect=$('#plan-floor');
let viewer=null,selectedApartment=null,mode='2d',revision=0,current=null,zoom=1,viewerModule=null;
const fullFloorImage=document.createElement('img');fullFloorImage.id='furnished-floor-render';fullFloorImage.hidden=true;fullFloorImage.alt='Furnished 3D floor plan reconstructed from the supplied typical layout';$('#plan-3d').append(fullFloorImage);
const fullPan={x:0,y:0,drag:null};
function paintFullPhoto(){fullFloorImage.style.transform=`translate(${fullPan.x}px,${fullPan.y}px) scale(${zoom})`;}
fullFloorImage.onpointerdown=e=>{if(zoom<=1)return;e.preventDefault();fullPan.drag={x:e.clientX,y:e.clientY,fromX:fullPan.x,fromY:fullPan.y};fullFloorImage.setPointerCapture(e.pointerId);};
fullFloorImage.onpointermove=e=>{if(!fullPan.drag)return;const limitX=fullFloorImage.clientWidth*(zoom-1)/2,limitY=fullFloorImage.clientHeight*(zoom-1)/2;fullPan.x=Math.max(-limitX,Math.min(limitX,fullPan.drag.fromX+e.clientX-fullPan.drag.x));fullPan.y=Math.max(-limitY,Math.min(limitY,fullPan.drag.fromY+e.clientY-fullPan.drag.y));paintFullPhoto();};
fullFloorImage.onpointerup=fullFloorImage.onpointercancel=()=>fullPan.drag=null;
const renderDownload=document.createElement('a');renderDownload.id='render-download';renderDownload.textContent='Download furnished 3D plan ↓';renderDownload.setAttribute('download','');renderDownload.hidden=true;$('.plan-footer').append(renderDownload);


const apartments=new ApartmentSelector({
  select(unit){
    selectedApartment=unit;revision++;mode='2d';zoom=1;
    $('#plan-drawing').style.transform='';
    setMode('2d');
  },
  toggle(){if(selectedApartment)setMode(mode==='2d'?'3d':'2d');}
});

const options='<option value="" selected disabled>Choose a building</option>'+BUILDINGS.map(building=>`<option value="${building.id}">${building.number?'Tower '+building.number+' · ':''}${building.name}</option>`).join('');
buildingSelect.innerHTML=options;$('#dialog-building').innerHTML=options;
function syncFloors(preserve=false){
  const building=BUILDINGS.find(item=>item.id===buildingSelect.value),old=floorSelect.value;
  let content='<option value="">Choose a floor</option>';
  if(building){
    content+='<option value="0">Ground · drawing unavailable</option>';
    for(let floor=1;floor<=building.floors;floor++)content+=`<option value="${floor}">Floor ${floor}${false?' · Refuge':''}</option>`;
  }
  floorSelect.innerHTML=content;$('#dialog-floor').innerHTML=content;
  floorSelect.disabled=!building;$('#dialog-floor').disabled=!building;
  if(preserve&&old&&Number(old)<=building?.floors)floorSelect.value=old;
  $('#dialog-building').value=buildingSelect.value;$('#dialog-floor').value=floorSelect.value;
  $('#open-floor-plan').disabled=!floorSelect.value;
  $('#plan-availability').textContent=building?(!building.page?'Apartment drawings for this master-layout tower are not supplied.':'Typical plan available. Individual floor assignments are unconfirmed.'):'Supplied floor plans cover 16 towers.';
}
function chooseBuilding(value,preserve=false){buildingSelect.value=value;$('#plan-kind').value='typical';syncFloors(preserve);if(dialog.open&&floorSelect.value)showFloor();}
buildingSelect.onchange=()=>chooseBuilding(buildingSelect.value);
$('#dialog-building').onchange=event=>{
  const previous=Number(floorSelect.value),next=BUILDINGS.find(b=>b.id===event.target.value);
  chooseBuilding(next.id);floorSelect.value=String(Math.min(previous,next.floors));showFloor();
};
floorSelect.onchange=()=>{if(floorSelect.value)showFloor();};
$('#dialog-floor').onchange=event=>{floorSelect.value=event.target.value;showFloor();};
$('#open-floor-plan').onclick=showFloor;
$('#plan-kind').onchange=showFloor;
$('#close-floor-plan').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{revision++;viewer?.setActive(false);document.dispatchEvent(new CustomEvent('floor-plan-close'));});
$('#plan-previous').onclick=()=>stepFloor(-1);$('#plan-next').onclick=()=>stepFloor(1);
function stepFloor(delta){floorSelect.value=String(Number(floorSelect.value)+delta);showFloor();}
$('#plan-zoom-in').onclick=()=>changeZoom(1.2);$('#plan-zoom-out').onclick=()=>changeZoom(1/1.2);
$('#plan-fit').onclick=()=>{zoom=1;fullPan.x=fullPan.y=0;paintFullPhoto();$('#plan-drawing').style.transform='';viewer?.reset();};
function changeZoom(factor){if(mode==='orbit')viewer?.zoom(1/factor);else if(mode==='3d'&&!selectedApartment){zoom=Math.max(.65,Math.min(4,zoom*factor));if(zoom<=1)fullPan.x=fullPan.y=0;paintFullPhoto();}else{zoom=Math.max(.65,Math.min(4,zoom*factor));$('#plan-drawing').style.transform=`scale(${zoom})`;}}
for(const button of document.querySelectorAll('[data-plan-mode]'))button.onclick=()=>setMode(button.dataset.planMode);
function setMode(value){
  mode=value;
  fullFloorImage.hidden=true;$('#floor-plan-canvas').hidden=false;renderDownload.hidden=!current?.available;
  if(current?.available)renderDownload.href='assets/plans/'+(selectedApartment?.renderPhoto??current.key+'-photoreal.webp');
  for(const button of document.querySelectorAll('[data-plan-mode]'))button.setAttribute('aria-pressed',String(mode===button.dataset.planMode));
  document.querySelector('[data-plan-mode="orbit"]').hidden=!current?.available;
  if(mode==='orbit'&&current?.available){
    $('#plan-2d').hidden=true;$('#plan-3d').hidden=false;$('#plan-cutaway-note').hidden=true;
    $('#plan-view-help').textContent='Drag to rotate · scroll to zoom';
    $('.apartment-instruction').textContent='Drag to inspect the furnished apartment.';
    load3d(selectedApartment?.renderPair??current.key,++revision);return;
  }
  if(!selectedApartment&&mode==='3d'&&current?.available){
    const request=++revision;viewer?.setActive(false);$('#plan-2d').hidden=true;$('#plan-3d').hidden=false;$('#floor-plan-canvas').hidden=true;$('#plan-cutaway-note').hidden=true;$('#plan-loading').hidden=false;$('#plan-loading').textContent='Preparing the furnished 3D floor plan…';
    fullFloorImage.src='assets/plans/'+current.key+'-photoreal.webp';fullFloorImage.hidden=false;
    fullFloorImage.decode().then(()=>{if(request===revision)$('#plan-loading').hidden=true;}).catch(()=>{if(request===revision)$('#plan-loading').textContent='The furnished floor render could not load. The original 2D drawing is available.';});
    $('#plan-view-help').textContent='Photorealistic furnished visualization · zoom and drag to inspect · Rotate model for the interactive cutaway';paintFullPhoto();return;
  }
  if(selectedApartment?.renderPair){
    revision++;viewer?.setActive(false);
    $('#plan-2d').hidden=false;$('#plan-3d').hidden=true;
    $('#plan-cutaway-note').hidden=true;
    const hint=mode==='2d'?'Tap the plan to view it in 3D.':'Tap the render for the 2D plan.';
    $('.apartment-instruction').textContent=hint;
    $('#plan-view-help').textContent=mode==='2d'?'Apartment floor plan':'Furnished apartment render';
    const request=revision;
    apartments.reveal.show(mode==='3d').catch(()=>{
      if(request!==revision)return;
      setMode('2d');$('#plan-view-help').textContent='The render could not load. Tap the plan to retry.';
    });
    return;
  }
  $('#plan-2d').hidden=mode!=='2d';$('#plan-3d').hidden=mode!=='3d';
  $('#plan-view-help').textContent=mode==='2d'?'Original supplied drawing · use + / − to zoom':'Drag to orbit · scroll to zoom · right-drag to pan';
  $('#plan-cutaway-note').hidden=mode!=='3d';viewer?.setActive(mode==='3d'&&dialog.open);
  revision++;
  if(mode==='3d'&&current?.available)load3d(selectedApartment?.key??current.key,revision);
  $('.apartment-instruction').textContent=mode==='2d'?'Tap the plan to view it in 3D.':'Drag to orbit the 3D apartment. Use 2D plan to return to the drawing.';
}
async function load3d(key,request){
  const status=$('#plan-loading');status.hidden=false;status.textContent='Preparing the floor cutaway…';
  try{
    viewerModule??=import('./floor-plan-viewer.js?v=furnished-finishes-1');
    const {FloorPlanViewer}=await viewerModule;
    if(request!==revision||!dialog.open||!['3d','orbit'].includes(mode))return;
    viewer??=new FloorPlanViewer($('#floor-plan-canvas'),()=>{if(selectedApartment)setMode('2d');});
    viewer.setActive(true);if(mode==='orbit')await viewer.loadModel(key);else await viewer.load(key);
    if(request===revision)status.hidden=true;
  }catch(error){if(request===revision){status.hidden=false;status.textContent='The 3D cutaway could not load. Switch to 2D to view the supplied drawing.';}console.error(error);}
}
function showFloor(){
  const building=BUILDINGS.find(item=>item.id===buildingSelect.value),floor=Number(floorSelect.value);
  if(!building||floorSelect.value==='')return;
  $('#open-floor-plan').disabled=false;$('#dialog-floor').value=String(floor);$('#dialog-building').value=building.id;
  selectedApartment=null;mode='2d';fullPan.x=fullPan.y=0;zoom=1;paintFullPhoto();apartments.clear();
  current=resolvePlan(building.id,floor,$('#plan-kind').value);const request=++revision;
  const inElevation=Boolean(document.querySelector('#elevation[open]'));
  $('#dialog-building').disabled=inElevation;dialog.classList.toggle('from-elevation',inElevation);
  const rail=$('#floor-levels');rail.replaceChildren();
  for(let n=building.floors;n>=0;n--){
    const button=document.createElement('button');button.type='button';
    button.textContent=n===0?'G':String(n).padStart(2,'0');button.setAttribute('aria-label','View floor '+n);
    button.setAttribute('aria-current',String(n===floor));
    button.onclick=()=>{floorSelect.value=String(n);showFloor();};rail.append(button);
  }
  if(!dialog.open){
    const source=document.querySelector('#scene'),background=$('#plan-background');
    background.width=source.width;background.height=source.height;
    background.getContext('2d').drawImage(source,0,0);
    document.dispatchEvent(new CustomEvent('floor-plan-open'));dialog.showModal();}
  $('#plan-building-name').textContent=building.number?'Tower '+building.number+' · '+building.name:building.name;
  $('#plan-title').textContent=floor===0?'GROUND FLOOR':'LEVEL '+String(floor).padStart(2,'0');
  $('#plan-note').textContent=current.note??current.reason;
  $('#plan-kind-label').hidden=true;
  $('#plan-previous').disabled=floor===0;$('#plan-next').disabled=floor===building.floors;
  $('#plan-source').href=SOURCE_URL;$('#plan-source').textContent=current.available?'Source PDF · page '+current.page+' ↗':'Open supplied plan PDF ↗';
  $('.plan-modes').hidden=!current.available;
  $('#plan-empty').hidden=current.available;$('#plan-content').hidden=!current.available;
  renderDownload.hidden=!current.available;
  $('#plan-empty-message').textContent=current.reason??'';
  $('#plan-loading').hidden=true;viewer?.setActive(false);
  if(current.available){
    const image=$('#floor-plan-image');zoom=1;image.style.transform='';
    image.alt=building.name+', floor '+floor+', '+current.kind+' floor plan from PDF page '+current.page;
    image.src='assets/plans/'+current.key+'-floor.png';setMode('2d');
    apartments.load(current.key,{building:building.name,floor,available:current.verified});
  }
  dialog.dataset.building=building.id;dialog.dataset.floor=String(floor);dialog.dataset.plan=current.key??'unavailable';
}
document.addEventListener('open-block-floor',({detail})=>{
  const building=BUILDINGS.find(item=>item.sceneId===detail.id||item.id===detail.id);
  if(!building)return;
  chooseBuilding(building.id);floorSelect.value=String(detail.floor??0);mode='2d';showFloor();
  if(detail.floor===null){
    $('#dialog-floor').value='';$('#plan-title').textContent='Floor plans';
    $('#plan-note').textContent='Sai Sun City';
    $('#plan-empty-message').textContent='The supplied drawings cover residential towers. Select a residential tower or open the commercial references.';
  }
});
document.addEventListener('tower-focus',event=>{
  const building=BUILDINGS.find(item=>item.sceneId===event.detail);if(building)chooseBuilding(building.id);
});
syncFloors();
