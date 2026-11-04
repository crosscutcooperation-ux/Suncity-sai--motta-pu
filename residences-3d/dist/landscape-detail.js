import * as THREE from './vendor/three.module.js';

function instances(parent, name, geometry, material, transforms) {
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const transform = new THREE.Object3D();
  transforms.forEach(({position, scale, rotation}, index) => {
    transform.position.set(...position);
    transform.scale.set(...scale);
    transform.rotation.set(0, rotation, 0);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function palmFrond() {
  const positions = [], indices = [];
  // A curved midrib with separate tapered leaflets casts a feathered shadow.
  const center = t => [t * 3.8, Math.sin(t * Math.PI) * .85 - t * .75, 0];
  const addLeaflet = (t, side) => {
    const p = center(t), width = Math.sin(t * Math.PI) * .70;
    const i = positions.length / 3;
    positions.push(...p, p[0] - .22, p[1] - .08, side * width, p[0] + .18, p[1] - .12, side * width * .92);
    indices.push(i, i+1, i+2);
  };
  for (let i = 1; i < 23; i++) {
    addLeaflet(i/24, -1);
    addLeaflet(i/24, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function addLandscapeDetail(parent, crowns, palms, canopyTexture) {
  const fronds = [];
  palms.forEach(([x,y,z], index) => {
    for (let branch=0; branch<9; branch++) {
      fronds.push({position:[x,y+3.5,z], scale:[1,1,1], rotation:branch*Math.PI*2/9+index*.27});
    }
  });
  const palmMaterial = new THREE.MeshStandardMaterial({color:0x456543, roughness:.9, side:THREE.DoubleSide});
  palmMaterial.name = 'Sun City | feathered palm foliage';
  instances(parent, 'Curved feathered palm fronds', palmFrond(), palmMaterial, fronds);

  const sprays = [];
  crowns.forEach(([x,y,z,w,h,d], index) => {
    for (let side=0; side<3; side++) {
      sprays.push({position:[x,y-.35,z], scale:[w*2.1,h*1.9,d*2.1], rotation:index*.73+side*Math.PI/3});
    }
  });
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color:0xc4d0b8, map:canopyTexture ?? null, roughness:1, alphaTest:.44, side:THREE.DoubleSide,
  });
  canopyMaterial.name = 'Sun City | photographic tree foliage';
  instances(parent, 'Layered photographic tree canopies', new THREE.PlaneGeometry(1,1), canopyMaterial, sprays);
}
