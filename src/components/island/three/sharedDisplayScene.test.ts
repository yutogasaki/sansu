import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandSharedMemories, resolveSharedTarget, sharedWorkCaptureKey, type SharedDisplayId, type SharedTarget } from '../../../domain/island/sharedMemories';
import { getIslandWorkshop, reduceIslandWorkshop, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, type WorkshopSpecimenId } from '../../../domain/island/workshop';
import { getWorkshopPartPorts, WORKSHOP_PART_IDS } from '../../../domain/island/workshopLayout';
import type { IslandRecord } from '../../../domain/island/types';
import { IslandSharedDisplayScene, makeSharedDisplayTarget, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z,
    SHARED_DISPLAY_WORK_SCALE } from './sharedDisplayScene';
import { workshopAnchorToWorld } from './workshopGeometry';

const disposables: { dispose(): void }[] = [];
afterEach(() => { disposables.splice(0).forEach(item => item.dispose()); });
const initial = (profileId = 'display-child'): IslandRecord => ({ ...createIsland(profileId, 0), completedSets: 1 });
function scene(island = initial()) {
    const result = new IslandSharedDisplayScene(); disposables.push(result); result.update(island); return result;
}
function put(island: IslandRecord, target: SharedTarget, id: SharedDisplayId = 'display-1', x = 0, rotation = 0): IslandRecord {
    const sharedMemories = getIslandSharedMemories(island);
    sharedMemories.displays[id] = { target, position: { x, z: 0 }, rotation, arrangement: 'plain', placedAt: 5 };
    return { ...island, sharedMemories };
}
function specimenTarget(island: IslandRecord, specimenId: WorkshopSpecimenId = 'driftwood') {
    return resolveSharedTarget(island, { kind: 'specimen', specimenId });
}
function clean(island: IslandRecord, specimenId: WorkshopSpecimenId) {
    for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId, section }, 1);
    for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) {
        island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result, cleanedMask: 63 }, 2);
    }
    return island;
}
function savedWork() {
    let island = WORKSHOP_SPECIMEN_IDS.reduce(clean, initial());
    WORKSHOP_PART_IDS.forEach((partId, i) => {
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId } }, 3);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId, position: { col: i % 2 * 3, row: i < 2 ? 0 : 3 } } }, 3);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'rotate', partId, rotation: i as 0 | 1 | 2 | 3 } }, 3);
    });
    island = reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: 'さいしょの さくひん' }, 4);
    const target = resolveSharedTarget(island, { kind: 'work', workId: 'work-1',
        targetKey: sharedWorkCaptureKey(island.profileId, 'work-1', getIslandWorkshop(island).works['work-1']!) });
    return { island, target: target as Extract<SharedTarget, { kind: 'work' }> };
}
function allMeshes(group: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); }); return result;
}
function visible(object: THREE.Object3D) {
    for (let part: THREE.Object3D | null = object; part; part = part.parent) if (!part.visible) return false;
    return true;
}
const close = (a: THREE.Vector3, b: THREE.Vector3, precision = 6) => expect(a.distanceTo(b)).toBeCloseTo(0, precision);
const down = (point: THREE.Vector3) => new THREE.Ray(point.clone().add(new THREE.Vector3(0, 5, 0)), new THREE.Vector3(0, -1, 0));

describe('shared display physical identity and immutable captures', () => {
    it('allocates no display for old islands, then follows the same three specimens without revealing unknown names', () => {
        let island = initial(); const view = scene(island);
        expect(view.group.children).toHaveLength(0); expect(view.describe()).toEqual([]); expect(view.group.visible).toBe(false);
        WORKSHOP_SPECIMEN_IDS.forEach((id, i) => { island = put(island, specimenTarget(island, id), `display-${i + 1}` as SharedDisplayId, i * 3); });
        view.update(island);
        const identities = view.describe().map(item => item.targetUuid), geometry = allMeshes(view.group).map(item => item.geometry.uuid);
        expect(new Set(identities).size).toBe(3);
        expect(view.describe().map(item => item.name)).toEqual(['すなの かたまり 1', 'すなの かたまり 2', 'すなの かたまり 3']);
        expect(view.describe().map(item => item.visibleSand)).toEqual(Array.from({ length: 3 }, () => [0, 1, 2, 3, 4, 5]));
        expect(view.update(island)).toBe(false); expect(allMeshes(view.group).map(item => item.geometry.uuid)).toEqual(geometry);
        island = reduceIslandWorkshop(island, { type: 'brush', specimenId: 'seaglass', section: 3 }, 5);
        island = reduceIslandWorkshop(island, { type: 'name-specimen', specimenId: 'seaglass', name: 'みどりの たから' }, 6);
        view.update(island);
        expect(view.describe()[1]).toMatchObject({ name: 'みどりの たから', identified: false, cleanedMask: 8, visibleSand: [0, 1, 2, 4, 5] });
        island = clean(island, 'driftwood'); view.update(island);
        expect(view.describe()[0]).toMatchObject({ name: 'ながれぎ', identified: true, cleanedMask: 63, visibleSand: [] });
        expect(view.describe().map(item => item.targetUuid)).toEqual(identities);
        expect(allMeshes(view.group).map(item => item.geometry.uuid)).toEqual(geometry);
    });

    it('keeps displayed A after its saved slot and draft become B or are deleted, including every cell and rotation', () => {
        const work = savedWork(); let island = put(work.island, work.target, 'display-1', 2, .73);
        const view = scene(island), visual = view.targetVisual('display-1')!, uuid = visual.group.uuid;
        const before = structuredClone(island);
        view.describe(); expect(island).toEqual(before);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'clear' } }, 7);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 1, row: 2 } } }, 8);
        island = reduceIslandWorkshop(island, { type: 'save-work', workId: 'work-1', name: 'あたらしい さくひん' }, 9);
        expect(view.update(island)).toBe(false);
        island = reduceIslandWorkshop(island, { type: 'delete-work', workId: 'work-1' }, 10); view.update(island);
        expect(view.describe()[0].name).toBe('さいしょの さくひん'); expect(view.targetObject('display-1')!.uuid).toBe(uuid);
        for (const id of WORKSHOP_PART_IDS) {
            const part = visual.parts[id]!, saved = work.target.layout.parts[id];
            close(part.group.position, workshopAnchorToWorld(saved.position!, 0));
            expect(part.group.rotation.y).toBe(-saved.rotation * Math.PI / 2);
            expect(part.finished.visible).toBe(true); expect(part.frame.visible).toBe(false);
            // The physical inlet endpoints continue to meet the pure simulator's
            // rotated water/shaft ports after both display and board transforms.
            for (const port of getWorkshopPartPorts(id, saved)) {
                const input = port.role === 'input';
                const y = id === 'wheel' && input ? .12 : id === 'bell' || id === 'wheel' ? .3 : .13;
                const physical = id === 'elbow' && !input ? new THREE.Vector3(0, y, .54) : new THREE.Vector3(input ? -.54 : .54, y, 0);
                const actual = part.group.localToWorld(physical);
                const expected = part.group.parent!.localToWorld(workshopAnchorToWorld(port.anchor, y));
                close(actual, expected);
            }
        }
        const straight = visual.parts.straight!, bell = visual.parts.bell!;
        expect(straight.group.getWorldScale(new THREE.Vector3()).x).toBeCloseTo(SHARED_DISPLAY_WORK_SCALE);
        expect(bell.bell).toBeDefined(); expect(visual.parts.wheel!.rotor).toBeDefined();
    });

    it('displays unfinished placed frames and omits absent parts, without inventing assembled materials or changing the snapshot', () => {
        const { target } = savedWork();
        const draft = structuredClone(target); draft.layout.parts.wheel.assembled = false; delete draft.layout.parts.bell.position;
        const before = structuredClone(draft), visual = makeSharedDisplayTarget(draft); disposables.push(visual);
        expect(visual.parts.wheel!.finished.visible).toBe(false); expect(visual.parts.wheel!.frame.visible).toBe(true);
        expect(visual.parts.bell).toBeUndefined(); expect(visual.anchors().partSurfaces.wheel).toBeUndefined();
        expect(draft).toEqual(before);
        visual.group.traverse(object => { expect(object.userData.workshopHit).toBeUndefined(); });
    });

    it('requires explicit historical specimen appearance rather than silently taking the current cleaned state', () => {
        const island = clean(initial(), 'seaglass'), target = specimenTarget(island, 'seaglass');
        expect(() => makeSharedDisplayTarget(target)).toThrow('recorded appearance');
        const old = makeSharedDisplayTarget(target, { cleanedMask: 1, name: 'すなの かたまり 2', identified: false }); disposables.push(old);
        expect(old.specimen!.patches.map(patch => patch.visible)).toEqual([false, true, true, true, true, true]);
        expect(old.name).toBe('すなの かたまり 2'); expect(old.appearance!.identified).toBe(false);
    });
});

describe('shared display geometry, anchors and lifecycle', () => {
    it('exposes one opaque tabletop surface after batching while retaining the actual support and contact heights', () => {
        const work = savedWork();
        for (const target of [specimenTarget(work.island), work.target]) for (const rotation of [0, .61, Math.PI / 2]) {
            const island = put(work.island, target, 'display-1', 3, rotation), saved = structuredClone(island);
            const view = scene(island), table = view.group.getObjectByName('shared-display-table')!;
            const actual = view.targetObject('display-1')!, targetMatrix = actual.matrixWorld.toArray();
            const tabletopY = .52, topRadius = view.describe()[0].radius - .073;
            for (const [x, z] of [[.13, .07], [-.23, .11], [.05, .31], [-.3, -.13]]) {
                const origin = table.localToWorld(new THREE.Vector3(x * topRadius, 2, z * topRadius));
                const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObjects(allMeshes(table), false);
                const top = hits.filter(hit => hit.face!.normal.y > .999 && Math.abs(hit.point.y - tabletopY) < 1e-6);
                expect(top.length).toBeGreaterThan(0);
                const colors = new Set(top.map(hit => {
                    const object = hit.object as THREE.Mesh, color = object.geometry.getAttribute('color');
                    expect(object.receiveShadow).toBe(true);
                    return new THREE.Color().fromBufferAttribute(color, hit.face!.a).getHexString();
                }));
                // Former .47 + .1 / 2 dark cap occupied this same plane. Both
                // real triangle colors survived batching and fought for depth.
                expect([...colors]).toEqual(['f3e0b6']);
                expect(hits[0].point.y).toBeCloseTo(tabletopY, 6);
            }
            const anchors = view.anchors('display-1')!;
            expect(anchors.destination.y).toBe(SHARED_DISPLAY_TARGET_Y);
            expect(anchors.gripLeft.y).toBeCloseTo(.57, 6);
            expect(anchors.gripRight.y).toBeCloseTo(.57, 6);
            expect(anchors.lightReceiver.y).toBe(.525);
            expect(view.update(island)).toBe(false);
            expect(view.targetObject('display-1')).toBe(actual);
            expect(actual.matrixWorld.toArray()).toEqual(targetMatrix);
            expect(island).toEqual(saved);
        }
    });

    it('keeps every real table, tray, object, petal and selection vertex inside the shared placement footprint', () => {
        const { island: workIsland, target: work } = savedWork();
        for (const target of [...WORKSHOP_SPECIMEN_IDS.map(id => specimenTarget(workIsland, id)), work]) {
            for (const rotation of [0, .61, Math.PI / 2]) {
                const island = put(workIsland, target, 'display-1', 3, rotation);
                island.sharedMemories!.displays['display-1']!.arrangement = 'petal-ring';
                const view = scene(island); view.update(island, { selectedDisplayId: 'display-1' });
                const radius = view.describe()[0].radius; let furthest = 0, lowest = Infinity;
                for (const object of allMeshes(view.group).filter(visible)) {
                    const positions = object.geometry.getAttribute('position');
                    for (let i = 0; i < positions.count; i++) {
                        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                        furthest = Math.max(furthest, Math.hypot(point.x - 3, point.z)); lowest = Math.min(lowest, point.y);
                    }
                }
                expect(furthest).toBeLessThanOrEqual(radius + .000001); expect(lowest).toBeGreaterThanOrEqual(0);
                const { targetBounds, tableBounds, displayBounds } = view.describe()[0];
                expect(targetBounds.min.y).toBeGreaterThan(tableBounds.max.y - .03);
                expect(displayBounds.containsBox(targetBounds)).toBe(true); expect(displayBounds.containsBox(tableBounds)).toBe(true);
            }
        }
    });

    it('anchors three real petals, wells and material surfaces in world space and selects only visible actual geometry', () => {
        let island = put(initial(), specimenTarget(initial(), 'seaglass'), 'display-1', 2, .4);
        const view = scene(island), universe = new THREE.Group(); universe.position.set(10, 2, -4); universe.rotation.y = .6; universe.add(view.group);
        const anchors = view.anchors('display-1')!, table = view.group.getObjectByName('shared-display-1')!;
        anchors.petals.forEach((point, i) => close(point, table.getObjectByName(`shared-display-petal-${i + 1}`)!.getWorldPosition(new THREE.Vector3())));
        expect(anchors.preparation).toHaveLength(3); expect(new Set(anchors.preparation.map(p => p.toArray().join(','))).size).toBe(3);
        for (const point of [...anchors.preparation, anchors.returnPlate, anchors.lightReceiver, anchors.surface]) {
            expect(view.selectHit(down(point))?.displayId).toBe('display-1');
        }
        const patchPosition = view.targetVisual('display-1')!.specimen!.patches[0].getWorldPosition(new THREE.Vector3());
        const dirtySurface = view.selectHit(down(patchPosition))!.point, object = view.targetObject('display-1');
        island = clean(island, 'seaglass'); view.update(island);
        const cleanSurface = view.anchors('display-1')!.surface;
        expect(view.selectHit(down(patchPosition))!.point.y).toBeLessThan(dirtySurface.y); expect(view.targetObject('display-1')).toBe(object);
        const actual = view.selectHit(down(cleanSurface))!; close(actual.point, cleanSurface, 5);
        island.sharedMemories!.displays['display-1']!.arrangement = 'petal-ring'; view.update(island);
        const petals = allMeshes(view.group).filter(mesh => mesh.name.startsWith('shared-display-petal-'));
        expect(petals.filter(p => p.visible)).toHaveLength(3);
        view.update(island, { active: false }); expect(view.selectHit(down(cleanSurface))).toBeUndefined();
        view.update(island); universe.visible = false; expect(view.selectHit(down(cleanSurface))).toBeUndefined();
    });

    it('moves the same instance through hands and cancel restoration, preserving world-pose continuity across attach', () => {
        const island = put(initial(), specimenTarget(initial()), 'display-1', 2, .8), view = scene(island);
        const universe = new THREE.Group(), hand = new THREE.Group(); universe.add(view.group, hand); hand.position.set(-2, 1, 3); hand.rotation.y = -.5;
        universe.updateMatrixWorld(true);
        const actual = view.targetObject('display-1')!, uuid = actual.uuid, home = actual.parent!, matrix = actual.matrixWorld.clone();
        const start = view.anchors('display-1')!, pose = { position: actual.position.clone(), quaternion: actual.quaternion.clone() };
        hand.attach(actual); actual.updateWorldMatrix(true, true);
        actual.matrixWorld.elements.forEach((n, i) => expect(n).toBeCloseTo(matrix.elements[i], 6));
        close(view.anchors('display-1')!.gripLeft, start.gripLeft);
        hand.position.x += 1.25; view.update(island);
        expect(actual.parent).toBe(hand); expect(view.describe()[0].carried).toBe(true);
        close(view.anchors('display-1')!.gripLeft, start.gripLeft.clone().add(new THREE.Vector3(1.25, 0, 0)));
        close(view.anchors('display-1')!.destination, start.destination);
        expect(view.restoreTarget('display-1')).toBe(true);
        expect(actual.parent).toBe(home); expect(actual.uuid).toBe(uuid); close(actual.position, pose.position);
        expect(actual.quaternion.angleTo(pose.quaternion)).toBeCloseTo(0);
        close(view.anchors('display-1')!.gripLeft, start.gripLeft); expect(view.describe()[0].carried).toBe(false);
    });

    it('places both hand anchors on real front handles and leaves the preparation wells behind the owned tray', () => {
        const work = savedWork();
        for (const target of [specimenTarget(work.island), work.target]) {
            const view = scene(put(work.island, target)), anchors = view.anchors('display-1')!, visual = view.targetVisual('display-1')!;
            const tray = visual.group.getObjectByName('shared-carry-tray')!;
            for (const anchor of [anchors.gripLeft, anchors.gripRight]) {
                const raycaster = new THREE.Raycaster(); raycaster.ray.copy(down(anchor));
                const hit = raycaster.intersectObjects(allMeshes(tray), false)[0];
                expect(hit).toBeDefined();
                // The anchor is inside the small raised grip, with an actual
                // top surface within 3 cm; it is not a floating target marker.
                expect(hit.point.y - anchor.y).toBeGreaterThan(.02);
                expect(hit.point.y - anchor.y).toBeLessThan(.03);
                expect(anchor.z).toBeGreaterThan(target.kind === 'work' ? .58 : .39);
            }
            expect(anchors.gripLeft.distanceTo(anchors.gripRight)).toBeLessThanOrEqual(.61);
            expect(Math.max(...anchors.preparation.map(p => p.z))).toBeLessThan(visual.bounds().min.z - .1);
        }
    });

    it('retains the transported UUID when the atomic saved placement changes slots, then restores onto the new actual table', () => {
        let island = put(initial(), specimenTarget(initial())); const view = scene(island);
        const carrier = new THREE.Group(), universe = new THREE.Group(); universe.add(view.group, carrier);
        const visual = view.targetVisual('display-1')!, actual = visual.group, dispose = vi.spyOn(visual, 'dispose');
        carrier.attach(actual); carrier.position.set(4, 1, 0); actual.updateWorldMatrix(true, true);
        const before = actual.getWorldPosition(new THREE.Vector3());
        island = put(island, specimenTarget(island), 'display-2', 4, Math.PI / 2);
        delete island.sharedMemories!.displays['display-1']; view.update(island);
        expect(view.targetObject('display-1')).toBeUndefined(); expect(view.targetVisual('display-2')).toBe(visual);
        expect(actual.parent).toBe(carrier); close(actual.getWorldPosition(new THREE.Vector3()), before); expect(dispose).not.toHaveBeenCalled();
        view.restoreTarget('display-2'); close(actual.getWorldPosition(new THREE.Vector3()), view.anchors('display-2')!.destination);
        expect(actual.position.toArray()).toEqual([0, SHARED_DISPLAY_TARGET_Y, SHARED_DISPLAY_TARGET_Z]);
        expect(view.describe()[0].targetUuid).toBe(actual.uuid); expect(view.describe()[0].carried).toBe(false);
    });

    it('adopts a newly displayed owned object only after matching identity, with one disposal owner and no hidden duplicates', () => {
        const target = specimenTarget(initial()), owned = makeSharedDisplayTarget(target, { cleanedMask: 0, name: 'すなの かたまり 1', identified: false });
        const view = scene(), carrier = new THREE.Group(); carrier.add(owned.group);
        const ownedDispose = vi.spyOn(owned, 'dispose');
        expect(view.adoptTarget('display-1', owned)).toBe(false); expect(ownedDispose).not.toHaveBeenCalled();
        const island = put(initial(), target); view.update(island);
        const replaced = view.targetVisual('display-1')!, replacedDispose = vi.spyOn(replaced, 'dispose');
        const wrong = makeSharedDisplayTarget(specimenTarget(initial(), 'seaglass'), { cleanedMask: 0, name: 'すなの かたまり 2', identified: false }); disposables.push(wrong);
        expect(view.adoptTarget('display-1', wrong)).toBe(false); expect(replacedDispose).not.toHaveBeenCalled();
        expect(view.adoptTarget('display-1', owned)).toBe(true); expect(replacedDispose).toHaveBeenCalledTimes(1);
        expect(view.targetObject('display-1')).toBe(owned.group); expect(owned.group.parent).toBe(carrier);
        expect(view.adoptTarget('display-1', owned)).toBe(true); expect(ownedDispose).not.toHaveBeenCalled();
        view.restoreTarget('display-1'); expect(carrier.children).toHaveLength(0);
        expect(view.group.getObjectsByProperty('name', 'shared-display-target')).toEqual([owned.group]);
        view.dispose(); view.dispose(); expect(ownedDispose).toHaveBeenCalledTimes(1);
    });

    it('cleans removed slots, transferred objects and profile changes without reviving disposed geometry', () => {
        const island = put(initial(), specimenTarget(initial())), view = scene(island), actual = view.targetObject('display-1')!;
        const carrier = new THREE.Group(); carrier.attach(actual);
        const meshes = allMeshes(actual), geometry = meshes[0].geometry, disposed = vi.spyOn(geometry, 'dispose');
        view.update(initial('another-child'));
        expect(carrier.children).toHaveLength(0); expect(actual.children).toHaveLength(0); expect(disposed).toHaveBeenCalledTimes(1);
        expect(view.describe()).toEqual([]); expect(view.anchors('display-1')).toBeUndefined();
        expect(view.restoreTarget('display-1')).toBe(false); expect(view.group.visible).toBe(false);
        view.dispose(); expect(view.update(island)).toBe(false); expect(view.group.children).toHaveLength(0);
    });

    it('releases a preview object with its world pose intact and transfers disposal responsibility to the saved scene', () => {
        const island = put(initial(), specimenTarget(initial()), 'display-1', 2, .5);
        const preview = scene(island), saved = scene(island), universe = new THREE.Group();
        universe.position.set(7, 0, -3); universe.rotation.y = .3; universe.add(preview.group);
        const visual = preview.targetVisual('display-1')!, object = visual.group, disposed = vi.spyOn(visual, 'dispose');
        object.updateWorldMatrix(true, true); const before = object.matrixWorld.clone();
        expect(preview.releaseTarget('display-1')).toBe(visual);
        object.matrixWorld.elements.forEach((n, i) => expect(n).toBeCloseTo(before.elements[i], 6));
        expect(preview.releaseTarget('display-1')).toBeUndefined(); expect(preview.restoreTarget('display-1')).toBe(false);
        expect(preview.targetObject('display-1')).toBeUndefined(); expect(preview.describe()).toEqual([]);
        expect(preview.group.getObjectByName('shared-display-table')).toBeDefined();
        preview.update(island); expect(disposed).not.toHaveBeenCalled();
        expect(saved.adoptTarget('display-1', visual)).toBe(true); saved.restoreTarget('display-1');
        preview.dispose(); expect(disposed).not.toHaveBeenCalled();
        expect(saved.targetObject('display-1')).toBe(object); saved.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
    });
});
