import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_RESIDENT_LOOKS } from '../../../domain/island/experience';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeResidentRig, RESIDENT_SCALE, type ResidentSpecies } from './residentRig';
import { IslandResidentOutfit, residentOutfitStandingBounds } from './residentOutfit';
import { planResidentPointRoute } from './navigation';

function meshes(group: THREE.Object3D) {
    const result: THREE.Mesh[] = []; group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); }); return result;
}
function snapshot(objects: THREE.Object3D[]) {
    return objects.map(object => ({ uuid: object.uuid, position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray(),
        ...(object instanceof THREE.Mesh ? { geometry: object.geometry.uuid, positions: Array.from(object.geometry.getAttribute('position').array),
            material: Array.isArray(object.material) ? object.material.map((material: THREE.Material) => material.uuid) : object.material.uuid } : {}) }));
}
const species: ResidentSpecies[] = ['otter', 'rabbit', 'fox'];

describe('optional attached resident outfits', () => {
    it.each(species)('%s preserves every original mesh, body proportion, fixed scarf and hand/seat/foot anchor through all appearances', kind => {
        const materials = new IslandMaterials(), rig = makeResidentRig(kind, materials), original: THREE.Object3D[] = [];
        rig.pose.traverse(object => { original.push(object); });
        const before = snapshot(original), outfit = new IslandResidentOutfit(kind, rig.body, rig.head);
        try {
            expect(meshes(outfit.bodyGroup)).toHaveLength(0); expect(meshes(outfit.headGroup)).toHaveLength(0);
            expect(outfit.set('original')).toBe(false);
            for (const look of ['scarf', 'cap', 'original', 'cap', 'scarf'] as const) {
                outfit.set(look);
                expect(outfit.bodyGroup.visible).toBe(look === 'scarf'); expect(outfit.headGroup.visible).toBe(look === 'cap');
                expect(snapshot(original)).toEqual(before);
                expect(outfit.bodyGroup.parent).toBe(rig.body); expect(outfit.headGroup.parent).toBe(rig.head);
            }
            outfit.set('original');
            expect(outfit.bodyGroup.visible || outfit.headGroup.visible).toBe(false);
            expect(snapshot(original)).toEqual(before);
        } finally { outfit.dispose(); disposeGeometry(rig.pose); materials.dispose(); }
    });

    it.each(species)('%s keeps caps clear of the front-facing eyes, nose, mouth and both inner ears', kind => {
        const materials = new IslandMaterials(), rig = makeResidentRig(kind, materials), outfit = new IslandResidentOutfit(kind, rig.body, rig.head);
        try {
            outfit.set('cap'); rig.pose.updateMatrixWorld(true);
            const eyeX = kind === 'rabbit' ? .108 : .15, earX = kind === 'rabbit' ? .135 : kind === 'otter' ? .285 : .275;
            const earY = kind === 'rabbit' ? .42 : kind === 'otter' ? .215 : .25;
            const visiblePoints = [[-eyeX, .047], [eyeX, .047], [0, -.052], [0, -.13], [-earX, earY], [earX, earY],
                [-earX, earY + (kind === 'rabbit' ? .17 : .025)], [earX, earY + (kind === 'rabbit' ? .17 : .025)]];
            for (const [x, y] of visiblePoints) {
                const origin = rig.head.localToWorld(new THREE.Vector3(x, y, 2));
                const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, 0, -1), 0, 3);
                expect(ray.intersectObject(outfit.headGroup, true), `${kind}: face/ear at ${x},${y}`).toHaveLength(0);
            }
            const patches = meshes(outfit.headGroup).filter(object => object.name.startsWith('cap-patch-'));
            expect(patches).toHaveLength(2);
            expect(patches[0].material).not.toBe(patches[1].material);
            expect(Array.from(patches[0].geometry.getAttribute('position').array)).not.toEqual(Array.from(patches[1].geometry.getAttribute('position').array));
            expect(new THREE.Box3().setFromObject(outfit.headGroup, true).min.y - rig.head.position.y).toBeGreaterThan(.17);
        } finally { outfit.dispose(); disposeGeometry(rig.pose); materials.dispose(); }
    });

    it.each(species)('%s bounds every actual optional vertex before its first selection and keeps it close to the original proportions', kind => {
        const materials = new IslandMaterials(), rig = makeResidentRig(kind, materials), outfit = new IslandResidentOutfit(kind, rig.body, rig.head);
        const envelope = residentOutfitStandingBounds(kind, rig.head.position.y);
        try {
            outfit.set('scarf'); rig.pose.updateMatrixWorld(true);
            for (const object of [...meshes(outfit.bodyGroup), ...meshes(outfit.headGroup)]) {
                const positions = object.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    expect(envelope.containsPoint(point), `${kind}: ${point.toArray()}`).toBe(true);
                }
            }
            const hat = new THREE.Box3().setFromObject(outfit.headGroup, true).getSize(new THREE.Vector3());
            expect(hat.x).toBeLessThan(.43); expect(hat.y).toBeLessThan(.22); expect(hat.z).toBeLessThan(.49);
            const scarf = new THREE.Box3().setFromObject(outfit.bodyGroup, true);
            expect(scarf.min.y).toBeGreaterThan(.44); expect(scarf.max.y).toBeLessThan(.82);
        } finally { outfit.dispose(); disposeGeometry(rig.pose); materials.dispose(); }
    });

    it('creates one bounded material/texture/geometry pool, reuses it across repeated switching, and disposes exactly once', () => {
        const materials = new IslandMaterials(), rig = makeResidentRig('otter', materials), outfit = new IslandResidentOutfit('otter', rig.body, rig.head);
        outfit.set('scarf');
        const objects = [...meshes(outfit.bodyGroup), ...meshes(outfit.headGroup)], geometries = [...new Set(objects.map(object => object.geometry))];
        const ownedMaterials = [...new Set(objects.map(object => object.material as THREE.MeshStandardMaterial))], textures = [...new Set(ownedMaterials.map(material => material.map!))];
        expect(textures).toHaveLength(1); expect(ownedMaterials).toHaveLength(5); expect(objects.length).toBeLessThan(18);
        const disposed = new Map<string, number>();
        for (const resource of [...geometries, ...ownedMaterials, ...textures]) resource.addEventListener('dispose', () => { disposed.set(resource.uuid, (disposed.get(resource.uuid) ?? 0) + 1); });
        for (let index = 0; index < 120; index++) outfit.set(ISLAND_RESIDENT_LOOKS[index % 3]);
        expect([...meshes(outfit.bodyGroup), ...meshes(outfit.headGroup)].map(object => object.geometry.uuid)).toEqual(objects.map(object => object.geometry.uuid));
        expect(disposed.size).toBe(0);
        outfit.dispose(); outfit.dispose(); expect(outfit.set('cap')).toBe(false);
        expect(outfit.bodyGroup.parent).toBeNull(); expect(outfit.headGroup.parent).toBeNull();
        expect(disposed.size).toBe(geometries.length + ownedMaterials.length + textures.length);
        expect([...disposed.values()].every(count => count === 1)).toBe(true);
        disposeGeometry(rig.pose); materials.dispose();
    });

    it.each(species)('%s appearance setters preserve live walking/hand anchors and keep the cap inside the learning frame envelope', kind => {
        const materials = new IslandMaterials(), actor = new IslandResident(kind, materials, [0, 0, 1.6], () => undefined);
        try {
            const route = planResidentPointRoute(actor.group.position, { x: 1.5, z: 1.8 }, [], 0)!;
            expect(actor.walkToPoint(route, 0, false, 0)).toBe(true); actor.update(100);
            actor.group.updateMatrixWorld(true);
            const body = actor.body.matrix.clone(), feet = actor.feet.map(foot => foot.position.clone()), hand = actor.handAnchor().clone(), root = actor.group.position.clone();
            const reserved = actor.learningFrameBounds();
            expect(actor.setAppearance('cap')).toBe(true); expect(actor.setAppearance('cap')).toBe(false);
            actor.group.updateMatrixWorld(true);
            const cap = actor.head.getObjectByName('resident-optional-cap')!;
            const capBox = new THREE.Box3().setFromObject(cap, true);
            expect(reserved.containsBox(capBox)).toBe(true);
            expect(actor.body.matrix.equals(body)).toBe(true); expect(actor.group.position.equals(root)).toBe(true);
            expect(actor.handAnchor().distanceTo(hand)).toBeLessThan(1e-8);
            actor.feet.forEach((foot, i) => expect(foot.position.equals(feet[i])).toBe(true));
            expect(actor.group.scale.toArray()).toEqual([RESIDENT_SCALE, RESIDENT_SCALE, RESIDENT_SCALE]);
            expect(actor.action).toBe('walk');
        } finally { actor.disposeAppearance(); disposeGeometry(actor.group); materials.dispose(); }
    });
});
