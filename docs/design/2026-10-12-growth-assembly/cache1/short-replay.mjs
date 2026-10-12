import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as d from './domain-bundle.mjs';
const ROOT='/Users/yutogasaki/Projects/sansu',OUT='/private/tmp/sansu-growth-cache1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const originalInputs=JSON.parse(readFileSync(`${OUT}/inventory.json`)).inputs;
for(const [p,h] of Object.entries(originalInputs))assert.equal(sha(readFileSync(p)),h,p);
const json=f=>JSON.parse((f.endsWith('.gz')?gunzipSync(readFileSync(`${ROOT}/${f}`)):readFileSync(`${ROOT}/${f}`)).toString());
const initial=json('prototypes/place-qa/authored-shoulder-reference-mature.json').state;
const base=d.withNative05WaterCarvingScope(d.compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
const options={water:true,cove:true,shoulder:json('prototypes/place-qa/authored-shoulder-profile.json.gz')};
const frame=s=>d.authoredWorldFrame(s,base,options),ids=['l14','l15','l28','l29'];
const first=frame(initial),owners=s=>[...s.plots,...s.landmarks,...s.keepsakes],key=c=>`${c.x},${c.z}`;
function invariants(s,w){
 const rest=s=>owners(s).filter(o=>!ids.includes(o.id));
 assert.deepEqual(rest(s),rest(initial),'Other owners changed');
 for(const id of ids){const clean=o=>{const x=structuredClone(o);delete x.cell;return x;};assert.deepEqual(clean(s.landmarks.find(o=>o.id===id)),clean(initial.landmarks.find(o=>o.id===id)));}
 assert.deepEqual(s.land,initial.land);assert.equal(s.drops,initial.drops);assert.deepEqual(s.town,initial.town);assert.deepEqual(s.nature,initial.nature);assert.equal(s.nextId,initial.nextId);
 const rights=world=>d.landCells(s,world).map(key).sort();assert.deepEqual(rights(w),rights(first.world));
 return {owners:owners(s).length,placedOwners:owners(s).filter(o=>o.cell).length,rights:rights(w).length,drops:s.drops,otherOwnersExact:true,treeFieldsExceptCellExact:true,townNatureLandExact:true,newOwnerOrRights:false};
}
function snapshot(s,f){
 const w=f.world,open=d.walkableCells(s,w),reached=d.reachableFromHome(s,open,w);
 const access=owners(s).filter(o=>o.cell).map(o=>({id:o.id,cell:o.cell,reachedApproaches:d.approachCells(o.cell,w).filter(c=>reached.has(d.key(c))).length}));
 const places=d.derivePlaces(s,w).map(p=>({id:p.id,ruleId:p.ruleId,variant:p.variant,stage:p.stage,mainIds:p.mainIds,memberIds:p.memberIds,entrances:p.entrances.length,missing:p.missing}));
 return {revision:f.revision,invariants:invariants(s,w),trees:ids.map(id=>{const o=s.landmarks.find(o=>o.id===id);return{id,cell:o.cell,growth:o.growth,age:d.treeAge(s,id),floor:o.cell?w.floorAt(o.cell)?.point:undefined,placementSupport:o.cell?d.hasAuthoredPlacementSupport(w,o.cell):undefined};}),places:places.filter(p=>p.ruleId==='P02'||p.mainIds.some(id=>ids.includes(id))),allPlaces:places,path:{scope:'Current domain walk graph; no actual tree/canopy mesh or body-envelope clearance test',open:open.size,reached:reached.size,ownerApproaches:access,unreachedOwners:access.filter(a=>a.reachedApproaches===0).map(a=>a.id)},coveAssemblyCount:f.covePlan?.assemblies.length};
}

const plan=JSON.parse(readFileSync(`${OUT}/arrangements.json`)).find(p=>p.id===process.argv[2]);assert(plan);
const output=`${OUT}/${plan.id}-result.json`,steps=[];
let state=plan.id==='west-open-center'?JSON.parse(readFileSync(`${OUT}/${plan.id}-state.json`)):initial;
function command(c){
 const f=frame(state);if(c.cell)assert(d.canPlace(state,c.cell,c.type==='move'?c.id:undefined,f.world));
 const beforeCell=state.landmarks.find(o=>o.id===c.id).cell;
 const result=d.applyIntent(state,{id:`layout-short-${plan.id}-${steps.length}`,command:c},undefined,f.world);state=result.state;
 const after=frame(state),proof=invariants(state,after.world);
 steps.push({command:c,beforeCell,invariants:proof,events:result.events,revision:after.revision});
 writeFileSync(`${OUT}/${plan.id}-progress.json`,JSON.stringify({steps},null,2));
}
if(plan.id!=='west-open-center')for(const move of plan.moves)command({type:'move',id:move.id,cell:{x:move.cell[0],z:move.cell[1]}});
const result=snapshot(state,frame(state));writeFileSync(`${OUT}/${plan.id}-state.json`,JSON.stringify(state,null,2));
let storeProbe;
if(plan.id==='west-open-center'){
 const before=state,cell=state.landmarks.find(o=>o.id==='l15').cell;
 command({type:'store',id:'l15'});const stored=snapshot(state,frame(state));
 command({type:'unstore',id:'l15',cell});
 const clean=v=>{const x=structuredClone(v);delete x.applied;delete x.placeProgress;return x;};assert.deepEqual(clean(state),clean(before));
 storeProbe={stored,restored:snapshot(state,frame(state)),exactExceptReceiptsAndPlaceProgress:true};
}
for(const [p,h] of Object.entries(originalInputs))assert.equal(sha(readFileSync(p)),h,p);
const report={id:plan.id,description:plan.description,commands:plan.moves.map(m=>({type:'move',id:m.id,cell:{x:m.cell[0],z:m.cell[1]}})),steps,result,storeProbe,scope:'Current domain only; no browser, renderer or actual-mesh clearance',inputsUnchanged:true,inputHashes:originalInputs,generatedAt:new Date().toISOString(),sourceBundleSha256:sha(readFileSync(`${OUT}/domain-bundle.mjs`))};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({id:plan.id,result:result.trees,places:result.places,unreached:result.path.unreachedOwners,storeProbe:!!storeProbe}));
