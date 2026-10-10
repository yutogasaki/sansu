import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { HOME_CELL, key } from '../../../domain/growingIsland/space';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import type { LandmarkKind } from '../../../domain/growingIsland/types';
import { IslandMaterials } from '../three/primitives';
import { buildObjectLayer, type Ghost } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { chooseGrowingFingerTarget, updateGrowingFingerTargets } from './growingFingerTargets';

function setup() {
    const state = newIsland('preview-ownership', Date.UTC(2026, 9, 9));
    state.landmarks.push({ id: 'swing', kind: 'swing', cell: { x: 4, z: 3 }, growth: 0 });
    state.plots.push({ id: 'bud', kind: 'home', cell: { x: 1, z: 3 }, stage: 1, growth: 6, plantedAt: 0, origin: 'seed', paid: 0 });
    state.unopened = ['bud'];
    state.bridge = { x: 2 };
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
    return { state, m, layout, layer };
}

const ghost = (x = 0, valid = true): Ghost => ({ kind: 'home', seed: true, cell: { x, z: 2 }, valid, style: 'plain', allowed: [{ x: 0, z: 2 }, { x: 0, z: 3 }] });
function meshes(root: T.Object3D) {
    const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) result.push(object); }); return result;
}
function outline(holder: T.Object3D) {
    return holder.children.find(object => object instanceof T.Mesh && object.geometry instanceof T.TorusGeometry && object.material instanceof T.MeshBasicMaterial) as T.Mesh | undefined;
}

describe('growing object previews', () => {
    it('replaces connected mature crowns under the same owner IDs and restores solitary trees after separation', () => {
        const state = newIsland('native-owned-grove', 1000);
        state.land = { expanded: 'east', extra: ['south'], capes: ['east'] }; state.landmarks = []; state.plots = []; state.unopened = []; state.villagers = [];
        const goal = placeGoalCatalog.find(goal => goal.id === 'P01')!;
        for (const [i, entry] of goal.variants.find(variant => variant.id === 'lane')!.demo.entries()) {
            state.landmarks.push({ id: `grove-${i}`, kind: goal.inputs.find(input => input.role === entry.role)!.kind.split(':')[1] as LandmarkKind,
                cell: { x: entry.x + 6, z: entry.z + 1 }, growth: 18, maturedAt: 0 });
        }
        const saved = structuredClone(state), materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const layer = buildObjectLayer(materials, state, layout);
        const trees = state.landmarks.filter(item => item.kind === 'sapling');
        for (const tree of trees) {
            expect(layer.objects.get(tree.id)!.children[0].visible).toBe(false);
            expect(meshes(layer.placeRoot).some(mesh => mesh.userData.objectId === tree.id)).toBe(true);
        }
        expect(state).toEqual(saved); layer.dispose();
        trees[0].cell = undefined;
        const split = buildObjectLayer(materials, state, layout);
        expect(split.objects.has(trees[0].id)).toBe(false);
        expect(split.objects.get(trees[1].id)!.children[0].visible).toBe(true);
        expect(trees[1]).toEqual(saved.landmarks.find(item => item.id === trees[1].id));
        split.dispose(); materials.dispose();
    });
    it('replaces only actual mature supplied water visuals while preserving owner holders and young or unrelated streams', () => {
        const state = newIsland('shallow-owned-water', 1000);
        state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
        state.landmarks = []; state.plots = []; state.unopened = []; state.villagers = [];
        const goal = placeGoalCatalog.find(goal => goal.id === 'P03')!;
        for (const [i, entry] of goal.variants.find(variant => variant.id === 'tiered')!.demo.entries()) {
            state.landmarks.push({ id: `water-${i}`, kind: goal.inputs.find(input => input.role === entry.role)!.kind.split(':')[1] as LandmarkKind,
                cell: { x: entry.x + 6, z: entry.z + 1 }, growth: 6 });
        }
        state.landmarks.push({ id: 'dry-stream', kind: 'water-channel', cell: { x: -5, z: 6 }, growth: 0 },
            { id: 'unrelated-bowl', kind: 'water-bowl', cell: { x: -4, z: 4 }, growth: 0 },
            { id: 'unrelated-stream', kind: 'water-channel', cell: { x: -3, z: 4 }, growth: 0 });
        const saved = structuredClone(state), materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const layer = buildObjectLayer(materials, state, layout), place = layer.places.find(place => place.ruleId === 'P03' && place.mainIds.includes('water-0'))!;
        expect(place.stage).toBe('grown');
        const matureWater = state.landmarks.filter(item => (item.kind === 'water-bowl' || item.kind === 'water-channel')
            && [...place.mainIds, ...place.waterRefs].includes(item.id));
        expect(matureWater.filter(item => item.kind === 'water-channel')).toHaveLength(2);
        for (const item of matureWater) {
            const holder = layer.objects.get(item.id)!;
            expect(holder.parent).toBe(layer.root); expect(holder.position).toEqual(layout.point(item.cell!));
            expect(holder.children[0].visible).toBe(false);
            expect(meshes(holder).every(mesh => mesh.userData.objectId === item.id)).toBe(true);
            expect(meshes(layer.placeRoot).some(mesh => mesh.userData.objectId === item.id)).toBe(true);
        }
        for (const id of ['dry-stream', 'unrelated-bowl', 'unrelated-stream']) expect(layer.objects.get(id)!.children[0].visible).toBe(true);
        expect(layer.objects.size).toBe(state.landmarks.length); expect(state).toEqual(saved);
        layer.dispose();
        state.landmarks.find(item => item.kind === 'flower')!.growth = 0;
        const youngSaved = structuredClone(state), young = buildObjectLayer(materials, state, layout);
        expect(young.places.some(place => place.ruleId === 'P03' && (place.stage === 'grown' || place.stage === 'lived'))).toBe(false);
        for (const item of state.landmarks.filter(item => item.kind === 'water-bowl' || item.kind === 'water-channel')) expect(young.objects.get(item.id)!.children[0].visible).toBe(true);
        expect(state).toEqual(youngSaved); young.dispose(); materials.dispose();
    });
    it('wires camera-sized finger hits to actual young tree/flower owners without changing growth or inventory', () => {
        const state = newIsland('young-owner-hit', 1000);
        state.landmarks = [
            { id: 'young-tree', kind: 'sapling', cell: { x: 0, z: 3 }, growth: .01 },
            { id: 'young-flower', kind: 'flower', color: 'purple', cell: { x: 1, z: 3 }, growth: 2 },
            { id: 'mature-tree', kind: 'sapling', cell: { x: 5, z: 3 }, growth: 18 },
            { id: 'mature-flower', kind: 'flower', color: 'pink', cell: { x: 4, z: 3 }, growth: 6 },
            { id: 'stored-tree', kind: 'sapling', growth: 0 },
            { id: 'bench', kind: 'bench', cell: { x: 2, z: 3 }, growth: 0 },
        ];
        const saved = structuredClone(state), m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const layer = buildObjectLayer(m, state, layout), width = 390, height = 700;
        const camera = new T.OrthographicCamera(-7, 7, 7 * height / width, -7 * height / width, .1, 100);
        camera.position.set(8, 12, 15); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
        expect(layer.fingerTargets.map(hit => hit.userData.objectId)).toEqual(['young-tree', 'young-flower']);
        updateGrowingFingerTargets(layer.fingerTargets, camera, width);
        for (const pad of layer.fingerTargets) {
            expect(pad.parent).toBe(layer.objects.get(pad.userData.objectId));
            expect(pad.userData).toMatchObject({ ownMaterial: true, placementHitOnly: true });
            expect((pad.material as T.MeshBasicMaterial).colorWrite).toBe(false);
            const center = pad.getWorldPosition(new T.Vector3()).project(camera);
            const pixel = { x: (center.x + 1) * width / 2 + 22, y: (1 - center.y) * height / 2 };
            const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(pixel.x / width * 2 - 1, 1 - pixel.y / height * 2), camera);
            const hits = ray.intersectObject(pad);
            expect(chooseGrowingFingerTarget(hits, camera, width, height, pixel.x, pixel.y)?.object.userData.objectId).toBe(pad.userData.objectId);
        }
        expect(state).toEqual(saved); expect(layer.objects.size).toBe(5);
        layer.dispose(); m.dispose();
    });
    it('keeps saved geometry, hit metadata, boats and swing poses while moving and cancelling a ghost', () => {
        const { state, m, layout, layer } = setup(), saved = structuredClone(state);
        const objects = [...layer.objects], buds = [...layer.buds], seats = [...layer.seats], pivots = [...layer.swingPivots];
        const boats = [layer.arrivalBoat, layer.visitorBoat, layer.nextBoat], flag = layer.flag;
        const base = meshes(layer.root).map(mesh => ({ mesh, geometry: mesh.geometry, material: mesh.material, data: { ...mesh.userData } }));
        const disposed = [...new Set(base.map(value => value.geometry))].map(geometry => vi.spyOn(geometry, 'dispose'));
        const swing = layer.swingPivots.get(key({ x: 4, z: 3 }))!; swing.rotation.x = .42;
        layer.visitorBoat.position.set(2, .12, 4);
        layer.updatePreview(ghost(), 'starter-bench', [{ x: 0, z: 4 }]);
        expect(layer.root.getObjectByName('growing-ghost')?.position).toEqual(layout.point({ x: 0, z: 2 }));
        expect(layer.glows).toHaveLength(1);
        layer.updatePreview(ghost(1, false), 'flag');
        const preview = layer.root.getObjectByName('growing-ghost')!;
        expect(preview.position).toEqual(layout.point({ x: 1, z: 2 }));
        expect((outline(preview)!.material as T.MeshBasicMaterial).color.getHexString()).toBe('8a5a3a');
        layer.updatePreview();

        expect(layer.root.getObjectByName('growing-ghost')).toBeUndefined(); expect(layer.glows).toHaveLength(0);
        expect([...layer.objects]).toEqual(objects); expect([...layer.buds]).toEqual(buds); expect([...layer.seats]).toEqual(seats); expect([...layer.swingPivots]).toEqual(pivots);
        for (const [id, object] of objects) expect(layer.objects.get(id)).toBe(object);
        [layer.arrivalBoat, layer.visitorBoat, layer.nextBoat].forEach((boat, index) => expect(boat).toBe(boats[index]));
        expect(layer.flag).toBe(flag); expect(swing.rotation.x).toBe(.42); expect(layer.visitorBoat.position).toEqual(new T.Vector3(2, .12, 4));
        expect(meshes(layer.root)).toEqual(base.map(value => value.mesh));
        for (const value of base) {
            expect(value.mesh.geometry).toBe(value.geometry); expect(value.mesh.material).toBe(value.material); expect(value.mesh.userData).toEqual(value.data);
        }
        for (const dispose of disposed) expect(dispose).not.toHaveBeenCalled();
        expect(state).toEqual(saved);
        layer.dispose(); m.dispose();
    });

    it('preserves selection parenting and opening hit metadata without making normal rings interactive', () => {
        const { m, layout, layer } = setup();
        const bench = layer.objects.get('starter-bench')!, bud = layer.buds.get('bud')!;
        layer.updatePreview(undefined, 'starter-bench');
        expect(outline(bench)?.parent).toBe(bench); expect(outline(bench)?.userData.objectId).toBeUndefined();
        layer.updatePreview(undefined, 'bud');
        expect(outline(bench)).toBeUndefined(); expect(outline(bud)?.parent).toBe(bud);
        expect(outline(bud)?.userData.budId).toBe('bud'); expect(outline(bud)?.userData.objectId).toBeUndefined();
        layer.updatePreview(undefined, 'flag');
        const flagRing = outline(layer.root)!; expect(flagRing.position).toEqual(layer.flag.position);
        layer.updatePreview(undefined, 'house');
        expect(layer.root.getObjectByName('growing-house-selection')?.position).toEqual(layout.point({ x: HOME_CELL.x + .5, z: HOME_CELL.z - .5 }, .08));
        layer.updatePreview(ghost(), 'house');
        expect(layer.root.getObjectByName('growing-house-selection')).toBeUndefined();
        layer.dispose(); m.dispose();
    });

    it('disposes replaced and final overlay resources once while retaining shared materials', () => {
        const { m, layer } = setup(), baseMeshes = new Set(meshes(layer.root));
        const sharedMaterials = new Set([...baseMeshes].filter(mesh => !mesh.userData.ownMaterial).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
        const sharedDisposed = [...sharedMaterials].map(material => vi.spyOn(material, 'dispose'));
        const observePreview = () => {
            const created = meshes(layer.root).filter(mesh => !baseMeshes.has(mesh));
            expect(created.length).toBeGreaterThan(0);
            const geometries = new Set(created.map(mesh => mesh.geometry));
            const materials = new Set(created.filter(mesh => mesh.userData.ownMaterial).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
            return [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
        };
        layer.updatePreview(ghost(), 'starter-bench', [{ x: 0, z: 4 }]); const first = observePreview();
        layer.updatePreview(ghost(1), 'bud'); const second = observePreview();
        for (const dispose of first) expect(dispose).toHaveBeenCalledTimes(1);
        layer.updatePreview();
        for (const dispose of second) expect(dispose).toHaveBeenCalledTimes(1);
        layer.updatePreview(ghost(), 'house'); const final = observePreview();
        layer.dispose(); layer.dispose();
        for (const dispose of [...first, ...second, ...final]) expect(dispose).toHaveBeenCalledTimes(1);
        for (const dispose of sharedDisposed) expect(dispose).not.toHaveBeenCalled();
        expect(layer.glows).toHaveLength(0);
        m.dispose();
    });

    it('rebuilds saved geometry and positions when a new saved state is supplied', () => {
        const { state, m, layer } = setup(), previous = layer.objects.get('starter-bench')!;
        const next = structuredClone(state); next.landmarks.find(item => item.id === 'starter-bench')!.cell = { x: 0, z: 4 };
        const geometry = meshes(previous).map(mesh => vi.spyOn(mesh.geometry, 'dispose'));
        layer.dispose();
        const nextLayout = sceneLayout(next), rebuilt = buildObjectLayer(m, next, nextLayout);
        expect(rebuilt.objects.get('starter-bench')).not.toBe(previous);
        expect(rebuilt.objects.get('starter-bench')!.position).toEqual(nextLayout.point({ x: 0, z: 4 }));
        for (const dispose of geometry) expect(dispose).toHaveBeenCalledTimes(1);
        rebuilt.dispose(); m.dispose();
    });
});
