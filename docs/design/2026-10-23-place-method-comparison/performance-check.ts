/** Fresh-process CPU diagnostics; no browser, database or user-state mutation. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { landBounds } from '../../../src/domain/growingIsland/space';
import type { GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import { terrainMethod, type TerrainMethod } from './section-profile';

const worldOf = editableIslandWorld as (state: GrowingState, curved: boolean, mode: TerrainMethod) => IslandWorld;
const method = terrainMethod(), kind = process.argv[2] ?? 'initial';
const make = (name: string) => {
    const state = newIsland(`explicit-performance:${name}`, 0);
    state.terrain = { version: 1 as const, heights: {}, undo: [], redo: [] };
    return state;
};
function fixture(name: string) {
    const state = make(name);
    if (name === 'expanded' || name === 'multiple-bays') {
        state.land.expanded = 'east'; state.land.extra = ['west', 'south']; state.land.capes = ['east'];
    }
    if (name === 'multiple-bays') state.terrain!.heights = {
        '-3,2': -4, '-3,3': -4, '-2,3': -3, '11,2': -4, '11,3': -4, '10,3': -3,
        '3,7': -4, '4,7': -4, '4,6': -3, '1,5': 8, '2,5': 8,
    };
    return state;
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
if (kind !== 'scan') {
    assert.ok(['initial', 'expanded', 'multiple-bays'].includes(kind));
    const state = fixture(kind), input = JSON.stringify(state), memoryBefore = process.memoryUsage().heapUsed;
    const start = performance.now(), world = worldOf(state, true, method), coldMs = performance.now() - start;
    const memoryAfter = process.memoryUsage().heapUsed, cached: number[] = [];
    for (let i = 0; i < 100; i++) { const t = performance.now(); assert.equal(worldOf(state, true, method), world); cached.push(performance.now() - t); }
    assert.equal(JSON.stringify(state), input);
    console.log(JSON.stringify({ kind, method, coldMs, cacheHitMedianMs: median(cached), cacheHitMaxMs: Math.max(...cached), heapDeltaBytes: memoryAfter - memoryBefore,
        sites: world.sites.length, floorTriangles: world.floors.filter(f => f.kind === 'ground').reduce((sum, f) => sum + f.indices.length / 3, 0),
        fixture: 'explicit same initial/expanded/bay input; not acquired via browser', revision: world.revision }));
} else {
    const offsets = [-.46, -.23, 0, .23, .46];
    const legal = (original: IslandWorld, world: IslandWorld, cell: Cell) => {
        const center = world.floorAt(cell)?.point.y, oldCenter = original.floorAt(cell)?.point.y;
        return center !== undefined && oldCenter !== undefined && offsets.every(dx => offsets.every(dz => {
            const at = { x: cell.x + dx, z: cell.z + dz }, current = world.floorAt(at)?.point.y, old = original.floorAt(at)?.point.y;
            return current !== undefined && old !== undefined && Math.abs((current - center) - (old - oldCenter)) <= .130000001;
        }));
    };
    const legals = (original: IslandWorld, world: IslandWorld) => new Set(world.sites.filter(s => s.placement && legal(original, world, s.cell)).map(s => `${s.cell.x},${s.cell.z}`));
    const tracks = [], warnings = [];
    for (const target of [{ x: 0, z: 1 }, { x: 5, z: 0 }, { x: 5, z: 1 }, { x: 5, z: 3 }, { x: 1, z: 1 }, { x: 2, z: 2 }]) for (const scenario of ['dig', 'raise', 'recover'] as const) {
        const delta = scenario === 'dig' ? -1 : 1;
        let state = make(`${target.x},${target.z}:${delta}`);
        const original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), steps = [];
        if (scenario === 'recover') for (let dig = 1; dig <= 4; dig++) {
            try { state = applyIntent(state, { id: `setup-dig:${dig}`, command: { type: 'terrain-edit', cell: target, delta: -1 } }, 0).state; } catch { break; }
        }
        const startHeight = state.terrain!.heights[`${target.x},${target.z}`] ?? 0;
        for (let step = 1; step <= (delta > 0 ? 12 - startHeight : 4); step++) {
            const before = worldOf(state, true, method), beforeA = worldOf(state, true, 'A'), legalBeforeA = legals(original, beforeA);
            let next: GrowingState; const started = performance.now();
            try { next = applyIntent(state, { id: `scan:${target.x},${target.z}:${delta}:${step}`, command: { type: 'terrain-edit', cell: target, delta } }, 0).state; }
            catch (error) { steps.push({ step, accepted: false, reason: error instanceof Error ? error.message : String(error), commandMs: performance.now() - started }); break; }
            const commandMs = performance.now() - started, after = worldOf(next, true, method), afterA = worldOf(next, true, 'A'), legalAfterA = legals(original, afterA);
            const lostProtected = [...legalBeforeA].filter(key => !legalAfterA.has(key));
            let maxDryHeightJump = 0, maxChangeIncludingWater = 0, maxExtraResponse = 0, changedOver2cm = 0, lostDryProbes = 0, reversedRaiseProbes = 0, maxRaiseReversal = 0;
            const reversals: { cell: Cell; distanceToEdit: number; before: number; after: number; drop: number; insideOwnedFootprint: boolean; bodySupportedBefore: boolean; nearbyPlacedOwners: string[] }[] = [];
            let worst: { cell: Cell; before: number; after: number; deltaA: number } | undefined;
            const bounds = landBounds(state);
            for (let iz = -10; iz <= bounds.depth * 10; iz++) for (let ix = (bounds.minX - 1) * 10; ix <= (bounds.maxX + 1) * 10; ix++) {
                const cell = { x: ix / 10, z: iz / 10 }, old = before.floorAt(cell)?.point.y, current = after.floorAt(cell)?.point.y;
                const aOld = beforeA.floorAt(cell)?.point.y, aCurrent = afterA.floorAt(cell)?.point.y;
                if (old !== undefined && current === undefined) lostDryProbes++;
                if (old !== undefined && current !== undefined) maxDryHeightJump = Math.max(maxDryHeightJump, Math.abs(current - old));
                const change = (current ?? -.4) - (old ?? -.4), changeA = (aCurrent ?? -.4) - (aOld ?? -.4), extra = Math.abs(change - changeA);
                if (Math.abs(change) > .02) changedOver2cm++;
                if (delta > 0 && change < -.02) {
                    reversedRaiseProbes++; maxRaiseReversal = Math.max(maxRaiseReversal, -change);
                    const bodySupportedBefore = [-.18, -.09, 0, .09, .18].every(dx => [-.18, -.09, 0, .09, .18].every(dz => before.floorAt({ x: cell.x + dx, z: cell.z + dz })));
                    const nearbyPlacedOwners = [...state.landmarks, ...state.plots, ...state.keepsakes].filter(owner => owner.cell
                        && Math.abs(owner.cell.x - cell.x) <= .46 && Math.abs(owner.cell.z - cell.z) <= .46).map(owner => owner.id);
                    reversals.push({ cell, distanceToEdit: Math.hypot(cell.x - target.x, cell.z - target.z), before: old ?? -.4, after: current ?? -.4, drop: -change,
                        insideOwnedFootprint: cell.x >= bounds.minX - .5 && cell.x <= bounds.maxX + .5 && cell.z >= -.5 && cell.z <= bounds.depth - .5,
                        bodySupportedBefore, nearbyPlacedOwners });
                }
                maxChangeIncludingWater = Math.max(maxChangeIncludingWater, Math.abs(change));
                if (extra > maxExtraResponse) { maxExtraResponse = extra; worst = { cell, before: old ?? -.4, after: current ?? -.4, deltaA: changeA }; }
            }
            const owned = [...next.landmarks, ...next.plots, ...next.keepsakes].filter(owner => owner.cell);
            const unsupportedOwners = owned.filter(owner => !legal(original, after, owner.cell!)).map(owner => owner.id);
            assert.deepEqual(unsupportedOwners, [], 'accepted domain edit may not invalidate an owned footprint');
            const center = { before: before.floorAt(target)?.point.y, after: after.floorAt(target)?.point.y,
                expectedAfterA: afterA.floorAt(target)?.point.y, delta: (after.floorAt(target)?.point.y ?? -.4) - (before.floorAt(target)?.point.y ?? -.4),
                suppressionVsA: (afterA.floorAt(target)?.point.y ?? -.4) - (after.floorAt(target)?.point.y ?? -.4) };
            const result = { step, center, reversals, reversedRaiseProbes, maxRaiseReversal, inputHeight: next.terrain!.heights[`${target.x},${target.z}`] ?? 0, accepted: true, commandMs, lostProtected, maxDryHeightJump,
                maxChangeIncludingWater, maxExtraResponse, worst, changedOver2cm, lostDryProbes, supportedOwners: owned.length };
            steps.push(result);
            if (method === 'C' && (maxExtraResponse > .10 || maxDryHeightJump > .23 || delta > 0 && center.delta < -1e-7)) warnings.push({ target, delta, ...result });
            state = next;
        }
        tracks.push({ target, delta, scenario, startHeight, steps });
    }
    console.log(JSON.stringify({ kind, method, fixture: 'normal applyIntent commands on explicit newIsland; initial owners retained; actor-free diagnostic',
        warningCriteria: 'C response beyond A > .10m or actual dry-to-dry change > .23m for one .18m input step', warnings, tracks }));
}
