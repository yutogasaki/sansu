import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { EXPRESSION_RESIDENT_CANDIDATE } from './expressionResidentVisuals';
import { OptionalFurnitureController } from './optionalFurnitureController';
import { makeOptionalFurniture } from './optionalFurnitureGeometry';

const species = ['otter', 'rabbit', 'fox'] as const;
const looks = ['original', 'scarf', 'cap'] as const;
function visibleMeshes(object: THREE.Object3D) {
    const meshes: THREE.Mesh[] = []; object.traverseVisible(child => { if (child instanceof THREE.Mesh) meshes.push(child); }); return meshes;
}
function snapshot(objects: THREE.Object3D[]) {
    return objects.map(object => ({ uuid: object.uuid, position: object.position.toArray(), rotation: object.quaternion.toArray(), scale: object.scale.toArray(),
        ...(object instanceof THREE.Mesh ? { geometry: object.geometry.uuid, material: Array.isArray(object.material) ? object.material.map(m => m.uuid) : object.material.uuid } : {}) }));
}
describe('expressions stay attached to the original residents', () => {
    it.each(species)('%s shows both real patterns with every free/paid outfit while preserving the original face, limbs and contacts', kind => {
        const materials = new IslandMaterials(), resident = new IslandResident(kind, materials, [0, 0, 0], () => {});
        const original: THREE.Object3D[] = [];
        resident.group.traverse(child => { original.push(child); }); const before = snapshot(original);
        const baselineEyes = (kind === 'rabbit' ? [-.108, .108] : [-.15, .15]).map(x => resident.head.localToWorld(new THREE.Vector3(x, .047, 2)));
        resident.group.updateWorldMatrix(true, true);
        const forward = resident.group.getWorldDirection(new THREE.Vector3());
        const rays = baselineEyes.map(origin => new THREE.Raycaster(origin, forward.clone().negate()));
        const faceHits = rays.map(ray => ray.intersectObjects(visibleMeshes(resident.head), false)[0].distance);
        const signatures = new Set<string>();
        for (const look of looks) for (const outfit of [null, 'raincoat', 'star-beret'] as const) for (const pattern of ['river-check', 'butterfly-stitch'] as const) {
            resident.setAppearance(look); resident.setExpression({ outfit, pattern, trail: null }); resident.group.updateWorldMatrix(true, true);
            const added = visibleMeshes(resident.group).filter(mesh => !original.includes(mesh));
            expect(snapshot(original.filter(object => !object.name.startsWith('expression-') && !object.name.startsWith('resident-optional-')))).toEqual(before.filter((_, index) => !original[index].name.startsWith('expression-') && !original[index].name.startsWith('resident-optional-')));
            expect(resident.expressionDiagnostic()).toMatchObject({ candidate: EXPRESSION_RESIDENT_CANDIDATE, outfit, pattern });
            for (const [index, ray] of rays.entries()) {
                expect(ray.intersectObjects(visibleMeshes(resident.group), false)[0].distance, `${kind}/${look}/${outfit} eye ${index}`).toBeCloseTo(faceHits[index], 7);
            }
            const cloth = resident.body.getObjectByName('expression-pattern-cloth')!, center = cloth.getWorldPosition(new THREE.Vector3());
            const hit = new THREE.Raycaster(center.clone().addScaledVector(forward, 2), forward.clone().negate()).intersectObjects(visibleMeshes(resident.group), false)[0];
            expect(visibleMeshes(cloth)).toContain(hit.object);
            expect(added.length).toBeGreaterThan(8); signatures.add(pattern + ':' + visibleMeshes(cloth).map(mesh => mesh.geometry.uuid).join(','));
            expect(resident.body.getObjectByName('resident-optional-scarf')!.visible).toBe(!outfit && look === 'scarf');
            expect(resident.head.getObjectByName('resident-optional-cap')!.visible).toBe(!outfit && look === 'cap');
        }
        expect(signatures.size).toBe(2); resident.setExpression(); resident.setAppearance('cap');
        expect(resident.head.getObjectByName('resident-optional-cap')!.visible).toBe(true);
        resident.disposeAppearance(); disposeGeometry(resident.group); materials.dispose();
    });
    for (const kind of ['telescope', 'hammock', 'tea-table'] as const) it.each(species)(`${kind} preserves %s real contacts in raincoat and beret`, selected => {
        const materials = new IslandMaterials(), scene = new THREE.Scene(), model = makeOptionalFurniture(kind, materials); scene.add(model);
        const residents = species.map((name, i) => new IslandResident(name, materials, i === 0 ? [-1.65, 0, 1.1] : i === 1 ? [1.7, 0, 1.35] : [2.6, 0, -.2], () => {}));
        residents.forEach(resident => scene.add(resident.group)); const controller = new OptionalFurnitureController(residents);
        for (const outfit of ['raincoat', 'star-beret'] as const) {
            residents.forEach(resident => resident.setExpression({ outfit, pattern: 'river-check', trail: null }));
            expect(controller.start({ item: { id: 'tool', kind, position: { x: 0, z: 0 }, rotation: 0 }, group: model, residentId: selected,
                requestId: outfit, borrowed: true, items: [], land: 0, now: 0, reduced: true }).status).toBe('playing');
            for (let t = 0; t < 5000 && controller.phase !== 'settled'; t += 80) { controller.update(t, true); controller.afterRender(() => true); }
            expect(controller.describe()).toMatchObject({ phase: 'settled', contactSeen: true });
            if (kind === 'tea-table') expect(controller.describe()?.transferSeen).toBe(true);
            controller.cancel(6000);
        }
        residents.forEach(resident => resident.disposeAppearance()); disposeGeometry(scene); materials.dispose();
    });
});
