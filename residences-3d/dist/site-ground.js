import * as THREE from './vendor/three.module.js';
import {toSite} from './site-data.js';

// Pixel coordinates in the north-up, 2376 × 1188 brochure master layout.
const perimeter = [
  [889,439],[937,386],[1037,352],[1061,303],[1091,326],[1158,311],[1220,271],
  [1255,246],[1284,247],[1302,265],[1324,329],[1380,373],[1434,398],[1500,383],
  [1546,378],[1580,361],[1605,326],[1603,275],[1586,177],[1718,164],[1845,156],
  [1904,186],[1989,270],[2040,323],[2127,285],[2321,321],[2324,420],
  [2152,422],[2134,480],[2010,491],[1920,500],[1892,556],[1883,602],[1946,606],
  [1912,633],[1831,642],[1790,665],[1868,700],[1903,739],[1848,791],[1753,835],
  [1712,878],[1580,872],[1564,922],[1550,1036],[1423,1048],[1398,1086],
  [1296,1072],[1237,1091],[1170,1052],[1085,1041],[1056,1073],[1001,1065],
  [1010,955],[1005,863],[977,820],[951,680]
];
const road = [[1060,303],[1091,321],[1100,386],[1091,997],[1084,1020],[1059,1071],[1001,1065],[1011,997],[1026,820],[1035,549],[1039,350]];
const lawns = [
  [[1097,335],[1176,305],[1248,251],[1281,252],[1297,277],[1317,336],[1374,383],[1435,407],[1433,433],[1101,439]],
  [[1595,179],[1846,162],[1897,190],[2027,321],[1931,323],[1882,293],[1792,294],[1787,376],[1610,375],[1630,322]],
  [[2157,316],[2306,328],[2307,400],[2155,401]],
  [[1800,681],[1888,743],[1845,780],[1745,832],[1758,805],[1770,754]],
  [[1170,938],[1494,933],[1494,1002],[1169,1001]]
];
const stone = new THREE.MeshStandardMaterial({color:0xd5c7b1,roughness:.91});
const grass = new THREE.MeshStandardMaterial({color:0x819260,roughness:.99});
const bed = new THREE.MeshStandardMaterial({color:0x647949,roughness:.99});
const asphalt = new THREE.MeshStandardMaterial({color:0x656467,roughness:.96});
const lane = new THREE.MeshStandardMaterial({color:0xd8cdae,roughness:1});
const water = new THREE.MeshStandardMaterial({color:0x51a3a6,metalness:.16,roughness:.26});
function polygon(host, pixels, level, mat, name) {
  const shape = new THREE.Shape();
  pixels.forEach(([px,py], i) => {
    const {x,z} = toSite(px,py);
    if (!i) shape.moveTo(x,-z);
    else shape.lineTo(x,-z);
  });
  shape.closePath();
  const obj = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  obj.name = name;
  obj.rotation.x = -Math.PI/2;
  obj.position.y = level;
  obj.receiveShadow = true;
  host.add(obj);
  return obj;
}
function rectangle(host, x,y,w,h, level, mat, name) {
  return polygon(host, [[x,y],[x+w,y],[x+w,y+h],[x,y+h]],level,mat,name);
}
function disk(host, px, py, radius, level, mat, name) {
  const pts = Array.from({length:72}, (_,i) => {
    const a = i * Math.PI / 36;
    return [px + Math.cos(a)*radius, py + Math.sin(a)*radius];
  });
  return polygon(host,pts,level,mat,name);
}
export function buildSiteGround(land) {
  polygon(land,perimeter,.56,stone,'Township footprint · brochure page 12');
  polygon(land,road,.62,asphalt,'Main entrance avenue');
  polygon(land,[[1040,1001],[1455,1009],[1432,1047],[1083,1039],[1058,1068],[1003,1065]],.63,asphalt,'Southern approach');
  polygon(land,[[2098,308],[2130,284],[2191,293],[2179,414],[2148,419],[2129,476],[1909,494],[1911,475],[2120,450]],.62,asphalt,'Eastern approach');
  for (const loop of lawns) polygon(land,loop,.64,grass,'Landscaped lawn');
  for (const [x,y,w,h] of [[1170,576,322,56],[1170,804,322,55],[1540,448,330,53]]) {
    rectangle(land,x,y,w,h,.67,bed,'Garden court');
    rectangle(land,x+5,y+6,w-10,h-12,.70,grass,'Garden court lawn');
    rectangle(land,x+8,y+h/2-2,w-16,4,.73,stone,'Garden court promenade');
  }
  // The circular plaza and its two flanking tower wings are the eastern arrival landmark.
  disk(land,1650,720,91,.68,stone,'Circular arrival plaza');
  disk(land,1650,720,64,.70,bed,'Plaza planting ring');
  disk(land,1650,720,59,.72,stone,'Promenade around fountain');
  disk(land,1650,720,37,.74,bed,'Central planting');
  disk(land,1650,720,26,.76,water,'Plaza water feature');
  for (let y=377; y<980; y+=30) rectangle(land,1067,y,1.2,12,.69,lane,'Avenue lane marking');
}
