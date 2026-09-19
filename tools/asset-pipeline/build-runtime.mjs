import {readFile,writeFile,mkdir,stat,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const runtime=process.env.ASSET_TOOLS_ROOT||'/tmp/sansu-asset-tools';
const require=createRequire(resolve(runtime,'package.json'));
const {NodeIO}=require('@gltf-transform/core');
const {ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {compactPrimitive,weld,prune}=require('@gltf-transform/functions');
const {MeshoptSimplifier}=await import(require.resolve('meshoptimizer'));
const sharp=require('sharp');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const cli=resolve(runtime,'node_modules/.bin/gltf-transform');
const hash=b=>createHash('sha256').update(b).digest('hex');
const fingerprint=doc=>doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().flatMap(p=>[...p.listAttributes(),p.getIndices()].filter(Boolean).map(a=>[a.getType(),a.getCount(),hash(Buffer.from(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength))])));
const triangles=doc=>doc.getRoot().listMeshes().reduce((s,m)=>s+m.listPrimitives().reduce((t,p)=>t+p.getIndices().getCount()/3,0),0);
const assetIds=process.argv.slice(2);
if(assetIds.some(id=>!/^[a-z]+(?:-[a-z]+)*$/.test(id)))throw new Error('Use asset names such as garden-hut, flowerbed, streetlamp');
for(const id of (assetIds.length ? assetIds : ['tree','rock','bench'])){
 const folder=`assets/island-${id}-v1/runtime`;await mkdir(folder,{recursive:true});
 const original=await readFile(`assets/island-${id}-v1/optimized/model-1024.glb`);
 const length=original.readUInt32LE(12),json=JSON.parse(original.subarray(20,20+length)),binary=original.subarray(28+length);
 for(const im of json.images){const v=json.bufferViews[im.bufferView];if(!binary.subarray(v.byteOffset,v.byteOffset+8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Expected embedded PNG');im.mimeType='image/png';}
 let meta=Buffer.from(JSON.stringify(json));meta=Buffer.concat([meta,Buffer.alloc((4-meta.length%4)%4,32)]);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+meta.length+binary.length,8);header.writeUInt32LE(meta.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length,0);bh.writeUInt32LE(0x004e4942,4);
 await writeFile(`${folder}/input-normalized.glb`,Buffer.concat([header,meta,bh,binary]));
 const doc=await io.read(`${folder}/input-normalized.glb`),geo=fingerprint(doc);
 for(const m of doc.getRoot().listMaterials()) for(const t of [m.getNormalTexture(),m.getMetallicRoughnessTexture()]) if(t){t.setImage(await sharp(t.getImage()).resize(512,512,{fit:'inside'}).png().toBuffer());t.setMimeType('image/png');}
 await io.write(`${folder}/resized.glb`,doc);
 if(!process.env.RUNTIME_FAR_ONLY){execFileSync(cli,['uastc',`${folder}/resized.glb`,`${folder}/near.glb`,'--level','2','--rdo','--rdo-lambda','0.5','--zstd','18','--filter','box'],{stdio:'inherit'});}
 const near=await io.read(`${folder}/near.glb`);
 if(JSON.stringify(fingerprint(near))!==JSON.stringify(geo))throw new Error('Near geometry changed');
 const far=await io.read(`${folder}/input-normalized.glb`);
 await far.transform(weld());await MeshoptSimplifier.ready;
 for(const mesh of far.getRoot().listMeshes())for(const p of mesh.listPrimitives()){
  const position=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),normal=p.getAttribute('NORMAL');
  const attributes=new Float32Array(position.getCount()*5);
  for(let i=0;i<position.getCount();i++)attributes.set([...uv.getElement(i,[]),...normal.getElement(i,[])],i*5);
  const [indices]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(p.getIndices().getArray()),position.getArray(),3,attributes,5,[4,4,.1,.1,.1],null,Math.floor(p.getIndices().getCount()*.12/3)*3,.01,['LockBorder']);
  p.getIndices().setArray(indices);compactPrimitive(p);
 }
 for(const t of far.getRoot().listTextures())t.dispose();
 await far.transform(prune({keepAttributes:true}));
 for(const m of far.getRoot().listMeshes())for(const p of m.listPrimitives())if(!p.getAttribute('TEXCOORD_0'))throw new Error('Far UV missing');await io.write(`${folder}/far-geometry.glb`,far);
 const report={asset:id,sourceSha256:hash(original),nearSha256:hash(await readFile(`${folder}/near.glb`)),farSha256:hash(await readFile(`${folder}/far-geometry.glb`)),nearBytes:(await stat(`${folder}/near.glb`)).size,farBytes:(await stat(`${folder}/far-geometry.glb`)).size,nearTriangles:triangles(near),farTriangles:triangles(far),nearGeometryIdentical:true,textureRecipe:'baseColor 1024; metallicRoughness/normal 512; all UASTC level2 RDO .5 Zstd18 box mip filter',farRecipe:'weld + attribute-aware meshoptimizer ratio .12 error .01 lock border; UV weights4 normal weights.1; no textures; runtime shares near material',gltfTransform:'4.5.0',ktx:'4.4.2'};
 await writeFile(`${folder}/profile.json`,JSON.stringify(report,null,2));console.log(report);
 for(const file of ['input-normalized.glb','resized.glb','color.glb'])await unlink(`${folder}/${file}`).catch(e=>{if(e.code!=='ENOENT')throw e;});
}
