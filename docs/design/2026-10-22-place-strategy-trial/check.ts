import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyTerrainCommand } from '../../../src/domain/growingIsland/terrainEditing';
import { trialGardens, gardenWeight } from './garden';

const state = newIsland('explicit-strategy-fixture', 0);
state.landmarks.find(item => item.kind === 'bench')!.cell = { x: 1, z: 3 };
state.terrain = { version: 1, heights: { '0,4': -3, '0,1': -1, '5,0': 3, '5,1': -3, '5,2': -3 }, undo: [], redo: [] };
const world = editableIslandWorld(state)!;
const before = JSON.stringify({ state, definition: world.definition });
const garden = trialGardens(state, world);
assert.equal(garden.length, 1);
assert.deepEqual(garden[0].target, { x: 1, z: 3 });
assert.ok(gardenWeight(garden[0].route[0], garden, state, world) > 0);
assert.equal(gardenWeight({ x: 5, z: 2 }, garden, state, world), 0, 'never paint a submerged inlet');
assert.equal(gardenWeight({ x: 2, z: 0 }, garden, state, world), 0, 'never invent a courtyard inside the house');
assert.equal(JSON.stringify({ state, definition: world.definition }), before, 'derivation changes no ownership or physical floor');

const stored = structuredClone(state); stored.landmarks.find(item => item.kind === 'bench')!.cell = undefined;
assert.equal(trialGardens(stored, world).length, 0);
const moved = structuredClone(state); moved.landmarks.find(item => item.kind === 'bench')!.cell = { x: 5, z: 2 };
assert.equal(trialGardens(moved, world).length, 0, 'a stale owner on water cannot create a garden');
assert.equal(trialGardens(state, { ...world, neighbors: () => [] }).length, 0, 'a disconnected passage graph cannot create a garden');
assert.deepEqual(trialGardens(state, world), garden, 'returning the owner restores the same garden');

// Mechanism diagnosis, not observed child success: count where a new player can
// actually begin sculpting. Keep rejection reasons rather than selecting only
// legal cells and claiming arbitrary editing.
const coverage = [];
for (let z = 0; z < 5; z++) for (let x = 0; x < 6; x++) {
    const fixture = newIsland('editing-coverage', 0);
    try { applyTerrainCommand(fixture, { type: 'terrain-edit', cell: { x, z }, delta: -1 }); coverage.push({ x, z, accepted: true }); }
    catch (error) { coverage.push({ x, z, accepted: false, reason: String(error) }); }
}
const report = { fixture: 'explicit newIsland + declared heights/bench; no user DB access', revision: terrainRevision(state),
    checks: 9, passed: true, garden, coverage, acceptedCells: coverage.filter(result => result.accepted).length };
writeFileSync('docs/design/2026-10-22-place-strategy-trial/evidence/logic.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
