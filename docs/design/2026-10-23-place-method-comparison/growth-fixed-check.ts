import assert from 'node:assert/strict';
import observedJSON from './evidence/33-F2-used-state.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { landBounds, reachableFromHome } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState, Side } from '../../../src/domain/growingIsland/types';
import { growthFixedOffset } from './growth-fixed-field';
import { inheritGrowthBoundary } from './growth-seam';

declare const FIXED_GROWTH_CANDIDATE: boolean;
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const initial: GrowingState = { ...newIsland('growth-fixed-33', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))), drops: 100_000 };
const ownerReport = (state: GrowingState) => [...state.plots, ...state.landmarks, ...state.keepsakes]
    .flatMap(owner => owner.cell ? [{ id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell) }] : []);
function compare(before: GrowingState, after: GrowingState) {
    const a = editableIslandWorld(before)!, b = editableIslandWorld(after)!, bounds = landBounds(before);
    const lostDry: { cell: Cell; y: number }[] = [], changed: { cell: Cell; delta: number }[] = [];
    let maxRise = 0, maxDrop = 0;
    for (let z = -5; z <= bounds.depth * 10 - 5; z++) for (let x = bounds.minX * 10 - 5; x <= bounds.maxX * 10 + 5; x++) {
        const cell = { x: x / 10, z: z / 10 }, y = a.floorAt(cell)?.point.y, next = b.floorAt(cell)?.point.y;
        if (y !== undefined && next === undefined) lostDry.push({ cell, y });
        if (y === undefined || next === undefined) continue;
        maxRise = Math.max(maxRise, next - y); maxDrop = Math.max(maxDrop, y - next);
        if (Math.abs(y - next) > 1e-7) changed.push({ cell, delta: next - y });
    }
    const reachable = reachableFromHome(after, undefined, b);
    const lostReachable = [...reachableFromHome(before, undefined, a)].filter(id => !reachable.has(id));
    return { maxRise, maxDrop, changedCount: changed.length, changed: changed.slice(0, 8),
        lostDryCount: lostDry.length, lostDry: lostDry.slice(0, 12), lostReachable };
}
const branches = [];
for (const order of [['west', 'east', 'south'], ['east', 'west', 'south']] as Side[][]) {
    let state = structuredClone(initial); const steps = [];
    for (const [i, side] of order.entries()) {
        const before = state, snapshot = structuredClone(before);
        try { state = applyIntent(state, { id: `fixed-${order[0]}-${i}`, command: { type: 'expand', side } }, 2000 + i).state; }
        catch (error) { assert.deepEqual(before, snapshot); steps.push({ side, rejected: String(error) }); break; }
        assert.deepEqual(before, snapshot);
        assert.deepEqual(before.terrain!.undo, state.terrain!.undo); assert.deepEqual(before.terrain!.redo, state.terrain!.redo);
        steps.push({ side, ...compare(before, state), owners: ownerReport(state) });
    }
    branches.push({ order, steps });
}
// Pure basis invariance is narrower than full geometry: shoreline, base terrain,
// and relocating foundation pins remain separate state-dependent mechanisms.
let maxCoefficientDrift = 0;
const before = structuredClone(initial), after = structuredClone(initial);
after.land.expanded = 'west'; inheritGrowthBoundary(before, after);
for (let z = -5; z <= 45; z++) for (let x = -5; x <= 55; x++) {
    const cell = { x: x / 10, z: z / 10 };
    maxCoefficientDrift = Math.max(maxCoefficientDrift, Math.abs(growthFixedOffset(before.terrain!.heights, cell, landBounds(before))
        - growthFixedOffset(after.terrain!.heights, cell, landBounds(after))));
}
assert(maxCoefficientDrift < 1e-12);
// Explicit diagnostic opening: remove movable owners so they cannot prevent the
// negative boundary fixture. This is not claimed to be a UI-created save.
const cut = structuredClone(initial); cut.plots = []; cut.landmarks = []; cut.keepsakes = [];
cut.terrain = { version: 1, heights: { '0,3': -4, '0,4': -4 }, undo: [], redo: [] };
const cutNext = applyIntent(cut, { id: 'negative-west', command: { type: 'expand', side: 'west' } }).state;
const cutWorld = editableIslandWorld(cutNext)!;
const openingSamples = Array.from({ length: 41 }, (_, i) => ({ x: -i / 10, z: 3.5 }))
    .map(cell => ({ cell, y: cutWorld.floorAt(cell)?.point.y ?? null }));
// An existing bank sample is not a dry floor. Missing floor means water here.
const oldOpeningFilled = Array.from({ length: 6 }, (_, i) => ({ x: -i / 10, z: 3.5 }))
    .filter(cell => !editableIslandWorld(cut)!.floorAt(cell) && cutWorld.floorAt(cell));
console.log(JSON.stringify({ candidate: FIXED_GROWTH_CANDIDATE ? 'fixed-cardinal-grid-v1' : 'F2',
    initialOwners: ownerReport(initial), maxCoefficientDrift, branches,
    negativeOpening: { inherited: cutNext.terrain!.heights, oldOpeningFilled, openingSamples,
        warning: 'One inherited row may leave an enclosed pond when newly acquired second/third rows default to zero.' },
    initialSamples: Array.from({ length: 81 }, (_, z) => Array.from({ length: 91 }, (_, x) => {
        const cell = { x: (x - 20) / 10, z: (z - 20) / 10 };
        return { ...cell, y: editableIslandWorld(initial)!.floorAt(cell)?.point.y ?? null };
    })).flat(),
}, null, 2));
