import * as T from './vendor/three.module.js';
import {Sky} from './vendor/addons/objects/Sky.js';
import {LANDMARKS} from './site-data.js';

// Warm occupied glazing against darker masonry, following the supplied night reference.
export const LIGHTING_PRESETS={
  day:{sun:[-160,205,195],color:0xfff0dc,sunPower:2.3,ambient:.48,fill:.28,environment:.5,exposure:1,
    fog:0xc4d6d6,density:.00082,windows:0,lamps:0,turbidity:2.5,rayleigh:1.65},
  evening:{sun:[-240,32,-220],color:0xffb456,sunPower:2.65,ambient:.58,fill:.60,environment:.38,exposure:1.04,
    fog:0xe6b29b,density:.0010,windows:.28,lamps:.15,turbidity:6,rayleigh:2.8},
  night:{sun:[-110,190,80],color:0xaec8ed,sunPower:.38,ambient:.32,fill:.2,environment:.08,exposure:1.1,
    fog:0x111e36,density:.0013,windows:3.2,lamps:1,turbidity:3,rayleigh:1}
};

export function createArchitecturalLighting({scene,renderer,sun,ambient,fill,model,invalidate,announce}) {
  const originalEnvironment=scene.environment;
  const sky=new Sky();sky.scale.setScalar(3000);sky.renderOrder=-10;scene.add(sky);
  sky.material.uniforms.mieCoefficient.value=.004;
  sky.material.uniforms.mieDirectionalG.value=.78;
  const gradient=new T.Mesh(new T.SphereGeometry(1050,32,16),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,toneMapped:false,
    uniforms:{horizon:{value:new T.Color(0xd7ecf1)},skyBlue:{value:new T.Color(0x369bef)}},
    vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w;}`,
    fragmentShader:`varying vec3 direction;uniform vec3 horizon;uniform vec3 skyBlue;
      void main(){float altitude=normalize(direction).y;float t=1.-exp(-5.5*max(altitude+.018,0.));
        gl_FragColor=vec4(mix(horizon,skyBlue,t),1.);
        #include <colorspace_fragment>
      }`
  }));
  gradient.renderOrder=-10;scene.add(gradient);scene.background=null;

  const windows=[],materials=new Set();
  model.root.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);});
  for(const material of materials) {
    if(!material.name.includes('daytime stone and recessed glazing')||!material.metalnessMap)continue;
    // Glazing rectangles registered to the supplied four-storey facade tile.
    // Light the upper panes only; balcony railings, mullions and stone do not emit.
    const source=material.metalnessMap,canvas=document.createElement('canvas');
    canvas.width=source.image.width;canvas.height=source.image.height;
    const context=canvas.getContext('2d');context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);
    const sx=canvas.width/512,sy=canvas.height/1024;
    for(let floor=0;floor<4;floor++)for(const [x,width] of [[46,32],[87,43],[247,49],[306,73]]) {
      const y=floor*256+19;
      context.fillStyle='#b9b9b9';context.fillRect(x*sx,y*sy,width*sx,81*sy);
      context.fillStyle='#fff';context.fillRect((x+1)*sx,(y+1)*sy,(width-2)*sx,79*sy);
    }
    const texture=source.clone();texture.source=new T.Source(canvas);texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;
    material.emissive.set(0xffd69a);material.emissiveMap=texture;material.emissiveIntensity=0;
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
        vec2 room=floor(vEmissiveMapUv*vec2(3.0,4.0));
        float occupancy=fract(sin(dot(room,vec2(127.1,311.7)))*43758.5453);
        totalEmissiveRadiance*=mix(.78,1.,fract(occupancy*17.));`);
    };
    material.customProgramCacheKey=()=> 'sun-city-glazing-lights-2';
    material.needsUpdate=true;windows.push(material);
  }

  const fixtures=new T.Group();fixtures.name='Landscape lighting';scene.add(fixtures);
  const glow=new T.MeshStandardMaterial({color:0xfff1cd,emissive:0xffca80,emissiveIntensity:0,roughness:.4});
  const metal=new T.MeshStandardMaterial({color:0x3b4038,roughness:.5,metalness:.55});
  const points=[];
  for(const landmark of [LANDMARKS.garden,LANDMARKS.club,LANDMARKS.pool]) {
    for(const dx of [-14,0,14])points.push([landmark.x+dx,landmark.z+8]);
  }
  const dummy=new T.Object3D();
  const stems=new T.InstancedMesh(new T.CylinderGeometry(.095,.13,1.25,6),metal,points.length);
  const bulbs=new T.InstancedMesh(new T.SphereGeometry(.21,8,5),glow,points.length);
  points.forEach(([x,z],i)=>{
    dummy.position.set(x,2,z);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);
    dummy.position.y=2.7;dummy.updateMatrix();bulbs.setMatrixAt(i,dummy.matrix);
  });
  fixtures.add(stems,bulbs);
  const lights=[LANDMARKS.garden,LANDMARKS.club,LANDMARKS.pool].map(point=>{
    const light=new T.PointLight(0xffd59a,0,42,2);light.position.set(point.x,5,point.z+7);fixtures.add(light);return light;
  });
  const uplights=[0,14,20].map(index=>{
    const bounds=new T.Box3().setFromObject(model.towers[index]),center=bounds.getCenter(new T.Vector3());
    const light=new T.SpotLight(0xffd6a3,0,135,.55,.85,2);
    light.position.set(center.x,3,bounds.max.z+12);
    light.target.position.set(center.x,center.y+8,center.z);
    fixtures.add(light,light.target);return light;
  });
  const environmentCache=new Map(),generator=new T.PMREMGenerator(renderer);
  function set(name) {
    const p=LIGHTING_PRESETS[name];if(!p)return;
    sun.position.set(...p.sun);sun.color.set(p.color);sun.intensity=p.sunPower;
    ambient.intensity=p.ambient;ambient.color.set(name==='day'?0xe2f1ff:name==='evening'?0xd9c1b5:0xe3e9f2);
    ambient.groundColor.set(name==='day'?0x6b7256:name==='night'?0x25394b:0x778369);
    fill.intensity=p.fill;fill.color.set(name==='day'?0xd6eaff:name==='evening'?0xffd09a:0xc3d7ff);
    fill.position.set(...(name==='evening'?[130,85,180]:[100,100,-200]));
    renderer.toneMappingExposure=p.exposure;scene.fog.color.set(p.fog);scene.fog.density=p.density;
    const uniforms=sky.material.uniforms;
    uniforms.sunPosition.value.copy(sun.position).normalize();uniforms.turbidity.value=p.turbidity;uniforms.rayleigh.value=p.rayleigh;
    sky.visible=name==='evening';gradient.visible=name!=='evening';
    gradient.material.uniforms.horizon.value.set(name==='day'?0xd7ecf1:0x1b2d46);
    gradient.material.uniforms.skyBlue.value.set(name==='day'?0x369bef:0x040a19);
    if(name==='day')scene.environment=originalEnvironment;
    else {
      if(!environmentCache.has(name)) {
        const backdrop=new T.Scene();
        if(name==='night')backdrop.background=new T.Color(0x23314d);else backdrop.add(sky.clone());
        environmentCache.set(name,generator.fromScene(backdrop,.035,.1,1800));
      }
      scene.environment=environmentCache.get(name).texture;
    }
    scene.environmentIntensity=p.environment;
    for(const material of windows)material.emissiveIntensity=p.windows;
    glow.emissiveIntensity=p.lamps*3.5;
    for(const light of lights)light.intensity=1700*p.lamps;
    for(const light of uplights)light.intensity=8000*p.lamps;
    document.querySelectorAll('button[data-lighting]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lighting===name)));
    const canvas=document.querySelector('#scene');canvas.dataset.lighting=name;canvas.dataset.windowLighting=String(p.windows>0);
    document.querySelector('#viewer').dataset.lighting=name;
    renderer.shadowMap.needsUpdate=true;
    document.dispatchEvent(new CustomEvent('architectural-lighting-change',{detail:{name,...p,environment:scene.environment}}));
    announce(name==='day'?'Morning':name==='evening'?'Evening · sunset and warm lights':'Night · illuminated residences and gardens');
    invalidate();
  }
  return {set};
}
