import assert from 'node:assert/strict';
import { trialInitialRecord } from './trial-store';
import { matureRearrangement } from './mature-composition';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import type { Command } from '../../../src/domain/growingIsland/types';
let state=trialInitialRecord().state;
const initial=structuredClone(state), reports:unknown[]=[];
let serial=0;
const run=(command:Command)=>{state=applyIntent(state,{id:`mature-${serial++}`,command},Date.now()).state;};
for(const layout of ['A','B','A'] as const){
 if(reports.length)for(const command of matureRearrangement(state,layout))run(command);
 validateTerrain(state);
 const world=editableIslandWorld(state)!;
 const places=derivePlaces(state,world);
 assert(places.some(p=>p.ruleId==='P02'&&p.stage==='grown'),'large tree place');
 assert(places.some(p=>p.ruleId==='P03'&&p.stage==='grown'),'water place');
 assert.equal(state.drops,initial.drops);
 assert.deepEqual(state.landmarks.map(item=>({...item,cell:undefined})),initial.landmarks.map(item=>({...item,cell:undefined})));
 reports.push({layout,places:places.map(p=>({ruleId:p.ruleId,stage:p.stage,variant:p.variant,targets:p.useTargets,walkPoints:p.walkSurface.length})),state});
}
assert.deepEqual(state.landmarks,initial.landmarks);
console.log(JSON.stringify({status:'PASS',at:new Date().toISOString(),reports,commands:serial,scope:'Explicit mature fixture and actual domain commands, not natural growth or browser use.'}));
