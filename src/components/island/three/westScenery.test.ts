import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandMaterials, disposeGeometry } from './primitives';
import { makeWestExpansion } from './westScenery';

describe('western island scenery', () => {
    it('renders upward-facing land and bridge planks at the western navigation coordinates', () => {
        const materials = new IslandMaterials(), group = makeWestExpansion(materials);
        group.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        for (const [x, z] of [[-6.2, 0], [-6.5, .5], [-5.8, -.5]]) {
            ray.set(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObject(group, true)[0]?.point.y).toBeCloseTo(0, 4);
        }
        for (let index = 0; index <= 8; index++) {
            const x = -(4 + index * .18), top = .19 + Math.sin(index / 8 * Math.PI) * .15;
            ray.set(new THREE.Vector3(x, 1, 0), new THREE.Vector3(0, -1, 0));
            expect(ray.intersectObject(group, true)[0]?.point.y).toBeCloseTo(top, 4);
        }
        disposeGeometry(group); materials.dispose();
    });
});
