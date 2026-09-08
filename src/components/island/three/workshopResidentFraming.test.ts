import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { IslandWorkshopScene } from './workshopScene';
import { IslandWorkshopPresentation } from './workshopPresentation';
import { fitIslandWorkshopResidentCamera } from './workshopResidentFraming';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandWorkshop, reduceIslandWorkshop, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS } from '../../../domain/island/workshop';

// Explicit geometry fixture, not earned learning evidence. The browser harness
// separately earns progress and assembles this layout through actual controls.
function assembledWorkshop(variant: 'A' | 'B' = 'A') {
    let island = { ...createIsland('camera-test', 0), completedSets: 1 };
    for (const specimenId of WORKSHOP_SPECIMEN_IDS) {
        for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId, section }, 1);
        island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result: 'clean', cleanedMask: 63 }, 2);
        island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result: WORKSHOP_SPECIMENS[specimenId].identityResult, cleanedMask: 63 }, 3);
    }
    const ids = variant === 'A' ? ['straight', 'wheel', 'bell'] as const : ['elbow', 'wheel', 'bell'] as const;
    ids.forEach((partId, index) => {
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId } }, 4);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId,
            position: variant === 'A' ? { col: index, row: 1 } : { col: 0, row: index + 1 } } }, 5);
        if (variant === 'B' && index > 0) island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'rotate', partId, rotation: 1 } }, 6);
    });
    return getIslandWorkshop(island);
}
function opaqueHits(point: THREE.Vector3, camera: THREE.Camera, objects: THREE.Object3D[], offset: number) {
    const direction = camera.position.clone().sub(point).normalize();
    const ray = new THREE.Raycaster(point.clone().addScaledVector(direction, offset), direction, 0, camera.position.distanceTo(point));
    return ray.intersectObjects(objects, true).filter(hit => {
        if (!(hit.object instanceof THREE.Mesh)) return false;
        for (let object: THREE.Object3D | null = hit.object; object; object = object.parent) if (!object.visible) return false;
        return true;
    });
}
function expectFaceForward(resident: IslandResident, camera: THREE.Camera) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(resident.head.getWorldQuaternion(new THREE.Quaternion()));
    const towardCamera = camera.position.clone().sub(resident.head.getWorldPosition(new THREE.Vector3())).normalize();
    expect(forward.dot(towardCamera)).toBeGreaterThan(.3);
}

describe('the actual workshop resident contact camera', () => {
    it.each((['otter', 'rabbit', 'fox'] as const).flatMap(species => (['A', 'B'] as const).map(variant => ({ species, variant }))))('keeps $species, its cap and real source contact visible through layout $variant', ({ species, variant }) => {
        const m = new IslandMaterials(), resident = new IslandResident(species, m, [0, 0, 1], () => {});
        resident.setAppearance('cap');
        const workshop = new IslandWorkshopScene({}), presentation = new IslandWorkshopPresentation(), scene = new THREE.Scene();
        workshop.update({ active: true, mode: 'build', workshop: assembledWorkshop(variant) }, 0, false);
        scene.add(workshop.group, resident.group); presentation.show(scene, workshop.group, [resident], species);
        const { sourceHandle, sourceApproach } = workshop.anchors;
        for (const aspect of [390 / 366, 768 / 430]) {
            presentation.beginRun({ id: 'run', command: { type: 'run' } }, 0, sourceHandle, sourceApproach);
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 80);
            fitIslandWorkshopResidentCamera(camera, workshop.group, aspect);
            for (const x of [-2.26, 2.26]) for (const z of [-2.26, 2.26]) {
                const point = new THREE.Vector3(x, .32, z).project(camera);
                expect(Math.abs(point.x)).toBeLessThan(.98); expect(Math.abs(point.y)).toBeLessThan(.98);
            }
            for (const now of [0, 500, 1000, 1600, 2100, 2500]) {
                presentation.pose(sourceHandle, sourceApproach, now, false);
                const bounds = new THREE.Box3().setFromObject(resident.group);
                for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                    const point = new THREE.Vector3(x, y, z).project(camera);
                    expect(Math.abs(point.x)).toBeLessThan(.98); expect(Math.abs(point.y)).toBeLessThan(.98);
                }
            }
            const hand = resident.handAnchor(new THREE.Vector3(), 'left');
            expect(hand.distanceTo(sourceHandle)).toBeLessThan(.045);
            // Start beyond the contacting hand itself and reject any nearer
            // visible head/body/source mesh that would hide the physical joint.
            const hits = opaqueHits(hand, camera, [resident.group, workshop.visuals.source], .12);
            expect(hits.map(hit => hit.object.name)).toEqual([]);
            expectFaceForward(resident, camera);
            presentation.afterRender(() => true, 2500);
            const interest = species === 'otter' ? workshop.visuals.source.localToWorld(new THREE.Vector3(.54, .13, 0))
                : species === 'rabbit' ? workshop.visuals.parts.wheel.rotor!.localToWorld(new THREE.Vector3(.215, 0, 0))
                    : workshop.visuals.parts.bell.bell!.localToWorld(new THREE.Vector3(0, -.27, 0));
            presentation.pose(sourceHandle, sourceApproach, 3200, false, interest);
            presentation.pose(sourceHandle, sourceApproach, 3800, false, interest);
            for (const fraction of [0, .25, .5, .75, 1]) {
                fitIslandWorkshopResidentCamera(camera, workshop.group, aspect, fraction);
                const bounds = new THREE.Box3().setFromObject(resident.group);
                for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                    const point = new THREE.Vector3(x, y, z).project(camera);
                    expect(Math.abs(point.x)).toBeLessThan(.98); expect(Math.abs(point.y)).toBeLessThan(.98);
                }
                for (const x of [-2.26, 2.26]) for (const z of [-2.26, 2.26]) {
                    const point = new THREE.Vector3(x, .32, z).project(camera);
                    expect(Math.abs(point.x)).toBeLessThan(.98); expect(Math.abs(point.y)).toBeLessThan(.98);
                }
            }
            expectFaceForward(resident, camera);
        }
        presentation.restore(); workshop.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); m.dispose();
    });
    it.each(['A', 'B'] as const)('shows the actual waterwheel window face in layout %s without an edge-on view', variant => {
        const workshop = new IslandWorkshopScene({});
        workshop.update({ active: true, mode: 'build', workshop: assembledWorkshop(variant) }, 0, false);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 80);
        fitIslandWorkshopResidentCamera(camera, workshop.group, 390 / 366, 1);
        const rotor = workshop.visuals.parts.wheel.rotor!; rotor.updateWorldMatrix(true, false);
        const center = rotor.localToWorld(new THREE.Vector3(.215, 0, 0));
        const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(rotor.getWorldQuaternion(new THREE.Quaternion()));
        const facing = normal.dot(camera.position.clone().sub(center).normalize());
        expect(Math.abs(facing)).toBeGreaterThan(.25);
        const points = [-.055, 0, .055].map(y => rotor.localToWorld(new THREE.Vector3(.215 + Math.sign(facing) * .024, y, .02)));
        const results = points.map(point => opaqueHits(point, camera, [workshop.group], .09));
        expect(results.filter(hits => hits.length === 0).length, JSON.stringify(results.map(hits => hits.map(hit => ({
            name: hit.object.name, parent: hit.object.parent?.name, grandparent: hit.object.parent?.parent?.name,
            world: hit.object.getWorldPosition(new THREE.Vector3()).toArray(), distance: hit.distance,
        }))))).toBeGreaterThanOrEqual(2);
        workshop.dispose();
    });
});
