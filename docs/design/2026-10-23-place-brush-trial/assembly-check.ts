import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOME_CELL, landCells, walkableCells } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { compositeOf, type PlaceSlot } from './composite-field';
import { compositeEditingRevision, type CompositeGrowingState } from './composite-model';
import type { PlaceShape } from './directional-field';
import { reachablePlacePlatform } from './model';
import { createAssemblySection } from './assembly-section';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const initial = (): CompositeGrowingState => ({ ...structuredClone(fixture.state) as unknown as GrowingState,
    trialPlaceSet: {}, trialPlaceSetHistory: { version: 1, undo: [], redo: [] } });
const west: PlaceShape = { center: { x: -1, z: 4 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 };
const east: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2, flatRadius: 1.75, rampDirection: 'west' };
const bay: PlaceShape = { center: { x: -1, z: 7 }, radius: 2, height: -.55, entrance: 1.2 };
let sequence = 0;
function edit(state: GrowingState, slot: PlaceSlot, shape?: PlaceShape, action: 'apply' | 'undo' | 'redo' = 'apply') {
    return applyIntent(state, { id: `assembly-${++sequence}`, command: { type: 'place-set', action, slot, shape,
        expectedPlaceRevision: compositeEditingRevision(state), safety: { actors: [], occupiedPlaceTargets: [] } } }, 1000).state as CompositeGrowingState;
}
function support(state: GrowingState) {
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    const targets = landCells(state).filter(cell => world.route(HOME_CELL, cell, open));
    for (const shape of [compositeOf(state)?.west, compositeOf(state)?.east]) if (shape) {
        const target = reachablePlacePlatform(world, open, shape); assert(target);
        const route = world.route(HOME_CELL, target, open)!;
        assert(route.slice(1).every((cell, i) => editableTerrainSegmentSupported(world, route[i], cell)));
    }
    return targets;
}
const reports: { name: string; detail?: unknown }[] = [];
const two = edit(edit(initial(), 'west', west), 'east', east);
let three = edit(two, 'bay', bay);
const reversed = edit(edit(edit(initial(), 'bay', bay), 'east', east), 'west', west);
const floors = (s: GrowingState) => editableIslandWorld(s)!.floors;
assert.equal(hash(floors(three)), hash(floors(reversed)));
const beforeTargets = support(two), afterTargets = support(three);
const lost = beforeTargets.filter(cell => !afterTargets.some(after => after.x === cell.x && after.z === cell.z));
assert.deepEqual(lost, [{ x: -1, z: 7 }]); // The deliberate inlet becomes water; all other destinations remain.
assert.deepEqual(three.landmarks, two.landmarks); assert.equal(three.drops, two.drops);
reports.push({ name: 'three parts commute; only the inlet destination becomes water', detail: { beforeCount: beforeTargets.length, afterCount: afterTargets.length, lost, destinations: afterTargets, floorHash: hash(floors(three)) } });
const originalWorld = editableIslandWorld(two)!, finalWorld = editableIslandWorld(three)!;
const samples = new Map<string, { x: number; z: number }>();
for (const floor of [...originalWorld.floors, ...finalWorld.floors]) for (const v of floor.vertices) samples.set(`${v.cell.x},${v.cell.z}`, v.cell);
let changed = 0, submerged = 0;
for (const cell of samples.values()) {
    const old = originalWorld.floorAt(cell)?.point, next = finalWorld.floorAt(cell)?.point;
    assert(!next || old, `no new land at ${JSON.stringify(cell)}`);
    if (old && next) { assert(next.y <= old.y + 1e-8, `lower only at ${JSON.stringify(cell)}`); if (Math.abs(next.y - old.y) > 1e-8) changed++; }
    if (old && !next) submerged++;
}
assert(changed > 0);
reports.push({ name: 'actual compiled floor only lowers', detail: { changed, submerged, sampled: samples.size } });
const shapeHash = hash(compositeOf(three)), floorHash = hash(floors(three));
three = edit(three, 'bay', undefined, 'undo'); assert.deepEqual(compositeOf(three), compositeOf(two));
assert.equal(hash(floors(three)), hash(floors(two)));
three = edit(three, 'bay', undefined, 'redo'); assert.equal(hash(compositeOf(three)), shapeHash); assert.equal(hash(floors(three)), floorHash);
assert.equal(hash(floors(structuredClone(three))), floorHash);
reports.push({ name: 'undo redo and fresh state rebuild preserve complete composition' });
const analytical = createAssemblySection(three, cell => Math.sin(cell.x) + Math.cos(cell.z));
for (const shape of [west, east]) for (let dz = -1; dz <= 1; dz += .05) for (let dx = -1; dx <= 1; dx += .05) {
    const cell = { x: shape.center.x + dx, z: shape.center.z + dz };
    assert.equal(analytical.heightAt(cell), Math.sin(cell.x) + Math.cos(cell.z));
}
reports.push({ name: 'usable flat samples are exact under the bay operator' });
const beforeInvalid = hash(three);
assert.throws(() => edit(three, 'bay', { ...bay, height: .5 })); assert.equal(hash(three), beforeInvalid);
assert.throws(() => edit(three, 'bay', { ...bay, flatRadius: 1.75 }));
reports.push({ name: 'malformed bay rejects without mutating prior composition' });
const outlines: unknown[] = [];
for (const x of [-1, 1]) for (const radius of [2, 3]) for (const depth of [.8, 1.6, 2.4]) {
    const shape = { ...bay, center: { x, z: 7 }, radius, bayDepth: depth };
    let candidate: GrowingState;
    try { candidate = edit(two, 'bay', shape); }
    catch (error) { outlines.push({ x, radius, depth, accepted: false, reason: String(error) }); continue; }
    const world = editableIslandWorld(candidate)!;
    const protectedPoints = [west, east].flatMap(shape => Array.from({ length: 17 }, (_, i) => Array.from({ length: 17 }, (_, j) =>
        ({ x: shape.center.x + (i - 8) / 8, z: shape.center.z + (j - 8) / 10 }))).flat());
    for (const cell of protectedPoints) assert.deepEqual(world.floorAt(cell)?.point, originalWorld.floorAt(cell)?.point);
    assert.deepEqual(candidate.landmarks, two.landmarks); assert.deepEqual(candidate.land, two.land);
    outlines.push({ x, radius, depth, accepted: true, destinations: support(candidate).length,
        protectedSamples: protectedPoints.length, floorHash: hash(world.floors) });
}
reports.push({ name: 'outline scale sweep with unchanged usable platforms and owners', detail: outlines });
console.log(JSON.stringify({ status: 'PASS', date: new Date().toISOString(), reports }));
