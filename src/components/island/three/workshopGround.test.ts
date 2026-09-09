import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { workshopSandHeight } from './workshopGround';
import { IslandWorkshopScene } from './workshopScene';

describe('the actual triangulated workshop sand', () => {
    it('matches the final batched sand triangles across the west lane and rejects the old entry', () => {
        const workshop = new IslandWorkshopScene({}), ground = workshop.visuals.build.children[0];
        ground.updateWorldMatrix(true, true);
        const sand = new THREE.Color('#f2d89a'), color = new THREE.Color();
        let supported = 0, outside = 0;
        for (let x = -4.2; x <= -2.4; x += .15) for (let z = -.5; z <= 2.8; z += .15) {
            const actual = new THREE.Raycaster(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0))
                .intersectObject(ground, true).find(hit => {
                    const mesh = hit.object as THREE.Mesh, colors = mesh.geometry.attributes.color;
                    color.fromBufferAttribute(colors, hit.face!.a);
                    return Math.abs(color.r - sand.r) + Math.abs(color.g - sand.g) + Math.abs(color.b - sand.b) < 1e-6;
                });
            const y = workshopSandHeight(x, z);
            if (actual) { expect(y).toBeCloseTo(actual.point.y, 7); supported++; }
            else { expect(y).toBeUndefined(); outside++; }
        }
        expect(supported).toBeGreaterThan(150); expect(outside).toBeGreaterThan(20);
        expect(workshopSandHeight(-3.05, 2.68)).toBeUndefined();
        expect(workshopSandHeight(-3.05, .58)).toBeLessThan(-.03);
        workshop.dispose();
    });
});
