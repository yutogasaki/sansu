import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const cwd=process.cwd(), cases=[];
for(const phase of ['before','after']){
 const result=await build({stdin:{contents:"export {buildLifeScene} from './src/components/island/life/scene.ts'; export {buildResidentShadow} from './src/components/island/life/residentShadow.ts'; export {newLife} from './src/domain/islandLife/model.ts'; export {replayLife} from './src/domain/islandLife/simulation.ts';",resolveDir:cwd},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent',define:{'import.meta.env':'{"DEV":false}'},plugins:phase==='before'?[{name:'before',setup(b){b.onLoad({filter:/\/residentShadow\.ts$/},a=>({contents:execFileSync('git',['show','a55854e0:src/components/island/life/residentShadow.ts'],{encoding:'utf8'}),loader:'ts'}));}}]:[]});
 const bundle=resolve('output/garden-frame-20260929/'+phase+'-shadow.mjs');await writeFile(bundle,result.outputFiles[0].text);
 const {buildLifeScene,buildResidentShadow,newLife,replayLife}=await import(pathToFileURL(bundle));
 for(const who of ['pokomoko','rabbit','otter'])for(const reduced of [false,true]){
  const state=replayLife(newLife('shadow-benchmark',0));state.now=5000;state.items=[{id:'bench',kind:'bench',cell:{x:3,z:2},access:'front',growth:0,style:'original'}];
  state.residents.find(r=>r.id===who).visit={itemId:'bench',from:{x:3,z:3},path:[{x:3,z:3}],start:0,end:30000};
  const scene=buildLifeScene(state);scene.animate(state.now,reduced);
  const shadow=buildResidentShadow(scene.root.getObjectByName('life-resident-'+who));
  const hash=createHash('sha256');let updateMs=0,rewrittenVertices=0,uploads=0;
  for(let frame=0;frame<240;frame++){
   const now=5000+frame*1000/60;scene.animate(now,reduced);
   const outputs=shadow.root.children, versions=outputs.map(o=>o.geometry.attributes.position.version);
   const start=performance.now();shadow.update(frame<120?-1:(frame-120)*1000/60,reduced);updateMs+=performance.now()-start;
   for(let i=0;i<outputs.length;i++){
    const output=outputs[i],p=output.geometry.attributes.position;
    if(p.version!==versions[i]){rewrittenVertices+=p.count;uploads++;}
    hash.update(new Uint8Array(p.array.buffer,p.array.byteOffset,p.array.byteLength));
    hash.update(JSON.stringify({visible:output.visible,box:output.geometry.boundingBox,sphere:output.geometry.boundingSphere}));
   }
  }
  cases.push({phase,who,reduced,frames:240,updateMs,rewrittenVertices,uploads,digest:hash.digest('hex')});shadow.dispose();scene.dispose();
 }
}
for(let i=0;i<6;i++)assert.equal(cases[i].digest,cases[i+6].digest);
await writeFile('output/garden-frame-20260929/shadow-comparison.json',JSON.stringify({scope:'Same three actual rigs, 240 projected frames each, normal/reduced motion, ordinary then waving shadow. Same source except residentShadow. Every output position byte, visibility and bounds hashed every frame. CPU timing is a synthetic diagnostic; not browser FPS or device power.',exactOutput:true,cases},null,2));
console.log(cases);
