import {LIGHTING_PRESETS} from './architectural-lighting.js?v=glow-1';
import * as T from './vendor/three.module.js';
import {BUILDINGS,resolvePlan} from './floor-plan-data.js?v=block-floors-1';

export function createTowerElevation({renderer,canvas,environment,open,close}){
  const byId=id=>document.getElementById(id);
  const dialog=byId('elevation'),stage=byId('elevation-stage'),rail=byId('elevation-levels'),bands=byId('elevation-bands');
  const railNav=rail.parentElement;
  const highlight=document.createElement('i');
  const overviewLabel=canvas.getAttribute('aria-label');
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,600);
  scene.environment=environment;
  const ambient=new T.HemisphereLight(0xfff2da,0x8292a4,1.55);scene.add(ambient);
  const keyLight=new T.DirectionalLight(0xffe3ba,2.05);
  scene.add(keyLight,keyLight.target);
  let building=null,mesh=null,parent=null,level=9,home=null;
  let yaw=0,pitch=0,hasSelection=false,drag=null,dragged=false,interactive=false,lastHover=null;
  const pickRay=new T.Raycaster(),pickPointer=new T.Vector2();
  const hoverActive={value:0},hoverFloor={value:new T.Vector2()};
  let restoredMaterials=[],hoverMaterials=[];
  function findFacades(){const facades=[];mesh?.traverse(object=>{if(object.isMesh&&object.name.startsWith('Plan-shaped'))facades.push(object);});return facades;}
  function installFloorHover(){
    const copies=new Map();hoverActive.value=0;
    const copy=original=>{
      if(copies.has(original))return copies.get(original);
      const material=original.clone();
      material.onBeforeCompile=(shader,renderer)=>{
        original.onBeforeCompile.call(material,shader,renderer);
        shader.uniforms.towerHoverActive=hoverActive;shader.uniforms.towerHoverFloor=hoverFloor;
        shader.vertexShader='varying float vTowerHeight;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
          vec4 towerPosition=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            towerPosition=instanceMatrix*towerPosition;
          #endif
          vTowerHeight=(modelMatrix*towerPosition).y;`);
        shader.fragmentShader='varying float vTowerHeight;uniform float towerHoverActive;uniform vec2 towerHoverFloor;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          float hoveredStorey=step(towerHoverFloor.x,vTowerHeight)*step(vTowerHeight,towerHoverFloor.y);
          outgoingLight*=mix(1.0,0.32,towerHoverActive*(1.0-hoveredStorey));
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>original.customProgramCacheKey.call(original)+'|tower-floor-only-v1';
      copies.set(original,material);return material;
    };
    mesh.traverse(object=>{
      if(!object.isMesh)return;
      restoredMaterials.push([object,object.material]);
      object.material=Array.isArray(object.material)?object.material.map(copy):copy(object.material);
    });
    hoverMaterials=[...copies.values()];
  }
  let buttons=[],slices=[],transition=null,closing=false,pending=null,origin=null;
  const switcher=document.createElement('select');
  switcher.setAttribute('aria-label','Choose a building');
  switcher.className='elevation-switcher';
  for(const item of BUILDINGS){
    const option=document.createElement('option');
    option.value=item.sceneId??item.id;option.textContent=item.name;
    switcher.append(option);
  }
  byId('leave-elevation').insertAdjacentElement('afterend',switcher);
  function siteTransform(){
    const rect=stage.getBoundingClientRect();
    const scale=Math.max(.04,Math.min(2,origin.height/(rect.height*.93)));
    return 'translate('+ (origin.x-rect.left-rect.width/2)+'px,'+(origin.y-rect.top-rect.height/2)+'px) scale('+scale+')';
  }
  function leave(next){
    pending=next;
    if(closing)return;
    closing=true;
    const motion=matchMedia('(prefers-reduced-motion: reduce)').matches?180:650;
    const animation=canvas.animate([
      {transform:'translate(0, 0) scale(1)',opacity:1},
      {transform:siteTransform(),opacity:0}
    ],{duration:motion,easing:'cubic-bezier(.55,0,.8,.25)',fill:'forwards'});
    animation.finished.then(()=>{
      dialog.close();animation.cancel();

    });
  }
  switcher.onchange=()=>leave(switcher.value);
  dialog.addEventListener('cancel',event=>{event.preventDefault();leave();});
  function updateLighting(detail){
    const name=detail?.name??byId('scene').dataset.lighting??'day';
    const p=LIGHTING_PRESETS[name];
    if(detail?.environment)scene.environment=detail.environment;
    scene.environmentIntensity=name==='day'?1:Math.max(.35,p.environment);
    ambient.intensity=name==='night'?1.05:name==='evening'?.8:1.55;
    ambient.color.set(name==='night'?0xe2e9f4:name==='day'?0xfff2da:0xffefd7);
    keyLight.intensity=name==='night'?1.3:name==='evening'?1.35:2.05;
    keyLight.color.set(name==='day'?0xffe3ba:p.color);dialog.dataset.lighting=name;
    resize();
  }
  document.addEventListener('architectural-lighting-change',event=>updateLighting(event.detail));
  const format=n=>n===0?'G':String(n).padStart(2,'0');

  function preview(n){
    if(!building)return;
    buttons[level]?.removeAttribute('aria-current');
    level=n;hasSelection=true;
    const base=mesh.position.y,podium=mesh.userData.podiumHeight??2.48,floorPitch=mesh.userData.floorPitch??1.767;
    hoverFloor.value.set(n===0?base:base+podium+(n-1)*floorPitch,base+podium+n*floorPitch);
    hoverActive.value=1;
    byId('elevation-indicator').hidden=false;byId('elevation-dim').hidden=true;highlight.hidden=false;
    buttons[n].setAttribute('aria-current','true');
    if(slices[n]){
      highlight.style.top=slices[n].style.top;
      highlight.style.height=slices[n].style.height;
      const top=parseFloat(slices[n].style.top),bottom=top+parseFloat(slices[n].style.height);
      byId('elevation-dim').style.setProperty('--band-top',top+'%');
      byId('elevation-dim').style.setProperty('--band-bottom',bottom+'%');
      byId('elevation-indicator').style.top=bottom+'%';
      byId('elevation-open').style.marginTop=bottom>92?'-38px':'0';
    }
    const plan=resolvePlan(building.id,n);
    byId('elevation-open').textContent=n===0?'OPEN GROUND FLOOR':'OPEN LEVEL '+format(n);
    byId('elevation-readout').textContent=n===0?'GROUND FLOOR':'LEVEL '+format(n);
    byId('elevation-tag').textContent=format(n);
    if(!slices[n])byId('elevation-indicator').style.top=((1-n/building.floors)*76+15)+'%';
    byId('elevation-note').textContent=plan.available?(plan.verified?'Floor plan available':'Typical layout · floor assignment unconfirmed'):'Drawing unavailable';
    renderer.render(scene,camera);
  }
  function openPlan(n){
    if(dragged){dragged=false;return;}
    preview(n);resize();
    document.dispatchEvent(new CustomEvent('open-block-floor',{detail:{id:building.id,floor:n}}));
  }
  document.addEventListener('floor-plan-close',()=>{
    if(!building)return;
    const floor=Number(byId('floor-plan-dialog').dataset.floor);
    if(buttons[floor])preview(floor);
  });
  byId('elevation-open').onclick=()=>openPlan(level);
  byId('leave-elevation').onclick=()=>leave();
  dialog.addEventListener('close',()=>{
    if(!building)return;
    hoverActive.value=0;
    for(const [object,material] of restoredMaterials)object.material=material;
    for(const material of hoverMaterials)material.dispose();
    restoredMaterials=[];hoverMaterials=[];
    parent.add(mesh);home.replaceWith(canvas);canvas.setAttribute('aria-label',overviewLabel);canvas.tabIndex=0;building=null;mesh=null;
    interactive=false;lastHover=null;
    renderer.setClearAlpha(1);
    close();closing=false;
    if(pending){const next=pending;pending=null;document.dispatchEvent(new CustomEvent('switch-elevation-tower',{detail:next}));}
  });
  function resize(){
    if(!building||!dialog.open)return;
    const w=stage.clientWidth,h=stage.clientHeight;
    if(!w||!h)return;
    const commercial=building.id==='business',angle=mesh.rotation.y;
    const bounds=new T.Box3().setFromObject(mesh);
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
    const mid=center.y;
    const span=Math.max(size.y*1.12,Math.hypot(size.x,size.z)*h/w*1.08);
    const direction=new T.Vector3(Math.sin(angle)*Math.cos(pitch),Math.sin(pitch),Math.cos(angle)*Math.cos(pitch));
    const distance=180;
    camera.top=span/2;camera.bottom=-span/2;camera.right=span*w/h/2;camera.left=-camera.right;
    camera.position.copy(center).addScaledVector(direction,distance);camera.position.y=mid+distance*Math.sin(pitch);
    camera.lookAt(center.x,mid,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    keyLight.target.position.copy(mesh.position);keyLight.position.copy(mesh.position).addScaledVector(direction,85);
    keyLight.position.x+=45;keyLight.position.y+=110;
    renderer.setSize(w,h,false);renderer.setClearAlpha(0);renderer.render(scene,camera);
    railNav.classList.remove('aligned');
    if(commercial)return;
    
    // Project the elevation onto the same camera plane as its picking stripes.
    const facades=findFacades();if(!facades.length)return;
    const xs=[],v=new T.Vector3();
    for(const facade of facades){
      const geom=facade.geometry;geom.computeBoundingBox();
      for(const x of [geom.boundingBox.min.x,geom.boundingBox.max.x])
        for(const z of [geom.boundingBox.min.z,geom.boundingBox.max.z]){
          v.set(x,0,z).applyMatrix4(facade.matrixWorld).project(camera);xs.push((v.x+1)*w/2);
        }
    }
    const min=Math.min(...xs),max=Math.max(...xs);
    byId('elevation-indicator').style.left=Math.max(24,min-12)+'px';
    byId('elevation-indicator').style.right=Math.max(12,w-max-40)+'px';
    bands.style.left=min+'px';bands.style.width=(max-min)+'px';
    const base=mesh.position.y,podium=mesh.userData.podiumHeight??2.48,floorPitch=mesh.userData.floorPitch??1.767;
    for(let n=0;n<=building.floors;n++){
      const bottom=n===0?base:base+podium+(n-1)*floorPitch;
      const top=base+podium+n*floorPitch;
      const projectedTop=new T.Vector3(mesh.position.x,top,mesh.position.z).project(camera).y;
      const projectedBottom=new T.Vector3(mesh.position.x,bottom,mesh.position.z).project(camera).y;
      slices[n].style.top=((1-projectedTop)*50)+'%';
      slices[n].style.height=((projectedTop-projectedBottom)*50)+'%';
    }
    const rowPitch=h*floorPitch/span;
    if(matchMedia('(min-width:651px) and (pointer:fine)').matches&&rowPitch>=12){
      const rowTop=parseFloat(slices[building.floors].style.top)*h/100;
      railNav.style.setProperty('--rail-shift',(max-w+20)+'px');
      railNav.style.setProperty('--rail-top',rowTop+'px');
      railNav.style.setProperty('--pitch',rowPitch+'px');
      railNav.style.setProperty('--ground-pitch',(h*podium/span)+'px');
      railNav.classList.add('aligned');
    }
    if(hasSelection)preview(level);
  }
  function clearSelection(){
    hasSelection=false;buttons[level]?.removeAttribute('aria-current');
    hoverActive.value=0;
    byId('elevation-indicator').hidden=true;byId('elevation-dim').hidden=true;highlight.hidden=true;
    byId('elevation-readout').textContent='SELECT A LEVEL';
    byId('elevation-note').textContent='Hover to highlight · Click a floor or level number to open its plan.';
    if(interactive&&building&&dialog.open)renderer.render(scene,camera);
  }
  function floorAt(event){
    if(!building||!mesh)return null;
    const rect=stage.getBoundingClientRect();
    pickPointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
    pickRay.setFromCamera(pickPointer,camera);
    const hit=pickRay.intersectObjects(findFacades(),false)[0];
    if(!hit)return null;
    const y=mesh.worldToLocal(hit.point.clone()).y;
    const podium=mesh.userData.podiumHeight??2.48,floorPitch=mesh.userData.floorPitch??1.767;
    if(y<0||y>podium+building.floors*floorPitch)return null;
    return T.MathUtils.clamp(Math.ceil((y-podium)/floorPitch),0,building.floors);
  }
  stage.addEventListener('pointerdown',event=>{
    if(!interactive||event.button!==0||event.target.closest('button'))return;
    drag={x:event.clientX,y:event.clientY};dragged=false;lastHover=null;
  });
  stage.addEventListener('pointermove',event=>{
    if(!interactive||!building||event.target.closest('button'))return;
    if(drag){
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!dragged&&Math.hypot(dx,dy)<5)return;
      dragged=true;clearSelection();
      drag={x:event.clientX,y:event.clientY};return;
    }
    if(event.buttons)return;
    // Ignore the pointer inherited from opening the dialog and its arrival animation.
    const previous=lastHover;lastHover={x:event.clientX,y:event.clientY};
    if(!previous||Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<2)return;
    dragged=false;
    const n=floorAt(event);
    if(n===null)clearSelection();else preview(n);
  });
  stage.addEventListener('pointerleave',()=>{lastHover=null;if(!drag)clearSelection();});
  stage.addEventListener('pointerup',event=>{
    if(!building||closing||!drag||dragged||event.button!==0||event.target.closest('button'))return;
    const floor=floorAt(event);
    if(floor!==null)openPlan(floor);
  });
  window.addEventListener('pointerup',()=>{drag=null;lastHover=null;});
  window.addEventListener('pointercancel',()=>{drag=null;dragged=false;lastHover=null;});
  new ResizeObserver(resize).observe(stage);
  function show(id,selected){
    const entry=BUILDINGS.find(b=>b.sceneId===id||b.id===id);
    if(!entry||dialog.open)return;
    yaw=0;pitch=0;hasSelection=false;dragged=false;interactive=false;lastHover=null;dialog.dataset.arriving="true";
    origin=open(byId('elevation-background'),selected);building=entry;mesh=selected;parent=mesh.parent;scene.add(mesh);
    installFloorHover();
    home=document.createComment('overview canvas');canvas.replaceWith(home);stage.prepend(canvas);
    switcher.value=entry.sceneId??entry.id;
    byId('elevation-name').textContent=entry.name;
    byId('elevation-index').textContent=entry.number?'RESIDENTIAL TOWER  /  '+format(entry.number):'COMMERCIAL TOWER';
    canvas.setAttribute('aria-label',entry.name+' original 3D tower, straight-on front elevation. Hover over the model to choose a floor.');canvas.tabIndex=-1;rail.replaceChildren();bands.replaceChildren(highlight);highlight.hidden=!entry.number;buttons=[];slices=[];
    for(let n=entry.floors;n>=0;n--){
      const button=document.createElement('button');button.type='button';button.textContent=format(n);
      button.style.setProperty('--reveal-delay',(0.2+(entry.floors-n)*.026)+'s');
      button.setAttribute('aria-label',n===0?'Ground floor':'Level '+n);
      button.onfocus=()=>{if(interactive)preview(n);};button.onpointermove=e=>{if(interactive&&e.pointerType==='mouse'&&!e.buttons)preview(n);};
      button.onclick=()=>{if(building&&!closing){dragged=false;openPlan(n);}};rail.append(button);buttons[n]=button;
      if(entry.number){
        const slice=document.createElement('div');
        // Projected bands only draw the hover highlight. Picking uses the 3D mesh.
        slices[n]=slice;bands.append(slice);
      }
    }
    if(!entry.number){
      byId('elevation-indicator').style.left='20%';
      byId('elevation-indicator').style.right='14%';
      byId('elevation-open').style.marginTop='0';
      byId('elevation-dim').style.setProperty('--band-top','0%');
      byId('elevation-dim').style.setProperty('--band-bottom','100%');
    }
    dialog.showModal();level=Math.min(9,entry.floors);
    byId('elevation-indicator').hidden=true;byId('elevation-dim').hidden=true;highlight.hidden=true;
    byId('elevation-readout').textContent='SELECT A LEVEL';
    byId('elevation-note').textContent=entry.number>16?'Apartment drawings for this tower were not supplied.':'Hover to highlight · Click a floor or level number to open its plan.';
    updateLighting();
    transition?.cancel();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?180:900;
    transition=canvas.animate([
      {transform:siteTransform(),opacity:0},
      {transform:'translate(0, 0) scale(1)',opacity:1}
    ],{duration,easing:'cubic-bezier(.22,1,.36,1)'});
    transition.finished.then(()=>{if(!closing&&building===entry){interactive=true;lastHover=null;dialog.dataset.arriving='false';clearSelection();}}).catch(()=>{});
  }
  return {show,resize,get active(){return building!==null;}};
}
