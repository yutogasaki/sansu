import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import snapshot from './evidence/assembly-v20-B-central-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainEditingRevision } from '../../../src/domain/growingIsland/terrainEditing';
import { landCells, HOME_CELL, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf } from './composite-field';
import { compositeEditingRevision } from './composite-model';
import type { PlaceShape } from './directional-field';

const original = structuredClone(snapshot.evidence.state) as unknown as GrowingState;
const reports: unknown[] = []; let sequence = 0;
for (const height of [.5]) for (const direction of ['west', 'east', 'north', 'south'] as const) {
 let state = structuredClone(original); let rampFailure: string | undefined;
 try { state = applyIntent(state, { id: `layout-ramp-${++sequence}`, command: { type: 'place-set', action: 'apply', slot: 'east',
  shape: { ...compositeOf(state)!.east!, rampDirection: direction, height } as PlaceShape,
  safety: { actors: [], occupiedPlaceTargets: [] }, expectedPlaceRevision: compositeEditingRevision(state) } },1000).state; }
 catch(error) { rampFailure = String(error); }
 if(rampFailure) { reports.push({height,direction,rampFailure}); continue; }
 const steps: unknown[] = [], failures: unknown[] = [];
 for(const z of [3,4,5,6]) for(const x of [1,2,3]) {
  const cell={x,z};
  while((state.terrain!.heights[`${x},${z}`]??0)>0) {
   const before=state.terrain!.heights[`${x},${z}`]??0;
   const point=editableIslandWorld(state)!.floorAt(cell)?.point;
   try { state=applyIntent(state,{id:`layout-cell-${++sequence}`,command:{type:'terrain-edit',cell,delta:-1,
    actors:[],occupiedPlaceTargets:[],expectedTerrainRevision:terrainEditingRevision(state)}},1000).state;
    steps.push({cell,before,after:before-1,point}); }
   catch(error) {failures.push({cell,before,reason:String(error)});break;}
  }
 }
 assert.deepEqual(state.landmarks,original.landmarks);assert.equal(state.drops,original.drops);assert.deepEqual(state.land,original.land);
 const world=editableIslandWorld(state)!,open=walkableCells(state,world);
 reports.push({height,direction,steps,failures,destinations:landCells(state).filter(c=>world.route(HOME_CELL,c,open)).length,state});
}
console.log(JSON.stringify({status:'PASS',scope:'Feasibility diagnostic via ordinary commands; live actors absent; not browser evidence.',reports}));
