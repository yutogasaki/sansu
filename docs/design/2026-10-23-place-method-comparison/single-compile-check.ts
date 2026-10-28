import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { compileWorldDefinition } from '../../../src/domain/growingIsland/worldDefinition';
import { landBounds } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { WorldDefinition, WorldPassage } from '../../../src/domain/growingIsland/worldTypes';
import inputJSON from './evidence/61-H-linear-stable-before-edit.json';

declare const SINGLE_COMPILE_DIAGNOSTIC: boolean;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const input = inputJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const expanded = { ...newIsland('single-compile-61', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, input[field]]))) } as GrowingState;
const fresh = newIsland('single-compile-fresh', 1000);
fresh.terrain = { version: 1, heights: {}, undo: [], redo: [] };
const cut = structuredClone(fresh); cut.terrain!.heights = { '0,3': -4, '1,3': -4, '5,0': 3 };
const bridge = structuredClone(fresh); bridge.bridge = { x: 1 };
const reports = [];
for (const [name, state] of [['initial', fresh], ['negative-cut', cut], ['actual-expanded61', expanded], ['bridge', bridge]] as const) {
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
    reports.push({ name, coldMs, sites: world.sites.length, edges: world.definition.edges.length, nonemptyNeighbors,
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
assert.throws(() => compileWorldDefinition(empty, () => { throw new Error('edge-builder-failure'); }), /edge-builder-failure/);
const timings = [], snapshot = JSON.stringify(expanded);
for (const [i, delta] of [-1, 1, -1].entries()) {
    const started = performance.now(); let status = 'accepted', message: string | undefined;
    try { applyIntent(expanded, { id: `single-compile-edit-${i}`, command: { type: 'terrain-edit', cell: { x: 4, z: 4 }, delta: delta as 1 | -1, actors: [{ x: 4, z: 4 }] } }, 1000 + i); }
    catch (e) { status = 'rejected'; message = String(e); }
    timings.push({ delta, status, message, ms: performance.now() - started });
}
assert.equal(JSON.stringify(expanded), snapshot);
console.log(JSON.stringify({ singleCompile: SINGLE_COMPILE_DIAGNOSTIC, reports, timings,
    optionalAPI: { callbackOnce: true, geometryFrozen: true, graphCloned: true, badEdgesRejected: true, thrownCallbackPropagated: true, inputUnchanged: true },
    scope: 'Node actual H + stable base + linear. CPU timings, not browser/GPU. Ordinary source graph and validation remain unchanged.' }));
