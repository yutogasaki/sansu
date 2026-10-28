/** Local diagnostic fixture, not a browser journey or a persisted user island.
 * Bundle with esbuild --platform=node --format=esm --define:import.meta.env.DEV=false.
 * The parent experiment may substitute its A/B floor modules while bundling.
 * This script writes JSON to stdout only; it never opens or injects a database.
 */
import assert from 'node:assert/strict';
import * as T from 'three';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainEditingRevision, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { HOME_CELL, key, reachableFromHome } from '../../../src/domain/growingIsland/space';
import type { Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { GrowingLife, type PlaceUseReceipt } from '../../../src/components/island/growing/growingLife';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { sceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { walkRoute } from '../../../src/components/island/growing/walkers';

const START = Date.UTC(2026, 9, 23), STEP = 20;
const PROFILE = 'place-method-life-diagnostic';
let intent = 0;
const command = (state: GrowingState, command: Command) => applyIntent(state,
    { id: `diagnostic-${++intent}`, command }, START).state;
const rights = (state: GrowingState) => ({
    land: state.land, drops: state.drops, villagers: state.villagers, learned: state.learned,
    owners: [...state.landmarks, ...state.plots, ...state.keepsakes].map(item => {
        const owner = { ...item }; delete owner.cell; return owner;
    }),
});
function signature(state: GrowingState) {
    const world = editableIslandWorld(state);
    const place = derivePlaces(state).find(place => place.ruleId === 'P05' && place.mainIds.includes('starter-flower'));
    assert(place && ['grown', 'lived'].includes(place.stage), 'The same owned flower makes an actual grown place');
    const target = place.useTargets.find(target => target.kind === 'garden');
    assert(target, 'The actual derivation supplies a garden target');
    const reached = reachableFromHome(state, undefined, world);
    assert(reached.has(key(target.cell)), 'The target is connected to the real doorstep');
    const route = walkRoute(reached, HOME_CELL, target.cell, world);
    assert(route?.length, 'The normal walking graph reaches the garden');
    return { owners: state.landmarks.map(({ id, cell }) => ({ id, cell })), heights: state.terrain?.heights,
        placeId: place.id, revision: place.revision, targets: place.useTargets, target, route };
}

/** Real life logic and floor, lightweight actor: no WebGL, native rig or camera proof. */
function exerciseGarden(state: GrowingState, label: string) {
    const saved = structuredClone(state), derived = signature(state);
    const materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true);
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const layer = buildObjectLayer(materials, state, layout), life = new GrowingLife(materials, actor);
    try {
        life.sync(state, layout, layer); life.tick(0, 0, true, false);
        assert.deepEqual(life.takePlaceUses(), []);
        const start = life.positionOf('pokomoko')!;
        assert(life.visitPlace('pokomoko', derived.placeId, 0, 'garden'));
        assert.deepEqual(life.positionOf('pokomoko'), start, 'Choosing a place does not teleport the actor');
        assert.deepEqual(life.takePlaceUses(), [], 'Choosing a place is not a use');
        let arrival: number | undefined, usedAt: number | undefined, receipt: PlaceUseReceipt | undefined;
        let previous = layout.logicalAt(start), distance = 0, steps = 0;
        const route: { x: number; z: number }[] = [{ ...previous }];
        const destination = layout.point(derived.target.cell);
        for (let now = STEP; now <= 30_000 && !receipt; now += STEP) {
            life.tick(now, STEP, true, false);
            // Arrival changes mode before updating the rendered pose; a same-time
            // zero-delta tick samples that pose without advancing the use clock.
            life.tick(now, 0, true, false);
            const position = life.positionOf('pokomoko'); assert(position);
            const at = layout.logicalAt(position), step = Math.hypot(at.x - previous.x, at.z - previous.z);
            assert(step <= STEP * .00115 + 1e-7, 'Every step follows normal walking speed');
            assert(layout.world.floorAt(at), 'Every occupied point has a real dry floor');
            if (step > 1e-8) {
                assert(editableTerrainSegmentSupported(layout.world, previous, at), 'Walking crosses only supported ground');
                distance += step; steps++; route.push(at);
            }
            previous = at;
            if (arrival === undefined && Math.hypot(position.x - destination.x, position.z - destination.z) < 1e-7) arrival = now;
            const uses = life.takePlaceUses().filter(use => use.actorId === 'pokomoko');
            for (const use of uses) {
                assert.equal(use.placeId, derived.placeId); assert.equal(use.targetId, derived.target.id);
                assert.equal(use.revision, derived.revision);
                assert(arrival !== undefined && now - arrival >= 700, 'A receipt requires 700ms after actual arrival');
                receipt = use; usedAt = now;
            }
        }
        assert(receipt && arrival !== undefined && usedAt !== undefined, `${label}: actual use finishes within 30 seconds`);
        assert(distance > .1 && steps > 1, 'The fixture proves walking, not an actor initially on the target');
        assert.deepEqual(state, saved, 'Life itself never mutates the saved island');
        const acknowledged = command(state, { type: 'place-used', profileId: PROFILE, expectedRevision: 0, ...receipt });
        const fact = acknowledged.placeProgress?.uses.P05?.pokomoko;
        assert.equal(fact?.targetId, receipt.targetId); assert.equal(fact?.revision, receipt.revision);
        return { state: acknowledged, proof: { label, ...derived, arrivalMs: arrival, receiptMs: usedAt,
            afterArrivalMs: usedAt - arrival, walkedDistance: distance, movementSteps: steps, receipt, actualRoute: route } };
    } finally { life.dispose(); layer.dispose(); materials.dispose(); }
}

/** Keep the same runtime actor alive while a currently used garden moves. */
function exerciseContinuousMove(state: GrowingState) {
    const before = signature(state), materials = new IslandMaterials('moon-garden');
    const layout = sceneLayout(state, true), layer = buildObjectLayer(materials, state, layout);
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(materials, actor);
    let nextLayer: ReturnType<typeof buildObjectLayer> | undefined;
    try {
        life.sync(state, layout, layer); life.tick(0, 0, true, false);
        assert(life.visitPlace('pokomoko', before.placeId, 0, 'garden'));
        let now = 0, arrival: number | undefined;
        const destination = layout.point(before.target.cell);
        while (now < 30_000 && (arrival === undefined || now - arrival < 300)) {
            now += STEP; life.tick(now, STEP, true, false); life.tick(now, 0, true, false);
            const position = life.positionOf('pokomoko')!;
            if (arrival === undefined && Math.hypot(position.x - destination.x, position.z - destination.z) < 1e-7) arrival = now;
            assert.deepEqual(life.takePlaceUses(), [], 'No receipt before the old garden has been used for 700ms');
        }
        assert(arrival !== undefined); assert.equal(life.activePlaceOf('pokomoko')?.revision, before.revision);
        const actualPosition = life.positionOf('pokomoko')!;
        let moved = command(state, { type: 'move', id: 'starter-bench', cell: { x: 3, z: 3 } });
        moved = command(moved, { type: 'move', id: 'starter-flower', cell: { x: 3, z: 2 } });
        const after = signature(moved), nextLayout = sceneLayout(moved, true);
        assert.notEqual(after.revision, before.revision);
        nextLayer = buildObjectLayer(materials, moved, nextLayout);
        life.sync(moved, nextLayout, nextLayer);
        assert.equal(life.activePlaceOf('pokomoko'), undefined, 'Moving the source cancels its active old destination');
        assert.deepEqual(life.positionOf('pokomoko'), actualPosition, 'The same runtime actor keeps its actual feet');
        assert.deepEqual(life.takePlaceUses(), [], 'Sync cannot manufacture or release a stale receipt');
        assert(life.visitPlace('pokomoko', after.placeId, now, 'garden'));
        assert.deepEqual(life.positionOf('pokomoko'), actualPosition, 'Revisit also starts without teleportation');
        const nextDestination = nextLayout.point(after.target.cell);
        let nextArrival: number | undefined, receipt: PlaceUseReceipt | undefined, steps = 0;
        let previous = nextLayout.logicalAt(actualPosition);
        const start = now;
        while (now - start < 30_000 && !receipt) {
            now += STEP; life.tick(now, STEP, true, false); life.tick(now, 0, true, false);
            const position = life.positionOf('pokomoko')!;
            const at = nextLayout.logicalAt(position), distance = Math.hypot(at.x - previous.x, at.z - previous.z);
            assert(distance <= STEP * .00115 + 1e-7);
            if (distance > 1e-8) { assert(editableTerrainSegmentSupported(nextLayout.world, previous, at)); steps++; }
            previous = at;
            if (nextArrival === undefined && Math.hypot(position.x - nextDestination.x, position.z - nextDestination.z) < 1e-7) nextArrival = now;
            for (const use of life.takePlaceUses()) {
                assert.equal(use.revision, after.revision, 'No old-revision receipt may escape after moving');
                assert.equal(use.targetId, after.target.id);
                assert(nextArrival !== undefined && now - nextArrival >= 700);
                receipt = use;
            }
        }
        assert(receipt && nextArrival !== undefined && steps > 1);
        assert.throws(() => command(moved, { type: 'place-used', profileId: PROFILE, expectedRevision: 0,
            ruleId: 'P05', placeId: before.placeId, revision: before.revision, actorId: 'pokomoko', targetId: before.target.id }),
        /ばしょの いま/, 'Domain independently rejects an obsolete receipt');
        const acknowledged = command(moved, { type: 'place-used', profileId: PROFILE, expectedRevision: 0, ...receipt });
        assert.equal(acknowledged.placeProgress?.uses.P05?.pokomoko?.revision, after.revision);
        return { sameRuntimeActor: true, movedAfterOldArrivalMs: start - arrival, oldTargetCancelled: true,
            positionPreserved: true, staleReceiptRejected: true, newReceipt: receipt,
            newArrivalMs: nextArrival, newReceiptMs: now, movementSteps: steps };
    } finally { life.dispose(); layer.dispose(); nextLayer?.dispose(); materials.dispose(); }
}

export function runLifeCheck() {
    intent = 0;
    const original = newIsland(PROFILE, START), originalRights = rights(original);
    // All changes after the explicitly labelled newIsland fixture use ordinary intents.
    let state = command(original, { type: 'move', id: 'starter-bench', cell: { x: 1, z: 3 } });
    for (const cell of [{ x: 5, z: 1 }, { x: 5, z: 2 }]) for (let n = 0; n < 3; n++) {
        state = command(state, { type: 'terrain-edit', cell, delta: -1, expectedTerrainRevision: terrainEditingRevision(state) });
    }
    assert.deepEqual(rights(state), originalRights, 'Placement and terrain preserve acquired owners, maturity and currency');
    assert.equal(editableIslandWorld(state)!.floorAt({ x: 5, z: 1 }), undefined);
    const continuousMove = exerciseContinuousMove(state);
    const a = exerciseGarden(state, 'A: flower 1,2 / bench 1,3'); state = a.state;
    state = command(state, { type: 'move', id: 'starter-bench', cell: { x: 3, z: 3 } });
    state = command(state, { type: 'move', id: 'starter-flower', cell: { x: 3, z: 2 } });
    assert.deepEqual(rights(state), originalRights);
    const b = exerciseGarden(state, 'B: same flower 3,2 / same bench 3,3'); state = b.state;
    assert.equal(a.proof.placeId, b.proof.placeId, 'Same source owner retains place identity');
    assert.equal(a.proof.target.id, b.proof.target.id, 'Same owned target is reused');
    assert.notDeepEqual(a.proof.target.cell, b.proof.target.cell, 'The usable destination changes with placement');
    assert.notDeepEqual(a.proof.actualRoute, b.proof.actualRoute, 'The actual walk changes with placement');
    const beforeUndo = signature(state), terrain = structuredClone(state.terrain), progress = structuredClone(state.placeProgress);
    state = command(state, { type: 'terrain-undo', expectedTerrainRevision: terrainEditingRevision(state) });
    assert.equal(state.terrain!.heights['5,2'], -2);
    assert.deepEqual(state.landmarks, b.state.landmarks, 'Terrain undo does not undo owner moves');
    signature(state);
    state = command(state, { type: 'terrain-redo', expectedTerrainRevision: terrainEditingRevision(state) });
    assert.deepEqual(state.terrain, terrain); assert.deepEqual(signature(state), beforeUndo);
    assert.deepEqual(state.placeProgress, progress, 'Terrain history does not fabricate or erase uses');
    const restored: GrowingState = JSON.parse(JSON.stringify(state)); validateTerrain(restored);
    assert.deepEqual(restored, state); assert.deepEqual(signature(restored), beforeUndo);
    const resumed = exerciseGarden(restored, 'serialize restoration: same B destination');
    assert.deepEqual(resumed.proof.actualRoute, b.proof.actualRoute, 'Reconstructed life follows the same actual route');
    return { status: 'PASS', fixture: 'newIsland plus normal domain intents; no DB injection or purchase/growth shortcut',
        outsideScope: ['UI input', 'WebGL visibility and native actor rig', 'browser repository transaction/reload',
            'resident pose persistence (life restarts normally)', 'terrain safety with live occupants', 'art quality', 'bench sitting'],
        initialOwners: original.landmarks, proofs: [a.proof, b.proof, resumed.proof], continuousMove,
        undoRedo: { heightsRestored: true, exactHistoryRestored: true, ownerPlacementRetained: true },
        serialization: { completeStateEqual: true, targetAndRouteEqual: true, genuineReceiptsRetained: true },
        commandCount: intent };
}

console.log(JSON.stringify(runLifeCheck(), null, 2));
