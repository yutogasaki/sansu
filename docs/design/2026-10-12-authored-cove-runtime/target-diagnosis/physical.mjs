import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { build } from 'esbuild';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const root='/private/tmp/sansu-authored-cove-c2/candidate', out='/private/tmp/sansu-cove-distant-p9-diagnosis';
const sha=value=>createHash('sha256').update(value).digest('hex');
const contents=`
export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame';
export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition';
export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving';
export { walkableCells, reachableFromHome, isReachable, approachCells, key, HOME_CELL } from './src/domain/growingIsland/space';
export { canPlace, applyIntent } from './src/domain/growingIsland/commands';
export { makePokomokoRig } from './src/components/island/three/islandCharacters';
export { IslandMaterials } from './src/components/island/three/primitives';
export { setActorVisualScale } from './src/components/island/growing/actorScale';
export { disposeActor, makeVillagerActor, wrapPokomoko } from './src/components/island/growing/actors';
export { authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from './src/components/island/growing/authoredFlowerObstructions';
export { buildObjectLayer } from './src/components/island/growing/objectLayer';
export { sceneLayout } from './src/components/island/growing/sceneLayout';
export { makeNativeAuthoredCove } from './src/components/island/growing/native/nativeAuthoredCove';
export { makeNativeAuthoredFlower } from './src/components/island/growing/native/nativeAuthoredFlower';
export { makeNativeGrowingKit } from './src/components/island/growing/native/nativeGrowingKit';
`;
const compiled=await build({stdin:{resolveDir:root,contents},bundle:true,packages:'external',format:'esm',platform:'node',write:false,metafile:true,logLevel:'silent'});
writeFileSync(`${out}/physical-bundle.mjs`,compiled.outputFiles[0].contents);
const d=await import(`${out}/physical-bundle.mjs`);
const inputFiles=new Set(Object.keys(compiled.metafile.inputs).filter(file=>file!=='<stdin>').map(file=>relative(root,resolve(process.cwd(),file))));
const read=file=>{inputFiles.add(file);return readFileSync(`${root}/${file}`)};
const readJson=file=>JSON.parse(read(file));
const reportFile='/private/tmp/sansu-authored-cove-c2/full/report.json';
const browser=JSON.parse(readFileSync(reportFile)), initial=browser.initialState, failed=browser.failureState;
const base=d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(read('prototypes/place-qa/native05-world.json.gz')))));
const manifest=readJson('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
const compressed=read(manifest.artifact.path.slice(1)),bytes=gunzipSync(compressed);
if(sha(compressed)!==manifest.artifact.sha256||sha(bytes)!==manifest.source.sha256)throw Error('Cove source hash mismatch');
const parse=async bytes=>(await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')).scene;
const source=await parse(bytes);source.userData.sourceId=manifest.source.id;source.userData.sourceSha256=sha(bytes);
const cove=d.makeNativeAuthoredCove(source,manifest);
const nativeManifest=readJson('docs/design/2026-10-11-native-owned-island/kit-manifest.json');
const kit=d.makeNativeGrowingKit(await parse(gunzipSync(read('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'))),nativeManifest);
const flowers=d.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read('prototypes/place-qa/native-flower-support.json.gz'))));
const m=new d.IslandMaterials('moon-garden'),rig=d.makePokomokoRig(m),hero=d.wrapPokomoko(rig.hero,rig.heroBody,rig.heroFeet);
d.setActorVisualScale(hero,.45);
const actors=[hero,...initial.villagers.map(v=>d.makeVillagerActor(m,v,.45))], envelope=d.measureAuthoredWalkingEnvelope(actors);
const options={water:true,cove:true},before=d.authoredWorldFrame(initial,base,options),target={x:12,z:-9};
const allowed=d.canPlace(initial,target,'p9',before.world);
if(!allowed)throw Error('Requested alternate target is invalid');
const alternate=d.applyIntent(initial,{id:'diagnostic-one-alternate-p9',command:{type:'move',id:'p9',cell:target}},initial.nature.realAt,before.world).state;
const results=[];
try {
 for(const [name,state] of [['baseline',initial],['failed',failed],['alternate-12--9',alternate]]){
   const frame=name==='baseline'?before:d.authoredWorldFrame(state,base,options);
   const layout=d.sceneLayout(state,false,frame.world,frame.waterPlan,base,{options,covePlan:frame.covePlan,revision:frame.revision});
   const layer=d.buildObjectLayer(m,state,layout,undefined,undefined,[],kit,flowers,cove);
   try {
    layer.root.updateMatrixWorld(true);
    const physical=d.authoredFlowerWalkSet(d.walkableCells(state,frame.world),frame.world,layout,layer.placeRoot,envelope);
    const reached=d.reachableFromHome(state,physical.walkable,frame.world);
    const owners=[...state.plots,...state.landmarks].filter(owner=>owner.cell).map(owner=>({id:owner.id,cell:owner.cell,dryFloor:Boolean(frame.world.floorAt(owner.cell)),reachable:d.isReachable(owner.cell,reached,frame.world),approaches:d.approachCells(owner.cell,frame.world).filter(cell=>reached.has(d.key(cell)))}));
    const routes=owners.filter(owner=>owner.reachable).map(owner=>{
      const destination=owner.approaches[0],route=frame.world.route(d.HOME_CELL,destination,physical.walkable);
      return {id:owner.id,destination,routePoints:route?.length??0,allNeighbors:!!route&&route.slice(1).every((at,i)=>frame.world.neighbors(route[i]).some(next=>d.key(next)===d.key(at))),allGroundClear:!!route&&route.slice(1).every((at,i)=>physical.clearGroundPath(route[i],at))};
    });
    const result={name,p9:state.plots.find(owner=>owner.id==='p9').cell,coveAssemblyCount:frame.covePlan.assemblies.length,proof:physical.proof,walkable:physical.walkable.size,reached:reached.size,owners,unreachable:owners.filter(owner=>!owner.reachable).map(owner=>owner.id),routes};
    results.push(result);
    console.log(JSON.stringify({name,p9:result.p9,cove:result.coveAssemblyCount,triangles:result.proof.triangles,stockCount:result.proof.stockCount,walkable:result.walkable,reached:result.reached,unreachable:result.unreachable,routeCount:routes.length,routeFailures:routes.filter(route=>!route.allNeighbors||!route.allGroundClear)}));
   }finally{layer.dispose()}
 }
}finally{actors.forEach(d.disposeActor);m.dispose();cove.dispose();flowers.dispose();kit.dispose()}
const hashes=[...inputFiles].sort().map(file=>{const actual=sha(readFileSync(`${root}/${file}`));return {file,sha256:actual,browserInitial:browser.initialInputs[file]??null,browserFinal:browser.finalInputs[file]??null,matchesBrowser:browser.initialInputs[file]===actual&&browser.finalInputs[file]===actual}});
const proofFields=['stockCount','coveCount','obstructionRootCount','triangles','blockedPoints','blockedEdges','excludedRefs'];
const comparisons=[['baseline',browser.captures[0].physical],['failed',JSON.parse(browser.failureMetadata.authoredObstructionWalking)]].map(([name,expected])=>{const actual=results.find(r=>r.name===name);return {name,proofFields:proofFields.map(field=>({field,expected:expected[field],actual:actual.proof[field],matches:expected[field]===actual.proof[field]})),walkableMatches:expected.walkableCount===actual.walkable,reachedMatches:expected.reachableCount===actual.reached,unreachableMatches:JSON.stringify(expected.ownerAccess.filter(o=>!o.reachable).map(o=>o.id))===JSON.stringify(actual.unreachable)}});
const result={scope:'Exact c2 browser baseline and failed target, plus parent-requested single alternate target (12,-9). Actual GLB/factories/rig/guard, no browser, no placement search.',sourceReportSha256:sha(readFileSync(reportFile)),sourceClosureUnchanged:browser.sourceClosureUnchanged,canPlaceAlternate:allowed,actualEnvelope:envelope,browserEnvelope:browser.captures[0].physical.envelope,envelopeExactMatch:JSON.stringify(envelope)===JSON.stringify(browser.captures[0].physical.envelope),results,comparisons,inputHashes:hashes,allInputsMatchBrowser:hashes.every(h=>h.matchesBrowser)};
writeFileSync(`${out}/physical-report.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({envelopeExactMatch:result.envelopeExactMatch,comparisons,inputCount:hashes.length,allInputsMatchBrowser:result.allInputsMatchBrowser,inputMismatches:hashes.filter(h=>!h.matchesBrowser).map(h=>h.file)},null,2));
