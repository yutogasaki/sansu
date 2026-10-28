import assert from 'node:assert/strict';
import * as T from 'three';
import { trialInitialRecord } from './trial-store';
import { matureRearrangement } from './mature-composition';
import { connectionPatch, connectionBank } from './connection-seams';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { GardenGeometry } from '../../../src/components/island/three/garden/geometry';
import { placePondGeometry } from '../../../src/components/island/growing/placePondGeometry';
let state=trialInitialRecord().state;const original=structuredClone(state),reports:unknown[]=[];let serial=0;
for(const layoutId of ['A','B','A'] as const){
 if(reports.length)for(const command of matureRearrangement(state,layoutId))state=applyIntent(state,{id:`join-${serial++}`,command},Date.now()).state;
 const before=JSON.stringify(state),world=editableIslandWorld(state)!,layout=sceneLayout(state),places=derivePlaces(state,world);
 const gallery=places.find(p=>p.ruleId==='P02')!;assert(gallery.walkSurface.length>30,'actual gallery remains');
 const trees=state.landmarks.filter(p=>p.kind==='sapling').map(p=>p.cell!);
 const entranceDistance=Math.min(...trees.map(p=>Math.hypot(p.x-gallery.walkSurface[0].x,p.z-gallery.walkSurface[0].z)));
 assert(entranceDistance<=1.45,'stairs stay near their trees');
 for(const p of gallery.walkSurface)assert(world.floorAt(p),'gallery still has measured ground beneath');
 const g=new GardenGeometry();connectionPatch(g,layout,trees,'#886f57',.65,'test-root');
 const pond=placePondGeometry(state,layout,places.find(p=>p.ruleId==='P03')!,places);assert(pond);connectionBank(g,layout,pond.geometry);
 let vertices=0;g.root.traverse(o=>{if(!(o instanceof T.Mesh))return;const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const logical=layout.logicalAt({x:p.getX(i),z:p.getZ(i)});assert(world.floorAt(logical));vertices++;}});
 assert.equal(JSON.stringify(state),before,'material and assembly do not mutate state');assert.equal(state.drops,original.drops);
 reports.push({layout:layoutId,entrance:gallery.walkSurface[0],entranceDistance,routePoints:gallery.walkSurface.length,supportedMaterialVertices:vertices});
}
assert.deepEqual(state.landmarks,original.landmarks);
console.log(JSON.stringify({status:'PASS',at:new Date().toISOString(),reports,scope:'actual transformed domain routes and material supports; not full mesh/body collision or child acceptance'}));
