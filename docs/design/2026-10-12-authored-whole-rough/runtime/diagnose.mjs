import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const ROOT='/private/tmp/sansu-authored-whole-c5/candidate', OUT='/private/tmp/sansu-authored-whole-c5/failure-diagnosis';
assert(!existsSync(`${OUT}/result.json`));
const require=createRequire(`${ROOT}/package.json`), {build}=require('esbuild');
const inputs=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
function read(file){const p=resolve(ROOT,file),b=readFileSync(p);inputs.set(p,sha(b));return b;}
const json=file=>JSON.parse((file.endsWith('.gz')?gunzipSync(read(file)):read(file)).toString());
const ui=json('../runtime/report.json'), before=ui.captures.find(c=>c.name==='whole-day').state;
const current=ui.captures.find(c=>c.name==='whole-phone').state;
const differingPreMoveKeys=Object.keys(before).filter(key=>JSON.stringify(before[key])!==JSON.stringify(current[key]));
assert(differingPreMoveKeys.every(key=>['applied','placeProgress'].includes(key)),'Physical state changed before move');
writeFileSync(`${OUT}/pre-move-observation.json`,JSON.stringify({differingPreMoveKeys,source:'whole-phone is latest saved pre-move UI state; target uses same original whole-load owner cell'},null,2));
const bundle=await build({stdin:{contents:`
export * as T from 'three'; export {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export {compileWorldDefinition} from './src/domain/growingIsland/worldDefinition.ts';
export {withNative05WaterCarvingScope} from './src/domain/growingIsland/authoredWaterCarving.ts';
export {authoredWorldFrame} from './src/domain/growingIsland/authoredWorldFrame.ts';
export {canPlace,applyIntent} from './src/domain/growingIsland/commands.ts';
export {landCells} from './src/domain/growingIsland/space.ts';
export {derivePlaces} from './src/domain/growingIsland/places.ts';
export {sceneLayout} from './src/components/island/growing/sceneLayout.ts';
export {IslandMaterials} from './src/components/island/three/primitives.ts';
export {buildObjectLayer} from './src/components/island/growing/objectLayer.ts';
export {makeNativeGrowingKit} from './src/components/island/growing/native/nativeGrowingKit.ts';
export {makeNativeAuthoredFlower} from './src/components/island/growing/native/nativeAuthoredFlower.ts';
export {makeNativeAuthoredCove} from './src/components/island/growing/native/nativeAuthoredCove.ts';
export {makeNativeAuthoredShoulder} from './src/components/island/growing/native/nativeAuthoredShoulder.ts';
export {makeNativeAuthoredForest} from './src/components/island/growing/native/nativeAuthoredForest.ts';
export {makeNativeAuthoredGallery} from './src/components/island/growing/native/nativeAuthoredGallery.ts';
`,resolveDir:ROOT},bundle:true,platform:'node',format:'esm',write:false,metafile:true,logLevel:'silent'});
for(const file of Object.keys(bundle.metafile.inputs))if(file!=='<stdin>')read(resolve(process.cwd(),file));
read(`${OUT}/diagnose.mjs`);
writeFileSync(`${OUT}/domain-bundle.mjs`,bundle.outputFiles[0].text);
writeFileSync(`${OUT}/input-hashes-before.json`,JSON.stringify(Object.fromEntries(inputs),null,2));
const d=await import(pathToFileURL(`${OUT}/domain-bundle.mjs`).href),T=d.T;
const options={water:true,cove:true,shoulder:json('prototypes/place-qa/authored-shoulder-profile.json.gz')};
const base=d.withNative05WaterCarvingScope(d.compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
const initialFrame=d.authoredWorldFrame(current,base,options),original=current.landmarks.find(o=>o.id==='l14').cell;
const candidates=d.landCells(current,initialFrame.world).filter(cell=>d.canPlace(current,cell,'l14',initialFrame.world)&&(cell.x!==original.x||cell.z!==original.z)).sort((a,b)=>Math.hypot(a.x-original.x,a.z-original.z)-Math.hypot(b.x-original.x,b.z-original.z));
const target=candidates[0];assert(target);
writeFileSync(`${OUT}/move-selection.json`,JSON.stringify({original,target,orderedLegalCells:candidates,frameRevision:initialFrame.revision},null,2));
console.log('same-driver target',target);
const moved=d.applyIntent(current,{id:'c5-one-move-diagnosis',command:{type:'move',id:'l14',cell:target}},undefined,initialFrame.world).state;
const movedFrame=d.authoredWorldFrame(moved,base,options);
async function glb(file,manifest){const bytes=gunzipSync(read(file));if(manifest)assert.equal(sha(bytes),manifest.artifact.expandedSha256);const source=(await new d.GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer,'')).scene;if(manifest){source.userData.sourceId=manifest.source.id;source.userData.sourceSha256=manifest.artifact.expandedSha256;}return source;}
const nativeManifest=json('docs/design/2026-10-11-native-owned-island/kit-manifest.json');
const native=d.makeNativeGrowingKit(await glb('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'),nativeManifest);
const flower=d.makeNativeAuthoredFlower(json('prototypes/place-qa/native-flower-support.json.gz'));
const cm=json('docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json'),sm=json('prototypes/place-qa/native-shoulder-manifest.json'),fm=json('prototypes/place-qa/native-forest-stage4-manifest.json'),gm=json('prototypes/place-qa/native-gallery-v5-manifest.json');
const cove=d.makeNativeAuthoredCove(await glb(cm.artifact.path.slice(1),cm),cm),shoulder=d.makeNativeAuthoredShoulder(await glb(sm.artifact.path.slice(1),sm),sm);
const forest=d.makeNativeAuthoredForest(await glb(fm.artifact.path.slice(1),fm),fm),gallery=d.makeNativeAuthoredGallery(await glb(gm.artifact.path.slice(1),gm),gm);
const materials=new d.IslandMaterials('moon-garden');
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const sameIds=(a,b)=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
const close=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=1e-8);
function snapshot(state,frame){
 const layout=d.sceneLayout(state,false,frame.world,frame.waterPlan,base,{options,covePlan:frame.covePlan,revision:frame.revision});
 const layer=d.buildObjectLayer(materials,state,layout,undefined,undefined,[],native,flower,cove,shoulder,{forest,gallery});
 layer.root.updateWorldMatrix(true,true);
 const groups=[],attached=[],forestOwners=[];
 layer.root.traverse(o=>{
  if(o.name==='place-native-shared-tree'){
   const authored=new T.Matrix4().makeTranslation(layout.center,0,2).multiply(o.matrixWorld);
   groups.push({name:o.name,visible:visible(o),ownerIds:o.userData.ownerIds,sourceScale:o.userData.sourceScale,authoredMatrix:authored.elements,authoredOrigin:new T.Vector3().setFromMatrixPosition(authored).toArray(),expectedAuthoredOrigin:gm.binding.authoredOrigin,originMatches:close(new T.Vector3().setFromMatrixPosition(authored).toArray(),gm.binding.authoredOrigin),ownersMatch:sameIds(o.userData.ownerIds,gm.binding.owners.map(x=>x.id)),directFactoryAccepted:Boolean(gallery.instance(state,layout,o,native.manifest))});
  }
  if(o.name==='authored-gallery-structure')attached.push({owners:o.userData.ownerIds,placeId:o.userData.placeId,visible:visible(o)});
  if(o.name==='authored-forest-tree')forestOwners.push(o.userData.ownerId);
 });
 const places=d.derivePlaces(state,frame.world).map(p=>({id:p.id,ruleId:p.ruleId,variant:p.variant,stage:p.stage,mainIds:p.mainIds,homeId:p.homeId,seatIds:p.seatIds,revision:p.revision}));
 const expectedOwners=gm.binding.owners.map(x=>x.id);
 const expectedPlace=places.find(p=>p.id===gm.binding.placeId);
 const result={frameRevision:frame.revision,layoutCenter:layout.center,p02Places:places.filter(p=>p.ruleId==='P02'),placesSharingGalleryOwners:places.filter(p=>p.mainIds.some(id=>expectedOwners.includes(id))),sharedTrees:groups,attachedGallery:attached,forestOwners,
 galleryEligibility:{expectedPlaceId:gm.binding.placeId,expectedOwners,ownersUnmovedMature:gm.binding.owners.every(e=>{const o=state.landmarks.find(x=>x.id===e.id);return o?.cell?.x===e.cell.x&&o.cell.z===e.cell.z&&o.growth>=18;}),expectedPlacePresent:Boolean(expectedPlace),expectedPlaceStage:expectedPlace?.stage,expectedPlaceVariant:expectedPlace?.variant,mainIdsMatch:Boolean(expectedPlace&&sameIds(expectedPlace.mainIds,expectedOwners))}};
 layer.dispose();return result;
}
const initial=snapshot(current,initialFrame),after=snapshot(moved,movedFrame);
const failedMeta=ui.failureMetadata;
const afterInputs=Object.fromEntries([...inputs].map(([file])=>[file,sha(readFileSync(file))]));assert.deepEqual(afterInputs,Object.fromEntries(inputs));
const result={status:'One fixed-c5 command and actual objectLayer reproduction, no browser',target,initial,after,uiFailureWholeArt:JSON.parse(failedMeta.authoredWholeArt),uiFailureWorldRevision:failedMeta.worldRevision,worldRevisionMatchesUi:after.frameRevision===failedMeta.worldRevision,galleryBinding:gm.binding,inputsUnchanged:true,inputHashes:Object.fromEntries(inputs),inputObservationsDifferingKeys:differingPreMoveKeys,runtimeOrAppChanged:false,scope:'Only original l14 move, no store/restore rerun or walking/gallery acceptance'};
writeFileSync(`${OUT}/result.json`,JSON.stringify(result,null,2));writeFileSync(`${OUT}/moved-state.json`,JSON.stringify(moved,null,2));
console.log(JSON.stringify({target,initial:initial.galleryEligibility,after:after.galleryEligibility,sharedAfter:after.sharedTrees,attachedAfter:after.attachedGallery,worldRevisionMatchesUi:result.worldRevisionMatchesUi},null,2));
forest.dispose();gallery.dispose();shoulder.dispose();cove.dispose();flower.dispose();native.dispose();materials.dispose();
