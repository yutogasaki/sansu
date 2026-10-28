import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import snapshot from './evidence/assembly-v18-B-state.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainEditingRevision } from '../../../src/domain/growingIsland/terrainEditing';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf } from './composite-field';

let state = structuredClone(snapshot.evidence.state) as unknown as GrowingState;
const original = structuredClone(state), reports: unknown[] = [];
let sequence = 0;
for (const z of [3, 4, 5, 6]) for (const x of [1, 2, 3]) {
    const cell = { x, z }, before = state.terrain!.heights[`${x},${z}`] ?? 0;
    const point = editableIslandWorld(state)!.floorAt(cell)?.point;
    let failure: string | undefined;
    for (let n = 0; n < before; n++) {
        try { state = applyIntent(state, { id: `internal-layout-${++sequence}`, command: {
            type: 'terrain-edit', cell, delta: -1, actors: [], occupiedPlaceTargets: [], expectedTerrainRevision: terrainEditingRevision(state),
        } }, 1000).state; }
        catch (error) { failure = String(error); break; }
    }
    reports.push({ cell, before, after: state.terrain!.heights[`${x},${z}`] ?? 0, point, failure });
}
assert.deepEqual(state.landmarks, original.landmarks); assert.deepEqual(state.land, original.land);
assert.deepEqual(compositeOf(state), compositeOf(original)); assert.equal(state.drops, original.drops);
console.log(JSON.stringify({ status: 'PASS', scope: 'Pure-domain feasibility diagnostic. No live actors, no browser edit claim.',
    reports: [{ name: 'ordinary terrain edits split the initial central plateau', detail: reports }], state }));
