import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { IslandWorkshopPresentation } from './workshopPresentation';
import { IslandWorkshopScene } from './workshopScene';
import { workshopFootSupport } from './workshopGround';

const handle = new THREE.Vector3(-2.75, 1.09, -.34), approach = new THREE.Vector3(-3.05, 0, .58);
const transforms = (root: THREE.Group) => {
    const result: number[][] = []; root.traverse(object => result.push([...object.position, ...object.quaternion, ...object.scale])); return result;
};
function expectSandSupport(resident: IslandResident, ground: THREE.Object3D, walking = false) {
    ground.updateWorldMatrix(true, true);
    const clearances = resident.feet.map(foot => {
        const support = workshopFootSupport(foot);
        expect(support, 'the full real foot footprint is inside sand').toBeDefined();
        const point = support!.point;
        const hits = new THREE.Raycaster(new THREE.Vector3(point.x, 2, point.z), new THREE.Vector3(0, -1, 0)).intersectObject(ground, true);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.y).toBeCloseTo(support!.sandY, 6);
        expect(support!.clearance).toBeGreaterThanOrEqual(-1e-6);
        expect(support!.clearance).toBeLessThanOrEqual(.111);
        return support!.clearance;
    });
    expect(Math.min(...clearances)).toBeCloseTo(0, 6);
    if (!walking) expect(Math.max(...clearances)).toBeCloseTo(0, 6);
}

describe('borrowing the live world for workshop presentation', () => {
    it.each((['otter', 'rabbit', 'fox'] as const).flatMap(species => [false, true].map(reduced => ({ species, reduced }))))(
        'keeps $species supported through waiting, walk cancellation and reentry (reduced=$reduced)', ({ species, reduced }) => {
            const m = new IslandMaterials(), resident = new IslandResident(species, m, [2, 0, 1], () => {});
            resident.setAppearance('cap'); resident.pose.position.set(.2, .3, -.1); resident.body.rotation.x = .12;
            const before = transforms(resident.group), uuid = resident.group.uuid;
            const meshes: { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; array: ArrayLike<number> }[] = [];
            resident.group.traverse(object => { if (object instanceof THREE.Mesh) meshes.push({ mesh: object, geometry: object.geometry,
                material: object.material, array: object.geometry.attributes.position.array }); });
            const scene = new THREE.Scene(), workshop = new IslandWorkshopScene({}), p = new IslandWorkshopPresentation();
            scene.add(resident.group, workshop.group);
            const anchors = workshop.anchors, ground = workshop.visuals.build.children[0];
            p.show(scene, workshop.group, [resident], species);
            p.pose(anchors.sourceHandle, anchors.sourceApproach, 0, reduced);
            expectSandSupport(resident, ground);
            const waiting = resident.group.position.clone();
            expect(waiting.z).toBeLessThan(2); expect(waiting.z).toBeGreaterThan(anchors.sourceApproach.z + .5);
            expect(p.diagnostic()?.candidate).toBe('workshop-grounded-residents-v1');
            expect(p.beginRun({ id: 'cancel-before-source', command: { type: 'run' } }, 0, anchors.sourceHandle, anchors.sourceApproach)).toBe(true);
            for (const now of [40, 80, 160]) {
                p.pose(anchors.sourceHandle, anchors.sourceApproach, now, reduced);
                expect(p.phase).toBe('walking'); expectSandSupport(resident, ground, !reduced);
                expect(p.afterRender(() => true, now)).toBeUndefined();
            }
            p.cancel(); p.pose(anchors.sourceHandle, anchors.sourceApproach, 170, reduced);
            expect(p.phase).toBe('waiting'); expect(resident.group.position.equals(waiting)).toBe(true); expectSandSupport(resident, ground);
            p.restore(); expect(transforms(resident.group)).toEqual(before);
            p.show(scene, workshop.group, [resident], species);
            p.pose(anchors.sourceHandle, anchors.sourceApproach, 5000, reduced);
            expect(resident.group.position.equals(waiting)).toBe(true); expectSandSupport(resident, ground);
            expect(p.afterRender(() => true, 5000)).toBeUndefined(); expect(resident.group.uuid).toBe(uuid);
            p.restore(); expect(transforms(resident.group)).toEqual(before);
            for (const saved of meshes) {
                expect(saved.mesh.geometry).toBe(saved.geometry); expect(saved.mesh.material).toBe(saved.material);
                expect(saved.mesh.geometry.attributes.position.array).toBe(saved.array);
            }
            workshop.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); m.dispose();
        });
    it('supports the waiting resident on the actual batched sand after returning to the workshop', () => {
        const m = new IslandMaterials(), resident = new IslandResident('otter', m, [2, 0, 1], () => {});
        const scene = new THREE.Scene(), workshop = new IslandWorkshopScene({}), p = new IslandWorkshopPresentation();
        scene.add(resident.group, workshop.group); p.show(scene, workshop.group, [resident], 'otter');
        p.pose(workshop.anchors.sourceHandle, workshop.anchors.sourceApproach, 0, false);
        const ground = workshop.visuals.build.children[0]; ground.updateWorldMatrix(true, true);
        for (const foot of resident.feet) {
            const sole = foot.localToWorld(new THREE.Vector3(0, -1, 0));
            const hits = new THREE.Raycaster(new THREE.Vector3(sole.x, 2, sole.z), new THREE.Vector3(0, -1, 0)).intersectObject(ground, true);
            expect(hits.length, `actual sand below foot at ${sole.toArray()}`).toBeGreaterThan(0);
            expect(Math.abs(sole.y - hits[0].point.y)).toBeLessThan(.004);
        }
        p.restore(); workshop.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); m.dispose();
    });
    it.each(['otter', 'rabbit', 'fox'] as const)('walks selected %s outside the board, renders exact hand contact before run, then restores its actual pose', species => {
        const m = new IslandMaterials(), resident = new IslandResident(species, m, [2, 0, 1], () => {});
        resident.action = 'rest'; resident.itemId = 'saved-seat'; resident.pose.position.set(.2, .3, -.1); resident.setAppearance('cap');
        const before = transforms(resident.group), uuid = resident.group.uuid;
        const scene = new THREE.Scene(), world = new THREE.Group(), hidden = new THREE.Group(), workshop = new IslandWorkshopScene({}), light = new THREE.HemisphereLight();
        hidden.visible = false; scene.add(world, hidden, resident.group, workshop.group, light);
        const presentation = new IslandWorkshopPresentation();
        presentation.show(scene, workshop.group, [resident], species);
        const request = { id: 'explicit-run', command: { type: 'run' as const } };
        expect(presentation.beginRun(request, 0, handle, approach)).toBe(true);
        let issued = false; const roots: number[][] = [];
        for (let now = 0; now <= 3500; now += 1000 / 30) {
            presentation.pose(handle, approach, now, false, new THREE.Vector3(0, .6, 0));
            expectSandSupport(resident, workshop.visuals.build.children[0], presentation.phase === 'walking');
            if (presentation.phase === 'walking') {
                expect(resident.group.position.x).toBeLessThan(-2.6); roots.push(resident.group.position.toArray());
                expect(presentation.afterRender(() => true, now)).toBeUndefined();
            } else if (!issued) {
                expect(presentation.afterRender(() => false, now)).toBeUndefined();
                const sent = presentation.afterRender(() => true, now);
                if (sent) { expect(sent).toBe(request); expect(resident.handAnchor(new THREE.Vector3(), 'left').distanceTo(handle)).toBeLessThan(.045); issued = true; }
            }
        }
        expect(issued).toBe(true); expect(roots.length).toBeGreaterThan(20); expect(roots[0][2] - roots[roots.length - 1][2]).toBeGreaterThan(.9);
        expect(presentation.phase).toBe('watching'); expect(presentation.afterRender(() => true, 3600)).toBeUndefined();
        expect(resident.group.uuid).toBe(uuid); expect(resident.action).toBe('rest'); expect(resident.itemId).toBe('saved-seat');
        presentation.restore();
        expect(transforms(resident.group)).toEqual(before); expect(world.visible).toBe(true); expect(hidden.visible).toBe(false); expect(resident.group.visible).toBe(true);
        workshop.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); m.dispose();
    });
    it('does not substitute an unavailable resident or borrow anybody for self operation; changing selection cancels a pending walk', () => {
        const m = new IslandMaterials(), rabbit = new IslandResident('rabbit', m, [2, 0, 1], () => {});
        const scene = new THREE.Scene(), workshop = new THREE.Group(); scene.add(rabbit.group, workshop);
        const p = new IslandWorkshopPresentation(), request = { id: 'run', command: { type: 'run' as const } };
        p.show(scene, workshop, [rabbit]); expect(p.actor).toBeUndefined(); expect(p.beginRun(request, 0, handle, approach)).toBe(false);
        p.show(scene, workshop, [rabbit], 'fox'); expect(p.actor).toBeUndefined();
        p.show(scene, workshop, [rabbit], 'rabbit'); expect(p.beginRun(request, 0, handle, approach)).toBe(true);
        p.pose(handle, approach, 100, true); p.unpresent(); p.show(scene, workshop, [rabbit], 'rabbit');
        expect(p.phase).toBe('walking');
        p.show(scene, workshop, [rabbit]); expect(p.afterRender(() => true, 10000)).toBeUndefined();
        p.restore(); expect(rabbit.group.position.toArray()).toEqual([2, 0, 1]);
        rabbit.disposeAppearance(); disposeGeometry(rabbit.group); m.dispose();
    });
    it.each(['otter', 'rabbit', 'fox'] as const)('keeps reduced-motion %s contact physical while the actual handle turns', species => {
        const m = new IslandMaterials(), resident = new IslandResident(species, m, [2, 0, 1], () => {});
        const scene = new THREE.Scene(), workshop = new IslandWorkshopScene({}), p = new IslandWorkshopPresentation();
        scene.add(resident.group, workshop.group); p.show(scene, workshop.group, [resident], species);
        const initial = workshop.anchors, request = { id: 'reduced-run', command: { type: 'run' as const } };
        expect(p.beginRun(request, 0, initial.sourceHandle, initial.sourceApproach)).toBe(true);
        p.pose(initial.sourceHandle, initial.sourceApproach, 100, true);
        expect(p.afterRender(() => true, 100)).toBeUndefined();
        p.pose(initial.sourceHandle, initial.sourceApproach, 240, true);
        p.pose(initial.sourceHandle, initial.sourceApproach, 256, true);
        expect(p.afterRender(() => false, 256)).toBeUndefined();
        expect(p.afterRender(() => true, 256)).toBe(request);
        for (let frame = 0; frame < 5; frame++) {
            workshop.visuals.handle.rotation.z = Math.sin(frame / 5 * Math.PI * 1.5) * .3;
            const live = workshop.anchors;
            p.pose(live.sourceHandle, live.sourceApproach, 270 + frame * 30, true);
            expect(resident.handAnchor(new THREE.Vector3(), 'left').distanceTo(live.sourceHandle)).toBeLessThan(.045);
            expect(p.afterRender(() => true, 270 + frame * 30)).toBeUndefined();
            expectSandSupport(resident, workshop.visuals.build.children[0]);
        }
        p.restore(); expect(resident.group.position.toArray()).toEqual([2, 0, 1]);
        workshop.dispose(); resident.disposeAppearance(); disposeGeometry(resident.group); m.dispose();
    });
});
