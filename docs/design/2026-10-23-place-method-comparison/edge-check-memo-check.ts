import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { compileWorldDefinition } from '../../../src/domain/growingIsland/worldDefinition';
import { landBounds } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { WorldDefinition, WorldPassage } from '../../../src/domain/growingIsland/worldTypes';
import inputJSON from './evidence/69-H-wide-shore-final-state.json';

import { trialQuery } from './frozen-query';
import { startTrialTiming, stopTrialTiming, trialTimingSnapshot } from './timing-store';
const EDGE_MEMO_DIAGNOSTIC = trialQuery().get('edgeTrial') === 'memo';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const input = inputJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const expanded = { ...newIsland('edge-check-memo-69', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, input[field]]))) } as GrowingState;
const fresh = newIsland('edge-check-memo-fresh', 1000);
fresh.terrain = { version: 1, heights: {}, undo: [], redo: [] };
const cut = structuredClone(fresh); cut.terrain!.heights = { '0,3': -4, '1,3': -4, '5,0': 3 };
const bridge = structuredClone(fresh); bridge.bridge = { x: 1 };
const benchmarkSnapshot = JSON.stringify(expanded);
// Warm only the previous world. The command's candidate geometry is still cold.
editableIslandWorld(expanded);
assert(startTrialTiming());
const actionStart = performance.now();
const edited = applyIntent(expanded, { id: 'edge-memo-cold', command: { type: 'terrain-edit', cell: { x: 4, z: 4 }, delta: -1 } }, 1000);
const coldEditMs = performance.now() - actionStart;
stopTrialTiming();
const cpu = trialTimingSnapshot();
assert.equal(cpu.aggregates['editableIslandWorld:cold'].calls, 1);
assert.equal(cpu.aggregates['compileWorldDefinition:derived-edges'].calls, 1);
assert.equal(JSON.stringify(expanded), benchmarkSnapshot);
const benchmark = { coldEditMs, compileMs: cpu.aggregates['compileWorldDefinition:derived-edges'].inclusiveMs, worldMs: cpu.aggregates['editableIslandWorld:cold'].inclusiveMs, cpu, resultHash: hash(edited) };
if (process.env.EDGE_CHECK_BENCH_ONLY === '1') {
    console.log(JSON.stringify({ enabled: EDGE_MEMO_DIAGNOSTIC, benchmark }));
    process.exit(0);
}
const reports = [];
for (const [name, state] of [['initial', fresh], ['negative-cut', cut], ['actual-shore69', expanded], ['bridge', bridge]] as const) {
    const snapshot = JSON.stringify(state), began = performance.now(), world = editableIslandWorld(state)!;
    const coldMs = performance.now() - began, queries = [], bounds = landBounds(state);
    for (let z = -8; z <= bounds.depth * 4 + 8; z++) for (let x = bounds.minX * 4 - 8; x <= bounds.maxX * 4 + 8; x++) {
        const cell = { x: x / 4, z: z / 4 }, floor = world.floorAt(cell);
        queries.push([cell, floor, world.anchorFloorAt(cell), world.anchorAt(cell), world.owns(cell), world.shoreApproachCells(cell),
            ...world.floors.flatMap(f => [world.floorAt(cell, f.id), world.sampleFloorAt(cell, f.id)]),
            floor && world.logicalAt(floor.point), floor && world.logicalAt({ x: floor.point.x, z: floor.point.z }),
            floor && world.siteAt(floor.point)]);
    }
    const graph = [], routes = [], all = new Set(world.sites.map(s => `${s.cell.x},${s.cell.z}`));
    const narrowed = new Set([...all].filter((_, i) => i % 7 !== 0));
    let nonemptyNeighbors = 0;
    for (const site of world.sites) for (const passage of ['walk', 'join', 'water'] as WorldPassage[]) {
        const neighbors = world.neighbors(site.cell, passage); if (neighbors.length) nonemptyNeighbors++;
        graph.push([site.cell, passage, neighbors, ...neighbors.map(next => world.isWalkEdgeSupported(site.cell, next))]);
    }
    assert(world.definition.edges.length > 0 && nonemptyNeighbors > 0, 'Published closures must see the completed graph');
    for (const from of world.sites.filter((_, i) => i % Math.max(1, Math.floor(world.sites.length / 4)) === 0))
        for (const to of world.sites) for (const passage of ['walk', 'join', 'water'] as WorldPassage[])
            for (const open of [all, narrowed]) routes.push([from.cell, to.cell, passage, open === all, world.route(from.cell, to.cell, open, passage)]);
    assert.equal(JSON.stringify(state), snapshot);
    assert(Object.isFrozen(world) && Object.isFrozen(world.definition) && Object.isFrozen(world.floors) && Object.isFrozen(world.sites));
    reports.push({ name, coldMs, cacheState: state === expanded ? 'warm from benchmark previous world' : 'cold', sites: world.sites.length, edges: world.definition.edges.length, nonemptyNeighbors,
        hashes: { definition: hash(world.definition), floors: hash(world.floors), anchors: hash(world.anchorFloors), surfaces: hash(world.surfaces),
            sites: hash(world.sites), walkSites: hash(world.walkSites), bounds: hash(world.bounds),
            floorHitOwnershipQueries: hash(queries), graphs: hash(graph), routes: hash(routes) }, queryCount: queries.length, routeCount: routes.length });
}
// New optional API preserves cloning, validation and immutable publication.
const definition = editableIslandWorld(fresh)!.definition, empty: WorldDefinition = { ...definition, edges: [] };
const saved = JSON.stringify(empty), mutableEdges = structuredClone(definition.edges);
let builderCalled = 0;
const built = compileWorldDefinition(empty, geometry => {
    builderCalled++; assert(Object.isFrozen(geometry) && Object.isFrozen(geometry.floors));
    assert(geometry.floorAt({ x: 1, z: 3 })); return mutableEdges;
});
assert.equal(builderCalled, 1); assert.equal(JSON.stringify(empty), saved);
assert.deepEqual(built.definition, definition);
const firstEdge = mutableEdges[0]; assert(firstEdge);
(firstEdge.from as { siteId: string }).siteId = 'changed-after-publication';
assert.deepEqual(built.definition, definition, 'Returned edge arrays must be cloned before publication');
assert.throws(() => compileWorldDefinition(definition, () => []), /empty input graph/);
assert.throws(() => compileWorldDefinition(empty, () => [...definition.edges, definition.edges[0]]), /duplicate edge/);
assert.throws(() => compileWorldDefinition(empty, () => [{ from: { districtId: 'missing', siteId: 'missing' }, to: definition.edges[0].to, allows: ['walk'] }]), /unknown endpoint/);
const callbackError = new Error('edge-builder-failure');
assert.throws(() => compileWorldDefinition(empty, () => { throw callbackError; }), error => error === callbackError);
const errors: { name: string; error: string }[] = [];
const captureError = (name: string, build: () => unknown) => {
    let error: unknown; try { build(); } catch (e) { error = e; }
    assert(error instanceof Error, name); errors.push({ name, error: error.message });
};
captureError('duplicate', () => compileWorldDefinition(empty, () => [...definition.edges, definition.edges[0]]));
captureError('unknown', () => compileWorldDefinition(empty, () => [{ ...definition.edges[0], from: { districtId: 'absent', siteId: 'absent' } }]));
captureError('invalid-right', () => compileWorldDefinition(empty, () => [{ ...definition.edges[0], allows: ['invalid' as WorldPassage] }]));
captureError('empty-right', () => compileWorldDefinition(empty, () => [{ ...definition.edges[0], allows: [] }]));
captureError('duplicate-right', () => compileWorldDefinition(empty, () => [{ ...definition.edges[0], allows: ['walk', 'walk'] }]));
captureError('nonarray-callback', () => compileWorldDefinition(empty, () => null as unknown as WorldDefinition['edges']));
const wetWorld = editableIslandWorld(cut)!, wetEmpty: WorldDefinition = { ...wetWorld.definition, edges: [] };
const drySite = wetWorld.sites.find(site => site.support), wetSite = wetWorld.sites.find(site => !site.support);
assert(drySite && wetSite);
let unsafeCalls = 0;
captureError('cached-unsafe-forward', () => compileWorldDefinition(wetEmpty, geometry => {
    unsafeCalls++;
    assert.equal(geometry.isWalkEdgeSupported(drySite.cell, wetSite.cell), false);
    assert.equal(geometry.isWalkEdgeSupported(drySite.cell, wetSite.cell), false);
    return [{ from: drySite.ref, to: wetSite.ref, allows: ['walk'] }];
}));
captureError('unsafe-reverse', () => compileWorldDefinition(wetEmpty, geometry => {
    unsafeCalls++;
    assert.equal(geometry.isWalkEdgeSupported(drySite.cell, wetSite.cell), false);
    assert.equal(geometry.isWalkEdgeSupported(wetSite.cell, drySite.cell), false);
    return [{ from: wetSite.ref, to: drySite.ref, allows: ['walk'] }];
}));
assert.equal(unsafeCalls, 2);
const directionalQueries: boolean[] = [];
let retainedGeometry: { isWalkEdgeSupported(from: { x: number; z: number }, to: { x: number; z: number }): boolean } | undefined;
const directed = compileWorldDefinition(empty, geometry => {
    retainedGeometry = geometry;
    for (const edge of definition.edges.slice(0, 20)) {
        const from = built.sites.find(site => site.ref.siteId === edge.from.siteId)!.cell;
        const to = built.sites.find(site => site.ref.siteId === edge.to.siteId)!.cell;
        directionalQueries.push(geometry.isWalkEdgeSupported(from, to), geometry.isWalkEdgeSupported(to, from), geometry.isWalkEdgeSupported(from, to));
    }
    return definition.edges;
});
assert.deepEqual(directed.definition, definition);
assert(retainedGeometry);
assert.equal(retainedGeometry.isWalkEdgeSupported({ x: 1, z: 3 }, { x: 2, z: 3 }), directed.isWalkEdgeSupported({ x: 1, z: 3 }, { x: 2, z: 3 }));
const timings = [], snapshot = JSON.stringify(expanded);
for (const [i, delta] of [-1, 1, -1].entries()) {
    const started = performance.now(); let status = 'accepted', message: string | undefined;
    try { applyIntent(expanded, { id: `single-compile-edit-${i}`, command: { type: 'terrain-edit', cell: { x: 4, z: 4 }, delta: delta as 1 | -1, actors: [{ x: 4, z: 4 }] } }, 1000 + i); }
    catch (e) { status = 'rejected'; message = String(e); }
    timings.push({ delta, status, message, ms: performance.now() - started });
}
assert.equal(JSON.stringify(expanded), snapshot);
console.log(JSON.stringify({ enabled: EDGE_MEMO_DIAGNOSTIC, benchmark, reports, timings, errors, directionalQueries,
    optionalAPI: { callbackOnce: true, geometryFrozen: true, graphCloned: true, badEdgesRejected: true, thrownCallbackPropagated: true, inputUnchanged: true },
    scope: 'Node actual Vite H + stable base + linear + single + frozen query. Same input69, candidate edit cold. CPU only, not browser/GPU. Directed local edge error memo only; all safety checks retained.' }));
