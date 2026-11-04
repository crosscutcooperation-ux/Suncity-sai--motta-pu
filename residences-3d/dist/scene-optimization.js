import * as T from './vendor/three.module.js';

import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';

// Merge small static pieces by material, while retaining tower groups and
// instancing. Selection uses a separate low-poly picking scene.
export function mergeStaticPieces(group){
  group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),buckets=new Map();
  for(const amenity of group.children.filter(child=>child.userData.amenityId))mergeStaticPieces(amenity);
  group.traverse(o=>{for(let parent=o.parent;parent&&parent!==group;parent=parent.parent)if(parent.userData.amenityId)return;if(!o.isMesh||o.isInstancedMesh||Array.isArray(o.material)||o.material.transparent||o.name==='Plan-shaped facade with projecting wings and recessed courts')return;const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow+':'+!!o.userData.nearDetail;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);});
  for(const items of buckets.values()){
    if(items.length<2)continue;const geometries=[];
    for(const o of items){let g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);geometries.push(g);}
    const merged=mergeGeometries(geometries,false);for(const g of geometries)g.dispose();if(!merged)continue;merged.computeBoundingSphere();const mesh=new T.Mesh(merged,items[0].material);mesh.name='Batched static architecture';mesh.userData={...items[0].userData};mesh.castShadow=items[0].castShadow;mesh.receiveShadow=items[0].receiveShadow;group.add(mesh);items.forEach(o=>o.removeFromParent());
  }
}
