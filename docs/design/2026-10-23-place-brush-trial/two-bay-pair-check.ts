import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import aOne from './evidence/two-bay-v21-A-one-state.json';
import aTwo from './evidence/two-bay-v21-A-two-state.json';
import bOne from './evidence/two-bay-v21-B-one-state.json';
import bTwo from './evidence/two-bay-v21-B-two-state.json';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, landCells, walkableCells, reachableFromHome, key } from '../../../src/domain/growingIsland/space';
import { authoredOwnerApproaches } from '../../../src/components/island/growing/authoredFlowerObstructions';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { terrainFootingError } from '../../../src/domain/growingIsland/terrainEditing';
import { compositeOf } from './composite-field';
import { assertCompositeGeometry } from './composite-model';
const reports:unknown[]=[];
let failedConnectivity = false;
for(const [label,one,two] of [['A',aOne,aTwo],['B',bOne,bTwo]] as const) {
 const before=one.evidence.state as unknown as GrowingState, after=two.evidence.state as unknown as GrowingState;
 for(const k of ['land','landmarks','drops','terrain'] as const)assert.deepEqual(before[k],after[k]);
 for(const k of ['west','east','bay'] as const)assert.deepEqual(compositeOf(before)![k],compositeOf(after)![k]);
 assertCompositeGeometry(before);assertCompositeGeometry(after);
 const a=editableIslandWorld(before)!,b=editableIslandWorld(after)!,oa=walkableCells(before,a),ob=walkableCells(after,b);
 const cells=landCells(after),lost=cells.filter(c=>a.route(HOME_CELL,c,oa)&&!b.route(HOME_CELL,c,ob));
 const lostDry=lost.filter(c=>b.floorAt(c)).map(c=>({cell:c,point:b.floorAt(c)!.point,walkable:ob.has(key(c))}));
 const reachedBefore=reachableFromHome(before,oa,a),reachedAfter=reachableFromHome(after,ob,b);
 const newlyDisconnected=[...ob].filter(id=>reachedBefore.has(id)&&!reachedAfter.has(id));
 const approaches=authoredOwnerApproaches(after.landmarks,b,ob,reachedAfter);
 const targets=derivePlaces(after).flatMap(p=>p.useTargets.map(t=>({place:p.id,target:t.id,kind:t.kind,cell:t.cell}))).map(t=>{
  const endpoint=['seat','play'].includes(t.kind)?approaches.get(key(t.cell))?.[0]:t.cell;
  const route=endpoint?b.route(HOME_CELL,endpoint,ob):undefined;return {...t,endpoint,route,allSegmentsSupported:!!route&&route.slice(1).every((c,i)=>editableTerrainSegmentSupported(b,route[i],c))};
 });
 assert(targets.length>=2);assert(targets.every(t=>t.allSegmentsSupported));failedConnectivity ||= newlyDisconnected.length > 0;
 reports.push({label,landCells:cells.length,beforeReachable:cells.filter(c=>a.route(HOME_CELL,c,oa)).length,
  afterReachable:cells.filter(c=>b.route(HOME_CELL,c,ob)).length,lost,lostDry,newlyDisconnected,actorProtection: newlyDisconnected.map(id=>{const [x,z]=id.split(',').map(Number);return {id,error:terrainFootingError(before,after,[{x,z}])??null};}),targets});
}
assert.deepEqual(aTwo.evidence.state.land,bTwo.evidence.state.land);assert.equal(aTwo.evidence.state.drops,bTwo.evidence.state.drops);
const inventory=(s:GrowingState)=>s.landmarks.map(({cell: _cell,...owner})=>{void _cell;return owner;}).sort((a,b)=>a.id.localeCompare(b.id));
assert.deepEqual(inventory(aTwo.evidence.state as unknown as GrowingState),inventory(bTwo.evidence.state as unknown as GrowingState));
console.log(JSON.stringify({status:failedConnectivity?'FAIL_CONNECTIVITY':'PASS',scope:'Actual UI snapshot pair audit, same land/inventory/balance; ground route resampling to runtime owner approaches; full rendered-obstacle collision and live animation are separate evidence',reports}));
