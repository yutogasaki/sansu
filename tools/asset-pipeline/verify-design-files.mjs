import {createRequire} from 'node:module';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire('/tmp/sansu-asset-tools/package.json');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha=b=>createHash('sha256').update(b).digest('hex');
const fingerprint=d=>d.getRoot().listMeshes().map(m=>m.listPrimitives().map(p=>[...p.listSemantics().sort().map(s=>[s,p.getAttribute(s)]),['indices',p.getIndices()]].map(([s,a])=>[s,a.getCount(),sha(Buffer.from(a.getArray().buffer,a.getArray().byteOffset,a.getArray().byteLength))])));
const manifest={},checks=[];
for(const id of ['fence','watering-can','planter','mailbox']){
 const base=`assets/island-${id}-v1`,folder=`${base}/design-v2`,v=JSON.parse(await readFile(`${folder}/verification.json`));
 assert.equal(sha(await readFile(`${base}/final/model.glb`)),v.source_sha256);
 assert.equal(sha(await readFile(`${folder}/model.glb`)),v.final_sha256);assert(v.roundtrip_pass);
 const master=await io.read(`${folder}/model.glb`),light=await io.read(`${folder}/model-1024.glb`),near=await io.read(`${folder}/near.glb`);
 assert.deepEqual(fingerprint(master),fingerprint(light),id+' light geometry');
 assert.deepEqual(fingerprint(light),fingerprint(near),id+' compressed geometry');
 assert(near.getRoot().listNodes().every(n=>n.getMesh()),'Unexpected non-mesh node');
 const bytes=await Promise.all([`${base}/final/model.glb`,`${folder}/model.glb`,`${folder}/near.glb`].map(async p=>(await stat(p)).size));
 const row={bytes,triangles:v.after.triangles,beforeTriangles:v.before.triangles};manifest[id]=row;
 checks.push({id,...row,materials:near.getRoot().listMaterials().length,nearSha256:sha(await readFile(`${folder}/near.glb`)),masterSha256:v.final_sha256,sourceSha256:v.source_sha256,geometryIdentical:true});
}
await writeFile('assets/pipeline/island-design-v2/runtime-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile('assets/pipeline/island-design-v2/file-checks.json',JSON.stringify({pass:true,checks},null,2)+'\n');
console.log(JSON.stringify({pass:true,checks}));
