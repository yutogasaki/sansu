import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import nativeManifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import manifest from '../../../../../prototypes/place-qa/native-gallery-v5-manifest.json';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { applyIntent, canPlace } from '../../../../domain/growingIsland/commands';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import type { GrowingState } from '../../../../domain/growingIsland/types';
import { GardenGeometry } from '../../three/garden/geometry';
import { sceneLayout } from '../sceneLayout';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { buildNativePlaceGrove } from './nativePlaceGrove';
import { makeNativeAuthoredGallery, type NativeAuthoredGallery } from './nativeAuthoredGallery';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
let world: IslandWorld, state: GrowingState, native: NativeGrowingKit, source: T.Group, gallery: NativeAuthoredGallery;
async function loadGallery() {
    const gzip = readFileSync(manifest.artifact.path.slice(1)), bytes = gunzipSync(gzip);
    expect(hash(gzip)).toBe(manifest.artifact.sha256); expect(hash(bytes)).toBe(manifest.artifact.expandedSha256);
    expect(bytes.length).toBe(manifest.artifact.expandedBytes);
    expect(bytes.equals(readFileSync(manifest.source.artifact))).toBe(true);
    const scene = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    scene.userData.sourceId = manifest.source.id; scene.userData.sourceSha256 = manifest.artifact.expandedSha256; return scene;
}
beforeAll(async () => {
    source = await loadGallery(); gallery = makeNativeAuthoredGallery(source, manifest);
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    native = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, nativeManifest);
    world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz')).toString()));
    state = JSON.parse(readFileSync('prototypes/place-qa/authored-shoulder-reference-mature.json', 'utf8')).state;
}, 20_000);
afterAll(() => { gallery?.dispose(); native?.dispose(); });
function fixture() {
    const layout = sceneLayout(state, false, world), place = derivePlaces(state, world).find(value => value.id === manifest.binding.placeId)!;
    expect(place.mainIds).toEqual(manifest.binding.owners.map(owner => owner.id)); expect(place.stage).toBe('grown');
    const geometry = new GardenGeometry(); buildNativePlaceGrove(geometry, state, layout, place, native, () => new T.Group());
    const shared = geometry.root.getObjectByName('place-native-shared-tree')!; geometry.root.updateMatrixWorld(true);
    return { layout, shared, geometry };
}

describe('v5 owner-bound native gallery coarse structure', () => {
    it('preserves the complete source stairs, six supports, rails/posts and visible tops once at the actual shared tree', () => {
        const { layout, shared, geometry } = fixture(), before = structuredClone(state), floorCount = world.floors.length;
        const root = gallery.instance(state, layout, shared, native.manifest)!;
        expect(root).toBeDefined(); expect(root.name).toBe('authored-gallery-structure');
        expect(root.position.toArray()).toEqual([-layout.center, 0, -2]); expect(root.scale.toArray()).toEqual([1, 1, 1]);
        root.updateWorldMatrix(true, true); const rendered = meshes(root), original = meshes(source);
        expect(rendered).toHaveLength(39); expect(rendered.reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0)).toBe(10220);
        expect(rendered.filter(mesh => mesh.userData.sourceGalleryNode.startsWith('solid-bough/'))).toHaveLength(6);
        expect(rendered.filter(mesh => mesh.userData.sourceGalleryNode.startsWith('solid-rail/'))).toHaveLength(3);
        expect(rendered.filter(mesh => mesh.userData.sourceGalleryNode.startsWith('solid-rail-post/'))).toHaveLength(20);
        expect(rendered.filter(mesh => mesh.userData.sourceGalleryNode.startsWith('walk-top/'))).toHaveLength(5);
        for (const [i, mesh] of rendered.entries()) {
            expect(mesh.geometry).toBe(original[i].geometry); expect(mesh.material).toBe(original[i].material);
            expect(mesh.userData).toMatchObject({ ownerIds: ['l10', 'l11', 'l12', 'l13'], noNewOwnerOrRights: true,
                nativeSharedGeometry: true, nativeSharedMaterial: true, defaultGroundExcluded: true, galleryTraversalEnabled: false });
            expect(mesh.userData.galleryTarget).toBeUndefined(); expect(mesh.userData.walkSurface).toBeUndefined();
            const p = mesh.geometry.getAttribute('position'), a = new T.Vector3(), b = new T.Vector3(); let maximum = 0;
            for (let v = 0; v < p.count; v++) {
                a.fromBufferAttribute(p, v).applyMatrix4(mesh.matrixWorld);
                b.fromBufferAttribute(p, v).add(new T.Vector3(-layout.center, 0, -2)); maximum = Math.max(maximum, a.distanceTo(b));
            }
            expect(maximum).toBeLessThan(1e-12);
        }
        expect(new Set(rendered.map(mesh => mesh.userData.objectId))).toEqual(new Set(['l10', 'l11', 'l12', 'l13']));
        expect(state).toEqual(before); expect(world.floors.length).toBe(floorCount);
        expect(derivePlaces(state, world).find(value => value.id === manifest.binding.placeId)!.walkSurface).toEqual([]);
        geometry.dispose();
    });

    it('detaches on ordinary move/store and reconnects on restore without changing rights or source geometry', () => {
        const { layout, shared, geometry } = fixture(), owner = state.landmarks.find(value => value.id === 'l10')!, destination = { x: 12, z: -9 };
        expect(canPlace(state, destination, owner.id, world)).toBe(true);
        let current = state;
        for (const [i, command] of [
            { type: 'move', id: owner.id, cell: destination }, { type: 'move', id: owner.id, cell: owner.cell! },
            { type: 'store', id: owner.id }, { type: 'unstore', id: owner.id, cell: owner.cell! },
        ].entries()) {
            current = applyIntent(current, { id: `gallery-source-lifecycle-${i}`, command: command as Parameters<typeof applyIntent>[1]['command'] }, state.nature.realAt, world).state;
            expect(Boolean(gallery.instance(current, layout, shared, native.manifest))).toBe(i % 2 === 1);
        }
        const young = structuredClone(state); young.landmarks.find(value => value.id === owner.id)!.growth = 6;
        expect(gallery.instance(young, layout, shared, native.manifest)).toBeUndefined();
        const noHome = structuredClone(state); noHome.plots = noHome.plots.filter(value => value.id !== 'p3');
        expect(gallery.instance(noHome, layout, shared, native.manifest)).toBeUndefined();
        expect(world.owns(owner.cell!)).toBe(true); geometry.dispose();
    });

    it('rejects changed native pivot/transform/source and retains marked hidden committed geometry for preview cancellation', () => {
        const { layout, shared, geometry } = fixture();
        expect(gallery.instance(state, { ...layout, authored: false }, shared, native.manifest)).toBeUndefined();
        expect(gallery.instance(state, layout, shared, { ...native.manifest, sha256: 'wrong' })).toBeUndefined();
        shared.position.x += .001; expect(gallery.instance(state, layout, shared, native.manifest)).toBeUndefined(); shared.position.x -= .001;
        const crown = shared.children.find(child => child.userData.nativePart === 'fan-crown')!;
        crown.scale.multiplyScalar(1.01); expect(gallery.instance(state, layout, shared, native.manifest)).toBeUndefined(); crown.scale.setScalar(.45);
        shared.visible = false; expect(gallery.instance(state, layout, shared, native.manifest)).toBeUndefined();
        shared.userData.authoredPreviewHidden = true;
        const hidden = gallery.instance(state, layout, shared, native.manifest)!;
        expect(hidden.visible).toBe(false); expect(hidden.userData.authoredPreviewHidden).toBe(true); expect(meshes(hidden)).toHaveLength(39);
        shared.visible = true; delete shared.userData.authoredPreviewHidden;
        expect(gallery.instance(state, layout, shared, native.manifest)!.visible).toBe(true); geometry.dispose();
    });

    it('borrows unchanged resources across instances and releases them only once at factory shutdown', async () => {
        const loaded = await loadGallery(), factory = makeNativeAuthoredGallery(loaded, manifest), { layout, shared, geometry } = fixture();
        const one = factory.instance(state, layout, shared, native.manifest)!, two = factory.instance(state, layout, shared, native.manifest)!;
        const a = meshes(one), b = meshes(two), geometrySpies = [...new Set(a.map(mesh => mesh.geometry))].map(value => vi.spyOn(value, 'dispose'));
        const materialSpies = [...new Set(a.map(mesh => mesh.material as T.Material))].map(value => vi.spyOn(value, 'dispose'));
        a.forEach((mesh, i) => { expect(mesh.geometry).toBe(b[i].geometry); expect(mesh.material).toBe(b[i].material); });
        one.userData.ownerIds.push('wrong'); expect(a[0].userData.ownerIds).toEqual(['l10', 'l11', 'l12', 'l13']);
        one.clear(); expect(geometrySpies.every(spy => spy.mock.calls.length === 0)).toBe(true);
        factory.dispose(); factory.dispose(); expect(geometrySpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
        expect(materialSpies.every(spy => spy.mock.calls.length === 1)).toBe(true);
        expect(() => factory.instance(state, layout, shared, native.manifest)).toThrow('disposed');
        const wrong = source.clone(true); wrong.userData.sourceSha256 = '0'.repeat(64);
        expect(() => makeNativeAuthoredGallery(wrong, manifest)).toThrow('source identity');
        const incomplete = source.clone(true); incomplete.remove(incomplete.children[0]);
        expect(() => makeNativeAuthoredGallery(incomplete, manifest)).toThrow('nodes differ'); geometry.dispose();
    });
});
