import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {BUILDINGS} from '../dist/site-data.js';
import {resolvePlan} from '../dist/floor-plan-data.js';
import {buildSite} from '../dist/model.js';
import {TOUR_ROUTES,ZONES,isWalkable,findWalkPath} from '../dist/walk-navigation.js';
const json=async name=>JSON.parse(await readFile(new URL('../dist/assets/'+name,import.meta.url),'utf8'));
assert.equal(BUILDINGS.length,26);assert.equal(new Set(BUILDINGS.map(b=>b.id)).size,26);
for(const b of BUILDINGS){
 assert.equal(b.floors,32);assert.equal(resolvePlan(b.id,0).available,false);assert.equal(resolvePlan(b.id,33).available,false);
 for(const floor of [1,9,32]){const p=resolvePlan(b.id,floor);assert.equal(p.available,b.number<=16);if(p.available){assert.equal(p.verified,false);assert.equal(p.page,b.page);}}
}
let count=0;
for(const group of ['carina-vega','coral-group','opal-group']){
 const floorGlb=await readFile(new URL('../dist/assets/plans/'+group+'.glb',import.meta.url));assert.equal(floorGlb.subarray(0,4).toString(),'glTF');
 await access(new URL('../dist/assets/plans/'+group+'-furnished.webp',import.meta.url));
 await access(new URL('../dist/assets/plans/'+group+'-photoreal.webp',import.meta.url));
 const manifest=await json('plans/'+group+'-units.json');assert.equal(manifest.units.length,8);assert.equal(new Set(manifest.units.map(u=>u.id)).size,8);
 for(const unit of manifest.units){
  const data=await json('plans/'+unit.key+'.json');assert.ok(data.walls.length&&data.footprint.length);assert.ok(data.furniture.some(f=>f.kind==='bed'));assert.equal(unit.renderPair,unit.key);
  assert.equal(unit.renderPhoto,unit.key+'-photoreal.webp');await access(new URL('../dist/assets/plans/'+unit.renderPhoto,import.meta.url));
  const glb=await readFile(new URL('../dist/assets/plans/'+unit.key+'.glb',import.meta.url));assert.equal(glb.subarray(0,4).toString(),'glTF');
  for(const suffix of ['-flat.webp','-furnished.webp','-2d.png'])await access(new URL('../dist/assets/plans/'+unit.key+suffix,import.meta.url));count++;
 }
}
const shapes=await json('tower-shapes.json'),model=buildSite(shapes);assert.equal(model.towers.length,26);
for(const [zone,route]of Object.entries(TOUR_ROUTES)){
 for(const [x,z]of route)assert.ok(isWalkable(zone,x,z,model.walkObstacles),`${zone} blocked waypoint ${x},${z}`);
 for(let i=1;i<route.length;i++){
  const start={x:route[i-1][0],z:route[i-1][1]},end={x:route[i][0],z:route[i][1]},path=findWalkPath(zone,start,end,model.walkObstacles);assert.ok(path.length,`${zone} unreachable leg ${i}`);
  let from=start;for(const next of path){const n=Math.ceil(Math.hypot(next.x-from.x,next.z-from.z)/.12);for(let k=0;k<=n;k++){const t=k/Math.max(n,1);assert.ok(isWalkable(zone,from.x+(next.x-from.x)*t,from.z+(next.z-from.z)*t,model.walkObstacles));}from=next;}
 }
 assert.equal(isWalkable(zone,ZONES[zone].bounds[0]-2,0),false);
}
assert.equal(isWalkable('pool',156,-62.4),false);assert.equal(isWalkable('garden',-7.2,-6),false);
console.log(`Verified 26 towers, honest plan availability, 3 complete furnished floor models, ${count} furnished apartment assets, and collision-free guided walking routes.`);
