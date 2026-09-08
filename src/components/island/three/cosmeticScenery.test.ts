import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { IslandAccentId, IslandCosmetics, IslandThemeId } from '../../../domain/island/customization';
import { createIsland, getIslandLands, ISLAND_ITEMS, isValidIslandPlacement } from '../../../domain/island/catalog';
import { RESIDENT_FOOTPRINT, residentPointIsClear } from './navigation';
import type { IslandItemKind } from './types';
import { IslandCosmeticScenery, sameIslandCosmetics } from './cosmeticScenery';
import { IslandMaterials, disposeGeometry } from './primitives';
import { getTreeLightAnchor, makeScenery, makeStarTree } from './scenery';
import { IslandResident } from './animals';
import { IslandScene } from './runtime';
import type { IslandStageState } from './types';

const themes: IslandThemeId[] = ['moon-garden', 'starry', 'candy', 'crystal'];
const accents: (IslandAccentId | null)[] = [null, 'star-lanterns', 'candy-flags', 'crystal-charms'];
function meshes(object: THREE.Object3D) {
    const result: THREE.Mesh[] = [];
    object.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); });
    return result;
}
function shape(object: THREE.Object3D) {
    object.updateMatrixWorld(true);
    return meshes(object).map(child => ({ matrix: child.matrixWorld.toArray(),
        positions: Array.from(child.geometry.getAttribute('position').array),
        colors: child.geometry.getAttribute('color') ? Array.from(child.geometry.getAttribute('color').array) : null }));
}
function stage(grown = false): IslandStageState {
    const island = createIsland('cosmetics-rendering', 1);
    return { ...island, pulse: 0, learning: false, completedSets: grown ? 24 : 0,
        growth: { ...island.growth!, expansionLevel: grown ? 2 : 0,
            progress: { garden: grown ? 6 : 0, waterside: grown ? 6 : 0, grove: grown ? 6 : 0, village: grown ? 6 : 0 } } };
}

describe('owned cosmetic scenery', () => {
    it('leaves the default scene geometry and rooted tree exactly as authored', () => {
        const world = new IslandCosmeticScenery(), materials = new IslandMaterials('moon-garden');
        const scenery = makeScenery(materials), tree = makeStarTree(materials);
        try {
            expect(shape(world.scenery)).toEqual(shape(scenery));
            expect(shape(world.tree)).toEqual(shape(tree));
            expect(world.environment.children).toHaveLength(0);
            expect(world.accents.children).toHaveLength(0);
            expect(sameIslandCosmetics(undefined, { themeId: 'moon-garden', accentId: null })).toBe(true);
            expect(sameIslandCosmetics({ themeId: 'starry', accentId: null }, { themeId: 'starry', accentId: 'candy-flags' })).toBe(false);
        } finally { world.dispose(); disposeGeometry(scenery); disposeGeometry(tree); materials.dispose(); }
    });

    it('changes real canopy silhouettes and house geometry, beyond recoloring', () => {
        const counts = new Set<string>(), houseCounts = new Set<number>();
        const colors = new Set<string>();
        for (const themeId of themes) {
            const world = new IslandCosmeticScenery({ themeId, accentId: null });
            try {
                counts.add(JSON.stringify(meshes(world.tree.getObjectByName('tree-canopy')!).map(child => child.geometry.getAttribute('position').count)));
                houseCounts.add(meshes(world.scenery).reduce((sum, child) => sum + child.geometry.getAttribute('position').count, 0));
                colors.add(['#76cdd3', '#72ab50', '#c24f3e', '#4e8843'].map(color => world.materials.color(color)).join(':'));
            } finally { world.dispose(); }
        }
        expect(counts.size).toBe(4); expect(houseCounts.size).toBe(4); expect(colors.size).toBe(4);
    });

    it.each(themes)('%s preserves true ground, light anchors and growth through every accent', themeId => {
        const state = stage(true), before = JSON.stringify(state);
        const anchor = new THREE.Vector3(.025, 1.05, .281);
        for (const accentId of accents) {
            const world = new IslandCosmeticScenery({ themeId, accentId });
            try {
                expect(world.updateGrowth(state)).toBe(true);
                expect(world.updateGrowth(state)).toBe(false);
                expect(getTreeLightAnchor(world.tree)).toEqual(anchor);
                expect(world.tree.position.toArray()).toEqual([1.6, 0, -1.6]);
                expect(world.expansion.visible && world.westExpansion.visible).toBe(true);
                world.group.updateMatrixWorld(true);
                for (const [x, z] of [[0, 0], [3, 1], [1, 2]]) {
                    const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0));
                    expect(ray.intersectObject(world.scenery, true)[0].point.y).toBeCloseTo(0, 5);
                }
                // Decoration is actually present, but below no additional ground-space obstacle.
                expect(world.accents.children.length > 0).toBe(Boolean(accentId));
                if (accentId) expect(new THREE.Box3().setFromObject(world.accents).min.y).toBeGreaterThan(.95);
            } finally { world.dispose(); }
        }
        expect(JSON.stringify(state)).toBe(before);
    });

    it('keeps crystal shore silhouettes clear of all land, bridge, resident and furniture footprints after expansion', () => {
        const world = new IslandCosmeticScenery({ themeId: 'crystal', accentId: null });
        try {
            world.environment.updateMatrixWorld(true);
            const triangles: THREE.Triangle[] = [];
            for (const object of meshes(world.environment)) {
                const positions = object.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    if (p.y < 0) continue;
                    for (const land of getIslandLands({ expansionLevel: 2 })) {
                        expect(((p.x - land.x) / land.radiusX) ** 2 + ((p.z - land.z) / land.radiusZ) ** 2).toBeGreaterThan(1);
                    }
                }
                const indices = object.geometry.index;
                for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
                    const points = [0, 1, 2].map(offset => new THREE.Vector3()
                        .fromBufferAttribute(positions, indices?.getX(i + offset) ?? i + offset).applyMatrix4(object.matrixWorld));
                    if (points.every(point => point.y < 0)) continue;
                    points.forEach(point => { point.y = 0; });
                    triangles.push(new THREE.Triangle(points[0], points[1], points[2]));
                }
            }
            const centers = [{ x: -5.1, z: 1.5 }, { x: -5, z: 1.5 }];
            for (let ix = -42; ix <= 42; ix++) for (let iz = -14; iz <= 14; iz++) centers.push({ x: ix / 4, z: iz / 4 });
            const point = new THREE.Vector3(), closest = new THREE.Vector3();
            const clearance = (center: { x: number; z: number }) => {
                point.set(center.x, 0, center.z);
                return Math.min(...triangles.map(triangle => {
                    if (triangle.getArea() > 1e-10) return triangle.closestPointToPoint(point, closest).distanceTo(point);
                    // A vertical face projects to a line, so retain that actual
                    // boundary without feeding a degenerate triangle to Three.
                    return Math.min(...[[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]].map(([a, b]) => {
                        const edge = new THREE.Line3(a, b);
                        return edge.distanceSq() === 0 ? point.distanceTo(a) : edge.closestPointToPoint(point, true, closest).distanceTo(point);
                    }));
                }));
            };
            for (const expansionLevel of [0, 1, 2] as const) {
                const island = createIsland(`clearance-${expansionLevel}`, 1);
                island.growth!.expansionLevel = expansionLevel;
                let residentMinimum = Infinity;
                const furnitureMinimum = new Map<IslandItemKind, number>();
                for (const center of centers) {
                    const distance = clearance(center);
                    if (residentPointIsClear(center, { expansionLevel }, [])) residentMinimum = Math.min(residentMinimum, distance);
                    for (const kind of Object.keys(ISLAND_ITEMS) as IslandItemKind[]) {
                        island.items = [{ id: 'probe', kind, rotation: 0 }];
                        if (isValidIslandPlacement(island, 'probe', center)) furnitureMinimum.set(kind,
                            Math.min(furnitureMinimum.get(kind) ?? Infinity, distance - ISLAND_ITEMS[kind].radius));
                    }
                }
                expect(residentMinimum, `resident footprint at land ${expansionLevel}`).toBeGreaterThan(RESIDENT_FOOTPRINT);
                expect(furnitureMinimum.size).toBe(6);
                expect(Math.min(...furnitureMinimum.values()), `all furniture footprints at land ${expansionLevel}`).toBeGreaterThan(0);
            }
        } finally { world.dispose(); }
    });

    it('disposes each owned geometry, material and texture once without touching resident materials', () => {
        const residents = new IslandMaterials('moon-garden'), resident = new IslandResident('otter', residents, [.1, 0, 1.6], () => undefined);
        const residentMaterials = new Set(meshes(resident.group).flatMap(child => Array.isArray(child.material) ? child.material : [child.material]));
        let residentDisposals = 0;
        residentMaterials.forEach(material => material.addEventListener('dispose', () => residentDisposals++));
        try {
            for (const themeId of [...themes, ...themes]) {
                const world = new IslandCosmeticScenery({ themeId, accentId: 'crystal-charms' });
                world.updateGrowth(stage(true));
                const geometry = new Set(meshes(world.group).map(child => child.geometry));
                const materials = new Set(meshes(world.group).flatMap(child => Array.isArray(child.material) ? child.material : [child.material]));
                const textures = new Set([...materials].flatMap(material => material instanceof THREE.MeshStandardMaterial && material.map ? [material.map] : []));
                const observed = [...geometry, ...materials, ...textures].map(resource => {
                    const counter = { value: 0 }; resource.addEventListener('dispose', () => counter.value++); return counter;
                });
                world.dispose(); world.dispose();
                expect(observed.every(counter => counter.value === 1)).toBe(true);
                expect(residentDisposals).toBe(0);
                expect(resident.group.position.toArray()).toEqual([.1, 0, 1.6]);
            }
        } finally { disposeGeometry(resident.group); residents.dispose(); }
    });

    it.each(themes.flatMap(themeId => [false, true].map(grown => ({ themeId, grown }))))(
        'fits $themeId theme at grown=$grown in the same home camera on phone and tablet', ({ themeId, grown }) => {
        const cosmetics: IslandCosmetics = { themeId, accentId: 'star-lanterns' };
        const world = new IslandCosmeticScenery(cosmetics), state = stage(grown);
        world.updateGrowth(state);
        try {
            for (const [width, height] of [[390, 380], [768, 470]]) {
                const camera = new THREE.OrthographicCamera(-7, 7, 5, -5, .1, 100);
                const runtime = Object.create(IslandScene.prototype) as { resize(): void };
                Object.assign(runtime, { camera, host: { clientWidth: width, clientHeight: height },
                    renderer: { setSize: () => undefined }, expansion: world.expansion, westExpansion: world.westExpansion,
                    state, items: new Map(), requestFrame: () => undefined });
                runtime.resize();
                world.group.updateMatrixWorld(true);
                for (const group of [world.scenery, world.tree, world.environment, world.accents, world.growth]) {
                    let maximum = 0;
                    group.traverseVisible(child => {
                        if (!(child instanceof THREE.Mesh)) return;
                        const positions = child.geometry.getAttribute('position');
                        for (let i = 0; i < positions.count; i++) {
                            const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld).project(camera);
                            maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
                        }
                    });
                    expect(maximum, `${themeId}:${group.name}:${width}`).toBeLessThan(1);
                }
            }
        } finally { world.dispose(); }
    });
});
