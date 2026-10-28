import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState, Command } from '../../../src/domain/growingIsland/types';
import type { WorldPassage } from '../../../src/domain/growingIsland/worldTypes';
import expandedJSON from './evidence/expanded-fixture-v2.json';
import shoreJSON from './evidence/69-H-wide-shore-final-state.json';
import { terrainMethod } from './section-profile';

declare global {
    var __memoSamplesCounts: Record<string, number>;
    var __memoSamplesFactory: (sample: (cell: Cell) => number) => (cell: Cell) => number;
}
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const shore = { ...newIsland('memo-shore', 1000), ...structuredClone(Object.fromEntries(fields.map(field => [field, shoreJSON[field]]))) } as GrowingState;
const expanded = structuredClone(expandedJSON.state) as unknown as GrowingState;
const fresh = newIsland('memo-fresh', 1000); fresh.terrain = { version: 1, heights: {}, undo: [], redo: [] };
const extreme = structuredClone(fresh); extreme.terrain!.heights = { '0,3': -4, '1,3': -4, '5,0': 12, '4,0': 12 };
const bridge = structuredClone(fresh); bridge.bridge = { x: 1 };
globalThis.__memoSamplesCounts = {};
let pureCalls = 0;
const exact = globalThis.__memoSamplesFactory(p => { pureCalls++; return Object.is(p.x, -0) ? -0 : p.x; });
assert(Object.is(exact({ x: -0, z: 0 }), -0));
assert(Object.is(exact({ x: 0, z: 0 }), 0));
assert.equal(exact({ x: 1, z: 0 }), 1);
assert.equal(exact({ x: 1 + Number.EPSILON, z: 0 }), 1 + Number.EPSILON);
assert.equal(exact({ x: 1, z: -0 }), 1);
exact({ x: -0, z: 0 }); exact({ x: 1 + Number.EPSILON, z: 0 });
assert.equal(pureCalls, 5, 'Do not quantize doubles or merge either axis signed zero');
const other = globalThis.__memoSamplesFactory(p => p.x + 5);
assert.equal(other({ x: 1, z: 0 }), 6, 'Factories must not share previous inputs');

const reports = [];
for (const [name, state] of [['initial30', fresh], ['expanded96', expanded], ['shore96', shore], ['signed-extreme30', extreme], ['bridge30', bridge]] as const) {
    const before = JSON.stringify(state); globalThis.__memoSamplesCounts = {};
    globalThis.gc?.(); const beforeHeap = process.memoryUsage().heapUsed, start = performance.now();
    const world = editableIslandWorld(state)!; const coldMs = performance.now() - start;
    const heapAfterCold = process.memoryUsage().heapUsed; globalThis.gc?.();
    const heapAfterGc = process.memoryUsage().heapUsed, counts = { ...globalThis.__memoSamplesCounts };
    const bounds = landBounds(state), queries = [];
    for (let z = -8; z <= bounds.depth * 4 + 8; z++) for (let x = bounds.minX * 4 - 8; x <= bounds.maxX * 4 + 8; x++) {
        const cell = { x: x / 4, z: z / 4 }, floor = world.floorAt(cell);
        queries.push([cell, floor, world.anchorFloorAt(cell), world.anchorAt(cell), world.owns(cell), world.shoreApproachCells(cell),
            ...world.floors.flatMap(f => [world.floorAt(cell, f.id), world.sampleFloorAt(cell, f.id)]),
            floor && world.logicalAt(floor.point), floor && world.siteAt(floor.point)]);
    }
    const graph = [], routes = [], all = new Set(world.sites.map(s => `${s.cell.x},${s.cell.z}`));
    const narrowed = new Set([...all].filter((_, i) => i % 7 !== 0));
    for (const site of world.sites) for (const passage of ['walk', 'join', 'water'] as WorldPassage[]) {
        const neighbors = world.neighbors(site.cell, passage); graph.push([site.cell, passage, neighbors, ...neighbors.map(next => world.isWalkEdgeSupported(site.cell, next))]);
    }
    for (const from of world.sites.filter((_, i) => i % Math.max(1, Math.floor(world.sites.length / 4)) === 0))
        for (const to of world.sites) for (const passage of ['walk', 'join', 'water'] as WorldPassage[])
            for (const open of [all, narrowed]) routes.push([from.cell, to.cell, passage, open === all, world.route(from.cell, to.cell, open, passage)]);
    assert.equal(JSON.stringify(state), before);
    assert.strictEqual(editableIslandWorld(state), world, 'Warm world cache identity is unchanged');
    const commands = []; let accepted = false;
    for (const cell of [{ x: 4, z: 4 }, { x: 1, z: 3 }, { x: 0, z: 4 }, { x: 4, z: 3 }]) {
        const command: Command = { type: 'terrain-edit', cell, delta: 1 };
        try {
            const changed = applyIntent(state, { id: `memo-${name}-edit`, command }, 8000).state;
            const undone = applyIntent(changed, { id: `memo-${name}-undo`, command: { type: 'terrain-undo' } }, 8001).state;
            const redone = applyIntent(undone, { id: `memo-${name}-redo`, command: { type: 'terrain-redo' } }, 8002).state;
            const nonzero = (s: GrowingState) => Object.fromEntries(Object.entries(s.terrain!.heights).filter(([, value]) => value !== 0));
            assert.deepEqual(nonzero(undone), nonzero(state)); assert.deepEqual(redone.terrain, changed.terrain);
            commands.push({ command, accepted: true, hashes: [changed, undone, redone].map(hash),
                worldHashes: [changed, undone, redone].map(s => hash(editableIslandWorld(s)!.definition)) });
            accepted = true; break;
        } catch (error) { if (error instanceof assert.AssertionError) throw error; commands.push({ command, accepted: false, reason: String(error) }); }
    }
    // Expanded-v2's old flower position and deliberately extreme synthetic
    // floors are not legal in every projection. Compare their actual refusals
    // rather than repairing them. The actual shore and ordinary initial/bridge
    // inputs must each complete a real cycle in the H candidate.
    if (terrainMethod() === 'H' && ['initial30', 'shore96', 'bridge30'].includes(name))
        assert(accepted, `${name}: at least one ordinary edit/undo/redo cycle must succeed: ${JSON.stringify(commands)}`);
    const protectedCommand: Command = { type: 'terrain-edit', cell: { x: 4, z: 4 }, delta: -1, actors: [{ x: 4, z: 4 }] };
    try { const result = applyIntent(state, { id: `memo-${name}-actor`, command: protectedCommand }, 8003); commands.push({ protectedCommand, accepted: true, hash: hash(result) }); }
    catch (error) { commands.push({ protectedCommand, accepted: false, reason: String(error) }); }
    assert.equal(JSON.stringify(state), before);
    reports.push({ name, coldMs, counts, heapBytes: { before: beforeHeap, afterCold: heapAfterCold, afterGc: heapAfterGc,
        coldDelta: heapAfterCold - beforeHeap, retainedDelta: heapAfterGc - beforeHeap },
        hashes: { definition: hash(world.definition), floors: hash(world.floors), anchors: hash(world.anchorFloors), surfaces: hash(world.surfaces),
            sites: hash(world.sites), walkSites: hash(world.walkSites), bounds: hash(world.bounds), queries: hash(queries), graphs: hash(graph), routes: hash(routes), commands: hash(commands) },
        queries: queries.length, routes: routes.length, ordinaryCycleAccepted: accepted, commands });
}
console.log(JSON.stringify({ reports, pureChecks: { signedZero: true, adjacentDoubles: true, separateFactories: true },
    scope: 'Node with actual browser flag branches. CPU and heap observations include diagnostic counters; afterCold heap is not a peak measurement. No browser/GPU claim.' }));
