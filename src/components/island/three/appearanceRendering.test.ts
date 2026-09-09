import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIsland } from '../../../domain/island/catalog';
import { createIslandAppearance, ISLAND_APPEARANCE_SLOT_IDS, islandAppearanceStyleId, type IslandAppearanceSlotId } from '../../../domain/island/appearance';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { applyFurnitureAppearance, furnitureAppearanceMaterials } from './furnitureAppearance';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
import { getTreeLightAnchor } from './scenery';
import { IslandMaterials, disposeGeometry } from './primitives';
import type { IslandStageItem, IslandStageState } from './types';
import { IslandScene } from './runtime';
import { IslandCameraControls } from './islandCameraControls';

function state(): IslandStageState {
    const island = createIsland('appearance-render-test', 1);
    return { ...island, learning: false, pulse: 0, completedSets: 24,
        growth: { ...island.growth!, expansionLevel: 2, progress: { garden: 6, grove: 6, waterside: 6, village: 6 } } };
}
function actualMeshes(objects: readonly THREE.Object3D[]) {
    const result: THREE.Mesh[] = [];
    objects.forEach(group => group.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); }));
    return result;
}
function items() {
    return ['flower', 'mushroom', 'fountain', 'bench', 'swing', 'lantern'].map((kind, index) => ({
        id: `owned-${kind}`, kind, position: { x: index * .8, z: 1 }, rotation: 0, growthLevel: 3,
    } as IslandStageItem));
}
function fixture() {
    const world = new IslandCosmeticScenery(), fixed = new IslandMaterials('moon-garden'), current = state();
    const furniture = items().map(item => ({ item, group: makeFurniture(item.kind, fixed) }));
    const scene = new THREE.Group(); scene.add(world.group, ...furniture.map(entry => entry.group));
    const update = () => {
        world.updateGrowth(current);
        for (const { group, item } of furniture) {
            applyFurnitureAppearance(group, item, world, fixed);
            applyFurnitureGrowth(group, item, furnitureAppearanceMaterials(item, world, fixed), 6);
            group.position.set(item.position!.x, 0, item.position!.z);
        }
        world.setFurnitureObjects(furniture); scene.updateMatrixWorld(true);
    };
    update();
    return { world, fixed, current, furniture, update, dispose() {
        world.dispose(); furniture.forEach(({ group }) => disposeGeometry(group)); fixed.dispose();
    } };
}
const slots = (world: IslandCosmeticScenery) => new Map(world.describeAppearance().slots.map(slot => [slot.slot, slot]));

describe('independently equipped actual island surfaces', () => {
    it('maps the biscuit surface onto unchanged level land and retires its shared texture once', () => {
        const f = fixture();
        const levelMeshes = () => actualMeshes(f.world.partObjects('ground')).filter(mesh => {
            const points = mesh.geometry.getAttribute('position');
            return Array.from({ length: points.count }, (_, i) => points.getY(i)).every(y => Math.abs(y) < 1e-6);
        });
        const before = levelMeshes().map(mesh => Array.from(mesh.geometry.getAttribute('position').array));
        const appearance = structuredClone(f.world.appearance);
        appearance.slots.ground = islandAppearanceStyleId('candy', 'ground');
        try {
            f.world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance }); f.update();
            const ground = levelMeshes();
            expect(ground).toHaveLength(3);
            expect(ground.map(mesh => Array.from(mesh.geometry.getAttribute('position').array))).toEqual(before);
            const textures = new Set(ground.map(mesh => (mesh.material as THREE.MeshStandardMaterial).map));
            expect(textures.size).toBe(1);
            const texture = [...textures][0]!;
            expect(texture).toBeDefined();
            for (const mesh of ground) {
                const positions = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
                expect(uv.count).toBe(positions.count);
                expect(Math.max(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))
                    - Math.min(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))).toBeGreaterThan(4);
            }
            let retired = 0; texture.addEventListener('dispose', () => retired++);
            appearance.slots.ground = islandAppearanceStyleId('moon-garden', 'ground', 'legacy-v1');
            f.world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance }); f.update();
            expect(retired).toBe(1);
            expect(levelMeshes().every(mesh => !(mesh.material as THREE.MeshStandardMaterial).map)).toBe(true);
            f.world.dispose(); expect(retired).toBe(1);
        } finally { f.dispose(); }
    });

    it.each(['starry', 'candy', 'crystal'] as const)('%s changes each actual slot while retaining every other slot and rooted identity', family => {
        const f = fixture(), beforeState = JSON.stringify(f.current);
        const root = f.world.tree, crown = root.getObjectByName('tree-canopy')!, western = f.world.westTree;
        const rootPose = root.matrixWorld.clone(), crownScale = crown.scale.clone(), anchor = getTreeLightAnchor(root);
        const fixedObjects = f.furniture.filter(entry => ['bench', 'swing', 'lantern'].includes(entry.item.kind))
            .flatMap(entry => actualMeshes([entry.group])).map(mesh => [mesh.uuid, mesh.geometry.uuid, (mesh.material as THREE.Material).uuid]);
        try {
            for (const slot of ISLAND_APPEARANCE_SLOT_IDS) {
                const before = slots(f.world), appearance = structuredClone(f.world.appearance);
                appearance.slots[slot] = islandAppearanceStyleId(family, slot);
                expect(f.world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance })).toBe(true);
                f.update(); const after = slots(f.world);
                const a = before.get(slot)!, b = after.get(slot)!;
                expect(b.meshCount, `${family}:${slot} real meshes`).toBeGreaterThan(0);
                expect(b.geometrySignature !== a.geometrySignature || b.materialSignature !== a.materialSignature,
                    `${family}:${slot} must change actual geometry or material`).toBe(true);
                for (const untouched of ISLAND_APPEARANCE_SLOT_IDS.filter(other => other !== slot)) {
                    expect(after.get(untouched), `${slot} must not change ${untouched}`).toEqual(before.get(untouched));
                }
                expect(root.matrixWorld).toEqual(rootPose); expect(crown.scale).toEqual(crownScale);
                expect(f.world.tree).toBe(root); expect(f.world.westTree).toBe(western);
                expect(root.getObjectByName('tree-canopy')).toBe(crown); expect(getTreeLightAnchor(root)).toEqual(anchor);
                expect(f.furniture.filter(entry => ['bench', 'swing', 'lantern'].includes(entry.item.kind))
                    .flatMap(entry => actualMeshes([entry.group])).map(mesh => [mesh.uuid, mesh.geometry.uuid, (mesh.material as THREE.Material).uuid])).toEqual(fixedObjects);
            }
            expect(JSON.stringify(f.current)).toBe(beforeState);
        } finally { f.dispose(); }
    });

    it('resolves the same explicit mix independently of legacy theme history, including accents', () => {
        const appearance = createIslandAppearance('crystal');
        appearance.slots.houseRoof = islandAppearanceStyleId('candy', 'houseRoof');
        appearance.slots.houseWindows = islandAppearanceStyleId('starry', 'houseWindows');
        appearance.slots.water = islandAppearanceStyleId('moon-garden', 'water', 'legacy-v1');
        const a = new IslandCosmeticScenery({ themeId: 'starry', accentId: 'candy-flags', appearance });
        const b = new IslandCosmeticScenery({ themeId: 'candy', accentId: 'candy-flags', appearance });
        try {
            a.updateGrowth(state()); b.updateGrowth(state());
            const fingerprints = (world: IslandCosmeticScenery) => world.describeAppearance().slots.map(slot => ({
                slot: slot.slot, geometry: slot.geometrySignature, material: slot.materialSignature, bounds: slot.bounds }));
            expect(fingerprints(a)).toEqual(fingerprints(b));
            expect(a.background).toEqual(b.background);
        } finally { a.dispose(); b.dispose(); }
    });

    it('keeps actual level ground and both bridge decks through three full looks and old restoration', () => {
        const f = fixture();
        try {
            for (const appearance of [...['starry', 'candy', 'crystal'].map(family => createIslandAppearance(family as 'starry' | 'candy' | 'crystal')),
                createIslandAppearance('moon-garden', 'legacy-v1')]) {
                f.world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance }); f.update();
                for (const [x, z] of [[0, 0], [3, 1], [-.5, 2], [8, 1], [-8, 1]]) {
                    const ray = new THREE.Raycaster(new THREE.Vector3(x, .7, z), new THREE.Vector3(0, -1, 0));
                    const ground = f.world.partObjects('ground');
                    expect(ray.intersectObjects(ground, true)[0]?.point.y, `ground ${x},${z}`).toBeCloseTo(0, 5);
                }
                for (const sign of [-1, 1]) for (const x of [4.03, 4.36, 4.72, 5.08, 5.4]) {
                    const ray = new THREE.Raycaster(new THREE.Vector3(sign * x, 1, 0), new THREE.Vector3(0, -1, 0));
                    const hit = ray.intersectObjects(f.world.partObjects('bridge'), true)[0];
                    expect(hit?.point.y).toBeGreaterThan(.15); expect(hit?.point.y).toBeLessThan(.35);
                    expect(hit?.face?.normal.y).toBeGreaterThan(.99);
                }
            }
        } finally { f.dispose(); }
    });

    it('only retires changed-slot resources and disposes each visible owned resource once', () => {
        const f = fixture();
        const observe = (slot: IslandAppearanceSlotId) => {
            const meshes = actualMeshes(f.world.partObjects(slot));
            const resources = new Set([...meshes.map(mesh => mesh.geometry), ...meshes.flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])]);
            return [...resources].map(resource => { const counter = { value: 0 }; resource.addEventListener('dispose', () => counter.value++); return counter; });
        };
        const tree = observe('tree'), untouched = observe('houseRoof');
        const appearance = structuredClone(f.world.appearance); appearance.slots.tree = islandAppearanceStyleId('crystal', 'tree');
        f.world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance }); f.update();
        expect(tree.every(counter => counter.value === 1)).toBe(true);
        expect(untouched.every(counter => counter.value === 0)).toBe(true);
        f.dispose(); f.world.dispose();
        expect(tree.every(counter => counter.value === 1)).toBe(true);
        expect(untouched.every(counter => counter.value === 1)).toBe(true);
    });

    it('distinguishes hidden expanded bridge meshes from currently visible geometry', () => {
        const world = new IslandCosmeticScenery({ themeId: 'moon-garden', accentId: null, appearance: createIslandAppearance('starry') });
        const current = state(); current.growth!.expansionLevel = 0;
        try {
            world.updateGrowth(current); const before = slots(world).get('bridge')!;
            expect(before.meshCount).toBeGreaterThan(before.visibleMeshCount);
            current.growth!.expansionLevel = 2; world.updateGrowth(current);
            expect(slots(world).get('bridge')!.visibleMeshCount).toBeGreaterThan(before.visibleMeshCount);
        } finally { world.dispose(); }
    });

    it.each(['starry', 'candy', 'crystal'] as const)('%s fits its actual distant silhouettes in the chosen overview at each land stage', family => {
        const world = new IslandCosmeticScenery({ themeId: 'moon-garden', accentId: null, appearance: createIslandAppearance(family) });
        try {
            for (const level of [0, 1, 2] as const) for (const [width, height] of [[390, 338], [768, 410], [390, 380], [768, 470]]) {
                const current = state(); current.growth!.expansionLevel = level; current.districtFocus = 'all'; world.updateGrowth(current);
                const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
                const runtime = Object.create(IslandScene.prototype) as { resize(): void };
                Object.assign(runtime, { camera, host: { clientWidth: width, clientHeight: height },
                    renderer: { setSize: () => undefined, getSize: (size: THREE.Vector2) => size.set(width, height) }, rendererSize: new THREE.Vector2(),
                    world, cameraControls: new IslandCameraControls(() => undefined), expansion: world.expansion, westExpansion: world.westExpansion,
                    state: current, items: new Map(), requestFrame: () => undefined });
                runtime.resize(); world.group.updateMatrixWorld(true);
                for (const object of actualMeshes([world.sky])) {
                    let visible = 0; const positions = object.geometry.getAttribute('position');
                    for (let i = 0; i < positions.count; i++) {
                        const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld).project(camera);
                        if (Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1) visible++;
                    }
                    expect(visible / positions.count, `${family} sky mesh ${width} land${level}`).toBeGreaterThan(.95);
                }
            }
        } finally { world.dispose(); }
    });
});
