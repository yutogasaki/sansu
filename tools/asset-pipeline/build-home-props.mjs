import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=process.env.ASSET_TOOLS_ROOT||'/tmp/sansu-asset-tools',require=createRequire(resolve(root,'package.json'));
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {weld,compactPrimitive,prune}=require('@gltf-transform/functions'),sharp=require('sharp');
const {MeshoptSimplifier}=await import(require.resolve('meshoptimizer'));await MeshoptSimplifier.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),sha=b=>createHash('sha256').update(b).digest('hex');
const tris=d=>d.getRoot().listMeshes().reduce((n,m)=>n+m.listPrimitives().reduce((s,p)=>s+p.getIndices().getCount()/3,0),0);
async function simplify(doc,ratio,error){
 await doc.transform(weld());
 for(const m of doc.getRoot().listMeshes())for(const p of m.listPrimitives()){
  const pos=p.getAttribute('POSITION'),uv=p.getAttribute('TEXCOORD_0'),normal=p.getAttribute('NORMAL');
  const attrs=new Float32Array(pos.getCount()*5);
  for(let i=0;i<pos.getCount();i++)attrs.set([...(uv?uv.getElement(i,[]):[0,0]),...normal.getElement(i,[])],i*5);
  const [indices]=MeshoptSimplifier.simplifyWithAttributes(new Uint32Array(p.getIndices().getArray()),pos.getArray(),3,attrs,5,[4,4,.1,.1,.1],null,Math.floor(p.getIndices().getCount()*ratio/3)*3,error,['LockBorder']);
  p.getIndices().setArray(indices);compactPrimitive(p);
 }
}
const report={candidate:'island-home-props-v1',recipe:'Near ratio .5/error .002; far ratio .15/error .015; locked UV borders. BaseColor256/other128. UASTC2 RDO.5 Zstd18.',assets:[]};
for(const id of ['fence','watering-can','planter','mailbox']){
 const source=`assets/island-${id}-v1/design-v2/model-1024.glb`,folder=`assets/island-${id}-v1/home-runtime`;await mkdir(folder,{recursive:true});
 const bytes=await readFile(source),doc=await io.read(source),originalTriangles=tris(doc);await simplify(doc,.5,.002);
 const colors=new Set(doc.getRoot().listMaterials().map(m=>m.getBaseColorTexture()).filter(Boolean));
 for(const t of doc.getRoot().listTextures()){
  const size=colors.has(t)?256:128;
  t.setImage(await sharp(t.getImage()).resize(size,size,{fit:'inside',withoutEnlargement:true}).png().toBuffer()).setMimeType('image/png');
 }
 await io.write(`${folder}/input.glb`,doc);
 execFileSync(resolve(root,'node_modules/.bin/gltf-transform'),['uastc',`${folder}/input.glb`,`${folder}/near.glb`,'--level','2','--rdo','--rdo-lambda','0.5','--zstd','18','--filter','box'],{stdio:'inherit'});
 const far=await io.read(source);await simplify(far,.15,.015);
 for(const t of far.getRoot().listTextures())t.dispose();await far.transform(prune({keepAttributes:true}));
 await io.write(`${folder}/far.glb`,far);
 const near=await readFile(`${folder}/near.glb`),farBytes=await readFile(`${folder}/far.glb`);
 assert.equal(sha(bytes),sha(await readFile(source)));
 const row={id,sourceSha256:sha(bytes),nearSha256:sha(near),farSha256:sha(farBytes),originalTriangles,nearTriangles:tris(doc),farTriangles:tris(far),nearBytes:near.length,farBytes:farBytes.length,materials:doc.getRoot().listMaterials().map(m=>m.getName())};
 assert(row.nearTriangles<=originalTriangles);assert(row.farTriangles<=row.nearTriangles);report.assets.push(row);await unlink(`${folder}/input.glb`);
}
report.totalBytes=report.assets.reduce((s,a)=>s+a.nearBytes+a.farBytes,0);
assert(report.totalBytes<2_000_000,'Four home props must stay below 2MB including LOD');
await writeFile('assets/pipeline/island-design-v2/home-runtime.json',JSON.stringify(report,null,2)+'\n');console.log(report);
