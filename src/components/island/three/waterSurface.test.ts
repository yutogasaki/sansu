import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { islandAppearanceStyleId } from '../../../domain/island/appearance';
import { IslandCosmeticScenery } from './cosmeticScenery';

function surfaces(world: IslandCosmeticScenery) {
    const result: { geometry: THREE.BufferGeometry; material: THREE.MeshBasicMaterial }[] = [];
    for (const group of world.partObjects('water')) group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial
            && child.material.name === 'island-water-surface-v1') result.push({ geometry: child.geometry, material: child.material });
    });
    return result;
}

const colors = (world: IslandCosmeticScenery) => surfaces(world)
    .map(({ geometry }) => Array.from(geometry.getAttribute('color').array));
const positions = (world: IslandCosmeticScenery) => surfaces(world)
    .map(({ geometry }) => Array.from(geometry.getAttribute('position').array));
const observeDisposal = (world: IslandCosmeticScenery) => surfaces(world).map(({ material }) => {
    const count = { value: 0 };
    material.addEventListener('dispose', () => count.value++);
    return count;
});

describe('static ocean and shallow-water resources', () => {
    it('keeps simultaneous theme palettes independent without altering their water geometry or other slots', () => {
        const original = new IslandCosmeticScenery();
        const preview = new IslandCosmeticScenery({ themeId: 'candy', accentId: null });
        try {
            const originalColors = colors(original), originalPositions = positions(original);
            expect(surfaces(original)).toHaveLength(4); // Ocean plus the three existing shore meshes.
            expect(surfaces(preview)).toHaveLength(4);
            expect(colors(preview)).not.toEqual(originalColors);
            expect(positions(preview)).toEqual(originalPositions);
            const retainedGround = preview.partObjects('ground');
            const appearance = structuredClone(preview.appearance);
            appearance.slots.water = islandAppearanceStyleId('crystal', 'water');
            expect(preview.updateAppearance({ themeId: 'candy', accentId: null, appearance })).toBe(true);
            expect(colors(original)).toEqual(originalColors);
            expect(positions(original)).toEqual(originalPositions);
            expect(positions(preview)).toEqual(originalPositions);
            expect(preview.partObjects('ground')).toEqual(retainedGround);
            const originalMaterials = new Set(surfaces(original).map(surface => surface.material));
            expect(surfaces(preview).every(surface => !originalMaterials.has(surface.material))).toBe(true);
        } finally { original.dispose(); preview.dispose(); }
    });

    it('reuses unchanged surfaces and retires each replaced or exited material once, without allocating textures', () => {
        const world = new IslandCosmeticScenery();
        const original = surfaces(world), retired = observeDisposal(world);
        try {
            expect(world.updateAppearance()).toBe(false);
            expect(surfaces(world).map(surface => surface.material)).toEqual(original.map(surface => surface.material));
            expect(retired.every(count => count.value === 0)).toBe(true);
            const appearance = structuredClone(world.appearance);
            appearance.slots.water = islandAppearanceStyleId('starry', 'water');
            const choice = { themeId: 'moon-garden' as const, accentId: null, appearance };
            expect(world.updateAppearance(choice)).toBe(true);
            expect(retired.every(count => count.value === 1)).toBe(true);
            const replacement = surfaces(world), exited = observeDisposal(world);
            expect(replacement).toHaveLength(4);
            for (const { material } of replacement) {
                expect(material.vertexColors).toBe(true);
                expect(material.color.toArray()).toEqual([1, 1, 1]);
                expect(material.opacity).toBe(1);
                expect(material.transparent).toBe(false);
                expect(Object.values(material).some(value => value instanceof THREE.Texture)).toBe(false);
            }
            expect(world.updateAppearance(choice)).toBe(false);
            expect(surfaces(world).map(surface => surface.material)).toEqual(replacement.map(surface => surface.material));
            world.dispose(); world.dispose();
            expect(retired.every(count => count.value === 1)).toBe(true);
            expect(exited.every(count => count.value === 1)).toBe(true);
        } finally { world.dispose(); }
    });
});
