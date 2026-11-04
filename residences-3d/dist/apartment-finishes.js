import * as T from './vendor/three.module.js';

const finishes=new Map([
  ['Oak joinery','oak'], ['Warm white marble','marble'], ['Limestone plaster','limestone'],
  ['Cotton percale','linen'], ['Ivory linen','linen'], ['Ivory upholstery','linen'],
  ['Muted olive weave','sage']
]);
let library;
export async function dressApartment(model){
  const loader=new T.TextureLoader();
  library??=Promise.all([...new Set(finishes.values())].map(async name=>{
    const texture=await loader.loadAsync('assets/plans/finishes/'+name+'.jpg');
    texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
    texture.anisotropy=4;texture.userData.sharedFinish=true;
    return [name,texture];
  })).then(entries=>new Map(entries)).catch(error=>{library=null;throw error;});
  const maps=await library;
  model.traverse(node=>{
    if(!node.isMesh)return;
    const material=node.material,texture=maps.get(finishes.get(material.name));
    if(!texture)return;
    const geometry=node.geometry;
    if(!geometry.attributes.uv){
      geometry.computeBoundingBox();
      const {min,max}=geometry.boundingBox;
      const size=new T.Vector3().subVectors(max,min);
      const position=geometry.attributes.position,uv=new Float32Array(position.count*2);
      // Bedding and cushions are mostly seen from above in the cutaway.
      for(let i=0;i<position.count;i++){
        uv[2*i]=(position.getX(i)-min.x)/Math.max(size.x,.001);
        uv[2*i+1]=(position.getZ(i)-min.z)/Math.max(size.z,.001);
      }
      geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
    }
    material.color.set(0xffffff);material.map=texture;material.needsUpdate=true;
  });
}
