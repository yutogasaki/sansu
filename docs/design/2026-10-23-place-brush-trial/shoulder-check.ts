import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported, terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, walkableCells, landCells } from '../../../src/domain/growingIsland/space';
import { commandGrowingIsland, readGrowingIsland, observeGrowingIsland, type GrowingIslandDatabase } from '../../../src/domain/growingIsland/repository';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { terrainFootingError, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { compositeOf, compositePlansFor, compositeEnabled, type PlaceSlot } from './composite-field';
import { compositeEditingRevision, type CompositeGrowingState } from './composite-model';
import { replacePlace, reachablePlacePlatform } from './model';
import type { PlaceShape } from './directional-field';
import { shoulderTrialMode, shoulderWidth } from './shoulder-section';
import { trialDatabase, openSavedTrial } from './trial-store';
import { compositeDatabase, openCompositeTrial } from './composite-store';
declare const __SHOULDER_REFERENCE__: boolean;
declare const __SHOULDER_MODE__: 'northWide' | 'northHermite';
const originalSearch = window.location.search;
const query = originalSearch.replace(/&shoulderTrial=[^&]*/g, '');
const safety = { actors: [], occupiedPlaceTargets: [] };
const west: PlaceShape = { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const east: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' };
const base = () => structuredClone(fixture.state) as unknown as GrowingState;
const initial = (): CompositeGrowingState => ({ ...base(), trialPlaceSet: {}, trialPlaceSetHistory: { version: 1, undo: [], redo: [] } });
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let sequence = 0;
function edit(state: GrowingState, slot: PlaceSlot, shape: PlaceShape) {
    return applyIntent(state, { id: `shoulder-${++sequence}`, command: { type: 'place-set', action: 'apply', slot, shape, safety,
        expectedPlaceRevision: compositeEditingRevision(state) } }, 1000).state as CompositeGrowingState;
}
function geometry(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    return { floors: sha(world.floors), routes: sha(landCells(state).map(cell => world.route(HOME_CELL, cell, open) ?? null)), revision: terrainRevision(state) };
}
function evict() { for (let i = 0; i < 10; i++) { const state = base(); state.terrain!.heights['-3,0'] = i % 5 - 2;
    state.terrain!.heights['-3,1'] = Math.floor(i / 5) + 1; editableIslandWorld(state); } }
window.location.search = query;
const standard = [base(), { ...base(), trialPlace: west }, { ...base(), trialPlace: east },
    { ...base(), trialPlace: { center: { x: -1, z: 7 }, radius: 2, height: -.25, entrance: 1.2 } },
    edit(edit(initial(), 'west', west), 'east', east)].map(geometry);
window.location.search = query + '&shoulderTrial=northWide';
const standardWide = geometry(edit(edit(initial(), 'west', west), 'east', east));
window.location.search = query;
const reports: { name: string; detail?: unknown }[] = [];
if (!__SHOULDER_REFERENCE__) {
    const old = edit(edit(initial(), 'west', west), 'east', east);
    const oldWorld = editableIslandWorld(old)!, oldGeometry = geometry(old), oldJSON = JSON.stringify(old);
    window.location.search = query + '&shoulderTrial=' + __SHOULDER_MODE__;
    assert.equal(shoulderTrialMode(), __SHOULDER_MODE__); assert(compositeEnabled());
    let state = edit(edit(initial(), 'west', west), 'east', east);
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    assert.notEqual(geometry(state).revision, oldGeometry.revision); assert.notEqual(geometry(state).floors, oldGeometry.floors);
    assert.deepEqual(compositeOf(state), compositeOf(old)); validateTerrain(state); assert.equal(terrainFootingError(base(), state), undefined);
    const targets = Object.entries(compositeOf(state)!).map(([slot, shape]) => {
        const target = reachablePlacePlatform(world, open, shape!)!; assert(target);
        const route = world.route(HOME_CELL, target, open)!; assert(route);
        assert(route.slice(1).every((cell, i) => editableTerrainSegmentSupported(world, route[i], cell)));
        return { slot, target, route };
    });
    const oldOpen = walkableCells(old, oldWorld);
    const reachability = landCells(state).map(cell => ({ cell, before: !!oldWorld.route(HOME_CELL, cell, oldOpen), after: !!world.route(HOME_CELL, cell, open) }));
    const lostDestinations = reachability.filter(item => item.before && !item.after);
    const changedAnalytic = (cell: Cell) => {
        const radius = Math.hypot(cell.x - 5, (cell.z - 5) / .8), width = shoulderWidth(east, cell);
        return width > east.radius * .42 && radius > east.flatRadius! && radius < east.flatRadius! + width;
    };
    const inClosure = (cell: Cell) => {
        const x = Math.floor(cell.x * 12 + 1e-8) / 12, z = Math.floor(cell.z * 12 + 1e-8) / 12;
        return [0, 1 / 12].some(dx => [0, 1 / 12].some(dz => changedAnalytic({ x: x + dx, z: z + dz })));
    };
    const samples = new Map<string, Cell>();
    for (const vertex of [...world.floors, ...oldWorld.floors].flatMap(floor => floor.vertices)) samples.set(`${vertex.cell.x},${vertex.cell.z}`, vertex.cell);
    for (let z = 1; z <= 7; z += .125) for (let x = -4; x <= 8; x += .125) samples.set(`${x},${z}`, { x, z });
    const changedPlateau: Cell[] = [];
    let changes = 0, outside = 0, protectedSamples = 0, plateauSamples = 0; const changedBounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const cell of samples.values()) {
        const before = oldWorld.floorAt(cell)?.point, after = world.floorAt(cell)?.point;
        const changed = !before !== !after || !!before && !!after && Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z) > 1e-8;
        if (cell.z >= 3.9 || cell.x <= 1.5) { assert(!changed, `protected floor ${JSON.stringify(cell)}`); protectedSamples++; }
        if (Math.hypot(cell.x - 5, (cell.z - 5) / .8) <= east.flatRadius!) {
            if (changed) changedPlateau.push(cell); plateauSamples++;
        }
        if (changed) { changes++; if (!inClosure(cell)) outside++;
            changedBounds.minX = Math.min(changedBounds.minX, cell.x); changedBounds.maxX = Math.max(changedBounds.maxX, cell.x);
            changedBounds.minZ = Math.min(changedBounds.minZ, cell.z); changedBounds.maxZ = Math.max(changedBounds.maxZ, cell.z); }
    }
    assert(changes > 100); assert.equal(outside, 0); assert.equal(JSON.stringify(old), oldJSON);
    assert(lostDestinations.length === 0 && changedPlateau.length === 0,
        `protected geometry lost: ${JSON.stringify({ lostDestinations, changedPlateau })}`);
    reports.push({ name: 'actual north-only floor changes stay within declared H-cell closure; west corridor, south, west place and owners unchanged',
        detail: { sampled: samples.size, changes, outside, protectedSamples, plateauSamples, changedBounds, targets,
            reachableBefore: reachability.filter(item => item.before).length, reachableAfter: reachability.filter(item => item.after).length } });
    evict(); editableIslandWorld(state); const plans = compositePlansFor(state)!;
    assert.equal(plans.length, 2); assert(!plans[0].influenceCells.some(cell => plans[1].influenceCells.includes(cell)));
    assert.throws(() => edit(state, 'west', { ...west, center: { x: 0, z: 4 } }), /重な/);
    for (const [id, cell] of [['starter-bench', { x: 5, z: 5 }], ['starter-flower', { x: 6, z: 5 }]] as const)
        state = applyIntent(state, { id: `shoulder-move-${id}`, command: { type: 'move', id, cell } }, 1000).state as CompositeGrowingState;
    const stable = geometry(state), snapshot = JSON.stringify(state), oldCompiled = editableIslandWorld(state);
    evict(); assert.notEqual(editableIslandWorld(state), oldCompiled); assert.deepEqual(geometry(state), stable); assert.equal(JSON.stringify(state), snapshot);
    evict(); assert.deepEqual(geometry(structuredClone(state)), stable);
    window.location.search = query; assert.deepEqual(geometry(old), oldGeometry);
    window.location.search = query + '&shoulderTrial=' + __SHOULDER_MODE__; assert.deepEqual(geometry(state), stable);
    reports.push({ name: 'disjoint reservations, normal owner moves, cache eviction/fresh clone and query switching preserve geometry and state', detail: { geometry: stable } });
    for (const [name, shape, actors] of [
        ['fixed-house', { ...east, center: { x: 3, z: 2 } }, []],
        ['fixed-dock', { ...east, center: { x: 7, z: 5 } }, []],
        ['actor', east, [{ x: 4, z: 5 }]],
    ] as const) assert.throws(() => replacePlace(base(), shape, { actors: [...actors], occupiedPlaceTargets: [] }), name === 'actor' ? /なかまが/ : /おうちと ふなつきばの 足もと/);
    reports.push({ name: 'existing fixed-house, dock and live-actor guards retain rejection' });
    let opens = 0, accesses = 0; const originalOpen = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args: Parameters<IDBFactory['open']>) => { opens++; return originalOpen(...args); };
    const forbidden = { name: 'forbidden', transaction: () => { accesses++; throw Error('DB touched'); }, islands: { get: () => { accesses++; throw Error('DB touched'); } } } as unknown as GrowingIslandDatabase;
    for (const saved of ['', '&trialSave=local', '&trialSave=two-local']) for (const suffix of ['northWide', 'northHermite', 'unknown', 'off', '']) {
        window.location.search = query + `&shoulderTrial=${suffix}${saved}`;
        assert.throws(trialDatabase, /メモリ内専用/); assert.throws(compositeDatabase, /メモリ内専用/);
        await assert.rejects(openSavedTrial(forbidden), /メモリ内専用/); await assert.rejects(openCompositeTrial(forbidden), /メモリ内専用/);
        await assert.rejects(readGrowingIsland('other', forbidden), /メモリ内専用/); assert.throws(() => observeGrowingIsland('other', forbidden), /メモリ内専用/);
        await assert.rejects(commandGrowingIsland('other', { id: 'forbidden', command: { type: 'flag', color: 1 } }, 1000, forbidden), /メモリ内専用/);
    }
    assert.equal(opens, 0); assert.equal(accesses, 0); indexedDB.open = originalOpen;
    for (const invalid of [query.replace('&trialScene=shore', ''), query.replace('terrainTrial=H', 'terrainTrial=F'), query + '&shoreTrial=bay08']) {
        window.location.search = invalid + '&shoulderTrial=northWide'; assert.throws(compositeEnabled, /固定の岸データ/);
    }
    reports.push({ name: 'any shoulder query blocks both saved accessors/openers and ordinary read/observe/writer before access; unsupported fixture rejects' });
}
window.location.search = originalSearch;
console.log(JSON.stringify({ status: 'PASS', at: new Date().toISOString(), standard, standardWide, reports }, null, 2));
