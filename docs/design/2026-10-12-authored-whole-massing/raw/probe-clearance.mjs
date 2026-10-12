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
// Retain four purchased IDs/species and actual maturity; move only newly purchased l34.
const candidate=JSON.parse(fs.readFileSync(`${out}/four-layer-final-state.json`)).state;
const current=frame(candidate),allowed=api.canPlace(candidate,{x:12,z:-5},'l34',current.world);
const moved=api.applyIntent(candidate,{id:'m1-forest-hypothetical-clearance-l34',command:{type:'move',id:'l34',cell:{x:12,z:-5}}},undefined,current.world).state;
const after=frame(moved),summary=summarize(moved,after.world);
const record={scope:'Hypothetical 4 normal sapling purchases + 18 actual advanceNature hours + one normal move, not real player or live app evidence',command:{type:'move',id:'l34',cell:{x:12,z:-5}},allowed,inputs:hashes,originalOwnerCount:original.landmarks.length+original.plots.length,ownerCount:moved.landmarks.length+moved.plots.length,existingPreserved:original.landmarks.every(old=>JSON.stringify(old)===JSON.stringify(moved.landmarks.find(l=>l.id===old.id)))&&original.plots.every(old=>JSON.stringify(old)===JSON.stringify(moved.plots.find(l=>l.id===old.id))),rightsPreserved:JSON.stringify(baseline.grants)===JSON.stringify(summary.grants),drops:moved.drops,newTrees:moved.landmarks.filter(t=>!original.landmarks.some(o=>o.id===t.id)).map(t=>({...t,form:api.treeForm(t.id),age:api.treeAge(moved,t.id),floor:after.world.floorAt(t.cell)?.point})),waterAssemblyCount:after.waterPlan?.assemblies?.length,coveAssemblyCount:after.covePlan?.assemblies.length,summary};
record.finalInputs=Object.fromEntries(inputs.map(p=>[p,sha(p)]));record.inputsUnchanged=JSON.stringify(record.inputs)===JSON.stringify(record.finalInputs);
fs.writeFileSync(`${out}/four-layer-clearance-state.json`,JSON.stringify({scope:record.scope,state:moved},null,2)+'\n');fs.writeFileSync(`${out}/clearance-result.json`,JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({...record,inputs:undefined,finalInputs:undefined,summary:{unreachable:summary.access.filter(x=>x.approaches===0),places:summary.places.map(p=>({id:p.id,stage:p.stage,variant:p.variant,main:p.main}))}}));
