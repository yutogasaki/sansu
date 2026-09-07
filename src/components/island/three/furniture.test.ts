import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import { makeFurniture, applyFurnitureInterest, applyFurnitureLife, applyFurnitureUse, getFurnitureAnchors } from './furniture';
import { getSwingSeatPosition, sampleFurnitureSwing } from './furnitureVisuals';
import { IslandMaterials, disposeGeometry } from './primitives';
import type { IslandItemKind } from './types';
import { sampleResidentInterest } from './residentInterest';

function projectedRadius(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), point = new THREE.Vector3();
    let radius = 0;
    group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.getAttribute('position');
        const matrix = inverse.clone().multiply(object.matrixWorld);
        for (let i = 0; i < vertices.count; i++) {
            point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
            radius = Math.max(radius, Math.hypot(point.x, point.z));
        }
    });
    return radius;
}

describe('furniture physical contracts', () => {
    it.each(Object.keys(ISLAND_ITEMS) as IslandItemKind[])('keeps %s geometry, including the strongest life/use pose, within saved placement bounds', kind => {
        const materials = new IslandMaterials(), furniture = makeFurniture(kind, materials);
        for (const amount of [0, 1.3]) for (const phase of [0, .25, .375, .5, .625, .75, 1]) {
            applyFurnitureLife(furniture, amount);
            applyFurnitureUse(furniture, phase);
            expect(projectedRadius(furniture)).toBeLessThanOrEqual(ISLAND_ITEMS[kind].radius + .00001);
        }
        disposeGeometry(furniture); materials.dispose();
    });

    it.each(['bench', 'swing', 'mushroom'] as const)('places the %s seat anchor on its real supporting surface at every orientation', kind => {
        const materials = new IslandMaterials(), furniture = makeFurniture(kind, materials);
        const anchor = getFurnitureAnchors(kind).seat!;
        for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            furniture.rotation.y = rotation;
            furniture.position.set(2, 0, -1);
            furniture.updateMatrixWorld(true);
            const seat = furniture.localToWorld(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
            const ray = new THREE.Raycaster(seat.clone().add(new THREE.Vector3(0, .03, 0)), new THREE.Vector3(0, -1, 0), 0, .06);
            const hit = ray.intersectObject(furniture, true)[0];
            expect(hit, `${kind} exposes a supporting surface`).toBeDefined();
            expect(hit.point.distanceTo(seat)).toBeLessThan(.0001);
        }
        disposeGeometry(furniture); materials.dispose();
    });

    it('uses the same swing pivot and moving contact point as the resident', () => {
        const materials = new IslandMaterials(), furniture = makeFurniture('swing', materials);
        const moving = furniture.getObjectByName('swing-moving')!;
        for (const phase of [0, .125, .25, .5, .75, 1]) {
            applyFurnitureUse(furniture, phase);
            furniture.updateMatrixWorld(true);
            const actual = moving.localToWorld(new THREE.Vector3(0, -1.05, 0));
            const expected = getSwingSeatPosition(phase);
            expect(actual.distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z))).toBeLessThan(.000001);
            expect(moving.rotation.x).toBe(sampleFurnitureSwing(phase).angle);
        }
        expect(sampleFurnitureSwing(0).angle).toBe(0);
        expect(sampleFurnitureSwing(1).angle).toBe(0);
        disposeGeometry(furniture); materials.dispose();
    });

    it('reacts locally without moving roots or shared light materials, then returns exactly to rest', () => {
        const materials = new IslandMaterials();
        const flower = makeFurniture('flower', materials), lamp = makeFurniture('lantern', materials), otherLamp = makeFurniture('lantern', materials);
        const fountain = makeFurniture('fountain', materials);
        const objects = [flower, lamp, fountain];
        const transforms = objects.map(object => object.getObjectByName('furniture-static')!.matrix.clone());
        objects.forEach(object => applyFurnitureLife(object, 1));
        objects.forEach((object, i) => {
            expect(object.scale.toArray()).toEqual([1, 1, 1]);
            expect(object.getObjectByName('furniture-static')!.matrix.equals(transforms[i])).toBe(true);
        });
        const lightIntensity = (group: THREE.Group) => {
            let intensity = 0;
            group.getObjectByName('lantern-light')!.traverse(object => {
                if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.userData.islandOwned) intensity = object.material.emissiveIntensity;
            });
            return intensity;
        };
        expect(lightIntensity(lamp)).toBeGreaterThan(lightIntensity(otherLamp));
        expect(flower.getObjectByName('flower-blooms')!.scale.x).toBeGreaterThan(1);
        expect(flower.getObjectByName('flower-leaves')!.scale.toArray()).toEqual([1.06, 1, 1.06]);
        expect(fountain.getObjectByName('fountain-water')!.scale.y).toBeGreaterThan(1);
        objects.forEach(object => applyFurnitureLife(object, 0));
        expect(lightIntensity(lamp)).toBe(lightIntensity(otherLamp));
        expect(flower.getObjectByName('flower-blooms')!.scale.toArray()).toEqual([1, 1, 1]);
        expect(flower.getObjectByName('flower-leaves')!.scale.toArray()).toEqual([1, 1, 1]);
        expect(fountain.getObjectByName('fountain-water')!.scale.toArray()).toEqual([1, 1, 1]);
        applyFurnitureLife(flower, 1, true);
        expect(flower.getObjectByName('flower-blooms')!.rotation.y).toBe(0);
        [...objects, otherLamp].forEach(disposeGeometry); materials.dispose();
    });
});


describe('ordinary resident interest only touches its actual object', () => {
    it.each(['flower', 'lantern', 'fountain'] as const)('%s retains anchors, fixed geometry and other instances through one response and exact reset', kind => {
        const materials = new IslandMaterials(), object = makeFurniture(kind, materials), other = makeFurniture(kind, materials);
        const fixed = object.getObjectByName('furniture-static')!, anchor = getFurnitureAnchors(kind).look;
        object.rotation.y = Math.PI / 2; object.position.set(1.25, 0, -.75); object.updateMatrixWorld(true); other.updateMatrixWorld(true);
        const matrix = fixed.matrixWorld.clone(), origin = object.matrixWorld.clone();
        const point = object.localToWorld(new THREE.Vector3(anchor.x, anchor.y, anchor.z));
        const state = (group: THREE.Object3D) => {
            const values: { transform: number[]; material: number[] }[] = [];
            group.traverse(part => {
                if (!(part instanceof THREE.Mesh)) return;
                const m = part.material as THREE.MeshStandardMaterial;
                values.push({ transform: part.matrixWorld.elements.slice(), material: [...m.color.toArray(), ...m.emissive.toArray(), m.emissiveIntensity] });
            });
            return values;
        };
        const original = state(object), unaffected = state(other);
        const protectedPart = object.getObjectByName(kind === 'flower' ? 'flower-leaves'
            : kind === 'fountain' ? 'fountain-water' : 'furniture-static')!;
        const protectedState = state(protectedPart);
        for (const species of ['otter', 'rabbit', 'fox'] as const) {
            for (const phase of [0, .25, .44, .6, .85, 1]) {
                applyFurnitureInterest(object, sampleResidentInterest(species, phase, false).life); object.updateMatrixWorld(true);
                expect(fixed.matrixWorld.equals(matrix)).toBe(true); expect(object.matrixWorld.equals(origin)).toBe(true);
                expect(object.localToWorld(new THREE.Vector3(anchor.x, anchor.y, anchor.z)).distanceTo(point)).toBe(0);
                expect(state(other)).toEqual(unaffected);
                expect(state(protectedPart), 'An ordinary response preserves every leaf or jet/droplet mesh').toEqual(protectedState);
                if (phase === .6) expect(state(object)).not.toEqual(original);
            }
            expect(state(object)).toEqual(original);
            applyFurnitureInterest(object, sampleResidentInterest(species, 0, true).life, true);
            object.updateMatrixWorld(true); expect(state(object)).not.toEqual(original); expect(state(other)).toEqual(unaffected);
            expect(state(protectedPart)).toEqual(protectedState);
            applyFurnitureInterest(object, 0); object.updateMatrixWorld(true); expect(state(object)).toEqual(original);
        }
        disposeGeometry(object); disposeGeometry(other); materials.dispose();
    });
});
