import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/addons/loaders/GLTFLoader.js';
import {BUILDINGS} from './site-data.js';
import {optimizeExterior} from './optimize-exterior.js?v=fast-2';
import {batchExteriorInstances} from './batch-exterior-instances.js?v=fast-2';

export async function loadSunCityModel() {
  const [gltf, obstacles] = await Promise.all([
    new GLTFLoader().loadAsync('assets/sun-city-new.glb'),
    fetch('assets/sun-city-walk-obstacles.json').then(response => {
      if (!response.ok) throw new Error('Walking geometry unavailable');
      return response.json();
    })
  ]);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const byId = new Map();
  const amenities = [];
  root.traverse(object => {
    if (object.userData.towerId) byId.set(object.userData.towerId,object);
    if (object.userData.amenityId) amenities.push(object);
    if (object.isMesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = !object.userData.nearDetail && materials.some(material => !material.transparent);
      object.receiveShadow = true;
      // The exterior geometry is static; keep tower roots movable for selection.
      object.matrixAutoUpdate = false;
      for (const material of materials) {
        if (material.alphaTest > 0) material.alphaToCoverage = true;
        if (material.name.includes('daytime stone and recessed glazing')) {
          material.polygonOffset = true;
          material.polygonOffsetFactor = 1;
          material.polygonOffsetUnits = 1;
        }
        for (const key of ['map','roughnessMap','metalnessMap','normalMap']) {
          if (material[key]) material[key].anisotropy = 4;
        }
      }
    }
  });
  const towers = BUILDINGS.map(building => byId.get(building.id));
  if (towers.some(tower => !tower)) throw new Error('The updated model is missing a tower');
  // Keep world transforms while adapting the exported hierarchy to the viewer.
  for (const tower of towers) root.attach(tower);
  const remainder = root.children.filter(child => !towers.includes(child));
  const land = new THREE.Group();
  land.name = 'Updated Sun City landscaping and amenities';
  root.add(land);
  for (const child of remainder) land.attach(child);
  for (const amenity of amenities) land.attach(amenity);
  root.updateMatrixWorld(true);
  const optimization = optimizeExterior(root, land);
  const instanceBatches = batchExteriorInstances(root,towers,land);
  const qualityMaterials = [], lighterMaterials = new Map();
  root.traverse(object => {
    if (!object.isMesh) return;
    const original = object.material;
    function lighter(material) {
      if (!material.isMeshPhysicalMaterial) return material;
      if (!lighterMaterials.has(material)) lighterMaterials.set(material,new THREE.MeshStandardMaterial().copy(material));
      return lighterMaterials.get(material);
    }
    const smooth = Array.isArray(original) ? original.map(lighter) : lighter(original);
    qualityMaterials.push({object,original,smooth});
    object.material = smooth;
  });
  return {root,towers,land,walkObstacles:obstacles,optimization,instanceBatches,
    setQuality(high) { for (const entry of qualityMaterials) entry.object.material=high?entry.original:entry.smooth; }
  };
}
