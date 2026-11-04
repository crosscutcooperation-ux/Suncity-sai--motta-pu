import fs from 'node:fs/promises';
import {buildSite} from '../dist/model.js';
import {mergeStaticPieces} from '../dist/scene-optimization.js';
import {GLTFExporter} from '../dist/vendor/GLTFExporter.js';

globalThis.FileReader=class{
 async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.();}
 async readAsDataURL(blob){this.result='data:'+blob.type+';base64,'+Buffer.from(await blob.arrayBuffer()).toString('base64');this.onloadend?.();}
};
const assetDir=new URL('../dist/assets/',import.meta.url);
const shapes=JSON.parse(await fs.readFile(new URL('tower-shapes.json',assetDir),'utf8'));
const model=buildSite(shapes);
for(const tower of model.towers)mergeStaticPieces(tower);
mergeStaticPieces(model.land);
model.root.updateMatrixWorld(true);

// GLTFExporter requires a browser canvas to serialize a raster texture. The
// original JPEG bytes can instead be embedded without recompression in Node.
const result=Buffer.from(await new GLTFExporter().parseAsync(model.root,{binary:true,onlyVisible:true}));
const jsonLength=result.readUInt32LE(12);
const document=JSON.parse(result.subarray(20,20+jsonLength));
const binaryLength=result.readUInt32LE(20+jsonLength);
const parts=[result.subarray(28+jsonLength,28+jsonLength+binaryLength)];
let offset=binaryLength;
document.images=[];document.textures=[];
document.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
for(const [name,filename,repeat] of [
 ['Sun City | registered balcony masonry','facade-sun-city.jpg',1],
 ['Sun City | landscape turf','grass.jpg',24],
 ['Sun City | avenue asphalt','asphalt.jpg',12],
 ['Sun City | deck timber','wood-deck.jpg',8],
 ['Sun City | photographic tree foliage','canopy-spray.png',1]
]){
 const mat=document.materials.find(m=>m.name===name);if(!mat)continue;
 const bytes=await fs.readFile(new URL(filename,assetDir));
 const view=document.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength})-1;
 const source=document.images.push({bufferView:view,mimeType:filename.endsWith('.png')?'image/png':'image/jpeg',name:filename})-1;
 const index=document.textures.push({source,sampler:0})-1;
 mat.pbrMetallicRoughness.baseColorTexture={index,extensions:{KHR_texture_transform:{offset:[0,1],scale:[repeat,-repeat]}}};
 if(!filename.startsWith('canopy'))mat.pbrMetallicRoughness.baseColorFactor=[1,1,1,1];
 const padding=Buffer.alloc((4-bytes.byteLength%4)%4);
 parts.push(bytes,padding);offset+=bytes.length+padding.length;
}
document.extensionsUsed ??=[];
if(!document.extensionsUsed.includes('KHR_texture_transform'))document.extensionsUsed.push('KHR_texture_transform');
document.buffers[0].byteLength=offset;
const json=Buffer.from(JSON.stringify(document));
const jsonPadding=Buffer.alloc((4-json.length%4)%4,0x20);
const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+jsonPadding.length+offset,8);
header.writeUInt32LE(json.length+jsonPadding.length,12);header.write('JSON',16);
binHeader.writeUInt32LE(offset,0);binHeader.write('BIN\0',4);
const output=Buffer.concat([header,json,jsonPadding,binHeader,...parts]);
const destination=new URL('../deliverables/sai-sun-city-exterior.glb',import.meta.url);
await fs.writeFile(destination,output);
console.log('Exported '+model.towers.length+' towers, '+document.images.length+' packed textures and named amenities ('+output.byteLength+' bytes).');

