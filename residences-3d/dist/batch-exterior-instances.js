import * as THREE from './vendor/three.module.js';

// Share draw calls across repeated geometry while retaining per-instance selection.
export function batchExteriorInstances(root, towers, land) {
  root.updateMatrixWorld(true);
  const inverse=root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),world=new THREE.Matrix4();
  const buckets=new Map(),sources=[],ownerInfo=new Map();
  const geometryKeys=new Map();
  function geometryKey(geometry) {
    if(geometryKeys.has(geometry))return geometryKeys.get(geometry);
    let hash=2166136261;
    const add=value=>{hash=Math.imul(hash^value,16777619)>>>0;};
    for(const [name,attribute] of Object.entries(geometry.attributes).sort()) {
      for(const char of name)add(char.charCodeAt(0));
      add(attribute.itemSize);add(attribute.count);add(attribute.normalized?1:0);
      for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++) {
        const value=attribute.getComponent(i,c);
        add(Math.round(value*1e6));
      }
    }
    if(geometry.index)for(let i=0;i<geometry.index.count;i++)add(geometry.index.getX(i));
    const key=hash+':'+geometry.attributes.position.count+':'+(geometry.index?.count??0);
    geometryKeys.set(geometry,key);return key;
  }
  function visit(object,owner=land,detail=false) {
    if(object.userData.towerId||object.userData.amenityId)owner=object;
    detail=detail||!!object.userData.nearDetail;
    if(object.isInstancedMesh&&!Array.isArray(object.material)&&!object.instanceColor) {
      if(!ownerInfo.has(owner))ownerInfo.set(owner,{center:new THREE.Box3().setFromObject(owner).getCenter(new THREE.Vector3())});
      const key=[geometryKey(object.geometry),object.material.uuid,detail,object.castShadow,object.receiveShadow].join('/');
      if(!buckets.has(key))buckets.set(key,{geometry:object.geometry,material:object.material,castShadow:object.castShadow,receiveShadow:object.receiveShadow,entries:[]});
      const bucket=buckets.get(key);
      world.multiplyMatrices(inverse,object.matrixWorld);
      for(let i=0;i<object.count;i++) {
        object.getMatrixAt(i,matrix);
        bucket.entries.push({owner,detail,matrix:new THREE.Matrix4().multiplyMatrices(world,matrix)});
      }
      sources.push(object);object.userData.batchedSource=true;object.visible=false;
    }
    for(const child of object.children)visit(child,owner,detail);
  }
  visit(root);
  const group=new THREE.Group();group.name='Shared exterior instances';root.add(group);
  const meshes=[];
  for(const bucket of buckets.values()) {
    const mesh=new THREE.InstancedMesh(bucket.geometry,bucket.material,bucket.entries.length);
    mesh.name='Shared exterior geometry';mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;
    mesh.matrixAutoUpdate=false;
    group.add(mesh);bucket.mesh=mesh;meshes.push(mesh);
  }
  let signature='',selected=null;
  function visible(owner) {
    for(let node=owner;node;node=node.parent){if(!node.visible)return false;if(node===root)return true;}
    return false;
  }
  function update(camera,high=false) {
    const state=new Map();let next=String(high);
    for(const [owner,info] of ownerInfo) {
      const shown=visible(owner)&&owner!==selected;
      const distance=camera.position.distanceToSquared(info.center);
      info.near=high||distance<(info.near?150*150:130*130);
      state.set(owner,{shown,near:info.near});next+='|'+Number(shown)+Number(info.near);
    }
    if(next===signature)return;
    signature=next;
    for(const bucket of buckets.values()) {
      const mesh=bucket.mesh;let count=0;
      for(const entry of bucket.entries) {
        const flags=state.get(entry.owner);
        if(!flags.shown||(entry.detail&&!flags.near))continue;
        mesh.setMatrixAt(count++,entry.matrix);
      }
      mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;
      if(count)mesh.computeBoundingSphere();
    }
  }
  function select(tower) {
    selected=tower;signature='';
    for(const source of sources) {
      let parent=source.parent;while(parent&&parent!==selected)parent=parent.parent;
      source.visible=!!selected&&parent===selected;
    }
  }
  return {meshes,update,select,sourceCount:sources.length,batchCount:meshes.length};
}
