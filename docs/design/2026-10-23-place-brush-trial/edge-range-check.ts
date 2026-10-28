import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import snapshot from './evidence/assembly-v20-B-central-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainEditingRevision, TERRAIN_MIN } from '../../../src/domain/growingIsland/terrainEditing';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
const initial=structuredClone(snapshot.evidence.state) as unknown as GrowingState;
const reports: unknown[]=[];let seq=0;
for(const cell of [{x:-3,z:0},{x:8,z:0},{x:-3,z:3},{x:8,z:3},{x:0,z:0},{x:3,z:0}]) {
 let state=structuredClone(initial);const id=`${cell.x},${cell.z}`,before=state.terrain!.heights[id]??0;
 let failure:string|undefined;
 const initialFloor=editableIslandWorld(state)!.floorAt(cell)?.point;
 while((state.terrain!.heights[id]??0)>TERRAIN_MIN) {
  try {state=applyIntent(state,{id:`edge-limit-${++seq}`,command:{type:'terrain-edit',cell,delta:-1,actors:[],occupiedPlaceTargets:[],expectedTerrainRevision:terrainEditingRevision(state)}},1000).state;}
  catch(error){failure=String(error);break;}
 }
 const floor=editableIslandWorld(state)!.floorAt(cell)?.point;
 assert.deepEqual(state.landmarks,initial.landmarks);assert.deepEqual(state.land,initial.land);assert.equal(state.drops,initial.drops);
 reports.push({cell,before,after:state.terrain!.heights[id]??0,initialFloor,floor,failure});
}
console.log(JSON.stringify({status:'PASS',scope:'Ordinary-command boundary range diagnostic without live actors; not browser proof',reports}));
