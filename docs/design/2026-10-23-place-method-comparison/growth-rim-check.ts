import assert from 'node:assert/strict';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { growthFixedOffset } from './growth-fixed-field';
import observedJSON from './evidence/33-F2-used-state.json';
import type { GrowingState } from '../../../src/domain/growingIsland/types';

declare const RIM_CANDIDATE: 'A' | 'fixed' | 'rim';
const initial = newIsland('rim-counterexample', 1000);
initial.terrain = { version: 1, heights: { '0,2': -4, '0,3': -1 }, undo: [], redo: [] };
initial.plots = []; initial.landmarks = []; initial.keepsakes = [];
const bounds = { minX: 0, maxX: 5, depth: 5 }, point = { x: -.5, z: 2.55 };
const t = .55, smooth = t * t * (3 - 2 * t);
const original = (-4 * (1 - smooth) - smooth) * .18;
const fixed = growthFixedOffset(initial.terrain.heights, point, bounds) * .18;
assert(original < -.375 && fixed > -.375,
    'A is water and fixed is dry at the exact acquired boundary: a continuous exterior cannot satisfy both.');
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const saved: GrowingState = { ...newIsland('rim-observed33', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))) };
const scenarios = [];
for (const [name, state] of [['explicit-boundary-counterexample', initial], ['observed33', saved]] as const) {
    const world = editableIslandWorld(state)!;
    const samples = [];
    for (let z = 0; z <= 500; z++) for (const x of [-.49, -.5, -.5001, -.501, -.51, -.525, -.55, -.575, -.6]) {
        const cell = { x, z: z / 100 };
        samples.push({ ...cell, y: world.floorAt(cell)?.point.y ?? null });
    }
    scenarios.push({ name, nearBoundary: [-.49, -.5, -.5001, -.501, -.51, -.525, -.55, -.575, -.6]
        .map(x => ({ x, z: 2.55, y: world.floorAt({ x, z: 2.55 })?.point.y ?? null })),
        outwardWalkable: editableTerrainSegmentSupported(world, { x: -.49, z: 2.55 }, { x: -.55, z: 2.55 }, .01), samples });
}
console.log(JSON.stringify({ candidate: RIM_CANDIDATE, pureBoundaryCounterexample: { point, original, fixed,
    heightJumpIfCapped: fixed - original, dryLevel: -.375 }, scenarios }));
