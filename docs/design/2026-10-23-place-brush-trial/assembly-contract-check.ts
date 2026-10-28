import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import aOne from './evidence/two-bay-v21-A-one-state.json';
import aTwo from './evidence/two-bay-v21-A-two-state.json';
import bOne from './evidence/two-bay-v21-B-one-state.json';
import bTwo from './evidence/two-bay-v21-B-two-state.json';
import { GrowingIslandDatabase, commandGrowingIsland, readGrowingIsland } from '../../../src/domain/growingIsland/repository';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainFootingError } from '../../../src/domain/growingIsland/terrainEditing';
import { HOME_CELL, reachableFromHome, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import { compositeOf } from './composite-field';
import { compositeEditingRevision, compositeConnectivityLoss } from './composite-model';
import type { PlaceShape } from './directional-field';
import { ASSEMBLY_DATABASE, ASSEMBLY_PROFILE, ASSEMBLY_SAVE_RECIPE, assemblyInitialRecord, openAssemblyTrial } from './assembly-store';
const reports:unknown[]=[];let seq=0;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const db=new GrowingIslandDatabase(ASSEMBLY_DATABASE);
const read=async()=> (await readGrowingIsland(ASSEMBLY_PROFILE,db))!;
async function send(action:'apply'|'undo'|'redo',actors:Cell[],shape?:PlaceShape){const r=await read();return(await commandGrowingIsland(ASSEMBLY_PROFILE,{id:`contract-${++seq}`,command:{type:'place-set',slot:'bay2',action,shape,safety:{actors,occupiedPlaceTargets:[]},expectedPlaceRevision:compositeEditingRevision(r.state)}},1000,db)).record;}
try{
 assert.equal(ASSEMBLY_DATABASE,'SansuAssemblyTrialV2');await openAssemblyTrial(db,1000);
 for(const [label,one,two] of [['A',aOne,aTwo],['B',bOne,bTwo]] as const){
  const before=structuredClone(one.evidence.state) as unknown as GrowingState,after=two.evidence.state as unknown as GrowingState;
  // Explicit seeded repository diagnostic from actual UI snapshots, not a browser journey.
  const fixture=assemblyInitialRecord();fixture.state={...before,trialPlaceSetRecipe:ASSEMBLY_SAVE_RECIPE} as typeof fixture.state;
  await db.islands.put(fixture);const initialHash=sha(await read());
  const lost=compositeConnectivityLoss(before,after),shape=compositeOf(after)!.bay2!;
  assert(lost.length>0);
  for(const id of lost){const [x,z]=id.split(',').map(Number);await assert.rejects(send('apply',[{x,z}],shape),/なかまが いる/);assert.equal(sha(await read()),initialHash);}
  const edited=await send('apply',[HOME_CELL],shape);assert.deepEqual(compositeOf(edited.state),compositeOf(after));
  const beforeWorld=editableIslandWorld(before)!,world=editableIslandWorld(edited.state)!;
  const reached=reachableFromHome(edited.state,walkableCells(edited.state,world),world);
  const undoBlocked=world.walkSites.find(site=>reached.has(`${site.cell.x},${site.cell.z}`)&&!terrainFootingError(edited.state,edited.state,[site.cell])&&terrainFootingError(edited.state,before,[site.cell]));
  assert(undoBlocked,'a currently usable changed floor is needed for the unsafe-undo case');
  const editedHash=sha(await read());await assert.rejects(send('undo',[undoBlocked.cell]),/なかまが いる/);assert.equal(sha(await read()),editedHash);
  const undone=await send('undo',[HOME_CELL]);assert.equal(sha(editableIslandWorld(undone.state)!.floors),sha(beforeWorld.floors));
  const redone=await send('redo',[HOME_CELL]);assert.equal(sha(editableIslandWorld(redone.state)!.floors),sha(world.floors));
  db.close();await db.open();const reloaded=await openAssemblyTrial(db);assert.deepEqual(reloaded,redone);
  reports.push({label,lostSites:lost,rejectedOccupiedEdits:lost.length,rejectedUndoActor:undoBlocked.cell,atomicRecordPreserved:true,safeUndoRedoFloorEqual:true,reloadEqual:true,revision:reloaded.revision});
 }
 console.log(JSON.stringify({status:'PASS',scope:'Specification 52 §1.1: actual actor support, legal route cuts, atomic writer and undo safety, actual floor restoration. Explicit fake-IDB diagnostic, no browser actor injection or general safety certification.',reports}));
}finally{db.close();}
