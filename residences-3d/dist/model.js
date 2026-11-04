import {addCommercialPodium} from './commercial-podium.js';
import {addLandscapeDetail} from './landscape-detail.js';
import * as T from './vendor/three.module.js';
import {BUILDINGS,LANDMARKS,toSite} from './site-data.js';
import {buildSiteGround} from './site-ground.js';
import {groupAmenities} from './amenity-selection.js';
export const towerLayout=BUILDINGS;
export const places=[
 {id:'club',title:'Club Atlantis',pos:[LANDMARKS.club.x,4,LANDMARKS.club.z],text:'The stepped clubhouse, pool and terrace referenced in the Sun City brochure.'},
 {id:'sports',title:'Sports & movement',pos:[-53,1,20],text:'Tennis, futsal, cricket practice and outdoor recreation along the sports avenue.'},
 {id:'retail',title:'The arrival boulevard',pos:[-80,2,90],text:'A palm-lined entrance and commercial frontage beside the main approach.'},
];
const unit=new T.BoxGeometry(1,1,1),dummy=new T.Object3D();
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.83,...extra});
const m={stone:material(0xc5b399),trim:material(0xe8decb),recess:material(0x796f61),glass:material(0x536e72,{roughness:.27,metalness:.3}),green:material(0x72a598,{metalness:.22,roughness:.55}),grass:material(0x7e984c),hedge:material(0x3d6334),path:material(0xd8d0b9),road:material(0x858b88),water:material(0x42a9c0,{metalness:.3,roughness:.13}),wood:material(0xad8862),white:material(0xeee5d4)};
function box(g,w,h,d,x,y,z,mat=m.stone,name=''){const mesh=new T.Mesh(unit,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
function batch(g,list,mat,geo=unit,name=''){
 if(!list.length)return;const mesh=new T.InstancedMesh(geo,mat,list.length);mesh.name=name;
 list.forEach(([x,y,z,w=1,h=1,d=1,rot=0],i)=>{dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,rot,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;
}
function cylinder(g,r,h,x,y,z,mat=m.trim){const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,32),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;}
const floorPitch=2.85*.62, podium=4*.62, roofLevel=podium+32*floorPitch;
const roofStone=material(0xc4b59d), rose=material(0xac8880), patina=material(0x6baf9d,{roughness:.51,metalness:.28});
const railsMetal=material(0x594846,{roughness:.51,metalness:.48});
const wallPhoto=material(0xffffff,{roughness:.79});
const archProfile=new T.Shape();
archProfile.moveTo(-.5,0);archProfile.lineTo(-.40,0);archProfile.lineTo(-.40,.42);
archProfile.absellipse(0,.42,.40,.43,Math.PI,0,true);archProfile.lineTo(.40,0);
archProfile.lineTo(.5,0);archProfile.lineTo(.5,1);archProfile.lineTo(-.5,1);archProfile.closePath();
const arcadeBay=new T.ExtrudeGeometry(archProfile,{depth:.28,bevelEnabled:false,curveSegments:10});
wallPhoto.name='Sun City | registered balcony masonry';
m.grass.name='Sun City | landscape turf';m.road.name='Sun City | avenue asphalt';m.wood.name='Sun City | deck timber';
function polygonMesh(points,height,y,mat,name){
 const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
 const geometry=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});
 geometry.rotateX(-Math.PI/2);const mesh=new T.Mesh(geometry,mat);
 mesh.name=name;mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
const crownTemplates=new Map();
function crown(g,x,z,r=2.7){
 const key=r.toFixed(3);
 if(crownTemplates.has(key)){const copy=crownTemplates.get(key).clone();copy.position.set(x,roofLevel+.38,z);g.add(copy);return;}
 const y=roofLevel+.38, rise=r*1.10, pier=r*.84;
 const ribs=new T.Group();ribs.name='Open ribbed verdigris roof pavilion';
 ribs.position.set(x,y,z);g.add(ribs);
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8,pts=[];
  for(let j=0;j<=10;j++){
   const f=j/10,theta=f*Math.PI/2,rad=r*Math.cos(theta);
   pts.push(new T.Vector3(Math.cos(a)*rad,pier+rise*Math.sin(theta),Math.sin(a)*rad));
  }
  const rib=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),12,r*.063,5,false),patina);
  rib.castShadow=true;ribs.add(rib);
  if(i%4===2)cylinder(ribs,r*.066,pier,Math.cos(a)*r,pier/2,Math.sin(a)*r,rose);
  if(i%2===0){
   const peak=pier+rise;
   const tips=[new T.Vector3(0,peak,0),new T.Vector3(Math.cos(a)*r*.16,peak+r*.19,Math.sin(a)*r*.16),new T.Vector3(Math.cos(a)*r*.37,peak+r*.3,Math.sin(a)*r*.37)];
   const leaf=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tips),5,r*.052,4,false),m.trim);ribs.add(leaf);
  }
 }
 for(const angle of [0,.35,.62,.88,1.1,1.29]){
  const ring=new T.Mesh(new T.TorusGeometry(r*Math.cos(angle),r*.019,4,40),patina);
  ring.rotation.x=Math.PI/2;ring.position.y=pier+rise*Math.sin(angle);ribs.add(ring);
 }
 crownTemplates.set(key,ribs.clone());
}
// Roof wings traced in brochure page 12 image coordinates. Each side of the
// circular plaza has two splayed blocks separated by a pedestrian opening.
const plazaFootprints={
 18:[[[1542,646],[1563,629],[1589,615],[1595,623],[1591,612],[1622,600],[1642,598],[1646,633],[1635,640],[1611,648],[1596,656],[1562,679],[1555,666]],[[1661,607],[1670,604],[1700,619],[1720,642],[1714,651],[1726,644],[1747,664],[1753,684],[1722,702],[1707,682],[1695,667],[1673,650],[1653,639]]],
 17:[[[1542,792],[1555,774],[1563,751],[1596,773],[1610,782],[1638,787],[1646,796],[1642,833],[1614,826],[1594,819],[1589,810],[1579,818],[1558,805]],[[1656,796],[1676,777],[1694,766],[1706,750],[1721,730],[1747,744],[1753,747],[1741,777],[1728,793],[1714,789],[1718,799],[1698,812],[1671,824],[1662,826]]]
};
function simplified(points){
 const unique=points.filter((v,i)=>i===0||Math.hypot(v[0]-points[i-1][0],v[1]-points[i-1][1])>.09);
 let result=unique.slice();
 while(result.length>4){
  let best=Infinity,bestIndex=-1;
  for(let i=0;i<result.length;i++){
   const a=result[(i+result.length-1)%result.length],b=result[i],c=result[(i+1)%result.length];
   const dx=c[0]-a[0],dz=c[1]-a[1],len=dx*dx+dz*dz;
   const t=Math.max(0,Math.min(1,len?((b[0]-a[0])*dx+(b[1]-a[1])*dz)/len:0));
   const error=Math.hypot(b[0]-a[0]-t*dx,b[1]-a[1]-t*dz);if(error<best){best=error;bestIndex=i;}
  }
  if(best>.18)break;result.splice(bestIndex,1);
 }
 return result;
}
// The two eastern garden wings are joined rows. End towers 22 and 23 turn
// north and south respectively. Unlike the three named residential types,
// their published individual floor sheets are unavailable.
const eastRoofs={
 19:[[1547,401],[1570,401],[1570,396],[1594,396],[1594,402],[1652,402],[1652,446],[1602,446],[1602,442],[1588,442],[1588,446],[1547,446],[1547,435],[1562,435],[1562,431],[1547,431],[1547,421],[1561,421],[1561,416],[1547,416]],
 20:[[1652,402],[1690,402],[1690,397],[1716,397],[1716,402],[1758,402],[1758,446],[1722,446],[1722,442],[1694,442],[1694,446],[1652,446]],
 21:[[1758,402],[1793,402],[1793,396],[1812,396],[1812,404],[1832,404],[1832,418],[1870,418],[1870,446],[1821,446],[1821,441],[1800,441],[1800,446],[1758,446]],
 22:[[1818,315],[1832,315],[1832,320],[1855,320],[1855,315],[1867,315],[1867,344],[1871,344],[1871,367],[1866,367],[1866,418],[1832,418],[1832,404],[1817,404],[1817,386],[1822,386],[1822,374],[1817,374]],
 23:[[1830,535],[1868,535],[1868,577],[1871,577],[1871,596],[1867,596],[1867,634],[1850,634],[1850,628],[1831,628],[1831,634],[1818,634],[1818,598],[1824,598],[1824,581],[1818,581],[1818,556],[1830,556]],
 24:[[1758,506],[1795,506],[1795,501],[1820,501],[1820,506],[1868,506],[1868,521],[1855,521],[1855,525],[1868,525],[1868,535],[1830,535],[1830,556],[1816,556],[1816,550],[1794,550],[1794,554],[1758,554]],
 25:[[1652,506],[1691,506],[1691,501],[1717,501],[1717,506],[1758,506],[1758,554],[1722,554],[1722,550],[1694,550],[1694,554],[1652,554]],
 26:[[1547,506],[1587,506],[1587,501],[1601,501],[1601,506],[1652,506],[1652,554],[1602,554],[1602,550],[1588,550],[1588,554],[1547,554],[1547,543],[1561,543],[1561,539],[1547,539],[1547,527],[1561,527],[1561,524],[1547,524]]
};
function towerFootprints(building,data){
 const traced=plazaFootprints[building.number] || (eastRoofs[building.number] && [eastRoofs[building.number]]);
 if(traced)return traced.map(points=>points.map(([px,py])=>{const p=toSite(px,py);return [p.x-building.x,p.z-building.z];}));
 const points=data.outline.map(([x,y])=>[(x/data.width-.5)*building.width,(y/data.height-.5)*building.depth]);
 return [simplified(points)];
}
function facingWall(group,ring,mat){
 const pos=[],uv=[],idx=[];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const count=Math.max(1,Math.round(length/4.85)),j=pos.length/3;
  pos.push(a[0],podium,a[1],b[0],podium,b[1],b[0],roofLevel,b[1],a[0],roofLevel,a[1]);
  uv.push(0,0,count,0,count,8,0,8);idx.push(j,j+1,j+2,j,j+2,j+3);
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
 const mesh=new T.Mesh(geo,mat);mesh.name='Plan-shaped facade with projecting wings and recessed courts';
 mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
}
function buildWing(g,ring){
 // Always use a clockwise ring as viewed from above so normals face the street.
 const area=ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-b[0]*a[1];},0);
 if(area>0)ring.reverse();
 const fins=[],decks=[],handrails=[],parapets=[],glazing=[],arches=[];
 facingWall(g,ring,wallPhoto);
 g.add(polygonMesh(ring,.34,roofLevel,roofStone,'Stepped roof terrace follows the residential outline'));
 const centroid=ring.reduce(([x,z],p)=>[x+p[0]/ring.length,z+p[1]/ring.length],[0,0]);
 const base=ring.map(([x,z])=>[centroid[0]+(x-centroid[0])*.91,centroid[1]+(z-centroid[1])*.91]);
 g.add(polygonMesh(base,podium,0,m.recess,'Recessed entrance plinth'));
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  minX=Math.min(minX,a[0]);maxX=Math.max(maxX,a[0]);minZ=Math.min(minZ,a[1]);maxZ=Math.max(maxZ,a[1]);
  if(len<.24)continue;
  const nx=-dz/len,nz=dx/len,ang=-Math.atan2(dz,dx),cx=(a[0]+b[0])/2,cz=(a[1]+b[1])/2;
  parapets.push([cx,roofLevel+.51,cz,len,.38,.16,ang]);
  if(len<1.35)continue;
  const spans=Math.max(1,Math.round(len/3.5));
  for(let j=0;j<spans;j++){
   const f=(j+.035)/spans;
   fins.push([a[0]+dx*f+nx*.13,(roofLevel+podium)/2,a[1]+dz*f+nz*.13,.24,roofLevel-podium+.65,.38,ang]);
   const mid=(j+.5)/spans;
   arches.push([a[0]+dx*mid,0,a[1]+dz*mid,len/spans,podium,1,ang]);
  }
  for(let n=0;n<32;n++){
   const y=podium+n*floorPitch;
   decks.push([cx+nx*.2,y,cz+nz*.2,len,.105,.56,ang]);
   if(len>2.6){
    handrails.push([cx+nx*.40,y+.59,cz+nz*.40,len-.15,.055,.055,ang]);
    for(let k=0;k<spans;k++){
     const f=(k+.52)/spans;
     glazing.push([a[0]+dx*f+nx*.24,y+.37,a[1]+dz*f+nz*.24,len/spans*.51,.44,.045,ang]);
    }
   }
  }
 }
 batch(g,fins,m.trim,unit,'Full-height limestone pilasters');batch(g,parapets,m.trim,unit,'Roofline coping');batch(g,decks,m.stone,unit,'32 projecting balcony slab edges');
 batch(g,arches,m.stone,arcadeBay,'Open arched entrance galleries');
 const rails=batch(g,handrails,railsMetal,unit,'Balcony handrails');if(rails)rails.userData.nearDetail=true;
 const glass=batch(g,glazing,m.glass,unit,'Balcony glass panels');if(glass){glass.userData.nearDetail=true;glass.castShadow=false;}
 let cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const alongX=maxX-minX>=maxZ-minZ, length=alongX?maxX-minX:maxZ-minZ;
 crown(g,cx,cz,Math.min(3.1,length*.135));
 function inside(x,z){
  let odd=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
   const a=ring[i],b=ring[j];
   if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])odd=!odd;
  }
  return odd;
 }
 for(const sign of [-1,1]){
  let x=cx+(alongX?sign*length*.26:0),z=cz+(alongX?0:sign*length*.26);
  for(let step=0;step<24;step++){
   if([[-1.5,-1.2],[1.5,-1.2],[1.5,1.2],[-1.5,1.2]].every(([dx,dz])=>inside(x+dx,z+dz)))break;
   x+=(centroid[0]-x)*.15;z+=(centroid[1]-z)*.15;
  }
  if(inside(x,z)){box(g,2.75,1.5,2.15,x,roofLevel+1.1,z,m.stone,'Roof service housing');box(g,3,.17,2.4,x,roofLevel+1.93,z,m.trim,'Housing coping');}
 }
}
function createTower(b,shapeData){
 const g=new T.Group();g.name=b.name;g.position.set(b.x,1,b.z);g.rotation.y=b.number>=17?0:b.rotation;
 g.userData={towerId:b.id,name:b.name,floors:32,podiumHeight:podium,floorPitch,roofLevel,verticalScale:.62,source:'Supplied typical drawing or brochure master layout; exterior elevations inferred',approximate:true};
 for(const ring of towerFootprints(b,shapeData))buildWing(g,ring);
 return g;
}

export function buildSite(shapes,textures={}){
 if(textures.facade){textures.facade.wrapS=textures.facade.wrapT=T.RepeatWrapping;wallPhoto.map=textures.facade;} wallPhoto.side=T.DoubleSide;
 for(const [name,key,repeat] of [['grass','grass',[24,24]],['road','asphalt',[12,12]],['wood','wood',[8,8]]])if(textures[key]){const t=textures[key];t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(...repeat);m[name].map=t;m[name].color.set(0xffffff);}
 const root=new T.Group();root.name='Sai Sun City — reference-based architectural reconstruction';
 const towers=BUILDINGS.map(b=>{const g=createTower(b,shapes[b.layout]);root.add(g);return g;});
 const land=new T.Group();land.name='Gardens, avenues and clubhouses';root.add(land);const obstacles=[];
 buildSiteGround(land);
 const trunks=[],crowns=[],palms=[],leaves=[];let seed=0;const rnd=i=>{const x=Math.sin(i*71.23+2)*43758.5453;return x-Math.floor(x);};
 const tree=(x,z,s=1)=>{trunks.push([x,2*s,z,.3*s,3.5*s,.3*s]);crowns.push([x,4.5*s,z,2.3*s,3*s,2.2*s]);};
 const palm=(x,z)=>{palms.push([x,4.5,z,.22,7,.22]);for(let i=0;i<8;i++){const a=i*Math.PI/4;leaves.push([x+Math.cos(a)*1.3,8,z+Math.sin(a)*1.3,3.1,.1,.65,-a]);}};
 for(const b of BUILDINGS){box(land,30,.25,17,b.x,.85,b.z,m.path);for(const side of [-1,1])for(let k=-1;k<=1;k++)palm(b.x+k*7,b.z+side*9.2);}
 // Three long garden courts registered to the source master layout.
 for(const gy of [605,835]){
  const c=toSite(1320,gy);box(land,79,.3,15,c.x,1,c.z,m.hedge);box(land,76,.15,12,c.x,1.2,c.z,m.grass);
  for(const z of [c.z-5.3,c.z+5.3])box(land,76,.14,2.0,c.x,1.32,z,m.path);
  for(const x of [c.x-25,c.x,c.x+25]){
   box(land,2,.18,11,x,1.35,c.z,m.path);cylinder(land,2.1,.3,x,1.5,c.z);
   for(const side of [-1,1]){box(land,3,.4,.65,x+side*4,1.8,c.z,m.wood);obstacles.push({zone:'garden',x:x+side*4,z:c.z,w:3,d:.65});}
  }
  for(let x=c.x-35;x<c.x+38;x+=7){tree(x,c.z-8,.7);tree(x,c.z+8,.7);}
 }
 const garden=LANDMARKS.garden;cylinder(land,2,.3,garden.x,1.65,garden.z,m.water);cylinder(land,.28,2,garden.x,2.7,garden.z,m.trim);
 function clubhouse(p,label){
  const g=new T.Group();g.name=label;land.add(g);const {x,z}=p;
  for(let level=0;level<4;level++){const w=36-level*5,d=17-level*2,y=1.4+level*2.1;
   box(g,w,2.1,d,x+level*1.2,y,z,m.stone);
   box(g,w+.5,.2,d+.6,x+level*1.2,y+1.13,z,m.trim);
   box(g,w*.86,1.65,.15,x+level*1.2,y+.08,z+d/2+.1,m.glass);
   box(g,w*.7,.14,2,x+level*1.2,y+1.3,z+d/2-1,m.grass);
   for(let bay=-w*.4;bay<w*.42;bay+=2.6)box(g,.10,1.8,.2,x+level*1.2+bay,y+.08,z+d/2+.22,m.trim,'Clubhouse glazing mullion');
   box(g,w,.05,.07,x+level*1.2,y+1.8,z+d/2+.2,railsMetal,'Clubhouse terrace handrail');}
  return g;
 }
 clubhouse(LANDMARKS.club,'Club Atlantis');clubhouse(LANDMARKS.club2,'Club Golden Dunes');
 const {x:px,z:pz}=LANDMARKS.pool;
 box(land,36,1.1,24,px,1.1,pz,m.trim,'Pool terrace');box(land,34,.2,22,px,1.76,pz,m.wood);
 const poolWater=box(land,23,.18,10,px,1.91,pz,m.water,'Swimming pool');
 for(const side of [-1,1])for(let k=-2;k<=2;k++){box(land,1.2,.5,2.5,px+k*4,2.15,pz+side*8,m.white);obstacles.push({zone:'pool',x:px+k*4,z:pz+side*8,w:1.2,d:2.5});palm(px+k*5,pz+side*13);}
 addCommercialPodium(land);
 // Sports avenue beside the main drive, with fenced courts and visible markings.
 for(const [i,z]of [-25,-8,8,42,62,83].entries()){
  const x=-52;box(land,11,.2,14,x,3.5,z,i%2?m.green:material(0x689b6e));
  const pts=[[-5,-6],[5,-6],[5,6],[-5,6],[-5,-6]].map(([dx,dz])=>new T.Vector3(x+dx,3.65,z+dz));land.add(new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xffffff})));
  box(land,10,.07,.08,x,3.68,z,m.white);for(const dx of [-5.5,5.5])box(land,.09,3,14,x+dx,5,z,m.glass);
 }
 const plaza=LANDMARKS.plaza;cylinder(land,23,.3,plaza.x,1,plaza.z,m.trim);cylinder(land,14,.4,plaza.x,1.35,plaza.z,m.path);cylinder(land,7,.2,plaza.x,1.65,plaza.z,m.water);
 for(let i=0;i<16;i++){const a=i*Math.PI/8;palm(plaza.x+Math.cos(a)*20,plaza.z+Math.sin(a)*20);}
 for(let x=-100;x<198;x+=7){tree(x,-108,.8+rnd(seed++)*.4);tree(x,128,.8+rnd(seed++)*.4);}
 for(let z=-104;z<127;z+=7){tree(-106,z,.9);tree(199,z,.9);}
 for(let i=0;i<210;i++){const x=-260+rnd(i+3)*620,z=-230+rnd(i+600)*500;if(x>-110&&x<205&&z>-112&&z<132)continue;tree(x,z,1+rnd(i+700)*.8);}
 batch(land,trunks,material(0x826b4c),new T.CylinderGeometry(.7,1,1,6),'Tree trunks');batch(land,palms,material(0x977f58),new T.CylinderGeometry(.7,1,1,7),'Palm trunks');addLandscapeDetail(land,crowns,palms,textures.canopy);
 const context=new T.Group();context.name='Illustrative city blocks';const blocks=[];
 for(let i=0;i<55;i++){const x=-340+rnd(i+100)*740,z=-300+rnd(i+300)*630;if(x>-140&&x<230&&z>-145&&z<165)continue;let h=8+rnd(i+70)*35;blocks.push([x,h/2,z,9+rnd(i+71)*16,h,9+rnd(i+72)*12]);}
 batch(context,blocks,material(0xc7cbbd));context.visible=false;root.add(context);
 groupAmenities(land);
 return {root,towers,land,context,walkObstacles:obstacles,poolWater};
}
