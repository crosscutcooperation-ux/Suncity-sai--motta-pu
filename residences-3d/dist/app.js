import {loadSunCityModel} from './sun-city-model-loader.js?v=fast-2';
import {amenities} from './amenity-selection.js?v=new-blender-1';
import {createArchitecturalLighting} from './architectural-lighting.js?v=glow-1';
import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {RGBELoader} from './vendor/addons/loaders/RGBELoader.js';
import {BUILDINGS,LANDMARKS} from './site-data.js';
import {createTowerElevation} from './tower-elevation.js?v=glow-1';
import {WalkthroughController} from './walkthrough-controller.js';
import {ZONES} from './walk-navigation.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const announce=text=>$('#announcement').textContent=text;
init().catch(error=>{console.error(error);$('#loading').hidden=true;$('#error').hidden=false;});
async function init(){
 const canvas=$('#scene'),viewport=$('#viewport');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
 const scene=new T.Scene();scene.background=new T.Color(0xd1e4eb);scene.fog=new T.FogExp2(0xc4d6d6,.00082);
 const camera=new T.PerspectiveCamera(42,1,.5,1100);
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI/2-.015;controls.minDistance=25;controls.maxDistance=740;controls.autoRotateSpeed=.45;
 const hemi=new T.HemisphereLight(0xe4f2ff,0x746d50,.62);scene.add(hemi);
 const sun=new T.DirectionalLight(0xffe8cb,2.5);sun.position.set(-130,230,150);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<650?1024:2048,innerWidth<650?1024:2048);Object.assign(sun.shadow.camera,{left:-235,right:235,top:235,bottom:-235,near:1,far:650});sun.shadow.normalBias=.12;sun.shadow.bias=-.0002;scene.add(sun);
 const fill=new T.DirectionalLight(0xc7e5ff,.25);fill.position.set(180,80,-180);scene.add(fill);
 const ground=new T.Mesh(new T.PlaneGeometry(30000,30000),new T.MeshStandardMaterial({color:0x9aa38a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-1;ground.receiveShadow=true;scene.add(ground);
 try{const hdr=await new RGBELoader().loadAsync('assets/environment.hdr');const pm=new T.PMREMGenerator(renderer);scene.environment=pm.fromEquirectangular(hdr).texture;scene.environmentIntensity=.48;scene.background=new T.Color(0xc8d9e2);scene.fog.color.copy(scene.background);hdr.dispose();pm.dispose();}catch(error){console.warn('Using direct architectural lighting.',error);}
 const model=await loadSunCityModel();scene.add(model.root);scene.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;canvas.dataset.modelFile='sun-city-new.glb';canvas.dataset.viewerVersion='intro-1';canvas.dataset.batchedObjects=String(model.optimization.removed);
 const amenityMeshes=[],amenityOwners=new Map();
 for(const group of model.land.children.filter(child=>child.userData.amenityId)){
  group.traverse(mesh=>{if(mesh.isMesh){amenityMeshes.push(mesh);amenityOwners.set(mesh,group.userData.amenityId);}});
 }
 const nearDetails=[];model.root.traverse(mesh=>{if(mesh.userData.nearDetail&&!mesh.userData.batchedSource)nearDetails.push({mesh,position:mesh.getWorldPosition(new T.Vector3())});});
 const selectables=[],owners=new Map();for(const tower of model.towers)tower.traverse(o=>{if(o.isMesh){selectables.push(o);owners.set(o,tower);}});
 const pickGroups=[...model.towers,...model.land.children.filter(group=>group.userData.amenityId)].map(owner=>{const meshes=[];owner.traverse(object=>{if(object.isMesh)meshes.push(object);});return{owner,meshes,bounds:new T.Box3().setFromObject(owner)};});
 const showLabels=true,high=false;
 let dirty=true,width=1,height=1,mode='overview',flight=null,overview=null,auto=false,frames=0,last=0,labelsNeedMeasure=true,inViewport=true;
 let interacting=false,settleTimer,adaptiveRatio=1,budgetMs=16.7,budgetSamples=0,lastBudget=0,renderElapsed=0;
 function setResolution(moving){if(canvas.parentElement!==viewport)return;const ratio=high?Math.min(devicePixelRatio,1.8):Math.min(devicePixelRatio,adaptiveRatio,moving?.9:1);if(renderer.getPixelRatio()!==ratio){renderer.setPixelRatio(ratio);dirty=true;}}
 function moving(){interacting=true;clearTimeout(settleTimer);setResolution(true);}
 function settled(){clearTimeout(settleTimer);settleTimer=setTimeout(()=>{interacting=false;setResolution(!!flight||auto);invalidate();},180);}
 controls.addEventListener('start',moving);controls.addEventListener('end',settled);
 new IntersectionObserver(entries=>{inViewport=entries[0].isIntersecting;if(inViewport)invalidate();}).observe(viewport);
 const invalidate=()=>dirty=true;controls.addEventListener('change',invalidate);
 const presets={
  courtyard:{pos:[-170,115,210],target:[16,25,14],title:'Sai Sun City · the township'},
  aerial:{pos:[-225,245,290],target:[36,14,5],title:'Aerial perspective'},
  street:{pos:[-124,14,155],target:[-50,26,26],title:'The arrival boulevard'},
  plan:{pos:[40,440,18],target:[40,0,17],title:'Site plan · brochure page 12'},
 };
 function fitted(pos,target){const p=new T.Vector3(...pos),t=new T.Vector3(...target);if(camera.aspect<1.15)p.sub(t).multiplyScalar(Math.min(1.8,1.15/camera.aspect)).add(t);return p;}
 function stopOrbit(){auto=false;controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');}
 function fly(pos,target,done=null,fov=42){
  stopOrbit();setResolution(true);flight={start:performance.now(),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:1000,from:camera.position.clone(),to:pos.isVector3?pos.clone():new T.Vector3(...pos),fromTarget:controls.enabled?controls.target.clone():camera.position.clone().add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(10)),target:new T.Vector3(...target),done,fov,fromFov:camera.fov};invalidate();
 }
 const profiles={clear(){},viewCamera(){return camera;},active:false};
 const lighting=createArchitecturalLighting({scene,renderer,sun,ambient:hemi,fill,model,invalidate,announce});
 $$('button[data-lighting]').forEach(button=>button.onclick=()=>lighting.set(button.dataset.lighting));
 lighting.set('day');
 const walk=new WalkthroughController({camera,canvas,scene,obstacles:model.walkObstacles,invalidate,onEnterRequest:enterWalk,onExit:exitWalk,announce});
 function leaveWalk(){walk.deactivate();mode='overview';controls.enabled=true;controls.target.copy(camera.position).add(camera.getWorldDirection(new T.Vector3()).multiplyScalar(10));$('#viewer').dataset.mode='overview';}
 function exitWalk(){if(mode==='overview')return;leaveWalk();if(overview)fly(overview.position,overview.target.toArray());else chooseView('courtyard');}
 function enterWalk(zone,point=null,options={}){
  if(!ZONES[zone])return;profiles.clear();if(mode==='overview')overview={position:camera.position.clone(),target:controls.target.clone()};
  stopOrbit();controls.enabled=false;mode='entering';const entry=walk.prepare(zone,options.tour?null:point);
  $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));
  fly(entry.position,entry.target,()=>{mode='walk';walk.activate(options);canvas.focus({preventScroll:true});},64);
 }
 function chooseView(name){$('#amenity-card').hidden=true;$$('[data-amenity]').forEach(button=>button.setAttribute('aria-pressed','false'));profiles.clear();if(mode!=='overview')leaveWalk();const p=presets[name];fly(fitted(p.pos,p.target),p.target);$$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===name)));canvas.dataset.view=name;}
 $$('[data-view]').forEach(b=>b.onclick=()=>chooseView(b.dataset.view));$('#reset').onclick=()=>chooseView('courtyard');
 $$('[data-enter-walk]').forEach(b=>b.onclick=()=>enterWalk(b.dataset.enterWalk));
 function zoom(factor){if(mode!=='overview')return;flight=null;camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();invalidate();}
 $('#zoom-in').onclick=()=>zoom(.84);$('#zoom-out').onclick=()=>zoom(1.18);
 $('#rotate').onclick=()=>{flight=null;auto=!auto;controls.autoRotate=auto;setResolution(auto);$('#rotate').setAttribute('aria-pressed',String(auto));invalidate();};
 controls.addEventListener('start',()=>{flight=null;stopOrbit();invalidate();});
 $('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('#viewer').requestFullscreen();}catch{announce('Fullscreen is unavailable.');}};
 document.addEventListener('fullscreenchange',()=>{resize();});
 const elevation=createTowerElevation({renderer,canvas,environment:scene.environment,
  open(background,selected){
   if(mode!=='overview')leaveWalk();const sourceCamera=profiles.viewCamera(),rect=canvas.getBoundingClientRect(),bounds=new T.Box3().setFromObject(selected),center=bounds.getCenter(new T.Vector3()).project(sourceCamera);
   const top=new T.Vector3(selected.position.x,bounds.max.y,selected.position.z).project(sourceCamera),bottom=new T.Vector3(selected.position.x,bounds.min.y,selected.position.z).project(sourceCamera);
   selected.visible=false;model.instanceBatches.update(sourceCamera,high);renderer.render(scene,sourceCamera);background.width=canvas.width;background.height=canvas.height;background.getContext('2d').drawImage(canvas,0,0);selected.visible=true;model.instanceBatches.select(selected);
   selected.traverse(object=>{if(object.userData.nearDetail)object.visible=true;});
   flight=null;stopOrbit();controls.enabled=false;return {x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,height:Math.max(120,Math.abs(top.y-bottom.y)*rect.height/2)};
  },
  close(){model.instanceBatches.select(null);controls.enabled=true;resize();renderer.shadowMap.needsUpdate=true;invalidate();},
 });
 function selectAmenity(id) {
  const info=amenities[id];
  if(!info)return;
  if(mode!=='overview')leaveWalk();
  profiles.clear();
  const {x,z}=info.point;
  fly([x-35,35,z+48],[x,4,z]);
  $('#amenity-name').textContent=info.name;
  $('#amenity-description').textContent=info.description;
  $('#amenity-card').hidden=false;
  $('#amenity-walk').hidden=!info.walk;
  $('#amenity-walk').onclick=()=>{ $('#amenity-card').hidden=true;enterWalk(info.walk); };
  $$('[data-amenity]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.amenity===id)));
 }
 $$('[data-amenity]').forEach(button=>button.onclick=()=>{selectAmenity(button.dataset.amenity);showPanel(false);});
 $('#close-amenity').onclick=()=>{ $('#amenity-card').hidden=true; };
 function focusTower(id){const tower=model.towers.find(t=>t.userData.towerId===id);if(!tower)return;if(!tower.visible)profiles.clear();elevation.show(id,tower);document.dispatchEvent(new CustomEvent('tower-focus',{detail:id}));$('#view-building').disabled=false;}
 const panelButton=$('#explore-toggle'),panel=$('#explore-sidebar'),panelQuery=matchMedia('(max-width:800px)');
 function updateBuildingDetails(id){
  const building=BUILDINGS.find(item=>item.id===id||item.sceneId===id),detail=$('#building-detail');
  detail.hidden=!building;if(!building)return;
  $('#detail-building-name').textContent=building.name;
  $('#detail-building-number').textContent='Tower '+String(building.number).padStart(2,'0');
  $('#detail-building-facts').innerHTML=building.page
   ? '<div><dt>Homes</dt><dd>1 &amp; 2 BHK</dd></div><div><dt>Typical layout</dt><dd>8 residences</dd></div><div><dt>Layout mix</dt><dd>4 × 1 BHK · 4 × 2 BHK</dd></div>'
   : '<div><dt>Floor plans</dt><dd>Not supplied</dd></div>';
 }
 document.addEventListener('tower-focus',event=>updateBuildingDetails(event.detail));
 document.addEventListener('floor-plan-open',()=>updateBuildingDetails($('#plan-building').value));
 function showPanel(open){document.body.classList.toggle('explore-open',open);panelButton.setAttribute('aria-expanded',String(open));}
 panelButton.onclick=()=>showPanel(!document.body.classList.contains('explore-open'));
 $('#close-explore').onclick=()=>showPanel(false);
 panelQuery.addEventListener('change',()=>showPanel(false));
 $('#plan-building').addEventListener('change',()=>{$('#view-building').disabled=!$('#plan-building').value;updateBuildingDetails($('#plan-building').value);});
 $('#view-building').onclick=()=>{showPanel(false);focusTower($('#plan-building').value);};
 document.addEventListener('keydown',event=>{if(event.key==='Escape')showPanel(false);});
 document.addEventListener('switch-elevation-tower',e=>focusTower(e.detail));
 document.addEventListener('ssc:hide-model',()=>{if(mode!=='overview')exitWalk();stopOrbit();});
 document.addEventListener('floor-plan-open',()=>{stopOrbit();if(mode!=='overview')exitWalk();});
 const ray=new T.Raycaster();let down=null;canvas.addEventListener('pointerdown',e=>{if(!elevation.active&&mode==='overview')down=[e.clientX,e.clientY];});
 canvas.addEventListener('pointerup',e=>{if(!down||elevation.active||mode!=='overview')return;const start=down;down=null;if(e.button!==0||Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)return;const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),profiles.viewCamera());const objects=pickGroups.filter(entry=>entry.owner.visible&&(entry.owner.userData.towerId||model.land.visible)&&ray.ray.intersectsBox(entry.bounds)).flatMap(entry=>entry.meshes);const hit=ray.intersectObjects(objects,false)[0];if(!hit)return;if(amenityOwners.has(hit.object))selectAmenity(amenityOwners.get(hit.object));else if(owners.has(hit.object))focusTower(owners.get(hit.object).userData.towerId);});
 canvas.addEventListener('pointercancel',()=>down=null);
 canvas.addEventListener('keydown',e=>{if(elevation.active||mode!=='overview'||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Escape'].includes(e.key))return;e.preventDefault();if(e.key==='Escape')return chooseView('courtyard');if(['+','=','-'].includes(e.key))return zoom(e.key==='-'?1.12:.9);flight=null;stopOrbit();const s=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(e.key==='ArrowLeft')s.theta-=.12;if(e.key==='ArrowRight')s.theta+=.12;if(e.key==='ArrowUp')s.phi=Math.max(.03,s.phi-.09);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI/2-.03,s.phi+.09);camera.position.copy(new T.Vector3().setFromSpherical(s).add(controls.target));controls.update();invalidate();});
 function resize(){if(elevation?.active){elevation.resize();return;}const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;const ratio=renderer.getPixelRatio();if(w===width&&h===height&&canvas.width===Math.floor(w*ratio)&&canvas.height===Math.floor(h*ratio))return;width=w;height=h;labelsNeedMeasure=true;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);invalidate();}
 new ResizeObserver(resize).observe(viewport);resize();controls.target.set(...presets.courtyard.target);camera.position.copy(fitted(presets.courtyard.pos,presets.courtyard.target));controls.update();
 const labels=BUILDINGS.map(b=>{
  const tower=model.towers.find(t=>t.userData.towerId===b.id),bounds=new T.Box3().setFromObject(tower);
  const anchor=bounds.getCenter(new T.Vector3());anchor.y=bounds.max.y+4;
  const label=document.createElement('span');label.className='roof-label';label.hidden=true;
  const button=document.createElement('button');button.type='button';button.className='roof-caption';button.textContent=b.name;button.setAttribute('aria-label','Explore '+b.name+' levels');button.onclick=()=>focusTower(b.id);
  const arrow=document.createElement('span');arrow.className='roof-arrow';arrow.setAttribute('aria-hidden','true');arrow.onclick=()=>focusTower(b.id);
  label.append(button,arrow);viewport.append(label);return{label,button,tower,anchor,w:0,h:0};
 });
 function positionLabels(){
  if(labelsNeedMeasure){
   // Batch layout reads once per resize, never between per-frame DOM writes.
   for(const marker of labels)marker.label.hidden=false;
   for(const marker of labels){marker.w=marker.button.offsetWidth;marker.h=marker.button.offsetHeight;}
   for(const marker of labels)marker.label.hidden=true;
   labelsNeedMeasure=false;
  }
  const occupied=[],v=new T.Vector3(),viewCamera=profiles.viewCamera();
  const projected=labels.map(marker=>{v.copy(marker.anchor).project(viewCamera);return{...marker,x:(1+v.x)*width/2,y:(1-v.y)*height/2,depth:v.z};});
  // Stable building order prevents captions swapping rows during an orbit.
  for(const marker of projected){
   const {x,y,depth}=marker;
   marker.label.hidden=!showLabels||!marker.tower.visible||mode!=='overview'||depth>1||depth< -1||x<0||x>width||y<10||y>height-90;
   if(marker.label.hidden)continue;const {w,h}=marker,left=Math.max(2,Math.min(width-w-2,x-w/2));let top=y-h-18;
   for(const box of occupied)if(left<box.right+3&&left+w>box.left-3&&top<box.bottom+3&&top+h>box.top-3)top=box.top-h-3;
   if(top<72){marker.label.hidden=true;continue;}
   occupied.push({left,right:left+w,top,bottom:top+h});occupied.sort((a,b)=>b.top-a.top);
   marker.label.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;marker.button.style.transform=`translate(${(left-x).toFixed(1)}px,${(top-y).toFixed(1)}px)`;marker.label.style.setProperty('--stem',Math.max(0,y-top-h-15)+'px');
  }
  for(const [id,p]of [['#pool-hotspot',LANDMARKS.pool],['#garden-hotspot',LANDMARKS.garden]]){v.set(p.x,4,p.z).project(camera);const el=$(id),x=(1+v.x)*width/2,y=(1-v.y)*height/2;el.hidden=profiles.active||mode!=='overview'||v.z>1||x<50||x>width-50||y<80||y>height-100;el.style.left=x+'px';el.style.top=y+'px';}
 }
 let ready=false;
 function draw(now){
  requestAnimationFrame(draw);const dt=Math.min(.05,(now-(last||now))/1000);last=now;if(document.hidden||elevation.active||$('#model-panel').hidden||!inViewport)return;
  if(flight){const f=flight,t=Math.min(1,(now-f.start)/f.duration),v=t*t*(3-2*t);camera.position.lerpVectors(f.from,f.to,v);const target=f.fromTarget.clone().lerp(f.target,v);camera.fov=T.MathUtils.lerp(f.fromFov,f.fov,v);camera.updateProjectionMatrix();if(controls.enabled)controls.target.copy(target);else camera.lookAt(target);dirty=true;if(t===1){flight=null;f.done?.();}}
  if(mode==='overview'&&controls.update(dt))dirty=true;if(mode==='walk'&&walk.update(dt))dirty=true;walk.tickRecording(now);
  if(!dirty&&walk.recorder?.state!=='recording')return;
  renderElapsed+=dt;
  if(ready&&renderElapsed<1/60)return;
  renderElapsed%=1/60;
  if(!high&&(auto||interacting||flight)&&dt>0){
   budgetMs=budgetMs*.9+dt*100;
   if(++budgetSamples>=30&&now-lastBudget>1000){
    if(budgetMs>24)adaptiveRatio=Math.max(.65,adaptiveRatio-.1);
    else if(budgetMs<17)adaptiveRatio=Math.min(1,adaptiveRatio+.05);
    setResolution(true);lastBudget=now;
   }
  }
  if(!flight&&!interacting&&!auto)setResolution(false);
  const started=performance.now();
  for(const detail of nearDetails){const limit=detail.mesh.visible?230:205;detail.mesh.visible=high||detail.position.distanceToSquared(camera.position)<limit*limit;}
  model.instanceBatches.update(camera,high);renderer.render(scene,profiles.viewCamera());const rendered=performance.now();positionLabels();frames++;canvas.dataset.frames=String(frames);canvas.dataset.mode=mode;canvas.dataset.drawCalls=String(renderer.info.render.calls);canvas.dataset.triangles=String(renderer.info.render.triangles);canvas.dataset.sharedBatches=String(model.instanceBatches.batchCount);canvas.dataset.renderMs=(rendered-started).toFixed(2);canvas.dataset.labelsMs=(performance.now()-rendered).toFixed(2);canvas.dataset.pixelRatio=String(renderer.getPixelRatio());canvas.dataset.distance=camera.position.distanceTo(controls.target).toFixed(1);canvas.dataset.azimuth=controls.getAzimuthalAngle().toFixed(3);
  dirty=!!flight||controls.autoRotate||!!(walk.active&&(walk.keys.size||walk.path.length||walk.tour?.running));
  if(!ready){ready=true;$('#loading').hidden=true;canvas.dataset.modelReady='true';canvas.dataset.towers=String(model.towers.length);announce('Sai Sun City is ready. Select a tower to explore its levels.');}
 }
 // Prepare material programs behind the loading screen, before the first orbit.
 if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
 requestAnimationFrame(draw);
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();walk.deactivate();$('#error').hidden=false;});canvas.addEventListener('webglcontextrestored',()=>location.reload());
}

