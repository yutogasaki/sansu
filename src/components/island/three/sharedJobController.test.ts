import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandSharedMemories, reduceIslandSharedMemories, resolveSharedTarget, sharedDisplayKey, sharedOperationIdentity, sharedRequestIdentity, sharedWorkCaptureKey,
    type IslandSharedMemoriesAction, type SharedDisplayId, type SharedTargetRef } from '../../../domain/island/sharedMemories';
import { getIslandWorkshop, reduceIslandWorkshop, WORKSHOP_SPECIMEN_IDS, WORKSHOP_SPECIMENS } from '../../../domain/island/workshop';
import type { IslandRecord } from '../../../domain/island/types';
import { IslandSharedDisplayScene } from './sharedDisplayScene';
import { IslandSharedJobController } from './sharedJobController';
import { IslandMaterials, disposeGeometry } from './primitives';
import { IslandResident } from './animals';
import type { IslandSharedSceneRequest, IslandSharedStageState } from './types';
import { fitSharedJobCamera, sharedJobCameraDiagnostic } from './sharedDisplayFraming';

const dispose: (() => void)[] = [];
afterEach(() => dispose.splice(0).forEach(fn => fn()));
// Explicit geometry/progression fixture. Browser QA must separately earn and
// place these objects; this is not evidence of actual learning or child use.
function fixture(): IslandRecord {
    const island = { ...createIsland('shared-job-fixture', 0), completedSets: 6, growth: undefined };
    return { ...island, items: island.items.map(item => ({ ...item, position: undefined })) };
}
const ref = (specimenId: 'driftwood' | 'seaglass' | 'striped-shell' = 'driftwood'): SharedTargetRef => ({ kind: 'specimen', specimenId });
function change(island: IslandRecord, action: IslandSharedMemoriesAction) {
    return { ...reduceIslandSharedMemories(island, action, island.updatedAt + 1,
        { receiptId: sharedOperationIdentity(island.profileId, island.revision) }).island, revision: island.revision + 1, updatedAt: island.updatedAt + 1 };
}
function placed(island = fixture(), target = ref(), displayId: SharedDisplayId = 'display-1', position = { x: .2, z: .4 }) {
    return change(island, { type: 'place-display', displayId, target, position, rotation: 0, expectedDisplayKey: sharedDisplayKey(island.sharedMemories?.displays[displayId]) });
}
function prepared(island: IslandRecord, residentId: 'otter' | 'rabbit' | 'fox', target = ref(), displayId: SharedDisplayId = 'display-1', position = { x: .2, z: .4 }) {
    return change(island, { type: 'prepare-request', requestId: sharedRequestIdentity(island.profileId, `job-${island.revision}`), residentId,
        jobId: residentId === 'otter' ? 'carry' : residentId === 'rabbit' ? 'gather' : 'illuminate', target,
        destination: { displayId, position, rotation: 0, expectedDisplayKey: sharedDisplayKey(island.sharedMemories?.displays[displayId]) },
        expectedRequestId: island.sharedMemories?.activeRequest?.requestId ?? null });
}
function workFixture() {
    let island = fixture();
    for (const specimenId of WORKSHOP_SPECIMEN_IDS) {
        for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId, section }, 1);
        for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const)
            island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result, cleanedMask: 63 }, 2);
    }
    for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId } }, 3);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId, position: { col, row: 1 } } }, 3);
    }
    island = reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: '実物の案A' }, 4);
    const target: SharedTargetRef = { kind: 'work', workId: 'work-1', targetKey: sharedWorkCaptureKey(island.profileId, 'work-1', getIslandWorkshop(island).works['work-1']!) };
    return { island, target };
}
function harness(island = fixture(), reduced = false) {
    const world = new THREE.Scene(), displays = new IslandSharedDisplayScene(), preview = new IslandSharedDisplayScene(), materials = new IslandMaterials();
    const residents = (['otter', 'rabbit', 'fox'] as const).map((id, i) => new IslandResident(id, materials,
        [[-1.8, 0, 2], [2.7, 0, 1.8], [7.8, 0, 1.5]][i] as [number, number, number], () => {}));
    const actions: IslandSharedMemoriesAction[] = [], feedback: string[] = [];
    const controller = new IslandSharedJobController(displays, preview, residents, { action: action => actions.push(action), feedback: text => feedback.push(text) });
    world.add(displays.group, preview.group, controller.group, ...residents.map(resident => resident.group));
    let state: IslandSharedStageState = { island, active: true }, now = 0, serial = 0;
    const sync = (changes: Partial<IslandSharedStageState> = {}) => {
        state = { ...state, ...changes }; controller.beforeUpdate(state); displays.update(state.island);
        if (state.preview && !controller.active) preview.update({ ...state.island, sharedMemories: { ...getIslandSharedMemories(state.island), displays: {
            [state.preview.displayId]: { target: state.preview.target, position: state.preview.position, rotation: state.preview.rotation, arrangement: 'plain', placedAt: 0 } } } });
        controller.afterUpdate(); world.updateMatrixWorld(true);
    };
    sync();
    dispose.push(() => { controller.dispose(); displays.dispose(); preview.dispose(); residents.forEach(resident => { resident.disposeAppearance(); disposeGeometry(resident.group); }); materials.dispose(); });
    const tick = (visible = true, ms = 200) => { now += ms; controller.update(now, reduced); world.updateMatrixWorld(true); controller.afterRender(() => visible); };
    return { world, controller, residents, displays, preview, actions, feedback, tick, state: () => state, sync,
        command: (command: IslandSharedSceneRequest['command'], id = `command-${++serial}`) => controller.command({ id, command }, now, reduced),
        until: (condition: () => boolean, visible = true) => { for (let i = 0; i < 250 && !condition(); i++) tick(visible); expect(condition(), JSON.stringify({ feedback, failure: controller.lastFailure, actual: controller.diagnostic() })).toBe(true); } };
}

describe('shared work after-render and actual object continuity', () => {
    it('borrows the actual hand, lamp and receiver for framing without turning strict camera diagnostics into a save gate', () => {
        let island = fixture();
        for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId: 'driftwood', section }, 1);
        island = prepared(placed(island), 'fox');
        const h = harness(island, true), saved = JSON.stringify(island);
        h.command({ type: 'run', requestId: island.sharedMemories!.activeRequest!.requestId });
        h.until(() => h.controller.phase === 'surface-illuminated');
        const frame = h.controller.framing!, resident = h.residents[2];
        expect(frame.channels.find(c => c.name === 'paw-left')).toMatchObject({
            objects: [resident.group.getObjectByName('hand-contact-left')!.parent],
            handContact: resident.group.getObjectByName('hand-contact-left'),
        });
        expect(frame.channels.find(c => c.name === 'lamp')!.objects[0]).toBe(h.controller.props.lamp);
        expect(frame.light!.receiverSamples).toHaveLength(5);
        const table = h.displays.group.getObjectByName('shared-display-table')!;
        frame.light!.receiverSamples.forEach(point => {
            const surface = new THREE.Raycaster(new THREE.Vector3(point.x, 2, point.z), new THREE.Vector3(0, -1, 0)).intersectObject(table, true)[0];
            expect(surface.point.distanceTo(point)).toBeLessThan(1e-6);
        });
        const identity = h.controller.diagnostic()!, camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 100);
        const enclosure = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
        enclosure.position.copy(frame.bounds.getCenter(new THREE.Vector3())); h.world.add(enclosure);
        try {
            fitSharedJobCamera(camera, frame, 1, [h.world], 0);
            expect(sharedJobCameraDiagnostic(camera)?.readable).toBe(false);
            expect(h.controller.diagnostic()).toEqual(identity); expect(JSON.stringify(island)).toBe(saved);
            // The existing rendered-step callback remains the gameplay contract.
            // A strict diagnostic of mutually touching surfaces adds no gate.
            h.until(() => h.actions.length === 1);
            expect(h.actions[0].type).toBe('complete-request');
            h.command({ type: 'stop' }); expect(h.controller.framing).toBeUndefined();
            expect(h.controller.props.group.visible).toBe(false);
        } finally { enclosure.removeFromParent(); enclosure.geometry.dispose(); enclosure.material.dispose(); }
    });

    it('places the actual preview only after a visible frame, and transfers the same object into the saved scene', () => {
        const h = harness(), target = resolveSharedTarget(h.state().island, ref());
        h.sync({ preview: { displayId: 'display-1', target, position: { x: .2, z: .4 }, rotation: 0, valid: true } });
        const object = h.preview.targetObject('display-1')!;
        h.command({ type: 'place-preview', action: { type: 'place-display', displayId: 'display-1', target: ref(), position: { x: .2, z: .4 }, rotation: 0, expectedDisplayKey: null } });
        for (let i = 0; i < 10; i++) h.tick(false);
        expect(h.actions).toEqual([]); expect(h.controller.diagnostic()?.targetUuid).toBe(object.uuid);
        h.until(() => h.actions.length === 1);
        h.sync({ island: change(h.state().island, h.actions[0]), preview: undefined });
        expect(h.displays.targetObject('display-1')).toBe(object); expect(h.controller.diagnostic()?.committed).toBe(true);
        h.command({ type: 'stop' }); expect(h.displays.targetObject('display-1')).toBe(object);
    });
    it('moves an existing display using the original actual object and restores it on cancellation', () => {
        const island = placed(fixture(), ref(), 'display-1', { x: -1.5, z: .5 }), h = harness(island);
        const target = resolveSharedTarget(island, ref()), object = h.displays.targetObject('display-1')!, origin = object.getWorldPosition(new THREE.Vector3());
        const preview = { displayId: 'display-2' as const, target, position: { x: 1, z: 1.4 }, rotation: Math.PI / 2, valid: true };
        h.sync({ preview }); const copy = h.preview.targetObject('display-2')!;
        const command = { type: 'place-preview' as const, action: { type: 'place-display' as const, displayId: 'display-2' as const, target: ref(), position: preview.position, rotation: preview.rotation, expectedDisplayKey: null } };
        h.command(command); h.tick(); expect(h.controller.diagnostic()?.targetUuid).toBe(object.uuid); expect(copy.visible).toBe(false);
        h.command({ type: 'stop' }); expect(object.getWorldPosition(new THREE.Vector3()).distanceTo(origin)).toBeLessThan(.001); expect(h.actions).toEqual([]);
        h.command(command); h.until(() => h.actions.length === 1); h.sync({ island: change(island, h.actions[0]), preview: undefined });
        expect(h.displays.targetObject('display-2')).toBe(object); expect(h.displays.targetObject('display-1')).toBeUndefined();
    });
    it('rejects a command whose requested target differs from the actual preview', () => {
        const h = harness(), target = resolveSharedTarget(h.state().island, ref());
        h.sync({ preview: { displayId: 'display-1', target, position: { x: .2, z: .4 }, rotation: 0, valid: true } });
        h.command({ type: 'place-preview', action: { type: 'place-display', displayId: 'display-1', target: ref('seaglass'), position: { x: .2, z: .4 }, rotation: 0, expectedDisplayKey: null } });
        expect(h.controller.active).toBe(false); expect(h.actions).toEqual([]);
    });
    it('returns a cancelled preview to the same legal table without a callback', () => {
        const h = harness(), target = resolveSharedTarget(h.state().island, ref());
        h.sync({ preview: { displayId: 'display-1', target, position: { x: .2, z: .4 }, rotation: 0, valid: true } });
        const object = h.preview.targetObject('display-1')!;
        h.command({ type: 'place-preview', action: { type: 'place-display', displayId: 'display-1', target: ref(), position: { x: .2, z: .4 }, rotation: 0, expectedDisplayKey: null } });
        h.tick(); h.command({ type: 'stop' }); expect(h.actions).toEqual([]); expect(h.preview.targetObject('display-1')).toBe(object);
        expect(object.parent).not.toBeNull();
    });
    it.each([false, true])('moves three finite actual petals from preparation to display before arranging (reduced=%s)', reduced => {
        const h = harness(placed(), reduced), initial = h.displays.anchors('display-1')!, key = sharedDisplayKey(h.state().island.sharedMemories!.displays['display-1'])!;
        h.command({ type: 'arrange', displayId: 'display-1', expectedDisplayKey: key });
        const petals = h.controller.props.petals.map(petal => petal.uuid);
        for (let i = 0; i < 12; i++) h.tick(false);
        expect(h.actions).toEqual([]); h.until(() => h.actions.length === 1);
        h.controller.props.petals.forEach((petal, index) => { expect(petal.uuid).toBe(petals[index]); expect(petal.getWorldPosition(new THREE.Vector3()).distanceTo(initial.petals[index])).toBeLessThan(.01); });
        expect(h.actions[0].type).toBe('arrange-display');
    });
    it.each([false, true])('carries the same displayed object with real hand contact then releases it (reduced=%s)', reduced => {
        const sourcePosition = { x: -1.5, z: .5 }, destination = { x: 1, z: 1.4 };
        const island = prepared(placed(fixture(), ref(), 'display-1', sourcePosition), 'otter', ref(), 'display-2', destination);
        const h = harness(island, reduced), object = h.displays.targetObject('display-1')!, uuid = object.uuid, origin = h.residents[0].group.position.clone();
        h.command({ type: 'run', requestId: island.sharedMemories!.activeRequest!.requestId });
        h.until(() => h.controller.phase === 'lifting');
        const pickupHeight = object.getWorldPosition(new THREE.Vector3()).y;
        h.until(() => h.controller.phase === 'carrying');
        expect(object.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(pickupHeight + .08);
        expect(object.parent).toBe(h.residents[0].group); expect(h.controller.diagnostic()?.targetUuid).toBe(uuid); expect(h.actions).toEqual([]);
        h.until(() => h.actions.length === 1);
        expect(object.parent).not.toBe(h.residents[0].group);
        h.sync({ island: change(island, h.actions[0]) }); expect(h.displays.targetObject('display-2')).toBe(object);
        h.command({ type: 'stop' }); expect(h.residents[0].group.position.toArray()).toEqual(origin.toArray());
        expect(h.displays.targetObject('display-2')).toBe(object);
    });
    it.each(['rabbit', 'fox'] as const)('performs the actual %s job before recording one visible result', species => {
        const island = prepared(placed(), species), h = harness(island, true);
        h.command({ type: 'run', requestId: island.sharedMemories!.activeRequest!.requestId });
        h.until(() => h.actions.length === 1);
        expect(h.actions[0]).toMatchObject({ type: 'complete-request', result: { kind: species === 'rabbit' ? 'petals-arranged' : 'illuminated' } });
        expect(h.controller.diagnostic()?.actorUuid).toBe(h.residents[species === 'rabbit' ? 1 : 2].group.uuid);
    });
    it.each(['otter', 'rabbit', 'fox'] as const)('uses the saved actual work layout for the %s job without changing its parts', species => {
        const fixture = workFixture();
        const island = species === 'otter' ? prepared(placed(fixture.island, fixture.target, 'display-1', { x: -1.5, z: .5 }), species, fixture.target, 'display-2', { x: 1, z: 1.4 })
            : prepared(placed(fixture.island, fixture.target, 'display-1', { x: -.1, z: 1 }), species, fixture.target, 'display-1', { x: -.1, z: 1 });
        const h = harness(island, true), object = h.displays.targetVisual('display-1')!;
        const before = Object.entries(object.parts).map(([id, part]) => ({ id, uuid: part.group.uuid, position: part.group.position.toArray(), rotation: part.group.rotation.toArray() }));
        h.command({ type: 'run', requestId: island.sharedMemories!.activeRequest!.requestId }); h.until(() => h.actions.length === 1);
        expect(Object.entries(object.parts).map(([id, part]) => ({ id, uuid: part.group.uuid, position: part.group.position.toArray(), rotation: part.group.rotation.toArray() }))).toEqual(before);
        if (species === 'fox') expect(h.controller.diagnostic()?.light?.effect).toBe('transmit');
    });
    it('illuminates the actual glass window off the axle and does not transmit through intervening wood', () => {
        const fixture = workFixture(), island = placed(fixture.island, fixture.target), h = harness(island, true);
        h.command({ type: 'illuminate', displayId: 'display-1' }); h.until(() => h.controller.phase === 'settled');
        expect(h.controller.props.lightContact?.effect).toBe('transmit'); expect(h.controller.props.lastProbe?.transmitting).toBe(true);
        const visual = h.displays.targetVisual('display-1')!, part = visual.parts.wheel!, surface = part.group.localToWorld(new THREE.Vector3(.24, .3, 0));
        const lamp = surface.clone().add(new THREE.Vector3(.55, .18, -.065)); h.controller.props.lamp.position.copy(lamp);
        expect(h.controller.props.illuminate(visual, surface, .525, new THREE.Vector3(.2, 0, .4), 1, 'transmit')).toBe(false);
        expect(h.controller.props.lightContact).toBeUndefined(); expect(h.actions).toEqual([]);
    });
    it.each(['inactive', 'profile', 'changed-target', 'stop'] as const)('cancels an in-hand object without saving when %s changes', reason => {
        const island = prepared(placed(fixture(), ref(), 'display-1', { x: -1.5, z: .5 }), 'otter', ref(), 'display-2', { x: 1, z: 1.4 });
        const h = harness(island), object = h.displays.targetObject('display-1')!, original = object.getWorldPosition(new THREE.Vector3());
        const actor = h.residents[0], origin = actor.group.position.clone();
        const requestId = island.sharedMemories!.activeRequest!.requestId;
        h.command({ type: 'run', requestId }, 'run-once'); h.until(() => h.controller.phase === 'carrying');
        if (reason === 'inactive') h.controller.beforeUpdate({ island, active: false });
        if (reason === 'profile') h.controller.beforeUpdate({ island: { ...island, profileId: 'another' }, active: true });
        if (reason === 'changed-target') h.controller.beforeUpdate({ island: { ...island, items: [...island.items, { id: 'new', kind: 'flower', position: { x: 2.5, z: 1 } }] }, active: true });
        if (reason === 'stop') h.command({ type: 'stop' });
        expect(h.controller.active).toBe(false); expect(h.actions).toEqual([]);
        expect(object.getWorldPosition(new THREE.Vector3()).distanceTo(original)).toBeLessThan(.001);
        expect(actor.group.position.distanceTo(origin)).toBeLessThan(.001);
        h.controller.beforeUpdate({ island, active: true }); h.command({ type: 'run', requestId }, 'run-once');
        expect(h.controller.active).toBe(false);
    });
    it.each(['otter', 'rabbit', 'fox'] as const)('revisits the remembered actual target with %s after its display is stored', species => {
        let island = prepared(placed(), species);
        if (species === 'otter') island = prepared(placed(fixture(), ref(), 'display-1', { x: -1.5, z: .5 }), species, ref(), 'display-2', { x: 1, z: 1.4 });
        const earnedGeometry = harness(island, true);
        earnedGeometry.command({ type: 'run', requestId: island.sharedMemories!.activeRequest!.requestId }); earnedGeometry.until(() => earnedGeometry.actions.length === 1);
        island = change(island, earnedGeometry.actions[0]);
        const memory = island.sharedMemories!.memories[0], slot = Object.entries(island.sharedMemories!.displays)[0];
        island = change(island, { type: 'remove-display', displayId: slot[0] as SharedDisplayId, expectedDisplayKey: sharedDisplayKey(slot[1])! });
        const snapshot = JSON.stringify(island), h = harness(island, true);
        h.command({ type: 'memory', memoryKey: memory.memoryKey });
        h.until(() => h.controller.phase === 'settled');
        expect(h.controller.diagnostic()).toMatchObject({ targetKey: memory.target.targetKey, actorId: species });
        expect(h.actions).toEqual([]); expect(JSON.stringify(h.state().island)).toBe(snapshot);
        h.command({ type: 'stop' }); expect(h.controller.active).toBe(false); expect(h.controller.preparation.describe()).toEqual([]);
    });
    it('illuminates a real cleaned glass surface and receiver without saving an observation', () => {
        let island = fixture(); for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId: 'seaglass', section }, 1);
        const h = harness(placed(island, ref('seaglass')));
        h.command({ type: 'illuminate', displayId: 'display-1' }); h.until(() => Boolean(h.controller.props.lightContact));
        expect(h.controller.props.lightContact?.effect).toBe('transmit'); expect(h.actions).toEqual([]);
        expect(h.controller.props.lightContact?.source.distanceTo(h.controller.props.lightContact.surface!)).toBeGreaterThan(.1);
    });
});
