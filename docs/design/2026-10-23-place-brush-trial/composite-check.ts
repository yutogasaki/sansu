import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, walkableCells, landCells } from '../../../src/domain/growingIsland/space';
import { commandGrowingIsland, type GrowingIslandDatabase } from '../../../src/domain/growingIsland/repository';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { PlaceShape } from './directional-field';
import { compositeEnabled, compositeOf, compositePlansFor, type PlaceSlot } from './composite-field';
import { compositeEditingRevision, compositeHistoryOf, type CompositeGrowingState, type CompositeCommand } from './composite-model';
import { reachablePlacePlatform } from './model';
import { trialDatabase, openSavedTrial } from './trial-store';

const west: PlaceShape = { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const east: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' };
const safety = { actors: [], occupiedPlaceTargets: [] };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const base = () => structuredClone(fixture.state) as unknown as GrowingState;
const initial = (): CompositeGrowingState => ({ ...base(), trialPlaceSet: {}, trialPlaceSetHistory: { version: 1, undo: [], redo: [] } });
let sequence = 0;
function command(state: GrowingState, action: CompositeCommand['action'], slot: PlaceSlot, shape?: PlaceShape): CompositeCommand {
    return { type: 'place-set', action, slot, shape, safety, expectedPlaceRevision: compositeEditingRevision(state) };
}
function edit(state: GrowingState, action: CompositeCommand['action'], slot: PlaceSlot, shape?: PlaceShape) {
    return applyIntent(state, { id: `composite-${++sequence}`, command: command(state, action, slot, shape) }, 1000).state as CompositeGrowingState;
}
function routes(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return landCells(state).map(cell => ({ cell, route: world.route(HOME_CELL, cell, open) ?? null }));
}
function floors(state: GrowingState) { return editableIslandWorld(state)!.floors; }
function evict() { for (let i = 0; i < 10; i++) { const other = base(); other.terrain!.heights['-3,0'] = (i % 5) - 2; other.terrain!.heights['-3,1'] = Math.floor(i / 5) + 1; editableIslandWorld(other); } }
function support(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return Object.entries(compositeOf(state)!).map(([slot, shape]) => {
        const target = reachablePlacePlatform(world, open, shape!); assert(target, `${slot} top reachable`);
        const route = world.route(HOME_CELL, target, open)!;
        assert(route.slice(1).every((cell, i) => editableTerrainSegmentSupported(world, route[i], cell)), `${slot} body corridor`);
        return { slot, target, route };
    });
}
const stripHistory = (state: GrowingState) => { const copy = structuredClone(state) as CompositeGrowingState;
    delete copy.trialPlaceSet; delete copy.trialPlaceSetHistory; copy.applied = []; return copy; };
const reports: { name: string; detail?: unknown }[] = [];
assert(compositeEnabled());

for (const [slot, shape] of [['west', west], ['east', east]] as const) {
    const single = { ...base(), trialPlace: shape }, composite = edit(initial(), 'apply', slot, shape);
    assert.equal(hash(floors(composite)), hash(floors(single)), `${slot} exact single-place floor parity`);
    assert.equal(hash(routes(composite)), hash(routes(single)), `${slot} exact single-place route parity`);
    reports.push({ name: `${slot} single parity`, detail: { floor: hash(floors(composite)), routes: hash(routes(composite)) } });
}
let state = edit(edit(initial(), 'apply', 'west', west), 'apply', 'east', east);
const reverse = edit(edit(initial(), 'apply', 'east', east), 'apply', 'west', west);
assert.equal(hash(floors(state)), hash(floors(reverse))); assert.equal(hash(routes(state)), hash(routes(reverse)));
const reordered = { ...state, trialPlaceSet: { east, west } };
assert.equal(terrainRevision(state), terrainRevision(reordered));
evict(); editableIslandWorld(state); // Diagnostic plans belong to the last compilation of this object.
const plans = compositePlansFor(state);
assert(plans?.length === 2);
assert(!plans[0].influenceCells.some(cell => plans[1].influenceCells.includes(cell)));
reports.push({ name: 'two places, insertion order and disjoint H cell closure', detail: { support: support(state), plans } });

const beforeOverlap = JSON.stringify(state);
assert.throws(() => edit(state, 'apply', 'west', { ...west, center: { x: 0, z: 4 } }), /重な/);
assert.equal(JSON.stringify(state), beforeOverlap);
reports.push({ name: 'overlap rejects without mutating input' });

const eastFloor = (value: GrowingState) => hash(floors(value).map(floor => floor.vertices.filter(vertex => vertex.cell.x >= 1.75)));
const oldEast = eastFloor(state), oldShape = JSON.stringify(compositeOf(state)!.east);
state = edit(state, 'apply', 'west', { ...west, radius: 1.2 });
assert.equal(eastFloor(state), oldEast); assert.equal(JSON.stringify(compositeOf(state)!.east), oldShape); support(state);
for (const [id, cell] of [['starter-bench', { x: 5, z: 5 }], ['starter-flower', { x: 6, z: 5 }]] as const)
    state = applyIntent(state, { id: `composite-move-${id}`, command: { type: 'move', id, cell } }, 1000).state as CompositeGrowingState;
const beforePurchase = state.drops;
state = applyIntent(state, { id: 'composite-buy-flower', command: { type: 'place', kind: 'flower', cell: { x: -1, z: 4 } } }, 1000).state as CompositeGrowingState;
assert.equal(state.drops, beforePurchase - 10);
const normal = stripHistory(state), owned = structuredClone(state.landmarks);
state = edit(state, 'undo', 'west'); assert.equal(eastFloor(state), oldEast); assert.equal(JSON.stringify(compositeOf(state)!.east), oldShape);
assert.deepEqual(stripHistory(state), normal); assert.deepEqual(state.landmarks, owned); support(state);
state = edit(state, 'redo', 'west'); assert.equal(eastFloor(state), oldEast); assert.deepEqual(stripHistory(state), normal); support(state);
reports.push({ name: 'west edit/undo/redo preserves east and later ordinary moves/purchase/wallet/clocks', detail: { drops: state.drops, owners: state.landmarks } });

const westFloor = (value: GrowingState) => hash(floors(value).map(floor => floor.vertices.filter(vertex => vertex.cell.x <= 1.5)));
const oldWest = westFloor(state), westShape = JSON.stringify(compositeOf(state)!.west);
state = edit(state, 'apply', 'east', { ...east, height: .5 });
assert.equal(westFloor(state), oldWest); assert.equal(JSON.stringify(compositeOf(state)!.west), westShape); support(state);
state = edit(state, 'undo', 'east'); assert.equal(westFloor(state), oldWest); assert.deepEqual(stripHistory(state), normal); support(state);
state = edit(state, 'redo', 'east'); assert.equal(westFloor(state), oldWest); support(state);
state = edit(state, 'undo', 'east'); assert.equal(westFloor(state), oldWest); support(state);
reports.push({ name: 'east edit/undo/redo independently preserves west floor, shape, route and later ordinary state' });

const beforeOwner = JSON.stringify(state);
assert.throws(() => edit(state, 'apply', 'east'), /足もと/);
assert.equal(JSON.stringify(state), beforeOwner);
const actorCommand = command(state, 'apply', 'west', { ...west, height: .4, radius: 1.2 });
actorCommand.safety = { actors: [{ x: -1, z: 4 }], occupiedPlaceTargets: [] };
assert.throws(() => applyIntent(state, { id: 'composite-actor', command: actorCommand }, 1000), /なかまが/);
reports.push({ name: 'owner-removal and live-actor guards reject atomically' });

const snapshot = JSON.stringify(state), revision = terrainRevision(state), world = editableIslandWorld(state)!;
const floorHash = hash(floors(state)), routeHash = hash(routes(state));
evict(); assert.notEqual(editableIslandWorld(state), world);
assert.equal(hash(floors(state)), floorHash); assert.equal(hash(routes(state)), routeHash);
assert.equal(JSON.stringify(state), snapshot); assert.equal(terrainRevision(state), revision);
evict(); const fresh = structuredClone(state);
assert.equal(hash(floors(fresh)), floorHash); assert.equal(hash(routes(fresh)), routeHash); assert.equal(JSON.stringify(fresh), snapshot);
reports.push({ name: 'real eviction and fresh clone preserve all floors, routes, both shapes and history', detail: { floorHash, routeHash } });

// Force validation of the prior world on applyIntent's mutable clone. A warm
// previous world would not populate its old plan and could hide a cache defect.
evict();
const changed = edit(state, 'apply', 'east', { ...east, height: .5 });
const changedSnapshot = JSON.stringify(changed), changedWorld = editableIslandWorld(changed)!;
const changedFloor = hash(floors(changed)), changedRoutes = hash(routes(changed));
evict(); assert.notEqual(editableIslandWorld(changed), changedWorld);
assert.equal(hash(floors(changed)), changedFloor); assert.equal(hash(routes(changed)), changedRoutes);
assert.equal(JSON.stringify(changed), changedSnapshot);
reports.push({ name: 'cold prior-world shape mutation also survives cache eviction without stale slot plans' });

let transactions = 0;
const forbiddenDb = { transaction: () => { transactions++; throw Error('must not transact'); } } as unknown as GrowingIslandDatabase;
await assert.rejects(commandGrowingIsland(state.seed, { id: 'forbidden-memory-save', command: command(state, 'apply', 'west', west) }, 1000, forbiddenDb), /メモリ内/);
assert.throws(() => trialDatabase(), /メモリ内専用/);
await assert.rejects(openSavedTrial(forbiddenDb), /メモリ内専用/);
assert.equal(transactions, 0);
const originalSearch = window.location.search;
let opened = 0; const originalOpen = indexedDB.open.bind(indexedDB);
indexedDB.open = (...args: Parameters<IDBFactory['open']>) => { opened++; return originalOpen(...args); };
try {
    window.location.search = originalSearch + '&trialSave=local';
    assert.throws(() => compositeEnabled(), /保存できません/);
    assert.throws(() => trialDatabase(), /保存できません/);
    await assert.rejects(openSavedTrial(), /保存できません/);
    assert.equal(opened, 0);
    window.location.search = originalSearch.replace('&trialScene=shore', '');
    assert.throws(() => compositeEnabled(), /初期データ/);
    window.location.search = originalSearch.replace('trialScene=shore', 'trialScene=unknown');
    assert.throws(() => compositeEnabled(), /初期データ/);
    window.location.search = originalSearch + '&shoreTrial=contour';
    assert.throws(() => compositeEnabled(), /off/);
    window.location.search = originalSearch.replace('&placeSetTrial=two', '') + '&shoreTrial=contour';
    assert.throws(() => trialDatabase(), /メモリ内専用/);
    await assert.rejects(openSavedTrial(forbiddenDb), /メモリ内専用/);
    assert.equal(transactions, 0);
    window.location.search = originalSearch.replace('&placeSetTrial=two', '') + '&shoreTrial=contour&trialSave=local';
    assert.throws(() => trialDatabase(), /保存を使わない/);
    await assert.rejects(openSavedTrial(), /保存を使わない/);
    assert.equal(opened, 0);
} finally { window.location.search = originalSearch; indexedDB.open = originalOpen; }
reports.push({ name: 'writer rejects memory command before transaction; saving/coast combination rejects before IndexedDB open' });
console.log(JSON.stringify({ at: new Date().toISOString(), status: 'PASS', scope: 'Memory-only two-place field/commands and safety, actual transformed domain; no browser or mature-place-use claim',
    inputs: { west, east }, reports, historyLength: compositeHistoryOf(state)!.undo.length }, null, 2));
