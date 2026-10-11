import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { buildNativeGrowingGround } from './nativeGrowingGround';
import { newIsland } from '../../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../../domain/growingIsland/placeCatalog';
import { key, landCells, walkableCells } from '../../../../domain/growingIsland/space';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../../domain/growingIsland/types';
import { sceneLayout } from '../sceneLayout';
import { buildObjectLayer } from '../objectLayer';
import { IslandMaterials } from '../../three/primitives';
import { RULES } from '../../../../domain/growingIsland/rules';
import { frameCamera, initialView } from '../growingCamera';

let kit: NativeGrowingKit;
beforeAll(async () => {
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    const buffer = Uint8Array.from(bytes).buffer;
    const gltf = await new GLTFLoader().parseAsync(buffer, ''); kit = makeNativeGrowingKit(gltf.scene, manifest);
});
afterAll(() => kit?.dispose());

function fixture(goalId: string, variantId: string) {
    const state = newIsland('native-floor-fixture', 1000);
    state.nature.hours = RULES.bigTreeHours + 1; // Explicit mature geometry fixture, not elapsed-time evidence.
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = []; state.villagers = [];
    const goal = placeGoalCatalog.find(goal => goal.id === goalId)!, variant = goal.variants.find(variant => variant.id === variantId)!;
    variant.demo.forEach((entry, i) => {
        const [type, kind] = goal.inputs.find(input => input.role === entry.role)!.kind.split(':');
        const cell = { x: entry.x + 6, z: entry.z + 1 }, id = `${goalId}-${i}`;
        if (type === 'landmark') state.landmarks.push({ id, kind: kind as LandmarkKind, cell, growth: kind === 'sapling' ? 18 : 6, maturedAt: 0 });
        else state.plots.push({ id, kind: kind as SeedKind, cell, plantedAt: 0, builtAt: 6, stage: kind === 'home' ? 2 : 1, style: goalId === 'P02' ? 'tree' : 'plain', growth: 0, origin: 'seed', paid: 40 });
    }); return state;
}
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(o => { if (o instanceof T.Mesh) result.push(o); }); return result; };

describe('native art on the actual owned floor', () => {
    it('leaves sea in front of every viewport corner when the complete native island is framed', () => {
        const state = fixture('P02', 'court'), layout = sceneLayout(state), ground = buildNativeGrowingGround(layout, kit.manifest.shoreProfile);
        layout.nativeArt = true; layout.cameraObjects = () => [ground.root];
        const camera = new T.OrthographicCamera(-5, 5, 5, -5, .1, 100), sea = new T.Plane(new T.Vector3(0, 1, 0), .4);
        for (const aspect of [390 / 780, 768 / 960, 1280 / 656]) for (const azimuth of [0, Math.PI / 2, Math.PI]) {
            frameCamera(camera, layout, { ...initialView(), azimuth }, aspect); camera.updateMatrixWorld(true);
            for (const x of [-1, 1]) for (const y of [-1, 1]) {
                const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(x, y), camera);
                const point = ray.ray.intersectPlane(sea, new T.Vector3());
                expect(point).not.toBeNull(); expect(point!.distanceTo(ray.ray.origin)).toBeLessThan(camera.far);
            }
        }
        ground.dispose();
    });
    it('keeps the saved home surroundings distinct and its earned upper height without painting another owner', () => {
        const roofs = ['plain', 'water', 'tree'] as const;
        const originals = roofs.map(style => kit.home(2, style));
        expect(originals.map(home => home.userData.nativePart)).toEqual(['home', 'home-cap', 'home-leaf']);
        for (const style of roofs) {
            const small = kit.home(2, style), upper = kit.home(4, style);
            expect(new T.Box3().setFromObject(upper).getSize(new T.Vector3()).y).toBeGreaterThan(new T.Box3().setFromObject(small).getSize(new T.Vector3()).y);
        }
        const unpainted = kit.instance('home-cap'), before = meshes(unpainted).map(mesh => (mesh.material as T.MeshStandardMaterial).color.getHex());
        kit.home(2, 'water', 2);
        expect(meshes(unpainted).map(mesh => (mesh.material as T.MeshStandardMaterial).color.getHex())).toEqual(before);
    });
    it('leaves every saved cell and fractional foot position on the same real floor, including very large districts', () => {
        const state = newIsland('native-shore', 1000);
        for (const land of [state.land, { expanded: 'east' as const, extra: ['west', 'south'] as ('west' | 'south')[], capes: ['west', 'east'] as ('west' | 'east')[], districts: Array.from({ length: 12 }, () => 'east' as const) }]) {
            state.land = land; const saved = structuredClone(state), layout = sceneLayout(state), ground = buildNativeGrowingGround(layout, kit.manifest.shoreProfile);
            ground.root.updateMatrixWorld(true);
            for (const cell of landCells(state)) for (const [dx, dz] of [[0, 0], [.13, .27]]) {
                const point = layout.point({ x: cell.x + dx, z: cell.z + dz }, 0);
                const hit = new T.Raycaster(point.clone().add(new T.Vector3(0, 8, 0)), new T.Vector3(0, -1, 0)).intersectObject(ground.floor)[0];
                expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(point.y, 5);
            }
            const positions = (ground.root.getObjectByName('native05-shore-bank') as T.Mesh).geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i), z = positions.getZ(i);
                expect(Math.abs(x) >= layout.width / 2 - 1e-5 || Math.abs(z - ((layout.depth - 1) / 2 - 2)) >= layout.depth / 2 - 1e-5).toBe(true);
            }
            expect(state).toEqual(saved); ground.dispose();
        }
    });
    for (const goal of placeGoalCatalog.filter(goal => ['P01', 'P02', 'P04', 'P05'].includes(goal.id))) for (const variant of goal.variants) {
        it(`renders ${goal.id}/${variant.id} from actual owners and keeps the gallery floor and free entrances`, () => {
            const state = fixture(goal.id, variant.id), saved = structuredClone(state), layout = sceneLayout(state);
            const m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
            const place = layer.places.find(place => place.ruleId === goal.id)!;
            expect(place).toBeDefined(); expect(layer.objects.size).toBe(state.landmarks.length + state.plots.length);
            const placeMeshes = meshes(layer.placeRoot).filter(mesh => mesh.userData.placeId === place.id);
            expect(place.stage, JSON.stringify(place.missing)).toBe('grown');
            expect(placeMeshes.some(mesh => mesh.userData.nativeSharedGeometry)).toBe(true);
            expect(placeMeshes.every(mesh => place.memberIds.includes(mesh.userData.objectId))).toBe(true);
            layer.root.updateMatrixWorld(true);
            const room = layer.placeRoot.getObjectByName('place-root-room');
            if (room) {
                const crown = layer.placeRoot.getObjectByName('place-native-fan-crown')!;
                expect(crown.scale.x).toBe(crown.scale.y); expect(crown.scale.y).toBe(crown.scale.z);
                const bough = crown.getObjectByName('sculpted tree wood') as T.Mesh, positions = bough.geometry.getAttribute('position');
                let bottom = new T.Vector3(0, Infinity, 0);
                for (let vertex = 0; vertex < positions.count; vertex++) {
                    const at = new T.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(bough.matrixWorld);
                    if (at.y < bottom.y) bottom = at;
                }
                const join = new T.Raycaster(bottom.clone().add(new T.Vector3(0, .15, 0)), new T.Vector3(0, -1, 0)).intersectObject(room, true)[0];
                expect(join, 'The original wooden crown stem must meet the actual hollow root volume').toBeDefined();
                expect(Math.abs(join.point.y - bottom.y)).toBeLessThan(.08);
            }
            const gallery = layer.placeRoot.getObjectByName('place-physical-gallery');
            if (gallery) for (const floor of place.walkSurface.slice(1, -1)) {
                const point = layout.floorPoint(floor), ray = new T.Raycaster(point.clone().add(new T.Vector3(0, .30, 0)), new T.Vector3(0, -1, 0));
                const hits = ray.intersectObject(gallery, true).filter(hit => hit.point.y <= point.y + .025);
                expect(hits.some(hit => Math.abs(hit.point.y - point.y) < .03)).toBe(true);
            }
            const open = walkableCells(state);
            for (const cell of place.entrances.filter(cell => open.has(key(cell)))) {
                const at = layout.point(cell), ray = new T.Raycaster(at.clone().add(new T.Vector3(0, 1.18, 0)), new T.Vector3(0, -1, 0));
                const low = ray.intersectObject(layer.placeRoot, true).filter(hit => hit.point.y > at.y + .13 && hit.point.y < at.y + 1.17);
                expect(low.map(hit => ({ mesh: hit.object.name, y: hit.point.y - at.y })), `Standing entrance ${key(cell)} must remain open`).toEqual([]);
            }
            expect(state).toEqual(saved); layer.dispose(); m.dispose();
        });
    }
    it('preview, moving and disposing one island leave the shared source geometry/materials alive and opaque', () => {
        const state = fixture('P02', 'lane'), m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
        const nativeMeshes = meshes(layer.placeRoot).filter(mesh => mesh.userData.nativeSharedGeometry);
        expect(nativeMeshes.length).toBeGreaterThan(0);
        const disposes = [...new Set(nativeMeshes.map(mesh => mesh.geometry))].map(geometry => vi.spyOn(geometry, 'dispose'));
        const opacities = nativeMeshes.map(mesh => (mesh.material as T.Material).opacity);
        const owner = state.landmarks[0];
        layer.updatePreview({ kind: 'sapling', seed: false, cell: { x: 1, z: 4 }, ownerId: owner.id, valid: true, style: 'tree', allowed: [] });
        expect(nativeMeshes.map(mesh => (mesh.material as T.Material).opacity)).toEqual(opacities);
        const home = state.plots.find(plot => plot.kind === 'home')!;
        layer.updatePreview({ kind: 'home', seed: true, cell: { x: 1, z: 4 }, ownerId: home.id, valid: true, style: 'tree', allowed: [] });
        expect(layer.root.getObjectByName('growing-native-home')?.userData.homeStage).toBe(home.stage);
        expect(layer.root.getObjectByName('growing-ghost')?.getObjectByName('growing-native-home')?.userData.nativePart).toBe('home-leaf');
        layer.dispose(); disposes.forEach(dispose => { expect(dispose).not.toHaveBeenCalled(); dispose.mockRestore(); });
        const moved: GrowingState = { ...state, landmarks: state.landmarks.map(l => l.id === owner.id ? { ...l, cell: { x: 1, z: 4 } } : l) };
        const split = buildObjectLayer(m, moved, sceneLayout(moved), undefined, undefined, [], kit);
        expect(meshes(split.root).some(mesh => mesh.userData.nativeSharedGeometry && mesh.geometry.getAttribute('position').count > 100)).toBe(true);
        split.dispose(); m.dispose();
    });
});
