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
import { convexTerraceOffset } from './terrace-convex-field';
import { foundationEditWeight } from '../2026-10-22-place-strategy-trial/foundation';

declare const CONVEX_TERRACE_DIAGNOSTIC_MODE: 'A' | 'F';
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
const fixtures = [false, true].flatMap(existing => [2, 3, 4, 8].flatMap(height =>
    (height === 2 ? [false, true, 'shoulder', ...(existing ? ['shoulder3'] : [])] : [false]).map(ramp => ({ existing, height, ramp, place: 'opening' }))));
fixtures.push({ existing: true, height: 2, ramp: true, place: 'south-central' });
for (const { existing, height, ramp, place: location } of fixtures) {
    let state = newIsland(`terrace-domain-${height}`, 1000);
    const owners = structuredClone(state.landmarks);
    // Real storage/placement commands retain the same initial owned items. This
    // is an explicit domain fixture, not evidence of user acquisition or input.
    state = apply(state, { type: 'store', id: 'starter-flower' });
    state = apply(state, { type: 'store', id: 'starter-bench' });
    if (existing) for (const [x, z, amount] of [[0, 4, -3], [0, 1, -1], [5, 0, 3], [5, 1, -3], [5, 2, -3]])
        for (let step = 0; step < Math.abs(amount); step++) state = apply(state, { type: 'terrain-edit', cell: { x, z }, delta: amount < 0 ? -1 : 1 });
    const topCells = location === 'south-central' ? [{ x: 2, z: 3 }, { x: 2, z: 4 }] : [{ x: 1, z: 3 }, { x: 2, z: 3 }];
    const rampCells = location === 'south-central' ? [[1, 3], [2, 2], [3, 3], [1, 4], [3, 4]] : [[1, 2], [2, 2], [0, 3], [1, 4], [2, 4], [3, 3]];
    if (ramp) for (const [x, z] of rampCells)
        state = apply(state, { type: 'terrain-edit', cell: { x, z }, delta: 1 });
    if (ramp === 'shoulder' || ramp === 'shoulder3') for (const [x, z] of [[0, 3], [1, 4]])
        state = apply(state, { type: 'terrain-edit', cell: { x, z }, delta: 1 });
    if (ramp === 'shoulder3') state = apply(state, { type: 'terrain-edit', cell: { x: 0, z: 3 }, delta: 1 });
    let maxRaiseCommandDrop = 0, maxRaiseCommandRise = 0;
    for (let step = 0; step < height; step++) for (const cell of topCells) {
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
    const placementRights = (input: typeof world) => input.sites.filter(site => site.placement).map(site => key(site.cell)).sort();
    assert.deepEqual(placementRights(world), placementRights(original), 'Sculpting must not acquire placement rights');
    const negativeCenters = Object.entries(state.terrain!.heights).filter(([, height]) => height < 0).map(([id, height]) => {
        const [x, z] = id.split(',').map(Number), cell = { x, z };
        const expectedY = original.floorAt(cell)!.point.y + height * .18 * foundationEditWeight(state, cell);
        const actualY = world.floorAt(cell)?.point.y;
        if (expectedY < -.375) assert.equal(actualY, undefined, 'A saved underwater centre must remain open');
        else assert(actualY !== undefined && Math.abs(actualY - expectedY) < 1e-7, 'A saved negative centre must retain its value');
        return { cell, height, expectedY, actualY: actualY ?? null };
    });
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
    const supported = topCells.map(cell => terrainOwnerSupported(state, cell));
    let topMin = Infinity, topMax = -Infinity;
    for (const cell of topCells) for (const x of [-.46, 0, .46]) for (const z of [-.46, 0, .46]) {
        const y = world.floorAt({ x: cell.x + x, z: cell.z + z })?.point.y;
        assert(y !== undefined); topMin = Math.min(topMin, y); topMax = Math.max(topMax, y);
    }
    const reached = reachableFromHome(state, undefined, world);
    const surfaceSamples: (number | null)[] = [];
    for (let z = -10; z <= 50; z++) for (let x = -10; x <= 60; x++) surfaceSamples.push(world.floorAt({ x: x / 10, z: z / 10 })?.point.y ?? null);
    const result = { mode: CONVEX_TERRACE_DIAGNOSTIC_MODE, existingHeights: existing, heightSteps: height, rampCells: ramp, topCells, location, fixture: 'same initial owners; ordinary store/edit/unstore commands',
        supported, topMin, topMax, topVariation: topMax - topMin, pinError,
        topConnected: topCells.map(cell => reached.has(key(cell))), placedBoth: false, actualUse: false,
        actualClimb: 0, receiptAfterMs: 0, placementError: '', maxRaiseCommandDrop, maxRaiseCommandRise, negativeCenters, surfaceSamples };
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
// Pure coefficient contract: exact integer centres and <=.18m response to
// one coefficient change for every sampled location, including negative values.
const pureBounds = { minX: 0, maxX: 5, depth: 5 };
let maxCoefficientResponse = 0, centerError = 0;
for (let height = -4; height < 12; height++) {
    const before = { '1,3': 8, '2,3': height }, after = { ...before, '2,3': height + 1 };
    centerError = Math.max(centerError, Math.abs(convexTerraceOffset(before, { x: 2, z: 3 }, pureBounds) - height));
    for (let z = 20; z <= 40; z++) for (let x = 0; x <= 40; x++) {
        const point = { x: x / 10, z: z / 10 };
        const delta = (convexTerraceOffset(after, point, pureBounds) - convexTerraceOffset(before, point, pureBounds)) * .18;
        assert(delta >= -1e-9 && delta <= .180000001);
        maxCoefficientResponse = Math.max(maxCoefficientResponse, delta);
    }
}
assert.equal(centerError, 0);
const valid = runs.filter(run => run.placedBoth && run.actualUse && run.actualClimb > .1);
const existingIslandUsable = valid.some(run => run.existingHeights);
const rejectedRecipes = [];
try {
    apply(newIsland('fixed-home-recipe', 1000), { type: 'terrain-edit', cell: { x: 2, z: 1 }, delta: 1 });
    assert.fail('A ramp must not replace the fixed home doorstep');
} catch (error) {
    assert(error instanceof Error && error.message.includes('足もと'));
    rejectedRecipes.push({ top: [{ x: 2, z: 2 }, { x: 3, z: 2 }], blockedRamp: { x: 2, z: 1 }, reason: error.message });
}
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
if (CONVEX_TERRACE_DIAGNOSTIC_MODE === 'F') {
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
    assert(delta.maxRise <= .180000001, 'Restoring an opening exceeded one physical edit step');
    openingRecovery.push({ from: n, to: n + 1, ...delta });
}
console.log(JSON.stringify({ status: existingIslandUsable ? 'PASS' : 'FAIL_USABILITY', mode: CONVEX_TERRACE_DIAGNOSTIC_MODE,
    existingIslandUsable, runs, rejectedRecipes, validHeights: valid.map(run => run.heightSteps),
    counterexamples: { centerError, maxCoefficientResponse, thresholdJoin: join, thresholdSplit: split, bridgeMerge, bridgeSplit, openingRecovery },
    limitation: 'Not all heights are reachable; all signed coefficient response bounded; arbitrary steep transitions may remain inaccessible; lightweight actor, no WebGL/UI proof' }, null, 2));
