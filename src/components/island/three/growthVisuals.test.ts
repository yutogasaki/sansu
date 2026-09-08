import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ISLAND_ITEMS, ISLAND_RESERVED_AREAS } from '../../../domain/island/catalog';
import { applyFurnitureLife, applyFurnitureUse, getFurnitureAnchors, makeFurniture } from './furniture';
import { applyFurnitureGrowth, applySceneryGrowth, growthAppearance, IslandNatureVisuals } from './growthVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { applyTreeGrowth, getTreeLightAnchor, makeStarTree } from './scenery';
import type { IslandItemKind, IslandStageItem, IslandStageState } from './types';

function radius(group: THREE.Group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert(), point = new THREE.Vector3();
    let maximum = 0;
    group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const vertices = object.geometry.getAttribute('position'), matrix = inverse.clone().multiply(object.matrixWorld);
        for (let i = 0; i < vertices.count; i++) {
            point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
            maximum = Math.max(maximum, Math.hypot(point.x, point.z));
        }
    });
    return maximum;
}

describe('same-place growth geometry', () => {
    it.each(Object.keys(ISLAND_ITEMS) as IslandItemKind[])('retains %s footprint and real seat support at all four appearances', kind => {
        const materials = new IslandMaterials(), model = makeFurniture(kind, materials);
        const item: IslandStageItem = { id: 'grown', kind, position: { x: 2, z: 1 }, rotation: .7, growthLevel: 3 };
        model.position.set(2, 0, 1); model.rotation.y = .7;
        for (let appearanceLevel = 0; appearanceLevel <= 3; appearanceLevel++) {
            applyFurnitureGrowth(model, { ...item, appearanceLevel }, materials, 6);
            for (const phase of [0, .375, .625, 1]) {
                applyFurnitureLife(model, 1.3); applyFurnitureUse(model, phase);
                expect(radius(model)).toBeLessThanOrEqual(ISLAND_ITEMS[kind].radius + .00001);
            }
            applyFurnitureLife(model, 0); applyFurnitureUse(model, 0);
            expect(model.position.toArray()).toEqual([2, 0, 1]);
            expect(model.rotation.y).toBe(.7);
            const seat = getFurnitureAnchors(kind).seat;
            if (seat) {
                model.updateWorldMatrix(true, true);
                const point = model.localToWorld(new THREE.Vector3(seat.x, seat.y, seat.z));
                const ray = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, .025, 0)), new THREE.Vector3(0, -1, 0), 0, .05);
                expect(ray.intersectObject(model, true)[0].point.distanceTo(point)).toBeLessThan(.00001);
            }
        }
        disposeGeometry(model); materials.dispose();
    });

    it('does not rebuild unchanged stages or rewrite earned ability when choosing buds again', () => {
        const materials = new IslandMaterials(), flower = makeFurniture('flower', materials);
        const item: IslandStageItem = { id: 'flower', kind: 'flower', rotation: 0, growthLevel: 3, appearanceLevel: 0 };
        expect(growthAppearance(item)).toBe(0);
        expect(applyFurnitureGrowth(flower, item, materials)).toBe(true);
        const detail = flower.getObjectByName('growth-details');
        expect(applyFurnitureGrowth(flower, item, materials)).toBe(false);
        expect(flower.getObjectByName('growth-details')).toBe(detail);
        expect(flower.getObjectByName('flower-blooms')?.visible).toBe(false);
        expect(item.growthLevel).toBe(3);
        applyFurnitureGrowth(flower, { ...item, appearanceLevel: undefined }, materials);
        expect(flower.getObjectByName('flower-blooms')?.visible).toBe(false);
        expect(flower.getObjectByName('growth-blooms')?.visible).toBe(true);
        disposeGeometry(flower); materials.dispose();
    });

    it('changes the real tree silhouette while preserving rooted structure and its exact light anchor', () => {
        const materials = new IslandMaterials(), tree = makeStarTree(materials);
        tree.updateMatrixWorld(true);
        const root = tree.position.clone(), anchor = getTreeLightAnchor(tree), structure = tree.getObjectByName('tree-structure')!;
        const structureBounds = new THREE.Box3().setFromObject(structure);
        const widths: number[] = [], heights: number[] = [];
        for (let level = 0; level <= 3; level++) {
            applyTreeGrowth(tree, level); tree.updateMatrixWorld(true);
            const bounds = new THREE.Box3().setFromObject(tree.getObjectByName('tree-canopy')!);
            widths.push(bounds.max.x - bounds.min.x); heights.push(new THREE.Box3().setFromObject(tree).max.y);
            expect(new THREE.Box3().setFromObject(structure).equals(structureBounds)).toBe(true);
            expect(tree.position.equals(root)).toBe(true); expect(getTreeLightAnchor(tree).equals(anchor)).toBe(true);
        }
        expect(widths[3] / widths[0]).toBeGreaterThan(2.2);
        expect(heights[3] / heights[0]).toBeGreaterThan(1.3);
        expect(widths.every((width, i) => i === 0 || width > widths[i - 1])).toBe(true);
        applyTreeGrowth(tree); expect(tree.getObjectByName('tree-canopy')!.scale.toArray()).toEqual([1, 1, 1]);
        disposeGeometry(tree); materials.dispose();
    });

    it('grows one rooted flower into a substantially taller and broader bloom, with a living response', () => {
        const materials = new IslandMaterials(), flower = makeFurniture('flower', materials);
        const heights: number[] = [], widths: number[] = [];
        for (const level of [1, 2, 3]) {
            applyFurnitureGrowth(flower, { id: 'flower', kind: 'flower', rotation: 0, growthLevel: level }, materials);
            const bloom = flower.getObjectByName('growth-blooms')!;
            const bounds = new THREE.Box3().setFromObject(bloom);
            heights.push(bounds.max.y); widths.push(bounds.max.x - bounds.min.x);
            applyFurnitureLife(flower, 1); expect(bloom.scale.x).toBeGreaterThan(1);
            applyFurnitureLife(flower, 0); expect(bloom.scale.toArray()).toEqual([1, 1, 1]);
        }
        expect(heights[2] / heights[0]).toBeGreaterThan(1.8);
        expect(widths[2] / widths[0]).toBeGreaterThan(1.7);
        // Maturity must fill a substantial vertical area with flowers: one
        // enlarged head above an otherwise bare stem cannot satisfy this.
        const matureFlowers = new THREE.Box3().setFromObject(flower.getObjectByName('growth-blooms')!);
        expect(matureFlowers.max.y - matureFlowers.min.y).toBeGreaterThan(.85);
        expect(matureFlowers.max.x - matureFlowers.min.x).toBeGreaterThan(.55);
        disposeGeometry(flower); materials.dispose();
    });

    it.each([
        ['bench', 1.65], ['swing', 2.3], ['fountain', 1.7],
    ] as const)('gives mature %s a substantial upper silhouette and keeps the seated space open', (kind, minimumHeight) => {
        const materials = new IslandMaterials(), furniture = makeFurniture(kind, materials);
        const item: IslandStageItem = { id: kind, kind, rotation: 0, growthLevel: 3 };
        applyFurnitureGrowth(furniture, { ...item, appearanceLevel: 0 }, materials);
        const before = new THREE.Box3().setFromObject(furniture);
        applyFurnitureGrowth(furniture, item, materials);
        const mature = new THREE.Box3().setFromObject(furniture);
        expect(mature.max.y).toBeGreaterThan(minimumHeight);
        expect(mature.max.y - before.max.y).toBeGreaterThan(.6);
        const seat = getFurnitureAnchors(kind).seat;
        if (seat) {
            // New flowers and overhead arches must not fill the actor's central
            // seated space, even though they change the furniture's outline.
            const start = new THREE.Vector3(seat.x, seat.y + .05, seat.z);
            const ray = new THREE.Raycaster(start, new THREE.Vector3(0, 1, 0), 0, .85);
            expect(ray.intersectObject(furniture.getObjectByName('growth-details')!, true)).toHaveLength(0);
        }
        applyFurnitureGrowth(furniture, { ...item, appearanceLevel: 0 }, materials);
        expect(new THREE.Box3().setFromObject(furniture).equals(before)).toBe(true);
        disposeGeometry(furniture); materials.dispose();
    });

    it('adds earned intermediate buds and preserves legacy geometry', () => {
        const materials = new IslandMaterials(), flower = makeFurniture('flower', materials);
        const item: IslandStageItem = { id: 'flower', kind: 'flower', rotation: 0 };
        applyFurnitureGrowth(flower, item, materials, 2);
        expect(flower.getObjectByName('growth-details')).toBeUndefined();
        applyFurnitureGrowth(flower, { ...item, growthLevel: 1 }, materials, 1);
        const before = flower.getObjectByName('growth-details')!;
        applyFurnitureGrowth(flower, { ...item, growthLevel: 1 }, materials, 2);
        expect(flower.getObjectByName('growth-details')).not.toBe(before);
        expect(flower.userData.growthVisualKey).toBe('1:1');
        disposeGeometry(flower); materials.dispose();
    });

    it('restores distinct fixed tree, west grove and house appearances from saved growth', () => {
        const materials = new IslandMaterials(), scenery = new THREE.Group();
        const state: IslandStageState = { items: [], completedSets: 24, pulse: 0, learning: false,
            growth: { version: 1, progress: { garden: 6, waterside: 6, grove: 6, village: 6 }, focus: 'village', memories: [], discoveries: [] } };
        applySceneryGrowth(scenery, state, materials);
        expect(scenery.getObjectByName('grown-west-tree')?.position.x).toBe(-6.7);
        const count = scenery.getObjectByName('grown-house')!.children.length;
        expect(count).toBeGreaterThan(0);
        applySceneryGrowth(scenery, { ...state, items: [{ id: 'home', kind: 'lantern', rotation: 0, habitatId: 'village', growthLevel: 3, appearanceLevel: 0 }] }, materials);
        expect(scenery.getObjectByName('grown-house')!.children.length).toBe(0);
        disposeGeometry(scenery); materials.dispose();
    });

    it('reveals western growth only with earned land and still restores legacy western memories', () => {
        const materials = new IslandMaterials(), scenery = new THREE.Group();
        const state: IslandStageState = { items: [], completedSets: 24, pulse: 0, learning: false,
            growth: { version: 1, expansionLevel: 0, progress: { garden: 6, waterside: 6, grove: 6, village: 6 },
                focus: 'village', memories: [], discoveries: [] } };
        for (const expansionLevel of [0, 1, 2, undefined] as const) {
            applySceneryGrowth(scenery, { ...state, growth: { ...state.growth!, expansionLevel } }, materials);
            expect(Boolean(scenery.getObjectByName('grown-west-tree'))).toBe(expansionLevel === 2 || expansionLevel === undefined);
            expect(scenery.getObjectByName('grown-tree')?.position.toArray()).toEqual([1.6, 0, -1.6]);
            expect(scenery.getObjectByName('grown-house')?.position.toArray()).toEqual([-2.6, 0, -1.65]);
        }
        disposeGeometry(scenery); materials.dispose();
    });

    it('keeps every low house-growth vertex inside the existing reserved ground at each stage', () => {
        const materials = new IslandMaterials(), scenery = new THREE.Group();
        const reserve = ISLAND_RESERVED_AREAS.find(area => area.x === -2.6 && area.z === -1.65)!;
        const state: IslandStageState = { items: [], completedSets: 24, pulse: 0, learning: false,
            growth: { version: 1, progress: { garden: 6, waterside: 6, grove: 6, village: 1 }, focus: 'village', memories: [], discoveries: [] } };
        for (const progress of [1, 3, 6]) {
            state.growth!.progress.village = progress;
            applySceneryGrowth(scenery, state, materials);
            const house = scenery.getObjectByName('grown-house')!;
            house.updateWorldMatrix(true, true);
            const inverse = house.matrixWorld.clone().invert(), point = new THREE.Vector3();
            let groundVertices = 0;
            house.traverse(object => {
                if (!(object instanceof THREE.Mesh)) return;
                const vertices = object.geometry.getAttribute('position'), matrix = inverse.clone().multiply(object.matrixWorld);
                for (let i = 0; i < vertices.count; i++) {
                    point.fromBufferAttribute(vertices, i).applyMatrix4(matrix);
                    if (point.y > .12) continue;
                    groundVertices++;
                    expect(Math.hypot(point.x, point.z)).toBeLessThanOrEqual(reserve.radius + .00001);
                }
            });
            expect(groundVertices).toBeGreaterThan(0);
        }
        disposeGeometry(scenery); materials.dispose();
    });

    it('leaves the original patchwork roof exposed and attaches only a bright dormer above it', () => {
        const materials = new IslandMaterials(), scenery = new THREE.Group();
        const state: IslandStageState = { items: [], completedSets: 24, pulse: 0, learning: false,
            growth: { version: 1, progress: { garden: 6, waterside: 6, grove: 6, village: 6 }, focus: 'village', memories: [], discoveries: [] } };
        applySceneryGrowth(scenery, state, materials);
        const house = scenery.getObjectByName('grown-house')!;
        house.updateWorldMatrix(true, true);
        const matureBounds = new THREE.Box3().setFromObject(house);
        expect(matureBounds.max.y).toBeGreaterThan(3);
        expect(matureBounds.max.x - matureBounds.min.x).toBeGreaterThan(2.1);
        // Growth must not cover the large original roof planes with a new skin.
        for (const x of [-.65, .8]) {
            const start = house.localToWorld(new THREE.Vector3(x, 3.5, -.4));
            expect(new THREE.Raycaster(start, new THREE.Vector3(0, -1, 0), 0, 3).intersectObject(house, true)).toHaveLength(0);
        }
        // The dormer still has two physical roof planes, in the house's bright palette.
        const pink = materials.get('#f39482').color, yellow = materials.get('#dc7c62').color;
        for (const [x, expectedColor] of [[.22, pink], [.6, yellow]] as const) {
            const start = house.localToWorld(new THREE.Vector3(x, 3.5, .65));
            const hit = new THREE.Raycaster(start, new THREE.Vector3(0, -1, 0), 0, 3).intersectObject(house, true)[0];
            expect(hit).toBeDefined();
            expect(house.worldToLocal(hit.point.clone()).y).toBeGreaterThan(2.4);
            const object = hit.object as THREE.Mesh, colors = object.geometry.getAttribute('color');
            const actual = new THREE.Color().fromBufferAttribute(colors, hit.face!.a);
            expect(actual.r).toBeCloseTo(expectedColor.r); expect(actual.g).toBeCloseTo(expectedColor.g); expect(actual.b).toBeCloseTo(expectedColor.b);
        }
        disposeGeometry(scenery); materials.dispose();
    });

    it('gives reduced motion the same visible butterfly and leaf boat, without moving the source', () => {
        const materials = new IslandMaterials(), nature = new IslandNatureVisuals(materials), source = new THREE.Group();
        source.position.set(6.9, 0, .15); source.rotation.y = 1.2;
        for (const kind of ['butterfly', 'boat'] as const) {
            expect(nature.update(kind, source, 0, true)).toBe(false);
            expect(nature.group.visible).toBe(true);
            expect(nature.group.children.filter(child => child.visible)).toHaveLength(1);
            expect(source.position.toArray()).toEqual([6.9, 0, .15]);
        }
        nature.clear(); expect(nature.group.visible).toBe(false);
        nature.dispose(); materials.dispose();
    });
});
