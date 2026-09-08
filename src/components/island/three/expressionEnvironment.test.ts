import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ISLAND_DAY_PERIODS, ISLAND_SEASONS } from '../../../domain/island/expression';
import { createIsland } from '../../../domain/island/catalog';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { IslandExpressionEnvironment } from './expressionEnvironment';
import { getTreeLightAnchor } from './scenery';
import type { IslandStageState } from './types';

function fixture() {
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight('#fff1d1', 2.6), hemisphere = new THREE.HemisphereLight('#f4fbef', '#b7b184', 1.7);
    const background = new THREE.Color('#254fa9'); scene.background = background; sun.position.set(-3, 9, 7); sun.castShadow = true;
    scene.add(sun, hemisphere);
    const effect = new IslandExpressionEnvironment(scene, sun, hemisphere);
    return { scene, sun, hemisphere, background, effect };
}
function meshes(root: THREE.Object3D) {
    const found: THREE.Mesh[] = []; root.traverse(object => { if (object instanceof THREE.Mesh) found.push(object); }); return found;
}
function stage(grown = false): IslandStageState {
    const island = createIsland('expression-renderer', 1);
    return { ...island, pulse: 0, learning: false, completedSets: grown ? 24 : 0,
        growth: { ...island.growth!, expansionLevel: grown ? 2 : 0,
            progress: { garden: grown ? 6 : 0, waterside: grown ? 6 : 0, grove: grown ? 6 : 0, village: grown ? 6 : 0 } } };
}
const periods = [null, ...ISLAND_DAY_PERIODS] as const, seasons = [null, ...ISLAND_SEASONS] as const;

describe('reversible expression environment on the existing world', () => {
    it.each(['moon-garden', 'starry', 'candy', 'crystal'] as const)('%s preserves geometry, growth, ground hits and all original material references through every period/season', themeId => {
        const { scene, sun, hemisphere, effect } = fixture(), world = new IslandCosmeticScenery({ themeId, accentId: null });
        const state = stage(true), savedState = JSON.stringify(state); world.updateGrowth(state); scene.add(world.group);
        const targets = { background: world.background, ground: world.partObjects('ground'), vegetation: world.partObjects('tree') };
        effect.update(undefined, targets); const baseline = effect.describe();
        world.group.updateMatrixWorld(true);
        const originals = meshes(world.group).map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material,
            matrix: mesh.matrixWorld.clone(), positions: mesh.geometry.getAttribute('position').array.slice() }));
        const anchor = getTreeLightAnchor(world.tree), shadow = sun.shadow, target = sun.target, distinctions = new Set<string>();
        const treeScale = world.tree.getObjectByName('tree-canopy')!.scale.clone();
        const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
        const groundHit = ray.intersectObject(world.scenery, true)[0].point.clone();
        try {
            for (const period of periods) for (const season of seasons) {
                effect.update({ period, season }, targets);
                const actual = effect.describe();
                distinctions.add(JSON.stringify([actual.background, actual.sun, actual.surfaces.map(surface => surface.colors)]));
                expect(actual.materialCount > 0).toBe(season !== null);
                expect(sun.shadow).toBe(shadow); expect(sun.target).toBe(target); expect(sun.castShadow).toBe(true);
                expect(ray.intersectObject(world.scenery, true)[0].point).toEqual(groundHit);
                expect(getTreeLightAnchor(world.tree)).toEqual(anchor); expect(world.tree.getObjectByName('tree-canopy')!.scale).toEqual(treeScale);
                expect(effect.update({ period, season }, targets)).toBe(false);
                effect.update(undefined, targets);
                expect(effect.describe()).toEqual(baseline); expect(scene.background).toBe(targets.background);
                for (const original of originals) expect(original.mesh.material).toBe(original.material);
            }
            expect(distinctions.size).toBe(20);
            world.group.updateMatrixWorld(true);
            for (const original of originals) {
                expect(original.mesh.geometry).toBe(original.geometry); expect(original.mesh.matrixWorld).toEqual(original.matrix);
                expect(original.mesh.geometry.getAttribute('position').array).toEqual(original.positions);
            }
            expect(JSON.stringify(state)).toBe(savedState);
            expect(hemisphere.intensity).toBe(1.7);
        } finally { effect.dispose(); world.dispose(); }
    });

    it('borrows patterned textures/shader functions and leaves shared water, actor and animated emissive sources intact', () => {
        const { effect, background } = fixture();
        const texture = new THREE.DataTexture(new Uint8Array([240, 120, 60, 255]), 1, 1);
        const source = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture, vertexColors: true, roughness: .93 });
        source.userData.islandOwned = true; source.onBeforeCompile = vi.fn(); source.customProgramCacheKey = () => 'borrowed-pattern';
        const glow = new THREE.MeshStandardMaterial({ color: '#ffe093', emissive: '#ffe093', emissiveIntensity: .58 });
        const ground = new THREE.Mesh(new THREE.BoxGeometry(), [source, glow]), water = new THREE.Mesh(ground.geometry, source);
        const actor = new THREE.Mesh(ground.geometry, source), trunk = new THREE.Group(); trunk.name = 'tree-structure';
        const wood = new THREE.Mesh(ground.geometry, source); trunk.add(wood);
        const targets = { background, ground: [ground], vegetation: [trunk] }, originalArray = ground.material;
        const disposeTexture = vi.fn(), disposeSource = vi.fn(); texture.addEventListener('dispose', disposeTexture); source.addEventListener('dispose', disposeSource);
        try {
            effect.update({ period: null, season: 'winter' }, targets);
            const clone = ground.material[0] as THREE.MeshStandardMaterial;
            expect(clone).not.toBe(source); expect(clone.color).not.toEqual(source.color);
            expect(clone.map).toBe(texture); expect(clone.vertexColors).toBe(true); expect(clone.roughness).toBe(.93);
            expect(clone.onBeforeCompile).toBe(source.onBeforeCompile); expect(clone.customProgramCacheKey()).toBe('borrowed-pattern');
            expect(clone.userData.islandOwned).toBe(false); expect(source.userData.islandOwned).toBe(true);
            expect(ground.material[1]).toBe(glow); glow.emissiveIntensity = 1.61;
            expect((ground.material[1] as THREE.MeshStandardMaterial).emissiveIntensity).toBe(1.61);
            expect(water.material).toBe(source); expect(actor.material).toBe(source); expect(wood.material).toBe(source);
            expect(source.color.getHexString()).toBe('ffffff');
            const disposedClone = vi.fn(); clone.addEventListener('dispose', disposedClone);
            effect.restore(); effect.dispose();
            expect(ground.material).toBe(originalArray); expect(disposedClone).toHaveBeenCalledTimes(1);
            expect(disposeTexture).not.toHaveBeenCalled(); expect(disposeSource).not.toHaveBeenCalled();
        } finally { effect.dispose(); ground.geometry.dispose(); source.dispose(); glow.dispose(); texture.dispose(); }
    });

    it('reuses same-selection resources, disposes retired clones once, and restores the newest theme after growth/material regeneration', () => {
        const { scene, sun, effect } = fixture(), world = new IslandCosmeticScenery({ themeId: 'candy', accentId: null }); scene.add(world.group);
        const capture = () => ({ background: world.background, ground: world.partObjects('ground'), vegetation: world.partObjects('tree') });
        const disposed = new Map<THREE.Material, number>(), owned = new Set<THREE.Material>();
        const observe = () => {
            for (const root of [...capture().ground, ...capture().vegetation]) for (const object of meshes(root)) {
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material.name.startsWith('expression-') && !owned.has(material)) {
                    owned.add(material); material.addEventListener('dispose', () => disposed.set(material, (disposed.get(material) ?? 0) + 1));
                }
            }
        };
        try {
            effect.update({ period: 'evening', season: 'autumn' }, capture()); observe(); const count = owned.size;
            for (let i = 0; i < 25; i++) { effect.update({ period: periods[i % 4], season: 'autumn' }, capture()); observe(); }
            expect(owned.size).toBe(count); expect(disposed.size).toBe(0);
            // Runtime must call restore before the world retires/rebuilds its owned materials.
            effect.restore(); expect(disposed.size).toBe(count);
            world.updateAppearance({ themeId: 'starry', accentId: null }); world.updateGrowth(stage(true));
            const newest = capture(), originals = meshes(world.group).map(mesh => [mesh, mesh.material] as const);
            effect.update({ period: 'morning', season: 'spring' }, newest); observe();
            expect(scene.background).not.toEqual(newest.background);
            effect.dispose(); effect.dispose();
            expect(effect.update({ period: 'day', season: 'summer' }, newest)).toBe(false);
            expect(scene.background).toBe(newest.background); expect(sun.position.toArray()).toEqual([-3, 9, 7]);
            expect(disposed.size).toBe(owned.size); expect([...disposed.values()].every(value => value === 1)).toBe(true);
            for (const [mesh, material] of originals) expect(mesh.material).toBe(material);
            expect(effect.describe().materialCount).toBe(0); expect(effect.describe().surfaceCount).toBe(0);
        } finally { effect.dispose(); world.dispose(); }
    });

    it('restores before disposal without touching unrelated scene objects or allocating additional lights', () => {
        const { scene, effect, background } = fixture(), outside = new THREE.Group(); scene.add(outside);
        const children = [...scene.children];
        for (const period of periods) for (const season of seasons) effect.update({ period, season }, { background, ground: [], vegetation: [] });
        expect(scene.children).toEqual(children); effect.dispose(); expect(scene.children).toEqual(children); expect(scene.background).toBe(background);
    });
});
