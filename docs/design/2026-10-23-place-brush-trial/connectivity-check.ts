import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import aOne from './evidence/two-bay-v21-A-one-state.json';
import aTwo from './evidence/two-bay-v21-A-two-state.json';
import bOne from './evidence/two-bay-v21-B-one-state.json';
import bTwo from './evidence/two-bay-v21-B-two-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, walkableCells, reachableFromHome } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf } from './composite-field';
import { compositeEditingRevision, compositeConnectivityLoss } from './composite-model';
import { assemblyInitialRecord } from './assembly-store';
import type { PlaceShape } from './directional-field';
const reports:unknown[]=[];let seq=0;
const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function edit(state:GrowingState,shape?:PlaceShape,action:'apply'|'undo'|'redo'='apply') {
 return applyIntent(state,{id:`connectivity-${++seq}`,command:{type:'place-set',slot:'bay2',action,shape,safety:{actors:[],occupiedPlaceTargets:[]},expectedPlaceRevision:compositeEditingRevision(state)}},1000).state;
}
for(const [label,one] of [['A',aOne],['B',bOne]] as const) {
 let state=assemblyInitialRecord().state;const steps:unknown[]=[];
 for(const slot of ['west','east','bay'] as const) {
  const shape=compositeOf(one.evidence.state)![slot];
  try {
   const next=applyIntent(state,{id:`start-${label}-${slot}`,command:{type:'place-set',slot,action:'apply',shape,safety:{actors:[],occupiedPlaceTargets:[]},expectedPlaceRevision:compositeEditingRevision(state)}},1000).state;
   assert.deepEqual(compositeConnectivityLoss(state,next),[]);state=next;steps.push({slot,accepted:true});
  } catch(error){steps.push({slot,accepted:false,error:String(error)});break;}
 }
 reports.push({label:`fresh-${label}`,steps});
}
for(const [label,one,two] of [['A',aOne,aTwo],['B',bOne,bTwo]] as const) {
 const before=structuredClone(one.evidence.state) as unknown as GrowingState, unsafe=two.evidence.state as unknown as GrowingState;
 const loss=compositeConnectivityLoss(before,unsafe); assert(loss.length>0);
 const original=sha(before), unsafeShape=compositeOf(unsafe)!.bay2!;
 assert.throws(()=>edit(before,unsafeShape),/行けなくなる地面/);assert.equal(sha(before),original);
 const a=editableIslandWorld(before)!,openA=walkableCells(before,a),reachA=reachableFromHome(before,openA,a);
 const trials:unknown[]=[];let accepted=0;
 for(const center of [unsafeShape.center,{x:-2,z:0},{x:7,z:0}]) for(const radius of [1.2,2])for(const bayDepth of [.8]) {
  const shape={...unsafeShape,center,radius,bayDepth};let next:GrowingState;
  try{next=edit(before,shape);}catch(error){trials.push({shape,accepted:false,error:String(error)});continue;}
  accepted++;assert.deepEqual(compositeConnectivityLoss(before,next),[]);assert.equal(sha(before),original);
  const b=editableIslandWorld(next)!,openB=walkableCells(next,b),reachB=reachableFromHome(next,openB,b);
  const removed=[...reachA].filter(id=>!openB.has(id));
  const reintroduced=[...openB].filter(id=>!openA.has(id)&&!reachB.has(id));
  const routeChanged=[...reachB].filter(id=>reachA.has(id)).slice(0,30).filter(id=>{
   const [x,z]=id.split(',').map(Number),cell={x,z};return sha(a.route(HOME_CELL,cell,openA))!==sha(b.route(HOME_CELL,cell,openB));
  });
  const undone=edit(next,undefined,'undo');assert.equal(sha(editableIslandWorld(undone)!.floors),sha(a.floors));
  const redone=edit(undone,undefined,'redo');assert.equal(sha(editableIslandWorld(redone)!.floors),sha(b.floors));
  trials.push({shape,accepted:true,removed,reintroduced,routeChanged,floorHash:sha(b.floors),reachable:reachB.size});
 }
 reports.push({label,knownUnsafeRejected:true,unchangedOnReject:true,knownLostSites:loss,baselineUnreachable:[...openA].filter(id=>!reachA.has(id)),accepted,trials});
}
console.log(JSON.stringify({status:'PASS',scope:'Retained home-reachable walk-site guard, actual before/after floor graph, atomic rejection; candidate sweep does not claim all arrangements safe',reports}));
