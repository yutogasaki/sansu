import assert from 'node:assert/strict';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { baseTerrainHeightAt } from '../../../src/domain/growingIsland/placeTerrain';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { reachableFromHome } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { stableBaseHeightAt } from './stable-base-field';
import expandedJSON from './evidence/expanded-fixture-v2.json';
import observedJSON from './evidence/33-F2-used-state.json';

declare const STABLE_BASE_CANDIDATE: boolean;
declare const STABLE_BASE_MODE: 'F' | 'H';
const fresh = newIsland('stable-base-pure', 1000);
fresh.terrain = { version: 1, heights: {}, undo: [], redo: [] };
fresh.plots = []; fresh.landmarks = []; fresh.keepsakes = [];
const grown = structuredClone(fresh); grown.land = { expanded: 'east', extra: ['west', 'south'], capes: [] };
let coreBaseDrift = 0, coreFloorDrift = 0, maxCoreAbsolute = 0;
const first = editableIslandWorld(fresh)!, second = editableIslandWorld(grown)!;
for (let z = -5; z <= 45; z++) for (let x = -5; x <= 55; x++) {
    const cell = { x: x / 10, z: z / 10 };
    coreBaseDrift = Math.max(coreBaseDrift, Math.abs(baseTerrainHeightAt(fresh, cell) - baseTerrainHeightAt(grown, cell)));
    maxCoreAbsolute = Math.max(maxCoreAbsolute, Math.abs(baseTerrainHeightAt(grown, cell)));
    coreFloorDrift = Math.max(coreFloorDrift, Math.abs(first.floorAt(cell)!.point.y - second.floorAt(cell)!.point.y));
}
if (STABLE_BASE_CANDIDATE) {
    assert.equal(coreBaseDrift, 0); assert.equal(maxCoreAbsolute, 0); assert(coreFloorDrift < 1e-7);
}
// No saved input is frozen: ordinary raise/lower/Undo remains authoritative.
const edited = applyIntent(fresh, { id: 'base-edit', command: { type: 'terrain-edit', cell: { x: 1, z: 3 }, delta: 1 } }).state;
const undone = applyIntent(edited, { id: 'base-undo', command: { type: 'terrain-undo' } }).state;
const redone = applyIntent(undone, { id: 'base-redo', command: { type: 'terrain-redo' } }).state;
assert.deepEqual(undone.terrain!.heights, fresh.terrain!.heights);
assert.deepEqual(redone.terrain, edited.terrain);
const editRise = editableIslandWorld(edited)!.floorAt({ x: 1, z: 3 })!.point.y - first.floorAt({ x: 1, z: 3 })!.point.y;
assert(Math.abs(editRise - .18) < 1e-8);
let maxApproxBaseGradient = 0;
for (let z = -30; z <= 90; z++) for (let x = -40; x <= 90; x++) {
    const point = { x: x / 10, z: z / 10 }, y = stableBaseHeightAt(point), e = .001;
    maxApproxBaseGradient = Math.max(maxApproxBaseGradient, Math.hypot(
        (stableBaseHeightAt({ ...point, x: point.x + e }) - y) / e,
        (stableBaseHeightAt({ ...point, z: point.z + e }) - y) / e));
}
const expanded = structuredClone(expandedJSON.state) as unknown as GrowingState;
const expandedWorld = editableIslandWorld(expanded)!;
const lostPoint = { x: -1, z: 4.5 };
const expandedCornerProbe = { cell: lostPoint, y: expandedWorld.floorAt(lostPoint)?.point.y ?? null,
    baseY: baseTerrainHeightAt(expanded, lostPoint), segments: [{ x: -1, z: 4 }, { x: -1, z: 5 }, { x: -1.5, z: 4.5 }, { x: -.5, z: 4.5 }]
        .map(cell => ({ cell, y: expandedWorld.floorAt(cell)?.point.y ?? null,
            corridorSupported: editableTerrainSegmentSupported(expandedWorld, lostPoint, cell) })) };
const reportOwners = (state: GrowingState) => [...state.plots, ...state.landmarks, ...state.keepsakes]
    .flatMap(owner => owner.cell ? [{ id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell),
        y: editableIslandWorld(state)!.floorAt(owner.cell)?.point.y ?? null }] : []);
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
let prior: GrowingState = { ...newIsland('stable-base-observed', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))), drops: 10_000 };
const growth = [];
for (const side of ['east', 'west', 'south'] as const) {
    const before = prior, a = editableIslandWorld(before)!;
    prior = applyIntent(before, { id: `stable-base-${side}`, command: { type: 'expand', side } }).state;
    const b = editableIslandWorld(prior)!, afterReach = reachableFromHome(prior, undefined, b);
    let maxCoreDrop = 0, maxCoreRise = 0, lostCoreDry = 0;
    for (let z = -5; z <= 45; z++) for (let x = -5; x <= 55; x++) {
        const cell = { x: x / 10, z: z / 10 }, y = a.floorAt(cell)?.point.y, next = b.floorAt(cell)?.point.y;
        if (y !== undefined && next === undefined) lostCoreDry++;
        if (y !== undefined && next !== undefined) { maxCoreDrop = Math.max(maxCoreDrop, y - next); maxCoreRise = Math.max(maxCoreRise, next - y); }
    }
    growth.push({ side, owners: reportOwners(prior), lostCoreDry, maxCoreDrop, maxCoreRise,
        lostReachable: [...reachableFromHome(before, undefined, a)].filter(id => !afterReach.has(id)) });
}
console.log(JSON.stringify({ stable: STABLE_BASE_CANDIDATE, mode: STABLE_BASE_MODE,
    coreBaseDrift, maxCoreAbsolute, coreFloorDrift, editRise, undoRedo: true, maxApproxBaseGradient,
    expandedOwners: reportOwners(expanded), expandedReachable: [...reachableFromHome(expanded)].sort(), expandedCornerProbe, growth,
    initialExteriorSamples: Array.from({ length: 81 }, (_, z) => Array.from({ length: 101 }, (_, x) => {
        const cell = { x: (x - 25) / 10, z: (z - 15) / 10 };
        return { ...cell, y: first.floorAt(cell)?.point.y ?? null };
    })).flat(),
    limits: ['Existing F boundary basis and movable foundation pins intentionally unchanged.', 'Native model foot support is independently measured by state agent.'] }));
