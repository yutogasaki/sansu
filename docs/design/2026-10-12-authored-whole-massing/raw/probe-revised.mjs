// Read-only M1 composition planning: only diagnostic files in this tmp directory.
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const repo='/Users/yutogasaki/Projects/sansu',out='/private/tmp/sansu-forest-composition-plan';
const require=createRequire(`${repo}/package.json`),{build}=require('esbuild');
const read=p=>fs.readFileSync(`${repo}/${p}`),sha=p=>createHash('sha256').update(read(p)).digest('hex');
const bundle=await build({stdin:{contents:`
export{compileWorldDefinition}from'./src/domain/growingIsland/worldDefinition.ts';
export{withNative05WaterCarvingScope}from'./src/domain/growingIsland/authoredWaterCarving.ts';
export{authoredWorldFrame}from'./src/domain/growingIsland/authoredWorldFrame.ts';
export{derivePlaces,placeConnected}from'./src/domain/growingIsland/places.ts';
export{walkableCells,reachableFromHome,approachCells,key}from'./src/domain/growingIsland/space.ts';
export{canPlace,applyIntent}from'./src/domain/growingIsland/commands.ts';
export{advanceNature,treeAge}from'./src/domain/growingIsland/nature.ts';
export{treeForm}from'./src/components/island/growing/treeSilhouettes.ts';
`,resolveDir:repo,loader:'ts'},write:false,bundle:true,packages:'external',platform:'node',format:'cjs',logLevel:'silent',metafile:true});
const mod={exports:{}};new Function('require','module','exports',bundle.outputFiles[0].text)(require,mod,mod.exports);const api=mod.exports;
const inputs=['prototypes/place-qa/authored-flower-reference-mature.json','prototypes/place-qa/native05-world.json.gz',...Object.keys(bundle.metafile.inputs).filter(p=>p!=='<stdin>')];
const hashes=Object.fromEntries(inputs.map(p=>[p,sha(p)]));
const original=JSON.parse(read(inputs[0])).state,base=api.withNative05WaterCarvingScope(api.compileWorldDefinition(JSON.parse(gunzipSync(read(inputs[1])))));
const frame=s=>api.authoredWorldFrame(s,base,{water:true,cove:true});
const summarize=(s,w)=>{
 const open=api.walkableCells(s,w),reached=api.reachableFromHome(s,open,w),places=api.derivePlaces(s,w);
 const owners=[...s.plots,...s.landmarks].filter(o=>o.cell&&!s.unopened.includes(o.id));
 return {revision:w.definition.revision,grants:w.sites.filter(site=>site.placement).map(site=>site.ref),reached:reached.size,
 access:owners.map(o=>({id:o.id,approaches:api.approachCells(o.cell,w).filter(c=>reached.has(api.key(c))).length})),
 places:places.map(p=>({id:p.id,variant:p.variant,stage:p.stage,main:p.mainIds,targets:p.useTargets,missing:p.missing}))};
};
const before=frame(original),baseline=summarize(original,before.world);
// Allocation follows actual nextId/treeForm; no identity/species reroll or skipped IDs.
const definitions=[
 {id:'four-layer-revised',cells:[[6,-7],[13,-5],[12,-9],[0,-5]]},
];
const result={scope:'Hypothetical command acquisition + actual advanceNature maturity in tmp; not real player history or live application acceptance',baseline,nextId:original.nextId,initialDrops:original.drops,townBank:original.town.bank,inputs:hashes,candidates:[]};
for(const definition of definitions){
 let s=structuredClone(original);const commands=[];let failure;
 for(const [x,z]of definition.cells){
  const cell={x,z},current=frame(s),allowed=api.canPlace(s,cell,undefined,current.world),id=`l${s.nextId}`;
  try{s=api.applyIntent(s,{id:`m1-forest-hypothetical-${definition.id}-${id}`,command:{type:'place',kind:'sapling',cell}},undefined,current.world).state;commands.push({id,cell,form:api.treeForm(id),allowed,paid:20});}
  catch(e){failure=String(e);break;}
 }
 let events=[];if(!failure)events=api.advanceNature(s,s.nature.realAt+18*3_600_000,frame(s).world);
 const current=frame(s),summary=summarize(s,current.world),newTrees=s.landmarks.filter(l=>!original.landmarks.some(old=>old.id===l.id));
 const existingPreserved=original.landmarks.every(old=>JSON.stringify(old)===JSON.stringify(s.landmarks.find(l=>l.id===old.id)))&&original.plots.every(old=>JSON.stringify(old)===JSON.stringify(s.plots.find(l=>l.id===old.id)));
 const record={id:definition.id,failure,commands,elapsedHours:18,events,newTrees:newTrees.map(t=>({...t,form:api.treeForm(t.id),age:api.treeAge(s,t.id),floor:current.world.floorAt(t.cell)?.point})),existingPreserved,rightsPreserved:JSON.stringify(baseline.grants)===JSON.stringify(summary.grants),drops:s.drops,waterAssemblyCount:current.waterPlan?.assemblies?.length,coveAssemblyCount:current.covePlan?.assemblies.length,summary};
 result.candidates.push(record);fs.writeFileSync(`${out}/${definition.id}-state.json`,JSON.stringify({scope:result.scope,state:s},null,2)+'\n');
 console.log(JSON.stringify({id:record.id,failure,existingPreserved,rightsPreserved:record.rightsPreserved,drops:s.drops,newTrees:record.newTrees,coveAssemblyCount:record.coveAssemblyCount,unreachable:summary.access.filter(a=>a.approaches===0),places:summary.places.map(p=>({id:p.id,stage:p.stage,variant:p.variant,main:p.main,missing:p.missing}))}));
}
result.finalInputs=Object.fromEntries(inputs.map(p=>[p,sha(p)]));result.inputsUnchanged=JSON.stringify(result.inputs)===JSON.stringify(result.finalInputs);
fs.writeFileSync(`${out}/revised-result.json`,JSON.stringify(result,null,2)+'\n');
console.log('input identity unchanged',result.inputsUnchanged);
