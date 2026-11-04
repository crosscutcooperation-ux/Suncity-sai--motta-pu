import * as THREE from './vendor/three.module.js';

const groups = [
  ['township','Whole township',null],
  ['entrance','Entrance pair',[1,2]],
  ['north-court','North garden wings',[3,4,5,6,7,8]],
  ['south-court','South garden wings',[9,10,11,12,13,14]],
  ['plaza','Circular plaza wings',[17,18]],
  ['east-court','East garden wings',[19,20,21,22,23,24,25,26]]
];
const directions = {
  top: [0,1,.0001],
  front: [0,.0001,1],
  side: [1,.0001,0],
  angle: [-.9,.63,1.25]
};

export function createTowerProfiles({model, camera, controls, canvas, prepare, invalidate}) {
  const panel = document.getElementById('tower-profiles');
  const select = panel.querySelector('select');
  const readout = panel.querySelector('output');
  const projection = new THREE.OrthographicCamera(-1,1,1,-1,.1,6000);
  let current = '', projected = false;
  const buildings = model.towers;
  const opt = (label,value) => new Option(label,value);
  for (const [id,label] of groups) select.add(opt(label,id));
  const individual = document.createElement('optgroup');
  individual.label = 'Individual towers';
  buildings.forEach(tower => individual.append(opt(tower.name,tower.userData.towerId)));
  select.append(individual);

  function present(view) {
    prepare();
    const choice = groups.find(([key]) => key === select.value);
    const selected = buildings.filter((tower,i) => choice
      ? !choice[2] || choice[2].includes(i+1) : tower.userData.towerId === select.value);
    buildings.forEach(tower => { tower.visible = selected.includes(tower); });
    model.land.visible = select.value === 'township';
    const bounds = new THREE.Box3();
    for (const tower of selected) bounds.expandByObject(tower);
    if (select.value === 'township') {
      bounds.expandByPoint(new THREE.Vector3(-112,0,-114));
      bounds.expandByPoint(new THREE.Vector3(235,0,111));
    }
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const aspect = Math.max(.15,canvas.clientWidth / Math.max(1,canvas.clientHeight));
    const span = view === 'top' ? Math.max(size.z,size.x/aspect) :
      view === 'front' ? Math.max(size.y,size.x/aspect) :
      view === 'side' ? Math.max(size.y,size.z/aspect) :
      Math.max(size.y,Math.hypot(size.x,size.z)/aspect,size.z*.72);
    const distance = Math.max(22,span*1.22/(2*Math.tan(THREE.MathUtils.degToRad(42)/2)));
    camera.fov = 42;
    camera.updateProjectionMatrix();
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI/2;
    controls.minDistance = view === 'top' ? 4 : 14;
    controls.maxDistance = Math.max(740,distance*1.5);
    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(new THREE.Vector3(...directions[view]).normalize(),distance);
    camera.lookAt(center);
    controls.update();
    current = view;
    projected = view !== 'angle';
    for (const button of panel.querySelectorAll('[data-profile]')) button.setAttribute('aria-pressed', String(button.dataset.profile === view));
    const caption = select.selectedOptions[0]?.textContent + ' · ' + panel.querySelector('[data-profile="'+view+'"]').textContent;
    readout.textContent = caption;
    document.getElementById('view-name').textContent = caption;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed','false'));
    invalidate();
  }
  select.onchange = () => present(current || 'angle');
  panel.querySelectorAll('[data-profile]').forEach(button => { button.onclick = () => present(button.dataset.profile); });
  function clear() {
    if (!current) return;
    current = '';
    projected = false;
    buildings.forEach(tower => { tower.visible = true; });
    model.land.visible = true;
    controls.maxPolarAngle = Math.PI/2-.015;
    controls.minDistance = 25;
    controls.maxDistance = 740;
    select.value = 'township';
    readout.textContent = '';
    panel.querySelectorAll('[data-profile]').forEach(button=>button.setAttribute('aria-pressed','false'));
  }
  function viewCamera() {
    if (!projected) return camera;
    const half = camera.position.distanceTo(controls.target)*Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5);
    projection.left = -half*camera.aspect;
    projection.right = half*camera.aspect;
    projection.top = half;
    projection.bottom = -half;
    projection.position.copy(camera.position);
    projection.quaternion.copy(camera.quaternion);
    projection.updateProjectionMatrix();
    projection.updateMatrixWorld();
    return projection;
  }
  return {clear,viewCamera,present,get active(){return !!current;}};
}
