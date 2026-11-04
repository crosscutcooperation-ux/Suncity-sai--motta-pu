import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {batchExteriorInstances} from '../dist/batch-exterior-instances.js';
import {optimizeExterior} from '../dist/optimize-exterior.js';

const root=new THREE.Group(),land=new THREE.Group(),a=new THREE.Group(),b=new THREE.Group();
root.add(land,a,b);a.userData.towerId='a';b.userData.towerId='b';
a.position.set(7,0,4);a.rotation.y=.4;b.position.set(-11,0,3);
const material=new THREE.MeshStandardMaterial(),geometry=new THREE.BoxGeometry();
const sources=[];
for(const owner of [a,b]) {
  const mesh=new THREE.InstancedMesh(geometry,material,2);
  mesh.position.y=3;
  mesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,0,0));
  mesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(2,1,0));
  owner.add(mesh);sources.push(mesh);
}
root.updateMatrixWorld(true);
const expected=[];
for(const source of sources)for(let i=0;i<2;i++) {
  const matrix=new THREE.Matrix4();source.getMatrixAt(i,matrix);
  expected.push(new THREE.Vector3().setFromMatrixPosition(matrix.premultiply(source.matrixWorld)));
}
const batches=batchExteriorInstances(root,[a,b],land);
const camera=new THREE.PerspectiveCamera();camera.position.set(0,30,30);
batches.update(camera);assert.equal(batches.batchCount,1);
assert.equal(batches.meshes[0].count,4);
for(let i=0;i<4;i++) {
  const matrix=new THREE.Matrix4();batches.meshes[0].getMatrixAt(i,matrix);
  assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(expected[i])<1e-5);
}
a.visible=false;batches.update(camera);assert.equal(batches.meshes[0].count,2);
a.visible=true;batches.select(a);batches.update(camera);
assert.equal(batches.meshes[0].count,2);assert.equal(sources[0].visible,true);assert.equal(sources[1].visible,false);
batches.select(null);batches.update(camera);assert.equal(batches.meshes[0].count,4);

const staticRoot=new THREE.Group(),staticLand=new THREE.Group(),owner=new THREE.Group();
staticRoot.add(staticLand,owner);owner.userData.towerId='static';owner.position.set(3,0,-4);
for(const x of [-2,2]){const mesh=new THREE.Mesh(geometry,material);mesh.position.x=x;owner.add(mesh);}
const before=new THREE.Box3().setFromObject(owner);
const result=optimizeExterior(staticRoot,staticLand);
assert.equal(result.removed,1);assert.equal(owner.children.length,1);
const after=new THREE.Box3().setFromObject(owner);
assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6);
console.log('Verified shared instance world transforms, tower isolation, selected tower restoration and unchanged static bounds.');
