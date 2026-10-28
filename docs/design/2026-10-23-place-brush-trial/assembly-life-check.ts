import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import * as T from 'three';
import aOne from './evidence/two-bay-v21-A-one-state.json';
import aTwo from './evidence/two-bay-v21-A-two-state.json';
import bOne from './evidence/two-bay-v21-B-one-state.json';
import bTwo from './evidence/two-bay-v21-B-two-state.json';
import { HOME_CELL, walkableCells } from '../../../src/domain/growingIsland/space';
import { editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainFootingError } from '../../../src/domain/growingIsland/terrainEditing';
import type { GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { GrowingLife } from '../../../src/components/island/growing/growingLife';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
const reports:unknown[]=[];
for(const [label,one,two,destination] of [['A',aOne,aTwo,{x:-3,z:.5}],['B',bOne,bTwo,{x:8,z:4}]] as const){
 const before=structuredClone(one.evidence.state) as unknown as GrowingState,after=structuredClone(two.evidence.state) as unknown as GrowingState;
 const m=new IslandMaterials('moon-garden'),actor={id:'pokomoko',root:new T.Group(),body:new T.Group(),feet:[]};
 const life=new GrowingLife(m,actor),a=sceneLayout(before,true),b=sceneLayout(after,true),la=buildObjectLayer(m,before,a),lb=buildObjectLayer(m,after,b);
 try{
  assert.equal(terrainFootingError(before,after,[HOME_CELL]),undefined);
  const oldRoute=a.world.route(HOME_CELL,destination,walkableCells(before,a.world));assert(oldRoute);
  assert.equal(b.world.route(HOME_CELL,destination,walkableCells(after,b.world)),undefined);
  life.sync(before,a,la);
  const walker=(life as unknown as {walkers:Map<string,{at:Cell;path:Cell[];mode:string;until:number}>}).walkers.get('pokomoko')!;
  // Explicit synthetic pose/path diagnostic. Browser evidence uses normal actors separately.
  walker.at={...HOME_CELL};walker.path=oldRoute.slice(1);walker.mode='walk';walker.until=0;
  life.tick(10,0,true,false);const at={...walker.at},position=actor.root.position.clone();life.takePlaceUses();
  life.sync(after,b,lb);assert.deepEqual(walker.at,at);assert.equal(actor.root.position.x,position.x);assert.equal(actor.root.position.z,position.z);
  assert.deepEqual(walker.path,[]);assert.equal(life.takePlaceUses().length,0);
  let previous={...walker.at},moved=0,maxStep=0;
  for(let frame=1;frame<=300;frame++){
   life.tick(100+frame*16,16,true,false);
   assert(b.world.floorAt(walker.at));const step=Math.hypot(walker.at.x-previous.x,walker.at.z-previous.z);maxStep=Math.max(maxStep,step);
   assert(step<.03);if(step>1e-8){assert(editableTerrainSegmentSupported(b.world,previous,walker.at));moved++;}previous={...walker.at};
  }
  reports.push({label,cutDestination:destination,initialPose:at,poseRetained:true,staleRouteCleared:true,noUseOnInvalidation:true,frames:300,movedFrames:moved,maxStep,finalPose:walker.at});
 }finally{life.dispose();la.dispose();lb.dispose();m.dispose();}
}
console.log(JSON.stringify({status:'PASS',scope:'Actual GrowingLife over transformed A/B terrain, explicit synthetic diagnostic pose; no GPU, no independent visual collision or child-UX claim',reports}));
