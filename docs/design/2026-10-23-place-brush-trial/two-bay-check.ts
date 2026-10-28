import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import snapshot from './evidence/assembly-v20-low-layout-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, landCells, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf, type PlaceSlot } from './composite-field';
import { compositeEditingRevision } from './composite-model';
import type { PlaceShape } from './directional-field';
const original=structuredClone(snapshot.evidence.state) as unknown as GrowingState;
const reports: unknown[]=[];let seq=0;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function edit(state:GrowingState,slot:PlaceSlot,shape?:PlaceShape,action:'apply'|'undo'|'redo'='apply') {
 return applyIntent(state,{id:`two-bay-${++seq}`,command:{type:'place-set',slot,action,shape,safety:{actors:[],occupiedPlaceTargets:[]},expectedPlaceRevision:compositeEditingRevision(state)}},1000).state;
}
const baseline=editableIslandWorld(original)!;
for(const center of [{x:-2,z:0},{x:7,z:0},{x:8,z:3}]) for(const bayDepth of [1.6,2.4]) {
 const shape:PlaceShape={center,radius:2,height:-.55,entrance:1.2,bayDepth};let state:GrowingState;
 try{state=edit(original,'bay2',shape);}catch(error){reports.push({center,bayDepth,accepted:false,reason:String(error)});continue;}
 assert.deepEqual(state.landmarks,original.landmarks);assert.deepEqual(state.land,original.land);assert.equal(state.drops,original.drops);
 assert.deepEqual(compositeOf(state)!.bay,compositeOf(original)!.bay);
 const world=editableIslandWorld(state)!,open=walkableCells(state,world);
 const undo=edit(state,'bay2',undefined,'undo');assert.deepEqual(compositeOf(undo),compositeOf(original));assert.equal(sha(editableIslandWorld(undo)!.floors),sha(baseline.floors));
 const redo=edit(undo,'bay2',undefined,'redo');assert.equal(sha(editableIslandWorld(redo)!.floors),sha(world.floors));
 const withoutBoth={...structuredClone(original),trialPlaceSet:{...compositeOf(original),bay:undefined,bay2:undefined},trialPlaceSetHistory:{version:1,undo:[],redo:[]}};
 delete withoutBoth.trialPlaceSet.bay;delete withoutBoth.trialPlaceSet.bay2;
 const reverse=edit(edit(withoutBoth,'bay2',shape),'bay',compositeOf(original)!.bay);
 assert.equal(sha(editableIslandWorld(reverse)!.floors),sha(world.floors));
 let changed=0,submerged=0;
 for(const floor of baseline.floors)for(const v of floor.vertices){if(floor.kind==='water')continue;const old=baseline.floorAt(v.cell),next=world.floorAt(v.cell);if(old&&next){assert(next.point.y<=old.point.y+1e-8);if(next.point.y<old.point.y-1e-8)changed++;}else if(old&&!next)submerged++;}
 assert(changed+submerged>0);
 reports.push({center,bayDepth,accepted:true,changed,submerged,destinations:landCells(state).filter(c=>world.route(HOME_CELL,c,open)).length,floorHash:sha(world.floors),state});
}
assert(reports.filter(r => (r as { accepted?: boolean }).accepted).length >= 2);
console.log(JSON.stringify({status:'PASS',scope:'Two independent lower-only bays, actual transformed domain and floor; no live actor/browser claim',reports}));
