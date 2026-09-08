import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createIslandAppearance } from '../../../domain/island/appearance';
import { createIsland } from '../../../domain/island/catalog';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { fitIslandAppearanceCamera } from './appearanceFraming';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { IslandScene } from './runtime';
import type { IslandStageItem, IslandStageState } from './types';

const families = ['moon-garden', 'starry', 'candy', 'crystal'] as const;
const camera = () => new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
const matrices = (view: THREE.Camera) => [...view.matrixWorld.toArray(), ...view.projectionMatrix.toArray()];
function projected(object: THREE.Object3D, view: THREE.Camera) {
    const points: THREE.Vector3[] = []; object.updateWorldMatrix(true, true);
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const attribute = child.geometry.getAttribute('position');
        for (let i = 0; i < attribute.count; i++) points.push(new THREE.Vector3().fromBufferAttribute(attribute, i).applyMatrix4(child.matrixWorld).project(view));
    }); return points;
}
const fits = (points: THREE.Vector3[]) => points.every(p => Math.abs(p.x) < .97 && Math.abs(p.y) < .97 && Math.abs(p.z) < 1);

describe('appearance viewing uses fixed real-target cameras', () => {
    it.each([390 / 354, 768 / 430])('keeps the entire central tree in frame with the same matrix for every style and maturity at aspect %s', aspect => {
        const world = new IslandCosmeticScenery(), view = camera(), island = createIsland('focus', 0);
        let baseline: number[] | undefined;
        try {
            for (const family of families) for (const version of ['legacy-v1', 'parts-v1'] as const) for (const level of [0, 3]) {
                world.updateAppearance({ themeId: family, accentId: null, appearance: createIslandAppearance(family, version) });
                world.updateGrowth({ ...island, items: [], learning: false, pulse: 0,
                    growth: { ...island.growth!, progress: { ...island.growth!.progress, grove: level === 3 ? 6 : 0 } } });
                expect(fitIslandAppearanceCamera(view, 'tree', [], 0, aspect)).toEqual({ requested: 'tree', actual: 'tree', targetIds: ['main-tree'] });
                baseline ??= matrices(view); expect(matrices(view)).toEqual(baseline);
                expect(fits(projected(world.tree, view)), `${family}/${version}/level${level}`).toBe(true);
            }
        } finally { world.dispose(); }
    });
    it('wall, roof and window use one fixed house view without hiding a resident, furniture or display', () => {
        const world = new IslandCosmeticScenery(), view = camera(), island = createIsland('focus-house', 0);
        const actualDisplay = new THREE.Group(), resident = new THREE.Group(), placed = new THREE.Group();
        const scene = new THREE.Scene(); scene.add(world.group, actualDisplay, resident, placed);
        const identities = scene.children.map(child => [child.uuid, child.visible, child.position.toArray()]);
        let baseline: number[] | undefined;
        try {
            for (const family of families) {
                world.updateAppearance({ themeId: family, accentId: null, appearance: createIslandAppearance(family) });
                world.updateGrowth({ ...island, items: [], learning: false, pulse: 0,
                    growth: { ...island.growth!, progress: { ...island.growth!.progress, village: 6 } } });
                for (const slot of ['houseBody', 'houseRoof', 'houseWindows'] as const) {
                    fitIslandAppearanceCamera(view, slot, [], 0, 390 / 354);
                    baseline ??= matrices(view); expect(matrices(view)).toEqual(baseline);
                    for (const group of world.partObjects(slot)) {
                        if (group.parent === world.lighthouse) continue;
                        expect(fits(projected(group, view)), `${family}/${slot}`).toBe(true);
                    }
                }
            }
            expect(scene.children.map(child => [child.uuid, child.visible, child.position.toArray()])).toEqual(identities);
        } finally { world.dispose(); }
    });
    it.each(['flower', 'mushroom'] as const)('frames moved %s instances and uses overview when they are stored, without placing anything', kind => {
        const materials = new IslandMaterials(), view = camera(), group = makeFurniture(kind, materials);
        const item: IslandStageItem = { id: `owned-${kind}`, kind, rotation: Math.PI / 2, position: { x: 6.5, z: 1.2 }, growthLevel: 0 };
        group.position.set(item.position!.x, 0, item.position!.z); group.rotation.y = item.rotation;
        const model = { item, group }, uuid = group.uuid;
        try {
            const first = fitIslandAppearanceCamera(view, kind, [model], 2, 390 / 354), matrix = matrices(view);
            expect(first).toMatchObject({ actual: kind, targetIds: [item.id] });
            for (const level of [0, 1, 2, 3]) {
                item.growthLevel = level; applyFurnitureGrowth(group, item, materials, 6);
                fitIslandAppearanceCamera(view, kind, [model], 2, 390 / 354); expect(matrices(view)).toEqual(matrix);
                expect(fits(projected(group, view))).toBe(true);
            }
            item.position = undefined;
            expect(fitIslandAppearanceCamera(view, kind, [model], 2, 390 / 354)).toEqual({ requested: kind, actual: 'all', targetIds: [] });
            const absent = matrices(view); fitIslandAppearanceCamera(view, 'all', [model], 2, 390 / 354); expect(matrices(view)).toEqual(absent);
            expect(item.position).toBeUndefined(); expect(group.uuid).toBe(uuid); expect(group.visible).toBe(true);
        } finally { disposeGeometry(group); materials.dispose(); }
    });
    it('the runtime fits the viewing prop independently of preview selection and stops fitting during learning', () => {
        const runtime = Object.create(IslandScene.prototype) as { frameCosmeticFocus(): boolean; cosmeticFrame?: unknown; state: IslandStageState };
        const view = camera();
        Object.assign(runtime, { camera: view, items: new Map(), host: { clientWidth: 390, clientHeight: 354 },
            state: { learning: false, readOnly: true, items: [], completedSets: 0, pulse: 0, cosmeticFocus: 'houseRoof' } });
        expect(runtime.frameCosmeticFocus()).toBe(true); const before = matrices(view);
        runtime.state.selectedId = undefined; expect(runtime.frameCosmeticFocus()).toBe(true); expect(matrices(view)).toEqual(before);
        expect(runtime.cosmeticFrame).toEqual({ requested: 'houseRoof', actual: 'houseRoof', targetIds: ['home-cottage'] });
        runtime.state.learning = true; expect(runtime.frameCosmeticFocus()).toBe(false); expect(runtime.cosmeticFrame).toBeUndefined();
    });
});
