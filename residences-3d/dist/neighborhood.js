import * as THREE from './vendor/three.module.js';
import {OrbitControls} from './vendor/OrbitControls.js';
import {BUILDINGS} from './site-data.js';

const ASSETS = './assets/neighborhood/';
const GOOGLE_PIN = 'https://www.google.com/maps/search/?api=1&query=19.088846,73.110424';
const SATELLITE = 'https://registry.opendata.aws/sentinel-2-l2a-cogs/';
const TERRAIN = 'https://registry.opendata.aws/terrain-tiles/';
const OSM = 'https://www.openstreetmap.org/copyright';

function surface(data) {
  const {extent:[left,top,right,bottom],n,heights}=data;
  return (x,z)=>{
    const u=THREE.MathUtils.clamp((x-left)/(right-left)*(n-1),0,n-1.0001);
    const v=THREE.MathUtils.clamp((z-top)/(bottom-top)*(n-1),0,n-1.0001);
    const col=Math.floor(u), row=Math.floor(v), k=row*n+col;
    const h0=THREE.MathUtils.lerp(heights[k],heights[k+1],u-col);
    const h1=THREE.MathUtils.lerp(heights[k+n],heights[k+n+1],u-col);
    return THREE.MathUtils.lerp(h0,h1,v-row);
  };
}

function drawTerrain(scene,data,texture){
  const [left,top,right,bottom]=data.extent;
  const mesh=new THREE.PlaneGeometry(right-left,bottom-top,data.n-1,data.n-1);
  mesh.rotateX(-Math.PI/2);
  const pos=mesh.attributes.position;
  for(let i=0;i<pos.count;i++) pos.setXYZ(i,pos.getX(i)+(right+left)/2,data.heights[i],pos.getZ(i)+(bottom+top)/2);
  mesh.computeVertexNormals();
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  scene.add(new THREE.Mesh(mesh,new THREE.MeshStandardMaterial({map:texture,roughness:1})));
}

function drawBuildings(scene,buildings,ground){
  const vertices=[], colors=[];
  function tri(a,b,c,tint){vertices.push(...a,...b,...c);for(let i=0;i<3;i++)colors.push(tint.r,tint.g,tint.b);}
  const roof=new THREE.Color(0xdfd1b9),side=new THREE.Color(0xa79a85);
  for(const [height,, ,points] of buildings){
    const ring=[];for(let i=0;i<points.length;i+=2)ring.push(new THREE.Vector2(points[i],points[i+1]));
    if(ring.length<3)continue;
    const y=Math.max(...ring.map(p=>ground(p.x,p.y)))+1;
    const xyz=(p,h)=>[p.x,h,p.y];
    for(const [a,b,c] of THREE.ShapeUtils.triangulateShape(ring,[]))tri(xyz(ring[a],y+height),xyz(ring[c],y+height),xyz(ring[b],y+height),roof);
    ring.forEach((p,i)=>{const q=ring[(i+1)%ring.length],a=xyz(p,ground(p.x,p.y)),b=xyz(q,ground(q.x,q.y)),c=xyz(q,y+height),d=xyz(p,y+height);tri(a,c,b,side);tri(a,d,c,side);});
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();
  const massing=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1}));
  scene.add(massing);
  return massing;
}

function ribbons(scene,features,height,settings){
  const vertices=[], colors=[];
  for(const [kind,,coords] of features){
    const [width,color,lift]=settings(kind),c=new THREE.Color(color);
    for(let i=2;i<coords.length;i+=2){
      const x1=coords[i-2],z1=coords[i-1],x2=coords[i],z2=coords[i+1];
      const dx=x2-x1,dz=z2-z1,d=Math.hypot(dx,dz);if(d<1)continue;
      const ox=-dz/d*width/2,oz=dx/d*width/2,steps=Math.ceil(d/35);
      for(let s=0;s<steps;s++){
        const a=x1+dx*s/steps,b=z1+dz*s/steps,e=x1+dx*(s+1)/steps,f=z1+dz*(s+1)/steps;
        const corners=[[a+ox,height(a+ox,b+oz)+lift,b+oz],[a-ox,height(a-ox,b-oz)+lift,b-oz],[e+ox,height(e+ox,f+oz)+lift,f+oz],[e-ox,height(e-ox,f-oz)+lift,f-oz]];
        for(const k of [0,1,2,1,3,2]){vertices.push(...corners[k]);colors.push(c.r,c.g,c.b);}
      }
    }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1})));
}

function projectSilhouette(scene,height){
  const group=new THREE.Group();
  const wall=new THREE.MeshStandardMaterial({color:0xf4e5c5}),green=new THREE.MeshStandardMaterial({color:0x627c64});
  const block=new THREE.BoxGeometry(31,99,18),crown=new THREE.SphereGeometry(5.2,10,6,0,Math.PI*2,0,Math.PI/2);
  for(const b of BUILDINGS){
    const base=height(b.x,b.z);
    const tower=new THREE.Mesh(block,wall);tower.position.set(b.x,base+49.5,b.z);tower.rotation.y=b.rotation;group.add(tower);
    const dome=new THREE.Mesh(crown,green);dome.position.set(b.x,base+99,b.z);group.add(dome);
  }
  scene.add(group);
}

function element(tag,cls,parent,text){
  const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;parent.append(el);return el;
}

export async function mountNeighborhood(container){
  const root=element('div','ssc-neighborhood',container);
  const header=element('div','ssc-map-heading',root);
  element('div','ssc-map-eyebrow',header,'LOCATION ATLAS  /  NAVI MUMBAI');
  element('h2','',header,'Ghot & Taloja');
  const canvasHost=element('div','ssc-map-stage',root);
  const status=element('span','ssc-map-loading',canvasHost,'Loading the neighborhood…');
  const footer=element('div','ssc-map-sources',root);
  footer.innerHTML='<a href="'+OSM+'" target="_blank" rel="noopener">© OpenStreetMap contributors</a> · <a href="'+SATELLITE+'" target="_blank" rel="noopener">Modified Copernicus Sentinel data 2026</a> · <a href="'+TERRAIN+'" target="_blank" rel="noopener">Terrain via Mapzen</a>';
  const sources=element('details','ssc-map-notes',root);
  element('summary','',sources,'Map notes');
  const sourceNote=element('div','',sources);
  sourceNote.innerHTML='<strong>Ghot, Panvel · 5.2 × 4.3 km</strong><p>Satellite imagery was acquired on 19 March 2026. Roads, tracks, watercourses and building outlines follow OpenStreetMap. Most neighboring building heights are estimated. The township silhouette uses the brochure layout at the Phase I filing pin.</p><a href="./assets/neighborhood/sources.html" target="_blank" rel="noopener">Sources &amp; data ↗</a>';
  const [map,dem,texture]=await Promise.all([
    ...['map.json','terrain.json'].map(async p=>{const response=await fetch(ASSETS+p);if(!response.ok)throw new Error('Neighborhood asset unavailable');return response.json();}),
    new THREE.TextureLoader().loadAsync(ASSETS+'satellite.webp?v=full-coverage')
  ]);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setClearColor(0xe2e8e3);
  canvasHost.prepend(renderer.domElement);status.remove();
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,2,18000);
  scene.fog=new THREE.Fog(0xe2e8e3,7000,14000);
  scene.add(new THREE.HemisphereLight(0xfff7e7,0x9ca48c,2.0));
  const sunlight=new THREE.DirectionalLight(0xfff4df,2.1);sunlight.position.set(-3500,5000,-2500);scene.add(sunlight);
  const ground=surface(dem);drawTerrain(scene,dem,texture);
  const massing=drawBuildings(scene,map.buildings,ground);
  ribbons(scene,map.waterways,ground,k=>[k==='river'?19:5,0x669899,1.1]);
  ribbons(scene,map.roads,ground,k=>['tertiary','secondary','primary','trunk'].includes(k)?[11,0xdfd2ae,1.6]:[5,0xb5aea2,1.35]);
  ribbons(scene,map.rail,ground,k=>[k==='subway'?8:5,k==='subway'?0x437768:0x61584f,k==='subway'?9:2.5]);
  projectSilhouette(scene,ground);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.maxPolarAngle=Math.PI*.455;controls.minDistance=230;controls.maxDistance=6500;
  controls.enableDamping=true;controls.dampingFactor=.14;
  const markerLayer=element('div','ssc-map-labels',canvasHost),places=[{id:'site',name:'Sai Sun City',kind:'Township · Phase I pin',xy:[0,0]},...map.places];
  const projected=new THREE.Vector3(),markers=[];
  const strip=element('div','ssc-map-tools',root),view=element('select','',strip);
  view.setAttribute('aria-label','Focus neighborhood location');
  const overview=document.createElement('option');overview.value='overview';overview.textContent='Neighborhood overview';view.append(overview);
  const info=element('div','ssc-map-info',root),infoTitle=element('strong','',info),infoText=element('span','',info);
  function focus(id){
    view.value=id;
    const p=places.find(x=>x.id===id);
    const [x,z]=p?p.xy:[-310,350], y=ground(x,z),scale=p?1250:3500;
    controls.target.set(x,y,z);camera.position.set(x+scale*.13,y+scale*.84,z+scale*.7);controls.update();
    infoTitle.textContent=p?p.name:'Around Sai Sun City';
    const km=p?Math.hypot(...p.xy)/1000:0;
    infoText.textContent=p?(p.id==='site'?'Phase I filing pin. The 26-tower silhouette illustrates the brochure layout.':p.kind+' · '+km.toFixed(1)+' km straight-line from the project pin.'):'Mapped buildings, streets and rail over satellite terrain. Drag to orbit. Scroll to zoom.';
    markers.forEach(m=>m.el.classList.toggle('is-current',m.p.id===id));
  }
  places.forEach(p=>{
    const option=document.createElement('option');option.value=p.id;option.textContent=p.name;view.append(option);
    const marker=element('button','ssc-map-pin'+(p.id==='site'?' is-site':''),markerLayer,p.name);marker.type='button';
    marker.onclick=()=>focus(p.id);markers.push({p,el:marker});
  });
  view.onchange=()=>focus(view.value);
  const gmaps=element('a','ssc-google-link',strip,'Google Maps ↗');gmaps.href=GOOGLE_PIN;gmaps.target='_blank';gmaps.rel='noopener';
  const footprintToggle=element('button','ssc-map-toggle',strip,'Buildings');
  footprintToggle.type='button';footprintToggle.setAttribute('aria-pressed','true');
  footprintToggle.onclick=()=>{massing.visible=!massing.visible;footprintToggle.setAttribute('aria-pressed',String(massing.visible));};
  let active=true,frame=0,disposed=false;
  function draw(){
    frame=0;if(!active||disposed)return;controls.update();renderer.render(scene,camera);
    const w=canvasHost.clientWidth,h=canvasHost.clientHeight;
    const occupied=[];
    for(const {p,el} of markers){
      projected.set(p.xy[0],ground(...p.xy)+(p.id==='site'?135:33),p.xy[1]).project(camera);
      const x=(projected.x+1)*w/2,y=(1-projected.y)*h/2;
      const fits=x>46&&x<w-46&&y>16&&y<h-20&&projected.z<1&&projected.z>-1&&!occupied.some(a=>Math.abs(a[0]-x)<105&&Math.abs(a[1]-y)<31);
      el.hidden=!fits;if(fits){el.style.left=x+'px';el.style.top=y+'px';occupied.push([x,y]);}
    }
    frame=requestAnimationFrame(draw);
  }
  function resize(){const w=canvasHost.clientWidth,h=canvasHost.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  function setActive(value){active=value;if(active&&!frame){resize();draw();}if(!active){cancelAnimationFrame(frame);frame=0;}}
  const observer=new ResizeObserver(resize);observer.observe(canvasHost);
  focus('overview');resize();draw();
  return {resize,setActive,dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});texture.dispose();renderer.dispose();root.remove();}};
}

