import fs from 'node:fs';import path from 'node:path';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import{build}from'esbuild';import * as T from'three';import{GLTFLoader}from'three/addons/loaders/GLTFLoader.js';
const root='/Users/yutogasaki/Projects/sansu',out='/private/tmp/sansu-l14-access-diagnosis',sha=b=>createHash('sha256').update(b).digest('hex');
const b=await build({stdin:{resolveDir:root,contents:`
export {authoredWorldFrame} from './src/domain/growingIsland/authoredWorldFrame';
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition';
export {withNative05WaterCarvingScope} from './src/domain/growingIsland/authoredWaterCarving';
export {walkableCells,reachableFromHome,approachCells,key,HOME_CELL} from './src/domain/growingIsland/space';
export {authoredPointBlocked} from './src/domain/growingIsland/authoredWorldAccess';
export {sceneLayout} from './src/components/island/growing/sceneLayout';
export {buildObjectLayer} from './src/components/island/growing/objectLayer';
export {IslandMaterials} from './src/components/island/three/primitives';
export {makePokomokoRig} from './src/components/island/three/islandCharacters';
export {wrapPokomoko,makeVillagerActor,disposeActor} from './src/components/island/growing/actors';
export {setActorVisualScale} from './src/components/island/growing/actorScale';
export {authoredFlowerWalkSet,measureAuthoredWalkingEnvelope} from './src/components/island/growing/authoredFlowerObstructions';
export {makeNativeGrowingKit} from './src/components/island/growing/native/nativeGrowingKit';
export {makeNativeAuthoredCove} from './src/components/island/growing/native/nativeAuthoredCove';
export {makeNativeAuthoredFlower} from './src/components/island/growing/native/nativeAuthoredFlower';
`},bundle:true,packages:'external',platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent'});
fs.writeFileSync(`${out}/module.mjs`,b.outputFiles[0].contents);const a=await import(`${out}/module.mjs`);
const inputs=new Set(Object.keys(b.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>path.relative(root,path.resolve(process.cwd(),p))));
const read=p=>{inputs.add(p);return fs.readFileSync(`${root}/${p}`)},json=p=>JSON.parse(read(p)),parse=async bytes=>(await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')).scene;
const state=json('prototypes/place-qa/authored-flower-reference-mature.json').state,owner=state.landmarks.find(o=>o.id==='l14'),kitManifest=json('docs/design/2026-10-11-native-owned-island/kit-manifest.json'),coveManifest=json('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json');
const kit=a.makeNativeGrowingKit(await parse(gunzipSync(read('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'))),kitManifest),flowers=a.makeNativeAuthoredFlower(JSON.parse(gunzipSync(read('prototypes/place-qa/native-flower-support.json.gz'))));
const compressed=read(coveManifest.artifact.path.slice(1)),bytes=gunzipSync(compressed);if(sha(compressed)!==coveManifest.artifact.sha256||sha(bytes)!==coveManifest.source.sha256)throw Error('source mismatch');
const source=await parse(bytes);source.userData.sourceId=coveManifest.source.id;source.userData.sourceSha256=sha(bytes);const cove=a.makeNativeAuthoredCove(source,coveManifest);
const base=a.withNative05WaterCarvingScope(a.compileWorldDefinition(JSON.parse(gunzipSync(read('prototypes/place-qa/native05-world.json.gz')))));
const beforeHashes=Object.fromEntries([...inputs].sort().map(p=>[p,sha(fs.readFileSync(`${root}/${p}`))]));
const options={water:true,cove:true},frame=a.authoredWorldFrame(state,base,options),world=frame.world,layout=a.sceneLayout(state,false,world,frame.waterPlan,base,{options,covePlan:frame.covePlan,revision:frame.revision});
const m=new a.IslandMaterials('moon-garden'),layer=a.buildObjectLayer(m,state,layout,undefined,undefined,[],kit,flowers,cove),rig=a.makePokomokoRig(m),hero=a.wrapPokomoko(rig.hero,rig.heroBody,rig.heroFeet);a.setActorVisualScale(hero,.45);
const actors=[hero,...state.villagers.map(v=>a.makeVillagerActor(m,v,.45))],envelope=a.measureAuthoredWalkingEnvelope(actors);layer.root.updateMatrixWorld(true);
const isVisible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true};
const ownerIds=o=>{for(let p=o;p;p=p.parent){if(p.userData.ownerIds?.length)return p.userData.ownerIds;if(p.userData.ownerId)return[p.userData.ownerId];if(p.userData.objectId)return[p.userData.objectId]}return[]};
const treeRoots=[];layer.root.traverse(o=>{if(o.name.startsWith('growing-tree-')||['place-native-shared-tree','place-native-mature-branch'].includes(o.name))treeRoots.push({node:o,name:o.name,visible:isVisible(o),ownerIds:ownerIds(o)})});
const briefMesh=o=>{const box=new T.Box3().setFromObject(o);return{name:o.name,material:o.material?.name,visible:isVisible(o),triangles:o.geometry?((o.geometry.index?.count??o.geometry.attributes.position.count)/3):undefined,min:[box.min.x+layout.center,box.min.y,box.min.z+2],max:[box.max.x+layout.center,box.max.y,box.max.z+2]}};
const l14roots=treeRoots.filter(t=>t.visible&&t.ownerIds.includes('l14'));
const originalCandidates=a.approachCells(owner.cell,world),allowed=a.walkableCells(state,world),local=world.walkSites.filter(s=>Math.hypot(s.cell.x-owner.cell.x,s.cell.z-owner.cell.z)<=1.5);
const all=[];let allGuard,allReached;
try{
for(const [name,predicate] of [['runtime-flower-cove',()=>false],['all-trees',()=>true],['l14-only',t=>t.ownerIds.includes('l14')],['all-except-l14',t=>!t.ownerIds.includes('l14')]]){
 for(const t of treeRoots)t.node.name=predicate(t)?'authored-cove-shell':t.name;
 const guard=a.authoredFlowerWalkSet(allowed,world,layout,layer.root,envelope),reached=a.reachableFromHome(state,guard.walkable,world);
 const record={name,triangles:guard.proof.triangles,blockedPoints:guard.proof.blockedPoints,blockedEdges:guard.proof.blockedEdges,reachable:reached.size,l14Candidates:originalCandidates.map(c=>({cell:c,baseAllowed:allowed.has(a.key(c)),hasFloor:!!world.floorAt(c),guardWalkable:guard.walkable.has(a.key(c)),reachable:reached.has(a.key(c)),clearPoint:guard.clearGroundPath(c,c)})),unreachable:[...state.plots,...state.landmarks].filter(o=>o.cell&&!a.approachCells(o.cell,world).some(c=>reached.has(a.key(c)))).map(o=>o.id)};
 all.push(record);console.log(JSON.stringify({name,triangles:record.triangles,reached:record.reachable,approaches:record.l14Candidates.filter(c=>c.reachable).length,unreachable:record.unreachable}));
 if(name==='all-trees'){allGuard=guard;allReached=reached;}
}
for(const t of treeRoots)t.node.name='authored-cove-shell';
const safeLocal=local.filter(s=>allReached.has(a.key(s.cell))).map(s=>{const route=world.route(a.HOME_CELL,s.cell,allGuard.walkable);return{cell:s.cell,distance:Math.hypot(s.cell.x-owner.cell.x,s.cell.z-owner.cell.z),offered:originalCandidates.some(c=>a.key(c)===a.key(s.cell)),floor:world.floorAt(s.cell)?.point,clearPoint:allGuard.clearGroundPath(s.cell,s.cell),routeCount:route?.length??0,routeSafe:!!route&&route.slice(1).every((c,i)=>allGuard.clearGroundPath(route[i],c))}}).sort((a,b)=>a.distance-b.distance);
const meshes=[];for(const t of l14roots)t.node.traverse(o=>{if(o instanceof T.Mesh)meshes.push({node:o,brief:briefMesh(o)})});
const materials=[];
for(const mesh of meshes){
 for(const t of treeRoots)t.node.name=t.name;
 const old=mesh.node.name;mesh.node.name='authored-cove-shell';
 const guard=a.authoredFlowerWalkSet(allowed,world,layout,layer.root,envelope),reached=a.reachableFromHome(state,guard.walkable,world);
 materials.push({...mesh.brief,candidates:originalCandidates.filter(c=>allowed.has(a.key(c))).map(c=>({cell:c,guardWalkable:guard.walkable.has(a.key(c)),reachable:reached.has(a.key(c)),clearPoint:guard.clearGroundPath(c,c)}))});mesh.node.name=old;
}
const afterHashes=Object.fromEntries([...inputs].sort().map(p=>[p,sha(fs.readFileSync(`${root}/${p}`))]));
const result={scope:'Read-only diagnostic of baseline l14 only. Actual native trees are eligible in isolated controls; current app guard remains flower+cove. No new forest/bench layout and no app edits.',owner,envelope,frameRevision:frame.revision,treeRoots:treeRoots.map(t=>({name:t.name,visible:t.visible,ownerIds:t.ownerIds,...briefMesh(t.node)})),l14Roots:l14roots.map(t=>({name:t.name,ownerIds:t.ownerIds,...briefMesh(t.node)})),originalCandidates,controls:all,safeLocal,materialIsolation:materials,inputHashesBefore:beforeHashes,inputHashesAfter:afterHashes,inputsUnchanged:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes)};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({l14RootCount:l14roots.length,originalCandidates:originalCandidates.length,safeLocal:safeLocal.slice(0,12),materials:materials.map(m=>({name:m.name,triangles:m.triangles,reachable:m.candidates.filter(c=>c.reachable).length,clearPoint:m.candidates.filter(c=>c.clearPoint).length})),inputCount:inputs.size,inputsUnchanged:result.inputsUnchanged},null,2));
}finally{actors.forEach(a.disposeActor);layer.dispose();m.dispose();kit.dispose();flowers.dispose();cove.dispose()}
