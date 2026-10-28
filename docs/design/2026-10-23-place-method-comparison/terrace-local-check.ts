import assert from 'node:assert/strict';
import * as T from 'three';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { terrainOwnerSupported, terrainEditingRevision } from '../../../src/domain/growingIsland/terrainEditing';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { HOUSE_CELLS, landBounds, reachableFromHome, key } from '../../../src/domain/growingIsland/space';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { GrowingLife } from '../../../src/components/island/growing/growingLife';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { createLocalTerraceField } from './terrace-local-field';

declare const LOCAL_TERRACE_DIAGNOSTIC_MODE: 'A' | 'E';
let sequence = 0;
const apply = (state: GrowingState, command: Command) => applyIntent(state, { id: `terrace-${++sequence}`, command }, 1000).state;
function difference(before: NonNullable<ReturnType<typeof editableIslandWorld>>, after: NonNullable<ReturnType<typeof editableIslandWorld>>) {
    let maxRise = 0, maxDrop = 0, changedSamples = 0;
    for (let z = 0; z <= 40; z++) for (let x = 0; x <= 50; x++) {
        const cell = { x: x / 10, z: z / 10 }, a = before.floorAt(cell)?.point.y, b = after.floorAt(cell)?.point.y;
        if (a === undefined || b === undefined) continue;
        maxRise = Math.max(maxRise, b - a); maxDrop = Math.max(maxDrop, a - b);
        if (Math.abs(b - a) > .02) changedSamples++;
    }
    return { maxRise, maxDrop, changedSamples };
}
const runs = [];
for (const existing of [false, true]) for (const height of [2, 3, 4, 8]) {
    let state = newIsland(`terrace-domain-${height}`, 1000);
    const owners = structuredClone(state.landmarks);
    // Real storage/placement commands retain the same initial owned items. This
    // is an explicit domain fixture, not evidence of user acquisition or input.
    state = apply(state, { type: 'store', id: 'starter-flower' });
    state = apply(state, { type: 'store', id: 'starter-bench' });
    if (existing) for (const [x, z, amount] of [[0, 4, -3], [0, 1, -1], [5, 0, 3], [5, 1, -3], [5, 2, -3]])
        for (let step = 0; step < Math.abs(amount); step++) state = apply(state, { type: 'terrain-edit', cell: { x, z }, delta: amount < 0 ? -1 : 1 });
    let maxRaiseCommandDrop = 0, maxRaiseCommandRise = 0;
    for (let step = 0; step < height; step++) for (const cell of [{ x: 1, z: 3 }, { x: 2, z: 3 }]) {
        const beforeWorld = editableIslandWorld(state);
        state = apply(state, { type: 'terrain-edit', cell, delta: 1, expectedTerrainRevision: terrainEditingRevision(state) });
        if (beforeWorld) {
            const delta = difference(beforeWorld, editableIslandWorld(state)!);
            maxRaiseCommandDrop = Math.max(maxRaiseCommandDrop, delta.maxDrop);
            maxRaiseCommandRise = Math.max(maxRaiseCommandRise, delta.maxRise);
        }
    }
    assert(maxRaiseCommandDrop < 1e-7, 'A raise command must not lower another supported surface');
    assert(maxRaiseCommandRise <= .180000001, 'Positive edit response exceeds one physical step');
    const world = editableIslandWorld(state)!, original = legacyIslandWorld(state, true);
    const source = JSON.stringify(state), movedOwners = structuredClone(state);
    movedOwners.landmarks = [];
    assert.equal(editableIslandWorld(movedOwners), world, 'Owners cannot change generated ground');
    const reordered = structuredClone(state); reordered.terrain!.heights = Object.fromEntries(Object.entries(reordered.terrain!.heights).reverse());
    assert.deepEqual(editableIslandWorld(reordered)!.definition, world.definition);
    assert.equal(JSON.stringify(state), source);
    const bounds = landBounds(state);
    let pinError = 0;
    for (const cell of [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }])
        for (const x of [-.46, -.23, 0, .23, .46]) for (const z of [-.46, -.23, 0, .23, .46]) {
            const p = { x: cell.x + x, z: cell.z + z };
            pinError = Math.max(pinError, Math.abs(world.floorAt(p)!.point.y - original.floorAt(p)!.point.y));
        }
    assert(pinError < 1e-7);
    const topCells = [{ x: 1, z: 3 }, { x: 2, z: 3 }];
    const supported = topCells.map(cell => terrainOwnerSupported(state, cell));
    let topMin = Infinity, topMax = -Infinity;
    for (const cell of topCells) for (const x of [-.46, 0, .46]) for (const z of [-.46, 0, .46]) {
        const y = world.floorAt({ x: cell.x + x, z: cell.z + z })?.point.y;
        assert(y !== undefined); topMin = Math.min(topMin, y); topMax = Math.max(topMax, y);
    }
    const reached = reachableFromHome(state, undefined, world);
    const surfaceSamples: (number | null)[] = [];
    for (let z = -10; z <= 50; z++) for (let x = -10; x <= 60; x++) surfaceSamples.push(world.floorAt({ x: x / 10, z: z / 10 })?.point.y ?? null);
    const result = { mode: LOCAL_TERRACE_DIAGNOSTIC_MODE, existingHeights: existing, heightSteps: height, fixture: 'same initial owners; ordinary store/edit/unstore commands',
        supported, topMin, topMax, topVariation: topMax - topMin, pinError,
        topConnected: topCells.map(cell => reached.has(key(cell))), placedBoth: false, actualUse: false,
        actualClimb: 0, receiptAfterMs: 0, placementError: '', maxRaiseCommandDrop, maxRaiseCommandRise, surfaceSamples };
    try {
        state = apply(state, { type: 'unstore', id: 'starter-flower', cell: topCells[0] });
        state = apply(state, { type: 'unstore', id: 'starter-bench', cell: topCells[1] });
        result.placedBoth = true;
    } catch (error) { result.placementError = error instanceof Error ? error.message : String(error); }
    if (result.placedBoth) {
        const identity = (items: typeof owners) => items.map(item => { const copy = { ...item }; delete copy.cell; return copy; });
        assert.deepEqual(identity(state.landmarks), identity(owners));
        const place = derivePlaces(state).find(p => p.ruleId === 'P05' && p.useTargets.some(t => t.kind === 'garden'));
        if (place) {
            const materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true), layer = buildObjectLayer(materials, state, layout);
            const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
            try {
                life.sync(state, layout, layer); life.tick(0, 0, true, false);
                const startY = life.positionOf('pokomoko')!.y;
                let previous = layout.logicalAt(life.positionOf('pokomoko')!);
                if (life.visitPlace('pokomoko', place.id, 0, 'garden')) for (let now = 20; now <= 30_000; now += 20) {
                    life.tick(now, 20, true, false); life.tick(now, 0, true, false);
                    const position = life.positionOf('pokomoko')!, cell = layout.logicalAt(position);
                    assert(editableTerrainSegmentSupported(world, previous, cell)); previous = cell;
                    const receipt = life.takePlaceUses().find(use => use.actorId === 'pokomoko' && use.placeId === place.id);
                    if (receipt) { result.actualUse = true; result.actualClimb = position.y - startY; result.receiptAfterMs = now; break; }
                }
            } finally { life.dispose(); layer.dispose(); materials.dispose(); }
        }
    }
    runs.push(result);
}
// Pure no-fill and locality counterexamples. A clipped triangle adjacent to
// water must retain all three original sample heights, even inside owned land.
const state = newIsland('terrace-counterexamples', 1000);
state.terrain = { version: 1, heights: { '1,3': 4, '2,3': 4 }, undo: [], redo: [] };
const options = { minX: -.5, maxX: 5.5, minZ: -.5, maxZ: 4.5, detail: 6, dryLevel: -.375 };
const baseline = (p: { x: number; z: number }) => p.x < .8 && p.z > 2.8 ? -.52 : .1 + .3 * Math.exp(-((p.x - 1) ** 2 + (p.z - 3) ** 2));
const field = createLocalTerraceField(state, (_state, cell) => baseline(cell), options);
let wetSamples = 0, outsideSamples = 0;
for (let iz = -12; iz <= 60; iz++) for (let ix = -12; ix <= 72; ix++) {
    const p = { x: ix / 12, z: iz / 12 }, a = baseline(p), d = field.heightAt(p);
    if (a < options.dryLevel) { assert.equal(d, a); wetSamples++; }
    if (p.x <= 0 || p.x >= 5 || p.z <= 0 || p.z >= 4) { assert.equal(d, a); outsideSamples++; }
}
const valid = runs.filter(run => run.placedBoth && run.actualUse && run.actualClimb > .1);
const existingIslandUsable = valid.some(run => run.existingHeights);
// Explicit counterexample to smooth editing: an unequal-height pair acquires
// its shared terrace when the lower cell crosses 1->2. Preserve that measured
// jump as a limitation even if direction and ownership remain correct.
let joining = newIsland('terrace-threshold-counterexample', 1000);
joining = apply(joining, { type: 'store', id: 'starter-flower' }); joining = apply(joining, { type: 'store', id: 'starter-bench' });
for (let n = 0; n < 8; n++) joining = apply(joining, { type: 'terrain-edit', cell: { x: 1, z: 3 }, delta: 1 });
joining = apply(joining, { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: 1 });
const beforeJoin = editableIslandWorld(joining)!;
joining = apply(joining, { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: 1 });
const afterJoin = editableIslandWorld(joining)!, join = difference(beforeJoin, afterJoin);
joining = apply(joining, { type: 'terrain-undo' });
const split = difference(afterJoin, editableIslandWorld(joining)!);
assert(join.maxDrop < 1e-7); assert(split.maxRise < 1e-7);
assert.deepEqual(editableIslandWorld(joining)!.definition, beforeJoin.definition);
// Two already-existing terraces, joined by one integer cell. This is a domain
// command fixture with empty furniture, not a claim about the current UI island.
let merging = newIsland('terrace-bridge-counterexample', 1000);
merging = apply(merging, { type: 'store', id: 'starter-flower' }); merging = apply(merging, { type: 'store', id: 'starter-bench' });
for (const [x, height] of [[0, 8], [1, 8], [3, 2], [4, 2], [2, 1]])
    for (let n = 0; n < height; n++) merging = apply(merging, { type: 'terrain-edit', cell: { x, z: 3 }, delta: 1 });
const beforeMerge = editableIslandWorld(merging)!;
merging = apply(merging, { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: 1 });
const afterMerge = editableIslandWorld(merging)!, bridgeMerge = difference(beforeMerge, afterMerge);
merging = apply(merging, { type: 'terrain-undo' });
const bridgeSplit = difference(afterMerge, editableIslandWorld(merging)!);
assert(bridgeMerge.maxDrop < 1e-7); assert(bridgeSplit.maxRise < 1e-7);
assert.deepEqual(editableIslandWorld(merging)!.definition, beforeMerge.definition);
if (LOCAL_TERRACE_DIAGNOSTIC_MODE === 'E') {
    assert(join.maxRise <= .180000001); assert(bridgeMerge.maxRise <= .180000001);
}
let recovery = newIsland('local-terrace-opening-recovery', 1000);
recovery = apply(recovery, { type: 'store', id: 'starter-flower' }); recovery = apply(recovery, { type: 'store', id: 'starter-bench' });
for (let n = 0; n < 8; n++) recovery = apply(recovery, { type: 'terrain-edit', cell: { x: 1, z: 3 }, delta: 1 });
for (let n = 0; n < 4; n++) recovery = apply(recovery, { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: -1 });
const openingRecovery = [];
for (let n = -4; n < 0; n++) {
    const before = editableIslandWorld(recovery)!;
    recovery = apply(recovery, { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: 1 });
    const delta = difference(before, editableIslandWorld(recovery)!);
    assert(delta.maxDrop < 1e-7, 'Restoring an opening must not lower another supported surface');
    openingRecovery.push({ from: n, to: n + 1, ...delta });
}
console.log(JSON.stringify({ status: existingIslandUsable ? 'PASS' : 'FAIL_USABILITY', mode: LOCAL_TERRACE_DIAGNOSTIC_MODE,
    existingIslandUsable, runs, validHeights: valid.map(run => run.heightSteps),
    counterexamples: { wetSamples, outsideSamples, thresholdJoin: join, thresholdSplit: split, bridgeMerge, bridgeSplit, openingRecovery },
    limitation: 'Not all heights are reachable; positive edit bound verified; opening recovery response is measured separately; lightweight actor, no WebGL/UI proof' }, null, 2));
