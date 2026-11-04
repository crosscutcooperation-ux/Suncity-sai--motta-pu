import {dressApartment} from './apartment-finishes.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import * as T from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';

export class FloorPlanViewer {
  constructor(host,onTap=null){
    this.host=host;
    this.scene=new T.Scene();this.scene.background=new T.Color(0xf8f7f3);
    this.camera=new T.PerspectiveCamera(38,1,.1,500);
    this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
    let pointerStart=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      if(pointerStart&&Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])<4)onTap?.();
      pointerStart=null;
    });
    this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;
    this.host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label','Rotatable 3D cutaway of the selected floor plan');
    this.renderer.domElement.setAttribute('role','img');
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.maxPolarAngle=Math.PI/2-.08;this.controls.minDistance=12;this.controls.maxDistance=150;
    this.controls.addEventListener('change',()=>this.draw());
    this.scene.add(new T.HemisphereLight(0xffffff,0x7a8171,.95));
    const sun=new T.DirectionalLight(0xfff6e3,2);sun.position.set(-25,60,35);sun.castShadow=true;
    sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:.1,far:130});
    sun.shadow.bias=-.0002;sun.shadow.normalBias=.04;sun.shadow.radius=3;
    this.scene.add(sun);
    const fill=new T.DirectionalLight(0xffffff,.5);fill.position.set(30,20,-30);this.scene.add(fill);
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(host);
    this.revision=0;this.active=true;
  }
  resize(){
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);this.draw();
  }
  clear(){
    if(!this.floor)return;
    this.scene.remove(this.floor);
    this.disposeModel(this.floor);this.floor=null;
  }
  disposeModel(model){
    const textures=new Set(),materials=new Set();
    model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.dispose();for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material]))materials.add(material);});
    for(const material of materials){for(const value of Object.values(material))if(value?.isTexture&&!value.userData.sharedFinish)textures.add(value);material.dispose();}
    for(const texture of textures)texture.dispose();
  }
  async loadModel(key){
    const revision=++this.revision;
    const {scene:model}=await new GLTFLoader().loadAsync('assets/plans/'+key+'.glb');
    try{await dressApartment(model);}catch(error){console.warn('Apartment finish textures unavailable',error);}
    if(revision!==this.revision){this.disposeModel(model);return;}
    this.clear();
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    this.floor=model;this.scene.add(model);
    const bounds=new T.Box3().setFromObject(model);
    const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.ShadowMaterial({opacity:.19}));
    ground.rotation.x=-Math.PI/2;ground.position.copy(bounds.getCenter(new T.Vector3()));
    ground.position.y=bounds.min.y-.01;ground.receiveShadow=true;model.add(ground);
    this.corners=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])
      this.corners.push(new T.Vector3(x,y,z));
    this.controls.minDistance=2;this.resize();this.reset();
  }
  async load(key){
    this.controls.minDistance=12;
    const revision=++this.revision;
    const [response,texture]=await Promise.all([fetch('assets/plans/'+key+'.json?v=floors-4'),new T.TextureLoader().loadAsync('assets/plans/'+key+'-floor.png?v=floors-4')]);
    if(!response.ok){texture.dispose();throw new Error('The 3D floor data could not be loaded.');}
    const data=await response.json();
    if(revision!==this.revision){texture.dispose();return;}
    this.clear();texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    const floor=new T.Group(),scale=48/Math.max(data.width,data.height);
    const point=([x,y])=>[(x-data.width/2)*scale,(data.height/2-y)*scale];
    function outline(points){const shape=new T.Shape();points.forEach((p,i)=>shape[i===0?'moveTo':'lineTo'](...point(p)));shape.closePath();return shape;}
    const bases=data.footprint.map(points=>outline(points));
    const slabGeometry=new T.ExtrudeGeometry(bases,{depth:.2,bevelEnabled:false});slabGeometry.rotateX(-Math.PI/2);
    const slab=new T.Mesh(slabGeometry,new T.MeshStandardMaterial({color:0xc6c3b6,roughness:.9}));slab.position.y=-.2;floor.add(slab);
    const drawing=new T.Mesh(new T.PlaneGeometry(data.width*scale,data.height*scale),new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.5,roughness:.92,metalness:0}));
    drawing.rotation.x=-Math.PI/2;drawing.position.y=.012;floor.add(drawing);
    const pieces=data.walls.map(ring=>{
      const shape=outline(ring.outer);
      for(const points of ring.holes){const hole=new T.Path();points.forEach((p,i)=>hole[i===0?'moveTo':'lineTo'](...point(p)));hole.closePath();shape.holes.push(hole);}
      const geometry=new T.ExtrudeGeometry(shape,{depth:1.05,bevelEnabled:false});geometry.rotateX(-Math.PI/2);return geometry;
    });
    const geometry=mergeGeometries(pieces,false);pieces.forEach(piece=>piece.dispose());
    if(geometry)floor.add(new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x788997,roughness:.82})));

    // Bed positions and sizes follow the bedroom finishes in the supplied drawing.
    const oak=new T.MeshStandardMaterial({color:0x80664c,roughness:.7});
    const linen=new T.MeshStandardMaterial({color:0xf3eee3,roughness:.98});
    const blue=new T.MeshStandardMaterial({color:0x596e84,roughness:.95});
    const bedGeometry=new T.BoxGeometry(1,1,1);
    function block(w,h,d,x,y,z,material){
      const object=new T.Mesh(bedGeometry.clone(),material);object.scale.set(w,h,d);
      object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;floor.add(object);
    }
    for(const bed of data.furniture??[]){
      if(bed.kind!=='bed')continue;
      const [x,py]=point([bed.x,bed.y]),z=-py,w=bed.width*scale,d=bed.depth*scale;
      block(w,.21,d,x,.12,z,oak);
      block(w*.98,.18,d*.98,x,.31,z,linen);
      block(w*1.03,.66,.1,x,.34,z-d/2,oak);
      block(w*.98,.05,d*.32,x,.425,z+d*.23,blue);
      for(const side of [-1,1])block(w*.37,.10,d*.18,x+side*w*.24,.45,z-d*.31,linen);
    }
    floor.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    this.floor=floor;this.scene.add(floor);
    this.corners=data.footprint.flat().map(pixel=>{
      const [x,y]=point(pixel);return new T.Vector3(x,0,-y);
    });
    this.resize();this.reset();
  }
  reset(){
    if(!this.corners?.length)return;
    const target=new T.Box3().setFromPoints(this.corners).getCenter(new T.Vector3());
    const direction=new T.Vector3(.45,1.7,.65).normalize();
    const right=new T.Vector3().crossVectors(this.camera.up,direction).normalize();
    const up=new T.Vector3().crossVectors(direction,right);
    const tanY=Math.tan(T.MathUtils.degToRad(this.camera.fov/2)),tanX=tanY*this.camera.aspect;
    let distance=this.controls.minDistance;
    for(const corner of this.corners){
      const offset=corner.clone().sub(target);
      const margin=1.12*Math.max(Math.abs(offset.dot(right))/tanX,Math.abs(offset.dot(up))/tanY);
      distance=Math.max(distance,offset.dot(direction)+margin);
    }
    this.controls.target.copy(target);this.camera.position.copy(target).addScaledVector(direction,distance);
    this.controls.update();this.draw();
  }
  zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();this.draw();}
  draw(){if(this.active)this.renderer.render(this.scene,this.camera);}
  setActive(active){this.active=active;if(active)this.resize();}
}
