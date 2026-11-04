import * as T from './vendor/three.module.js';
import {EYE_HEIGHT,ZONES,TOUR_ROUTES,walkFloor,moveWithin,isWalkable,nearestWalkable,findWalkPath} from './walk-navigation.js?v=master-layout-7';

const $=s=>document.querySelector(s);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class WalkthroughController{
  constructor({camera,canvas,scene,obstacles,invalidate,onEnterRequest,onExit,announce}){
    Object.assign(this,{camera,canvas,obstacles,invalidate,onEnterRequest,onExit,announce});
    this.active=false;this.zone='pool';this.keys=new Set();this.path=[];this.tour=null;this.drag=null;this.recorder=null;this.videoURL=null;
    this.marker=new T.Mesh(new T.RingGeometry(.28,.4,32),new T.MeshBasicMaterial({color:0xe6d69e,side:T.DoubleSide}));this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;scene.add(this.marker);
    $('#exit-walk').onclick=()=>this.onExit();
    for(const b of document.querySelectorAll('[data-walk-zone]'))b.onclick=()=>this.onEnterRequest(b.dataset.walkZone);
    $('#guided-tour').onclick=()=>{if(this.tour){this.tour.running=!this.tour.running;if(this.recorder){if(this.tour.running&&this.recorder.state==='paused')this.recorder.resume();else if(!this.tour.running&&this.recorder.state==='recording')this.recorder.pause();}this.refreshUI();this.invalidate();}else this.onEnterRequest(this.zone,null,{tour:true});};
    $('#record-tour').onclick=()=>{if(this.recorder){this.stopRecording();return;}this.onEnterRequest(this.zone,null,{tour:true,record:true});};
    this.recordSupported=typeof MediaRecorder!=='undefined'&&typeof canvas.captureStream==='function';$('#record-tour').hidden=!this.recordSupported;
    canvas.addEventListener('pointerdown',e=>{if(!this.active||e.button>0)return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,total:0};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!this.active||!this.drag||this.drag.id!==e.pointerId)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;this.drag.total+=Math.abs(dx)+Math.abs(dy);this.drag.x=e.clientX;this.drag.y=e.clientY;if(this.drag.total>4){this.yaw-=dx*.004;this.pitch=T.MathUtils.clamp(this.pitch-dy*.0035,-1.13,1.15);this.path=[];this.marker.visible=false;this.cancelTour();this.applyLook();this.invalidate();}});
    canvas.addEventListener('pointerup',e=>{if(!this.active||!this.drag||this.drag.id!==e.pointerId)return;const tapped=this.drag.total<7;this.drag=null;if(tapped)this.clickToWalk(e);});
    canvas.addEventListener('pointercancel',()=>this.drag=null);
    canvas.addEventListener('lostpointercapture',()=>this.drag=null);
    window.addEventListener('keydown',e=>{if(!this.active||e.target.closest?.('input,select,textarea,button,a'))return;const key=e.key.toLowerCase();if(key==='escape'){e.preventDefault();this.onExit();return;}if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift'].includes(key)){e.preventDefault();this.keys.add(key);this.path=[];this.marker.visible=false;this.cancelTour();this.invalidate();}});
    window.addEventListener('keyup',e=>this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur',()=>{this.keys.clear();this.drag=null;});
    document.addEventListener('visibilitychange',()=>{this.keys.clear();this.drag=null;if(document.hidden&&this.tour?.running){this.tour.running=false;if(this.recorder?.state==='recording')this.recorder.pause();this.refreshUI();}});
    for(const b of document.querySelectorAll('[data-move]')){
      const release=()=>{this.keys.delete(b.dataset.move);b.setAttribute('aria-pressed','false');};
      b.addEventListener('pointerdown',e=>{e.preventDefault();if(!this.active)return;b.setPointerCapture(e.pointerId);this.keys.add(b.dataset.move);b.setAttribute('aria-pressed','true');this.path=[];this.cancelTour();this.invalidate();});
      b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
      b.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();this.keys.add(b.dataset.move);this.cancelTour();}});b.addEventListener('keyup',release);b.addEventListener('blur',release);
    }
  }
  prepare(zone,point){
    this.deactivate(false);this.zone=zone;
    const start=point?nearestWalkable(zone,point.x,point.z,this.obstacles):{x:ZONES[zone].start[0],z:ZONES[zone].start[1]};
    this.position=start??{x:ZONES[zone].start[0],z:ZONES[zone].start[1]};
    const y=walkFloor(zone,this.position.x,this.position.z)+EYE_HEIGHT;
    const look=[ZONES[zone].look[0],y+.2,ZONES[zone].look[1]];
    $('#walk-zone-title').textContent=ZONES[zone].title;$('#walk-status').textContent='Entering the walking area…';$('#walk-panel').hidden=false;
    $('#viewer').dataset.mode='entering';this.refreshUI();
    return{position:[this.position.x,y,this.position.z],target:look};
  }
  activate(options={}){
    this.active=true;const e=new T.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.yaw=e.y;this.pitch=e.x;
    this.camera.rotation.order='YXZ';this.applyLook();$('#viewer').dataset.mode='walk';
    $('#walk-status').textContent='Drag to look · Tap a path to walk';this.refreshUI();
    if(options.tour)this.beginTour();if(options.record&&this.tour)this.startRecording();
    this.announce(`${ZONES[this.zone].title} walkthrough. Use WASD, arrow keys, or the on-screen movement controls. Drag to look around.`);this.invalidate();
  }
  deactivate(hide=true){
    this.active=false;this.keys.clear();this.path=[];this.drag=null;this.tour=null;this.marker.visible=false;
    if(this.recorder)this.stopRecording();if(hide)$('#walk-panel').hidden=true;this.refreshUI();
  }
  cancelTour(){if(this.tour){this.tour=null;$('#walk-status').textContent='Free exploration';this.refreshUI();}}
  applyLook(){this.camera.rotation.set(this.pitch,this.yaw,0,'YXZ');}
  refreshUI(){
    for(const b of document.querySelectorAll('[data-walk-zone]'))b.setAttribute('aria-pressed',String(b.dataset.walkZone===this.zone));
    $('#guided-tour').textContent=this.tour?(this.tour.running?'Pause tour':'Resume tour'):'Guided tour';
    $('#guided-tour').setAttribute('aria-pressed',String(!!this.tour?.running));
    $('#record-tour').textContent=this.recorder?'Stop recording':'Record tour';$('#record-tour').setAttribute('aria-pressed',String(!!this.recorder));
    $('#tour-progress').hidden=!this.tour;
  }
  clickToWalk(e){
    const r=this.canvas.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);
    const point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-ZONES[this.zone].floor),new T.Vector3());
    if(!point||!isWalkable(this.zone,point.x,point.z,this.obstacles)){this.announce('Choose a clear path or deck within this walking area.');return;}
    const path=findWalkPath(this.zone,this.position,{x:point.x,z:point.z},this.obstacles);
    if(!path.length){this.announce('That spot is not reachable from the current path.');return;}
    this.cancelTour();this.path=path;this.marker.position.set(point.x,walkFloor(this.zone,point.x,point.z)+.06,point.z);this.marker.visible=true;this.invalidate();
  }
  beginTour(){
    const route=TOUR_ROUTES[this.zone],path=[];let from={...this.position};
    for(const p of route.slice(1)){const to={x:p[0],z:p[1]},leg=findWalkPath(this.zone,from,to,this.obstacles);if(!leg.length){this.announce('The guided route could not start. You can still explore manually.');return;}path.push(...leg);from=to;}
    let length=0;from=this.position;for(const p of path){length+=Math.hypot(p.x-from.x,p.z-from.z);from=p;}
    this.tour={running:true,path,index:0,length,travelled:0};this.path=[];$('#tour-progress').value=0;this.refreshUI();$('#walk-status').textContent='Guided tour';this.invalidate();
  }
  update(dt){
    if(!this.active)return false;let dx=0,dz=0,changed=false;
    const forward=Number(this.keys.has('w')||this.keys.has('arrowup'))-Number(this.keys.has('s')||this.keys.has('arrowdown'));
    const right=Number(this.keys.has('d')||this.keys.has('arrowright'))-Number(this.keys.has('a')||this.keys.has('arrowleft'));
    if(forward||right){const speed=(this.keys.has('shift')?4.4:2.8)*dt/Math.max(1,Math.hypot(forward,right));dx=(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*right)*speed;dz=(-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*right)*speed;}
    else if(this.tour?.running||this.path.length){
      const tour=this.tour?.running?this.tour:null,queue=tour?tour.path:this.path,index=tour?tour.index:0,p=queue[index];
      if(p){const x=p.x-this.position.x,z=p.z-this.position.z,dist=Math.hypot(x,z);if(dist<.14){if(tour)tour.index++;else this.path.shift();}else{const move=Math.min(dist,dt*(tour?3.4:2.8));dx=x/dist*move;dz=z/dist*move;}
        if(tour){let lx=ZONES[this.zone].look[0],lz=ZONES[this.zone].look[1],ly=ZONES[this.zone].floor+1.5;const yaw=Math.atan2(-(lx-this.position.x),-(lz-this.position.z)),pitch=Math.atan2(ly-this.camera.position.y,Math.hypot(lx-this.position.x,lz-this.position.z));this.yaw+=wrap(yaw-this.yaw)*Math.min(1,dt*2.3);this.pitch+=(pitch-this.pitch)*Math.min(1,dt*2.3);changed=true;}
      }else if(tour){this.tour=null;$('#tour-progress').value=100;this.refreshUI();$('#walk-status').textContent='Tour complete — keep exploring';if(this.recorder)this.stopRecording();this.announce('Guided tour complete. You can continue walking.');}else this.marker.visible=false;
    }
    if(dx||dz){const p=moveWithin(this.zone,this.position,dx,dz,this.obstacles),distance=Math.hypot(p.x-this.position.x,p.z-this.position.z);this.position=p;changed=distance>.00001||changed;if(this.tour){this.tour.travelled+=distance;$('#tour-progress').value=Math.min(100,this.tour.travelled/this.tour.length*100);}}
    if(changed){const p=this.position;this.camera.position.set(p.x,walkFloor(this.zone,p.x,p.z)+EYE_HEIGHT,p.z);this.applyLook();this.canvas.dataset.walkPosition=`${p.x.toFixed(2)},${this.camera.position.y.toFixed(2)},${p.z.toFixed(2)}`;}
    return changed;
  }
  startRecording(){
    if(!this.recordSupported||this.recorder)return;
    try{
      const types=['video/webm;codecs=vp8','video/webm','video/mp4'],mime=types.find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw new Error('No supported recording format');
      const stream=this.canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000}),chunks=[],zone=this.zone;
      this.recorder=recorder;this.recordStream=stream;this.recordStarted=performance.now();
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mime});if(this.videoURL)URL.revokeObjectURL(this.videoURL);this.videoURL=URL.createObjectURL(blob);const a=$('#download-tour');a.href=this.videoURL;a.download=`sai-sun-city-${zone}-walkthrough.${mime.includes('mp4')?'mp4':'webm'}`;a.hidden=blob.size===0;$('#clip-status').textContent=blob.size?'Your walkthrough video is ready.':'';this.canvas.dataset.recordedBytes=String(blob.size);this.refreshUI();};
      recorder.onerror=()=>{this.announce('Video recording stopped. Live walkthrough remains available.');this.stopRecording();};
      recorder.start(1000);this.refreshUI();$('#clip-status').textContent='Recording the live 3D tour…';this.invalidate();
    }catch(e){this.recorder=null;this.announce('Video recording is unavailable in this browser. You can still use the guided tour.');this.refreshUI();}
  }
  stopRecording(){const r=this.recorder;if(!r)return;this.recorder=null;if(r.state!=='inactive')r.stop();this.refreshUI();}
  tickRecording(now){if(this.recorder&&now-this.recordStarted>120000)this.stopRecording();}
}
