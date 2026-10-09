import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { HOME_CELL, key } from '../../../domain/growingIsland/space';
import { IslandMaterials } from '../three/primitives';
import { buildObjectLayer, type Ghost } from './objectLayer';
import { sceneLayout } from './sceneLayout';

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
