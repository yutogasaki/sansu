import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { IslandMaterials } from '../three/primitives';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { frameCamera, initialView } from './growingCamera';
import { growingHitTarget } from './growingHitTarget';

function setup() {
    const state = newIsland('hit-priority', Date.UTC(2026, 9, 4));
    state.tutorial = 'done'; state.unopened = []; state.villagers = []; state.arrivals = [];
    state.plots = [
        { id: 'seed-a', kind: 'home', cell: { x: 2, z: 3 }, stage: 0, growth: 0, plantedAt: 0, origin: 'seed', paid: 4 },
        { id: 'home', kind: 'home', cell: { x: 2, z: 4 }, stage: 1, growth: 0, plantedAt: 0, origin: 'seed', paid: 4 },
        { id: 'seed-b', kind: 'farm', cell: { x: 3, z: 4 }, stage: 0, growth: 0, plantedAt: 0, origin: 'seed', paid: 4 },
    ];
    state.landmarks = [
        { id: 'flower', kind: 'flower', cell: { x: 1, z: 3 }, growth: 6, color: 'red' },
        { id: 'bench', kind: 'bench', cell: { x: 3, z: 3 }, growth: 0 },
        { id: 'young-tree', kind: 'sapling', cell: { x: 4, z: 2 }, growth: 0 },
        { id: 'lord-tree', kind: 'sapling', cell: { x: 4, z: 4 }, growth: 18, maturedAt: 0 },
    ];
    state.nature.hours = 800;
    const materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const layer = buildObjectLayer(materials, state, layout);
    layer.root.updateMatrixWorld(true);
    const hitMeshes: T.Mesh[] = [];
    layer.root.traverse(object => {
        if (object instanceof T.Mesh && object.material instanceof T.MeshBasicMaterial && !object.material.colorWrite) hitMeshes.push(object);
    });
    return { state, materials, layout, layer, hitMeshes };
}

describe('unbuilt seed touch target priority', () => {
    it('attaches only to unbuilt plots and leaves the scene on rebuild or cancel', () => {
        const { state, materials, layout, layer, hitMeshes } = setup();
        const scene = new T.Scene(); scene.add(layer.root);
        expect(hitMeshes).toHaveLength(2);
        expect(hitMeshes.every(mesh => mesh.userData.placementHitOnly && mesh.userData.objectId)).toBe(true);
        layer.dispose();
        expect(scene.children).not.toContain(layer.root);
        state.plots[0].stage = 1;
        const grown = buildObjectLayer(materials, state, layout);
        const grownHits: T.Object3D[] = []; grown.root.traverse(object => { if (object.userData.placementHitOnly) grownHits.push(object); });
        expect(grownHits).toHaveLength(1);
        grown.dispose();
        state.plots = [];
        const canceled = buildObjectLayer(materials, state, layout);
        const canceledHits: T.Object3D[] = []; canceled.root.traverse(object => { if (object.userData.placementHitOnly) canceledHits.push(object); });
        expect(canceledHits).toHaveLength(0);
        canceled.dispose(); materials.dispose();
    });
    it('measures visible neighbors over dense layouts at phone widths and camera angles', () => {
        const { materials, layout, layer, hitMeshes } = setup();
        expect(hitMeshes).toHaveLength(2);
        const results = [];
        const box = new T.Box3(), point = new T.Vector3(), ray = new T.Raycaster();
        const original = hitMeshes.map(mesh => mesh.raycast);
        const label = (x: number, y: number, camera: T.OrthographicCamera, width: number, height: number) => {
            ray.setFromCamera(new T.Vector2(x / width * 2 - 1, -(y / height * 2 - 1)), camera);
            return growingHitTarget(ray.intersectObjects([layer.root], true), false)?.object.userData.objectId as string | undefined;
        };
        for (const width of [320, 390]) for (const azimuth of [0, Math.PI, Math.PI / 4, -Math.PI / 4]) {
            const height = 780, camera = new T.OrthographicCamera(), view = initialView(); view.azimuth = azimuth;
            frameCamera(camera, layout, view, width / height); camera.updateMatrixWorld(true);
            const neighbors = ['flower', 'bench', 'home', 'young-tree', 'lord-tree', 'seed-a', 'seed-b'];
            const steals: Record<string, number> = {}, samples: Record<string, number> = {};
            for (const id of neighbors) {
                const object = layer.objects.get(id)!;
                box.setFromObject(object);
                const points = [];
                for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                    point.set(x, y, z).project(camera);
                    points.push({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 });
                }
                const left = Math.max(0, Math.floor(Math.min(...points.map(p => p.x))));
                const right = Math.min(width, Math.ceil(Math.max(...points.map(p => p.x))));
                const top = Math.max(0, Math.floor(Math.min(...points.map(p => p.y))));
                const bottom = Math.min(height, Math.ceil(Math.max(...points.map(p => p.y))));
                for (let y = top; y <= bottom; y += 3) for (let x = left; x <= right; x += 3) {
                    hitMeshes.forEach(mesh => { mesh.raycast = () => {}; }); const without = label(x, y, camera, width, height);
                    hitMeshes.forEach((mesh, i) => { mesh.raycast = original[i]; }); const withHit = label(x, y, camera, width, height);
                    if (without === id) {
                        samples[id] = (samples[id] ?? 0) + 1;
                        if (withHit !== id) steals[id] = (steals[id] ?? 0) + 1;
                    }
                }
            }
            const newSeedHits: Record<string, number> = {};
            for (const [i, mesh] of hitMeshes.entries()) {
                mesh.updateMatrixWorld(true); box.setFromObject(mesh);
                const corners = [];
                for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
                    point.set(x, y, z).project(camera);
                    corners.push({ x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 });
                }
                const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))));
                const right = Math.min(width, Math.ceil(Math.max(...corners.map(p => p.x))));
                const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))));
                const bottom = Math.min(height, Math.ceil(Math.max(...corners.map(p => p.y))));
                const id = i === 0 ? 'seed-a' : 'seed-b';
                for (let y = top; y <= bottom; y += 3) for (let x = left; x <= right; x += 3) {
                    hitMeshes.forEach(item => { item.raycast = () => {}; }); const without = label(x, y, camera, width, height);
                    hitMeshes.forEach((item, index) => { item.raycast = original[index]; }); const withHit = label(x, y, camera, width, height);
                    if (!without && withHit === id) newSeedHits[id] = (newSeedHits[id] ?? 0) + 1;
                }
            }
            results.push({ width, azimuth: Number((azimuth * 180 / Math.PI).toFixed(0)), samples, steals, newSeedHits });
        }
        for (const result of results) {
            expect(result.steals).toEqual({});
            expect(result.newSeedHits['seed-a']).toBeGreaterThan(0);
            expect(result.newSeedHits['seed-b']).toBeGreaterThan(0);
        }
        expect(results.reduce((sum, result) => sum + (result.samples['young-tree'] ?? 0), 0)).toBeGreaterThan(0);
        expect(results.reduce((sum, result) => sum + (result.samples['lord-tree'] ?? 0), 0)).toBeGreaterThan(0);
        layer.dispose(); materials.dispose();
    });
});
