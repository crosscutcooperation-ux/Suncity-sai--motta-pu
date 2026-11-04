import * as THREE from './vendor/three.module.js';
import {LANDMARKS} from './site-data.js';

export const amenities = {
  garden: {name:'Central gardens', point:LANDMARKS.garden, description:'The planted courts and promenades between the residential wings.', walk:'garden'},
  club: {name:'Club Atlantis', point:LANDMARKS.club, description:'The stepped clubhouse on the north side of the garden wings.'},
  pool: {name:'Swimming pool terrace', point:LANDMARKS.pool, description:'The outdoor pool and deck beside Club Golden Dunes.', walk:'pool'},
  club2: {name:'Club Golden Dunes', point:LANDMARKS.club2, description:'The second clubhouse at the eastern end of the master plan.'},
  plaza: {name:'Circular arrival plaza', point:LANDMARKS.plaza, description:'The fountain court enclosed by the curved residential wings.'},
  retail: {name:'Commercial podium', point:{x:-52,z:29}, description:'A continuous commercial frontage and sports deck along the approach avenue. Shop divisions and heights are estimated.'},
  sports: {name:'Sports avenue', point:{x:-52,z:20}, description:'The sequence of outdoor courts along the entrance avenue.'}
};

// Preserve actual selectable meshes as named objects in both the browser scene and exported model.
export function groupAmenities(land) {
  const groups = {};
  for (const [key, info] of Object.entries(amenities)) {
    const group = new THREE.Group();
    group.name = info.name;
    group.userData = {amenityId:key, label:info.name};
    groups[key] = group;
  }
  for (const object of [...land.children]) {
    if (object.isInstancedMesh || object.userData.amenityId) continue;
    const n = object.name.toLowerCase();
    const {x,z} = object.position;
    let key;
    if (n === 'club atlantis') key = 'club';
    else if (n === 'club golden dunes') key = 'club2';
    else if (/swimming pool|pool terrace/.test(n)) key = 'pool';
    else if (/plaza|central planting/.test(n)) key = 'plaza';
    else if (/garden court/.test(n)) key = 'garden';
    else if (object.isMesh && Math.abs(x-LANDMARKS.pool.x)<19 && Math.abs(z-LANDMARKS.pool.z)<13) key = 'pool';
    else if (object.isMesh && Math.hypot(x-LANDMARKS.plaza.x,z-LANDMARKS.plaza.z)<3) key = 'plaza';
    else if ((object.isMesh || object.isLine) && Math.abs(x+52)<6 && z>=-35 && z<=94 && object.position.y>.8) key = 'sports';
    else if (object.isMesh && x>-51 && x<42 && [-6,49].some(row=>Math.abs(z-row)<9) && object.position.y>.8) key = 'garden';
    if (key) groups[key].add(object);
  }
  for (const group of Object.values(groups)) if (group.children.length) land.add(group);
}
