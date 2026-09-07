import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { cottageRoofGeometry, islandGroundGeometry, loftGeometry, organicEllipsoidGeometry,
    roundedBoxGeometry, steppingStoneGeometry } from './geometry';
import { IslandMaterials, disposeGeometry } from './primitives';
import { applyTreeLife, getTreeLightAnchor, makeExpansion, makeScenery, makeStarTree } from './scenery';

function inspectGeometry(geometry: THREE.BufferGeometry) {
    for (const attribute of Object.values(geometry.attributes)) {
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) {
        expect(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)), `Normal at ${i}`).toBeCloseTo(1, 4);
    }
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.isEmpty()).toBe(false);
}

describe('island sculpted geometry', () => {
    it('rounds within the requested furniture dimensions, including thin planks', () => {
        for (const size of [[1.8, 1.4, 1.45], [.155, .1, .95], [.025, .3, .48]] as const) {
            const geometry = roundedBoxGeometry(size, .04);
            inspectGeometry(geometry);
            const bounds = geometry.boundingBox!.getSize(new THREE.Vector3());
            bounds.toArray().forEach((value, i) => expect(value).toBeCloseTo(size[i], 5));
            geometry.dispose();
        }
    });

    it('caps continuous root profiles exactly on their contact plane', () => {
        const geometry = loftGeometry([
            { y: 0, radiusX: .26, radiusZ: .24, lobes: 5, lobeStrength: .48 },
            { y: .08, radiusX: .3, lobes: 5, lobeStrength: .38 },
            { y: .6, radiusX: .3 }, { y: 1.8, radiusX: .17, centerX: -.06 },
        ], 32);
        inspectGeometry(geometry);
        expect(geometry.boundingBox!.min.y).toBe(0);
        expect(Math.max(Math.abs(geometry.boundingBox!.min.x), geometry.boundingBox!.max.x)).toBeLessThan(.85);
        const ray = new THREE.Raycaster(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1, 0));
        expect(ray.intersectObject(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))[0]?.point.y).toBeCloseTo(0);
        geometry.dispose();
    });

    it('keeps the full saved placement ellipse at y=0 with upward normals', () => {
        for (const [rx, rz] of [[4.8, 3.6], [1.9, 2.3]]) {
            const geometry = islandGroundGeometry(rx, rz);
            inspectGeometry(geometry);
            expect(geometry.boundingBox!.min.y).toBe(0);
            expect(geometry.boundingBox!.max.y).toBe(0);
            const material = new THREE.MeshBasicMaterial(), land = new THREE.Mesh(geometry, material);
            const ray = new THREE.Raycaster();
            for (let i = 0; i < 360; i++) {
                const angle = i * Math.PI / 180;
                ray.set(new THREE.Vector3(Math.cos(angle) * rx, 2, Math.sin(angle) * rz), new THREE.Vector3(0, -1, 0));
                expect(ray.intersectObject(land)[0]?.point.y, `Missing saved shore at ${i}`).toBeCloseTo(0);
            }
            geometry.dispose(); material.dispose();
        }
    });

    it('has finite, normalized broad crown surfaces and a bounded roof', () => {
        const leaf = organicEllipsoidGeometry([.9, .7, .8], 1.2), roof = cottageRoofGeometry();
        inspectGeometry(leaf); inspectGeometry(roof);
        expect(roof.boundingBox!.min.x).toBeGreaterThan(-1.23);
        expect(roof.boundingBox!.max.x).toBeLessThan(1.23);
        expect(roof.boundingBox!.max.y).toBeLessThan(2.42);
        leaf.dispose(); roof.dispose();
    });

    it('keeps worn stones low enough to share the level walking plane', () => {
        const first = steppingStoneGeometry(.28, 0), second = steppingStoneGeometry(.28, 1.4);
        inspectGeometry(first); inspectGeometry(second);
        expect(first.boundingBox!.min.y).toBeGreaterThanOrEqual(0);
        expect(first.boundingBox!.max.y).toBeLessThan(.03);
        expect(first.attributes.position.array).not.toEqual(second.attributes.position.array);
        first.dispose(); second.dispose();
    });

    it('rejects invalid dimensions before they can reach WebGL', () => {
        expect(() => roundedBoxGeometry([1, 0, 1])).toThrow(RangeError);
        expect(() => organicEllipsoidGeometry([1, 1, 1], NaN)).toThrow(RangeError);
        expect(() => loftGeometry([{ y: 1, radiusX: .2 }, { y: 0, radiusX: .2 }])).toThrow(RangeError);
        expect(() => islandGroundGeometry(Infinity, 1)).toThrow(RangeError);
    });

    it('keeps the tree structure grounded while the actual attached lights respond', () => {
        const materials = new IslandMaterials(), tree = makeStarTree(materials);
        const structure = tree.getObjectByName('tree-structure')!;
        tree.updateMatrixWorld(true);
        const before = structure.matrixWorld.clone(), originalAnchor = getTreeLightAnchor(tree);
        const lit: THREE.MeshStandardMaterial[] = [];
        tree.traverse(object => {
            if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.userData.islandOwned) lit.push(object.material);
        });
        const initialIntensity = lit[0].emissiveIntensity;
        applyTreeLife(tree, .6); tree.updateMatrixWorld(true);
        expect(structure.matrixWorld.equals(before)).toBe(true);
        expect(tree.scale.toArray()).toEqual([1, 1, 1]);
        expect(getTreeLightAnchor(tree)).toEqual(originalAnchor);
        expect(lit[0].emissiveIntensity).toBeGreaterThan(initialIntensity);
        applyTreeLife(tree, .6, true);
        for (const child of tree.children) expect(child.rotation.z).toBe(0);
        const independentAnchor = getTreeLightAnchor(tree); independentAnchor.x = 99;
        expect(getTreeLightAnchor(tree)).toEqual(originalAnchor);
        disposeGeometry(tree); materials.dispose();
    });

    it('keeps the static scenery and tree within a bounded mesh and triangle budget', () => {
        const materials = new IslandMaterials();
        const world = new THREE.Group(); world.add(makeScenery(materials), makeExpansion(materials), makeStarTree(materials));
        let meshes = 0, triangles = 0;
        world.traverse(object => {
            if (!(object instanceof THREE.Mesh)) return;
            meshes++;
            triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
            inspectGeometry(object.geometry);
        });
        expect(meshes).toBeLessThan(110);
        expect(triangles).toBeLessThan(80000);
        disposeGeometry(world); materials.dispose();
    });
});
