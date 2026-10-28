import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GrowingIslandDatabase, commandGrowingIsland, readGrowingIsland } from '../../../src/domain/growingIsland/repository';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { reachableFromHome, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeEditingRevision, compositeConnectivityLoss } from './composite-model';
import { compositeOf, type PlaceSlot } from './composite-field';
import type { PlaceShape } from './directional-field';
import { ASSEMBLY_DATABASE, ASSEMBLY_PROFILE, openAssemblyTrial } from './assembly-store';
const db=new GrowingIslandDatabase(ASSEMBLY_DATABASE),reports:unknown[]=[];let seq=0;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const read=async()=> (await readGrowingIsland(ASSEMBLY_PROFILE,db))!;
async function edit(slot:PlaceSlot,shape?:PlaceShape,action:'apply'|'undo'|'redo'='apply'){
 const current=await read(); return(await commandGrowingIsland(ASSEMBLY_PROFILE,{id:`guard-save-${++seq}`,command:{type:'place-set',slot,shape,action,safety:{actors:[],occupiedPlaceTargets:[]},expectedPlaceRevision:compositeEditingRevision(current.state)}},1000,db)).record;
}
function geometry(state:GrowingState){const w=editableIslandWorld(state)!;return {floor:sha(w.floors),reachable:sha([...reachableFromHome(state,walkableCells(state,w),w)].sort())};}
try{
 assert.equal(ASSEMBLY_DATABASE,'SansuAssemblyTrialV3');
 const initial=await openAssemblyTrial(db,1000),firstGeometry=geometry(initial.state);
 const west:PlaceShape={center:{x:-1,z:4},radius:1.6,height:.5,entrance:1.2,flatRadius:1.75};
 const record=await edit('west',west),beforeReject=sha(record),beforeGeometry=geometry(record.state);
 assert.deepEqual(compositeConnectivityLoss(initial.state,record.state),[]);
 await assert.rejects(edit('east',{...west,center:{x:5,z:5}}),/行けなくなる地面/);
 assert.equal(sha(await read()),beforeReject);assert.deepEqual(geometry((await read()).state),beforeGeometry);
 reports.push({name:'unsafe east platform rejected atomically',beforeHash:beforeReject,afterHash:sha(await read()),unchangedRevision:record.revision});
 const undo=await edit('west',undefined,'undo');assert.deepEqual(geometry(undo.state),firstGeometry);
 db.close();await db.open();const reopened=await openAssemblyTrial(db);assert.deepEqual(reopened,undo);
 const redo=await edit('west',undefined,'redo');assert.deepEqual(compositeOf(redo.state),compositeOf(record.state));assert.deepEqual(geometry(redo.state),beforeGeometry);
 db.close();await db.open();assert.deepEqual(await openAssemblyTrial(db),redo);
 reports.push({name:'accepted low platform undo, reload, redo, reload',geometry:beforeGeometry,revision:redo.revision});
 for(const name of ['SansuAssemblyTrialV1','SansuAssemblyTrialV2']){
  const old=new GrowingIslandDatabase(name);try{await assert.rejects(openAssemblyTrial(old));assert.equal(old.isOpen(),false);}finally{old.close();}
 }
 reports.push({name:'old assembly databases refused before open'});
 console.log(JSON.stringify({status:'PASS',scope:'Real repository with fake IndexedDB; initial fixture, safe low platform, unsafe east rejection. Does NOT establish a safe two-platform/two-bay pair.',reports}));
}finally{db.close();}
