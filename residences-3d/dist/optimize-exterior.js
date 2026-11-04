import * as THREE from './vendor/three.module.js';
import {mergeGeometries} from './vendor/addons/utils/BufferGeometryUtils.js';

// Batch within each selectable owner; never combine separate towers or amenities.
export function optimizeExterior(root, land) {
  root.updateMatrixWorld(true);
  const owners = new Map();
  function visit(object, owner) {
    if (object.userData.towerId || object.userData.amenityId) owner = object;
    if (object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh &&
        !Array.isArray(object.material) && !object.userData.nearDetail &&
        !object.name.startsWith('Plan-shaped') && !Object.keys(object.geometry.morphAttributes).length) {
      if (!owners.has(owner)) owners.set(owner, new Map());
      const geometry = object.geometry;
      const attributes = Object.entries(geometry.attributes).map(([key,value]) =>
        [key,value.itemSize,value.normalized,value.array.constructor.name].join(':')).sort().join('|');
      const key = [object.material.uuid,object.castShadow,object.receiveShadow,!!geometry.index,attributes].join('/');
      const batches = owners.get(owner);
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    }
    for (const child of object.children) visit(child, owner);
  }
  visit(root, land);
  let removed = 0;
  for (const [owner,batches] of owners) {
    const inverse = owner.matrixWorld.clone().invert();
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const pieces = meshes.map(mesh => {
        const matrix = new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
        const geometry = mesh.geometry.clone().applyMatrix4(matrix);
        if (matrix.determinant() < 0 && geometry.index) {
          const index = geometry.index;
          for (let i=0;i<index.count;i+=3) {
            const second=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,second);
          }
        }
        return geometry;
      });
      const geometry = mergeGeometries(pieces);
      for (const piece of pieces) piece.dispose();
      if (!geometry) continue;
      geometry.computeBoundingSphere();
      const merged = new THREE.Mesh(geometry,meshes[0].material);
      merged.name = 'Batched exterior details';
      merged.castShadow = meshes[0].castShadow;
      merged.receiveShadow = meshes[0].receiveShadow;
      merged.matrixAutoUpdate = false;
      owner.add(merged);
      for (const mesh of meshes) mesh.removeFromParent();
      removed += meshes.length-1;
    }
  }
  root.updateMatrixWorld(true);
  return {removed};
}
