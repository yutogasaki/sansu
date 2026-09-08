import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { IslandResident } from './animals';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeOptionalFurniture } from './optionalFurnitureGeometry';
import { OptionalFurnitureController } from './optionalFurnitureController';
import { fitOptionalFurnitureCamera, optionalFurnitureCameraDiagnostic, optionalFurnitureForwardYaw, OPTIONAL_FURNITURE_VIEW_ANGLES } from './optionalFurnitureFraming';
import { boxCorners } from './sceneFraming';

function meshes(root: THREE.Object3D) {
    const result: THREE.Mesh[] = []; root.traverseVisible(child => { if (child instanceof THREE.Mesh) result.push(child); }); return result;
}
/** Independent native raycasting against the real model and live house/tree. */
function visibility(scene: THREE.Scene, subject: THREE.Object3D, camera: THREE.Camera, external?: THREE.Object3D) {
    scene.updateWorldMatrix(true, true);
    const own = meshes(subject), world = meshes(scene), bounds = new THREE.Box3();
    own.forEach(mesh => bounds.union(new THREE.Box3().setFromObject(mesh, true)));
    const projected = new THREE.Box3().setFromPoints(boxCorners(bounds).map(point => point.project(camera))), size = projected.getSize(new THREE.Vector3());
    const ray = new THREE.Raycaster(); let total = 0, visible = 0; let externallyBlocked = 0;
    const solid = (hit: THREE.Intersection) => {
        const mesh = hit.object as THREE.Mesh, m = Array.isArray(mesh.material) ? mesh.material[hit.face?.materialIndex ?? 0] : mesh.material;
        return m.visible && (!m.transparent || m.opacity > .05);
    };
    for (let y = 0; y < 11; y++) for (let x = 0; x < 13; x++) {
        ray.setFromCamera(new THREE.Vector2(projected.min.x + size.x * (x + .5) / 13, projected.min.y + size.y * (y + .5) / 11), camera);
        const target = ray.intersectObjects(own, false).find(solid); if (!target) continue; total++;
        const block = ray.intersectObjects(world, false).find(hit => solid(hit) && hit.distance < target.distance - .003); if (!block) visible++; else if (external) { for (let object: THREE.Object3D | null = block.object; object; object = object.parent) if (object === external) { externallyBlocked++; break; } }
    }
    expect(total).toBeGreaterThan(8); return { visible: visible / total, externallyBlocked: externallyBlocked / total };
}
const angles = OPTIONAL_FURNITURE_VIEW_ANGLES;
function fixture(kind: 'telescope' | 'hammock', species: 'otter' | 'rabbit', aspect: number) {
    const materials = new IslandMaterials(), scene = new THREE.Scene(), world = new IslandCosmeticScenery(), island = createIsland('physical-tool-camera', 0);
    world.updateGrowth({ ...island, learning: false, pulse: 0, growth: { ...island.growth!, progress: { ...island.growth!.progress, village: 6, grove: 6 } } });
    const model = makeOptionalFurniture(kind, materials), position = kind === 'hammock' ? { x: -.5, z: -2.5 } : { x: -.5, z: -1 }, rotation = kind === 'hammock' ? 0 : Math.PI / 2;
    model.position.set(position.x, 0, position.z); model.rotation.y = rotation; scene.add(world.group, model);
    const resident = new IslandResident(species, materials, [-1, 0, 2], () => {}); scene.add(resident.group);
    const controller = new OptionalFurnitureController([resident]);
    expect(controller.start({ item: { id: kind, kind, position, rotation }, group: model, residentId: species, borrowed: true, items: [], land: 0,
        now: 0, reduced: true, requestId: kind }).status).toBe('playing');
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
    const fit = () => fitOptionalFurnitureCamera(camera, controller.framingBounds!, aspect, rotation,
        { key: `${kind}-${species}`, model, scene: { subjects: controller.framingSubjects, occluders: [scene], angles }, present: inspect => controller.withPresentation(inspect) });
    return { scene, world, model, resident, controller, camera, rotation, fit, dispose() { controller.cancel(6000); resident.disposeAppearance(); world.dispose(); disposeGeometry(scene); materials.dispose(); } };
}
describe('optional tool close views keep the physical cause visible', () => {
    it('uses the actual forward yaw after equivalent quaternion restoration and parent rotation', () => {
        const parent = new THREE.Group(), model = new THREE.Group(); parent.add(model);
        parent.rotation.y = .37; model.rotation.y = Math.PI;
        const before = optionalFurnitureForwardYaw(model), quaternion = model.quaternion.clone();
        model.quaternion.copy(quaternion);
        expect(model.rotation.y).toBeCloseTo(0);
        expect(optionalFurnitureForwardYaw(model)).toBeCloseTo(before);
        expect(new THREE.Vector3(Math.sin(before), 0, Math.cos(before)).distanceTo(
            new THREE.Vector3(0, 0, 1).transformDirection(model.matrixWorld))).toBeLessThan(1e-10);
    });
    for (const aspect of [390 / 295.390625, 768 / 358.390625]) it(`keeps the same tea cup and tabletop visible through quaternion-restored handoff at ${aspect}`, () => {
        const materials = new IslandMaterials(), scene = new THREE.Scene(), model = makeOptionalFurniture('tea-table', materials);
        model.rotation.y = Math.PI; scene.add(model);
        const residents = [new IslandResident('otter', materials, [-1.65, 0, 1.1], () => {}),
            new IslandResident('rabbit', materials, [1.7, 0, 1.35], () => {}), new IslandResident('fox', materials, [2.6, 0, -.2], () => {})];
        residents.forEach(resident => scene.add(resident.group));
        const controller = new OptionalFurnitureController(residents), item = { id: 'tea', kind: 'tea-table' as const, position: { x: 0, z: 0 }, rotation: Math.PI };
        expect(controller.start({ item, group: model, residentId: 'otter', partnerId: 'rabbit', borrowed: true,
            items: [item], land: 0, now: 0, reduced: false, requestId: 'rendered-tea-regression' }).status).toBe('playing');
        controller.withPresentation(() => {});
        expect(model.rotation.y).toBeCloseTo(0); // Physical half-turn still exists.
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100), cup = model.getObjectByName('optional-tea-cup')!, table = model.getObjectByName('furniture-static')!;
        const options = { key: 'legacy-yaw', scene: { subjects: controller.framingSubjects, occluders: [scene], angles },
            present: (inspect: () => void) => controller.withPresentation(inspect) };
        fitOptionalFurnitureCamera(camera, controller.framingBounds!, aspect, model.rotation.y, options);
        controller.withPresentation(() => expect(visibility(scene, cup, camera).visible).toBeLessThan(.2));
        const objects: THREE.Object3D[] = []; scene.traverse(object => objects.push(object));
        const transforms = () => objects.map(object => [object.uuid, object.visible, object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()]);
        const before = transforms(), cupUuid = cup.uuid;
        const fit = () => fitOptionalFurnitureCamera(camera, controller.framingBounds!, aspect, model.rotation.y, { ...options, key: 'actual-yaw', model });
        fit(); expect(transforms()).toEqual(before);
        expect(optionalFurnitureCameraDiagnostic(camera)!.visibility).toHaveLength(5);
        controller.withPresentation(() => {
            expect(visibility(scene, cup, camera).visible).toBeGreaterThan(.9);
            expect(visibility(scene, table, camera).visible).toBeGreaterThan(.8);
        });
        const matrix = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
        for (let now = 0; now <= 15000; now += 100) {
            controller.update(now, false); controller.afterRender(() => true); fit();
            expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(matrix);
            if (controller.phase === 'handoff') {
                expect(cup.uuid).toBe(cupUuid);
                expect(visibility(scene, cup, camera).visible).toBeGreaterThan(.8);
            }
            if (controller.phase === 'settled') break;
        }
        expect(controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true, transferSeen: true });
        controller.cancel(15000); residents.forEach(resident => resident.disposeAppearance()); disposeGeometry(scene); materials.dispose();
    });
    for (const aspect of [390 / 295, 768 / 380]) it(`frames the real hammock cloth past the house roof at ${aspect}`, () => {
        const f = fixture('hammock', 'otter', aspect);
        for (let t = 0; t < 3000; t += 80) { f.controller.update(t, true); f.controller.afterRender(() => true); }
        const surface = f.model.getObjectByName('optional-support-surface')!;
        fitOptionalFurnitureCamera(f.camera, f.controller.framingBounds!, aspect, f.rotation);
        const before = visibility(f.scene, surface, f.camera, f.world.group), identities = f.scene.children.map(group => [group.uuid, group.visible, group.position.toArray()]);
        f.fit(); const after = visibility(f.scene, surface, f.camera, f.world.group);
        // The seated body intentionally covers cloth. Measure the house/tree
        // separately so moving to a view behind the body cannot fake clearing scenery.
        expect(before.externallyBlocked).toBeGreaterThan(.25);
        expect(after.externallyBlocked).toBeLessThan(.15);
        expect(after.visible).toBeGreaterThan(.25);
        for (const x of [-.15, .15]) {
            const eye = f.resident.head.localToWorld(new THREE.Vector3(x, .047, .294));
            const back = new THREE.Vector3(0, 0, 1).applyQuaternion(f.camera.quaternion);
            const ray = new THREE.Raycaster(eye.clone().addScaledVector(back, 15), back.negate(), 0, 14.96);
            expect(ray.intersectObjects(meshes(f.scene), false), `actual eye ${x}`).toHaveLength(0);
        }
        expect(f.scene.children.map(group => [group.uuid, group.visible, group.position.toArray()])).toEqual(identities);
        expect(angles).toContain(optionalFurnitureCameraDiagnostic(f.camera)!.angle); f.dispose();
    });
    it('keeps the same front-facing selection through a walk and restores every actual pose after camera inspection', () => {
        const f = fixture('telescope', 'rabbit', 390 / 295), objects: THREE.Object3D[] = [];
        f.scene.traverse(object => objects.push(object));
        f.controller.update(120, true);
        const snapshot = () => objects.map(object => [object.uuid, object.position.toArray(), object.quaternion.toArray(), object.scale.toArray()]);
        const before = snapshot(); f.fit(); expect(snapshot()).toEqual(before);
        const matrix = [...f.camera.matrixWorld.toArray(), ...f.camera.projectionMatrix.toArray()];
        for (let t = 200; t < 2500; t += 80) { f.controller.update(t, true); f.controller.afterRender(() => true); f.fit();
            expect([...f.camera.matrixWorld.toArray(), ...f.camera.projectionMatrix.toArray()]).toEqual(matrix); }
        expect(f.controller.phase).toBe('settled');
        expect(visibility(f.scene, f.resident.head, f.camera).visible).toBeGreaterThan(.85);
        f.dispose();
    });
});
