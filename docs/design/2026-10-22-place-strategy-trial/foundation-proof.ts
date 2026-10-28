import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { applyTerrainCommand } from '../../../src/domain/growingIsland/terrainEditing';
import { HOUSE_CELLS } from '../../../src/domain/growingIsland/space';

const pins = [...HOUSE_CELLS, { x: 4, z: 4 }];
const runs = [];
for (const cell of [{ x: 5, z: 3 }, { x: 1, z: 1 }, { x: 2, z: 2 }, { x: 4, z: 1 }]) {
    const state = newIsland('explicit-empty-foundation-fixture', 0);
    state.landmarks = []; // isolating fixed foundations, not a natural player journey
    state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
    const before = editableIslandWorld(state)!, initial = terrainRevision(state);
    const targetBefore = before.floorAt(cell)!.point.y;
    for (let step = 0; step < 3; step++) applyTerrainCommand(state, { type: 'terrain-edit', cell, delta: -1 });
    const after = editableIslandWorld(state)!;
    let maxSupportError = 0, probes = 0;
    for (const pin of pins) for (let ix = -10; ix <= 10; ix++) for (let iz = -10; iz <= 10; iz++) {
        const at = { x: pin.x + ix * .046, z: pin.z + iz * .046 };
        const old = before.floorAt(at)!.point.y, next = after.floorAt(at)?.point.y;
        assert.notEqual(next, undefined); maxSupportError = Math.max(maxSupportError, Math.abs(old - next!)); probes++;
    }
    assert.ok(maxSupportError < 1e-7, `fixed foundation moved ${maxSupportError}`);
    const afterHeight = after.floorAt(cell)?.point.y;
    assert.ok(afterHeight === undefined || Math.abs(afterHeight - targetBefore + .54) < 1e-6);
    for (let step = 0; step < 3; step++) applyTerrainCommand(state, { type: 'terrain-undo' });
    assert.equal(terrainRevision(state), initial);
    runs.push({ cell, steps: 3, probes, maxSupportError, undoRestored: true });
}
const occupied = newIsland('actor-footing-fixture', 0);
assert.throws(() => applyTerrainCommand(occupied, { type: 'terrain-edit', cell: { x: 5, z: 3 }, delta: -1, actors: [{ x: 5, z: 3 }] }), /なかま/);
for (const cell of pins) assert.throws(() => applyTerrainCommand(newIsland('fixed-cell-fixture', 0), { type: 'terrain-edit', cell, delta: -1 }), /足もと/);
writeFileSync('docs/design/2026-10-22-place-strategy-trial/evidence/foundation-support.json', JSON.stringify({ passed: true, fixture: 'explicit empty-owner fixture; actors separately rejected', runs }, null, 2));
console.log('Foundation support, real height change, actor refusal and undo passed');
