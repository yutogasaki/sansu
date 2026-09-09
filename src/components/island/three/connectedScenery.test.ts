import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { getIslandFloorAreas } from '../../../domain/island/landGeometry';
import { IslandCosmeticScenery } from './cosmeticScenery';
import type { IslandStageState } from './types';

function state(level: 0 | 1 | 2): IslandStageState {
    const island = createIsland('connected-shore', 1);
    return { ...island, learning: false, pulse: 0, completedSets: 24,
        growth: { ...island.growth!, expansionLevel: level } };
}
function terrain(world: IslandCosmeticScenery, slot: 'ground' | 'shore' | 'water') {
    return world.scenery.getObjectByName(`island-terrain-${slot}`)!;
}
function meshes(group: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    group.traverse(object => { if (object instanceof THREE.Mesh) result.push(object); });
    return result;
}

describe('one connected island across growth and appearance changes', () => {
    it('replaces only terrain at unlocks, keeping the home, bridges and texture owner alive', () => {
        const world = new IslandCosmeticScenery();
        world.updateGrowth(state(0));
        const house = world.scenery.getObjectByName('island-home-shell');
        const props = [...world.expansion.children, ...world.westExpansion.children];
        const pool = world.partMaterials('ground');
        const texture = pool.surface('#72ab50', .98).bumpMap!;
        let textureDisposals = 0;
        texture.addEventListener('dispose', () => textureDisposals++);
        try {
            for (const level of [1, 2, 0] as const) {
                const previous = ['ground', 'shore', 'water'].flatMap(slot => meshes(terrain(world, slot as 'ground')));
                const retired = [...new Set(previous.map(mesh => mesh.geometry))].map(geometry => {
                    const count = { value: 0 }; geometry.addEventListener('dispose', () => count.value++); return count;
                });
                expect(world.updateGrowth(state(level))).toBe(true);
                expect(retired.every(count => count.value === 1)).toBe(true);
                const current = terrain(world, 'ground');
                expect(world.updateGrowth(state(level))).toBe(false);
                expect(terrain(world, 'ground')).toBe(current);
                expect(world.scenery.getObjectByName('island-home-shell')).toBe(house);
                expect([...world.expansion.children, ...world.westExpansion.children]).toEqual(props);
                expect(world.partMaterials('ground')).toBe(pool);
                expect(textureDisposals).toBe(0);
            }
        } finally { world.dispose(); }
        expect(textureDisposals).toBe(1);
        expect(world.updateGrowth(state(2))).toBe(false);
    });

    it.each([1, 2] as const)('supports all original and connecting floors once at level %s', level => {
        const world = new IslandCosmeticScenery();
        try {
            world.updateGrowth(state(level)); world.group.updateMatrixWorld(true);
            const ground = terrain(world, 'ground');
            for (const area of getIslandFloorAreas(level)) {
                for (let sample = 0; sample < 48; sample++) {
                    const angle = sample / 48 * Math.PI * 2;
                    const x = area.x + Math.cos(angle) * area.radiusX * .995;
                    const z = area.z + Math.sin(angle) * area.radiusZ * .995;
                    const hits = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(ground, true);
                    expect(hits.length, `${x},${z}`).toBeGreaterThan(0);
                    expect(hits.every(hit => Math.abs(hit.point.y) < 1e-6)).toBe(true);
                }
            }
            expect(meshes(ground)).toHaveLength(1);
            expect(meshes(world.expansion).every(mesh => mesh.geometry !== meshes(ground)[0].geometry)).toBe(true);
        } finally { world.dispose(); }
    });
});
