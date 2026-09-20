import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {unlink} from 'node:fs/promises';
const require=createRequire('/tmp/sansu-asset-tools/package.json');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions'),sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
for(const id of ['fence','watering-can','planter','mailbox']){
 const folder=`assets/island-${id}-v1/design-v2`,doc=await io.read(`${folder}/model-1024.glb`);
 const colors=new Set(doc.getRoot().listMaterials().map(m=>m.getBaseColorTexture()).filter(Boolean));
 for(const texture of doc.getRoot().listTextures()){
  const size=colors.has(texture)?(id==='mailbox'?512:1024):(id==='mailbox'?256:512);
  texture.setImage(await sharp(texture.getImage()).resize(size,size,{fit:'inside',withoutEnlargement:true}).png().toBuffer());texture.setMimeType('image/png');
 }
 const temporary=`${folder}/texture-input.glb`;await io.write(temporary,doc);
 execFileSync('/tmp/sansu-asset-tools/node_modules/.bin/gltf-transform',['uastc',temporary,`${folder}/near.glb`,'--level','2','--rdo','--rdo-lambda','0.5','--zstd','18','--filter','box'],{stdio:'inherit'});
 await unlink(temporary);
}
