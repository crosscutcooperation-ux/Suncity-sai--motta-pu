import * as THREE from './vendor/three.module.js';

export function addCommercialPodium(land) {
  const group = new THREE.Group();
  group.name = 'Commercial podium and sports deck';
  group.userData = {amenityId:'retail', label:'Commercial podium', approximate:true};
  const stone = new THREE.MeshStandardMaterial({color:0xc8bba4, roughness:.8});
  const trim = new THREE.MeshStandardMaterial({color:0xe2d7c0, roughness:.75});
  const glass = new THREE.MeshStandardMaterial({color:0x39464a, roughness:.22, metalness:.25});
  const box = (name,w,h,d,x,y,z,mat) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    mesh.name=name;
    mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
  };
  box('Continuous commercial podium',13,2.6,145,-52,1.8,29,stone);
  box('Sports terrace coping',13.7,.25,145.5,-52,3.2,29,trim);
  for(let z=-40;z<99;z+=5.4) {
    box('Recessed shopfront',.08,1.82,4.4,-58.55,1.63,z,glass);
    box('Stone shop pier',.6,2.55,.3,-58.8,1.8,z-2.52,trim);
    box('Shop transom',.16,.10,4.4,-58.66,2.02,z,trim);
    box('Shop mullion',.17,1.8,.07,-58.67,1.63,z,trim);
    box('Signage fascia',.25,.32,4.6,-58.8,2.9,z,stone);
  }
  land.add(group);
}
