import assert from 'node:assert/strict';
import * as T from 'three';
import {trialInitialRecord} from './trial-store';
import {matureRearrangement} from './mature-composition';
import {buildWaterModules,waterModulePlan} from './water-modules';
import {applyIntent} from '../../../src/domain/growingIsland/commands';
import {derivePlaces} from '../../../src/domain/growingIsland/places';
import {sceneLayout} from '../../../src/components/island/growing/sceneLayout';
import {GardenGeometry} from '../../../src/components/island/three/garden/geometry';
let state=trialInitialRecord().state;const initial=structuredClone(state),reports:unknown[]=[];let serial=0;
for(const configuration of ['A','B','A'] as const){
 if(reports.length)for(const command of matureRearrangement(state,configuration))state=applyIntent(state,{id:`method-${serial++}`,command},Date.now()).state;
 const layout=sceneLayout(state),places=derivePlaces(state,layout.world),place=places.find(p=>p.ruleId==='P03')!;
 assert(place,'water place persists');const plan=waterModulePlan(state,place,layout),before=JSON.stringify(state);
 assert.equal(plan.modules.length,5);
 for(const m of plan.modules)for(const port of m.ports){const other=plan.modules.find(p=>p.owner.id===port.id)!;assert(other.ports.some(p=>p.id===m.owner.id));}
 const g=new GardenGeometry();assert(buildWaterModules(g,state,layout,place));let vertices=0,meshes=0;
 g.root.updateMatrixWorld(true);g.root.traverse(o=>{if(!(o instanceof T.Mesh))return;meshes++;assert(state.landmarks.some(p=>p.id===o.userData.ownerId));
  const p=o.geometry.getAttribute('position');for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);assert(layout.world.floorAt(layout.logicalAt(v)));vertices++;}});
 assert.equal(JSON.stringify(state),before);assert.equal(state.drops,initial.drops);
 reports.push({configuration,modules:plan.modules.length,ports:plan.modules.reduce((n,m)=>n+m.ports.length,0),vertices,meshes,revision:plan.revision,targets:place.useTargets.map(t=>({kind:t.kind,cell:t.cell})),rejectedFaces:g.root.children[0].userData.rejectedFaces});
}
assert.deepEqual(state.landmarks,initial.landmarks);
// Real terrain command followed by undo; do not silently inject a different floor.
const beforeEdit=structuredClone(state);
assert.throws(()=>applyIntent(state,{id:'occupied-water',command:{type:'terrain-edit',cell:{x:4,z:4},delta:1}},Date.now()),/足もと/);
state=applyIntent(state,{id:`terrain-${serial++}`,command:{type:'terrain-edit',cell:{x:4,z:2},delta:1}},Date.now()).state;
assert.notDeepEqual(state.terrain,beforeEdit.terrain);
const changedLayout=sceneLayout(state),changedPlace=derivePlaces(state,changedLayout.world).find(p=>p.ruleId==='P03')!;
const changedGeometry=new GardenGeometry();assert(buildWaterModules(changedGeometry,state,changedLayout,changedPlace));
state=applyIntent(state,{id:`undo-${serial++}`,command:{type:'terrain-undo'}},Date.now()).state;
assert.deepEqual(state.terrain?.heights,beforeEdit.terrain?.heights);assert.deepEqual(state.landmarks,initial.landmarks);
console.log(JSON.stringify({status:'PASS',at:new Date().toISOString(),reports,terrainEditUndo:'PASS',scope:'shared domain owner moves, reciprocal ports, actual floor support, terrain edit/undo; no full collision or save acceptance'}));
