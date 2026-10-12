import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import nativeManifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import coveManifest from '../../../../../docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json';
import shoulderManifest from '../../../../../prototypes/place-qa/native-shoulder-manifest.json';
import forestManifest from '../../../../../prototypes/place-qa/native-forest-stage4-manifest.json';
import galleryManifest from '../../../../../prototypes/place-qa/native-gallery-v5-manifest.json';
import { authoredWorldFrame } from '../../../../domain/growingIsland/authoredWorldFrame';
import { withNative05WaterCarvingScope } from '../../../../domain/growingIsland/authoredWaterCarving';
import type { AuthoredShoulderProfile } from '../../../../domain/growingIsland/authoredShoulderWorld';
import { applyIntent, canPlace } from '../../../../domain/growingIsland/commands';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import { landCells } from '../../../../domain/growingIsland/space';
import type { GrowingState } from '../../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { IslandMaterials } from '../../three/primitives';
import type { AuthoredWholeArt } from '../authoredWholeArt';
import { buildObjectLayer } from '../objectLayer';
import { sceneLayout } from '../sceneLayout';
import { makeNativeAuthoredCove, type NativeAuthoredCove } from './nativeAuthoredCove';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower } from './nativeAuthoredFlower';
import { makeNativeAuthoredForest } from './nativeAuthoredForest';
import { makeNativeAuthoredGallery } from './nativeAuthoredGallery';
import { makeNativeAuthoredShoulder, type NativeAuthoredShoulder } from './nativeAuthoredShoulder';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = (path: string) => JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString());
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
const visible = (object: T.Object3D) => {
    for (let parent: T.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
};
const forest = (root: T.Object3D) => root.getObjectsByProperty('name', 'authored-forest-tree');
const forestIds = (root: T.Object3D) => forest(root).filter(visible).map(object => object.userData.ownerId as string).sort();
const galleries = (root: T.Object3D) => root.getObjectsByProperty('name', 'authored-gallery-structure').filter(visible);
const originals = (root: T.Object3D, ownerId: string) => {
    const result: T.Object3D[] = [];
    root.traverse(object => {
        if (/^growing-tree-(spread|spire|branch)$/.test(object.name)
            && (object.userData.ownerId ?? object.userData.objectId) === ownerId) result.push(object);
    });
    return result;
};
const expectedForest = ['l14', 'l15', 'l28', 'l29', 'l33', 'l34', 'l35'];
let base: IslandWorld, state: GrowingState, epoch: number, profile: AuthoredShoulderProfile;
let native: NativeGrowingKit, cove: NativeAuthoredCove, flowers: NativeAuthoredFlower, shoulder: NativeAuthoredShoulder, art: AuthoredWholeArt;

beforeAll(async () => {
    profile = json('prototypes/place-qa/authored-shoulder-profile.json.gz');
    base = withNative05WaterCarvingScope(compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
    const fixture = json('prototypes/place-qa/authored-shoulder-reference-mature.json');
    state = fixture.state; epoch = fixture.epoch ?? state.nature.realAt;
    const load = async (path: string, gzipSha: string, expandedSha: string, sourceId?: string) => {
        const compressed = readFileSync(path), bytes = gunzipSync(compressed);
        expect(sha(compressed)).toBe(gzipSha); expect(sha(bytes)).toBe(expandedSha);
        const source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
        source.userData.sourceId = sourceId; source.userData.sourceSha256 = expandedSha; return source;
    };
    native = makeNativeGrowingKit(await load('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz', nativeManifest.gzipSha256, nativeManifest.sha256), nativeManifest);
    cove = makeNativeAuthoredCove(await load(coveManifest.artifact.path.slice(1), coveManifest.artifact.sha256, coveManifest.source.sha256, coveManifest.source.id), coveManifest);
    shoulder = makeNativeAuthoredShoulder(await load(shoulderManifest.artifact.path.slice(1), shoulderManifest.artifact.sha256, shoulderManifest.artifact.expandedSha256, shoulderManifest.source.id), shoulderManifest);
    flowers = makeNativeAuthoredFlower(json('prototypes/place-qa/native-flower-support.json.gz'));
    art = {
        forest: makeNativeAuthoredForest(await load(forestManifest.artifact.path.slice(1), forestManifest.artifact.sha256, forestManifest.artifact.expandedSha256, forestManifest.source.id), forestManifest),
        gallery: makeNativeAuthoredGallery(await load(galleryManifest.artifact.path.slice(1), galleryManifest.artifact.sha256, galleryManifest.artifact.expandedSha256, galleryManifest.source.id), galleryManifest),
    };
}, 30_000);
afterAll(() => { art?.forest.dispose(); art?.gallery.dispose(); shoulder?.dispose(); flowers?.dispose(); cove?.dispose(); native?.dispose(); });

function setup(current = state) {
    const options = { water: true, cove: true, shoulder: profile }, frame = authoredWorldFrame(current, base, options);
    const layout = sceneLayout(current, false, frame.world, frame.waterPlan, base, { options, covePlan: frame.covePlan, revision: frame.revision });
    const materials = new IslandMaterials('moon-garden');
    const layer = buildObjectLayer(materials, current, layout, undefined, undefined, [], native, flowers, cove, shoulder, art);
    layer.root.updateMatrixWorld(true);
    return { frame, layout, layer, dispose() { layer.dispose(); materials.dispose(); } };
}

describe('saved whole-island art in the actual owned object layer', () => {
    it('attaches all seven mature forest owners and one complete gallery without duplicating trees or granting upper floors', () => {
        const before = structuredClone(state), f = setup();
        try {
            expect(forestIds(f.layer.root)).toEqual(expectedForest);
            expect(forest(f.layer.root)).toHaveLength(7);
            expect(galleries(f.layer.root)).toHaveLength(1);
            for (const ownerId of expectedForest) {
                const root = forest(f.layer.root).find(object => object.userData.ownerId === ownerId)!;
                const part = forestManifest.parts.find(value => value.ownerId === root.userData.templateOwnerId)!;
                expect(meshes(root)).toHaveLength(part.meshes);
                expect(meshes(root).reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0)).toBe(part.triangles);
                expect(originals(f.layer.root, ownerId).length).toBeGreaterThan(0);
                expect(originals(f.layer.root, ownerId).filter(visible)).toEqual([]);
                expect(meshes(root).every(mesh => mesh.userData.objectId === ownerId)).toBe(true);
            }
            const gallery = galleries(f.layer.root)[0], rendered = meshes(gallery);
            expect(rendered).toHaveLength(39);
            expect(rendered.reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0)).toBe(10220);
            expect(new Set(rendered.map(mesh => mesh.userData.objectId))).toEqual(new Set(['l10', 'l11', 'l12', 'l13']));
            expect(visible(f.layer.root.getObjectByName('place-native-shared-tree')!)).toBe(true);
            expect(rendered.every(mesh => mesh.userData.defaultGroundExcluded && mesh.userData.galleryTraversalEnabled === false)).toBe(true);
            expect(derivePlaces(state, f.frame.world).find(place => place.id === galleryManifest.binding.placeId)!.walkSurface).toEqual([]);
            expect(f.layer.objects.size).toBe(35); expect(landCells(state, f.frame.world)).toHaveLength(75);
            expect(f.layer.root.getObjectsByProperty('name', 'authored-tree-root-continuation')).toHaveLength(3);
            expect(state).toEqual(before);
        } finally { f.dispose(); }
    }, 30_000);

    it.each(['l14', 'l29'])('keeps the same source art during ordinary movement, preview and return of %s', (ownerId) => {
        const owner = state.landmarks.find(value => value.id === ownerId)!, destination = { x: 12, z: -9 };
        const initial = setup(); let moved: GrowingState;
        try {
            expect(canPlace(state, destination, owner.id, initial.frame.world)).toBe(true);
            moved = applyIntent(state, { id: 'whole-art-move', command: { type: 'move', id: owner.id, cell: destination } }, epoch, initial.frame.world).state;
        } finally { initial.dispose(); }
        const away = setup(moved!); let restored: GrowingState;
        try {
            expect(moved!.landmarks.find(value => value.id === owner.id)!.cell).toEqual(destination);
            expect(forestIds(away.layer.root)).toEqual(expectedForest);
            expect(originals(away.layer.root, owner.id).filter(visible)).toEqual([]);
            const committed = forest(away.layer.root).find(object => object.userData.ownerId === owner.id)!;
            const previewLayer = setup();
            try {
                previewLayer.layer.updatePreview({ kind: 'sapling', seed: false, valid: true, ownerId: owner.id, cell: destination, style: 'plain', allowed: [] });
                previewLayer.layer.root.updateMatrixWorld(true);
                const preview = forest(previewLayer.layer.root).find(object => object.userData.ownerId === owner.id && visible(object))!;
                expect(preview).toBeDefined();
                const bounds = new T.Box3().setFromObject(preview), expectedBounds = new T.Box3().setFromObject(committed);
                expect(bounds.min.distanceTo(expectedBounds.min)).toBeLessThan(1e-10);
                expect(bounds.max.distanceTo(expectedBounds.max)).toBeLessThan(1e-10);
                const committedMeshes = new Map(meshes(committed).map(mesh => [mesh.userData.forestDeliveryId, mesh]));
                for (const mesh of meshes(preview)) {
                    expect(mesh.geometry).toBe(committedMeshes.get(mesh.userData.forestDeliveryId)!.geometry);
                    expect((mesh.material as T.Material).opacity).toBe(.32);
                    expect(mesh.userData.nativeSharedMaterial).toBe(false);
                }
            } finally { previewLayer.dispose(); }
            expect(galleries(away.layer.root)).toHaveLength(1);
            expect(landCells(moved!, away.frame.world)).toHaveLength(75);
            restored = applyIntent(moved!, { id: 'whole-art-return', command: { type: 'move', id: owner.id, cell: owner.cell! } }, epoch, away.frame.world).state;
        } finally { away.dispose(); }
        const back = setup(restored!);
        try {
            expect(forestIds(back.layer.root)).toEqual(expectedForest);
            expect(originals(back.layer.root, owner.id).filter(visible)).toEqual([]);
            expect(galleries(back.layer.root)).toHaveLength(1);
        } finally { back.dispose(); }
    }, 30_000);

    it('removes a stored forest tree and restores its stable source shape at a different owned cell', () => {
        const owner = state.landmarks.find(value => value.id === 'l29')!, destination = { x: 12, z: -9 };
        const initial = setup(); let stored: GrowingState, original: T.Object3D;
        try {
            original = forest(initial.layer.root).find(object => object.userData.ownerId === owner.id)!;
            stored = applyIntent(state, { id: 'whole-forest-store', command: { type: 'store', id: owner.id } }, epoch, initial.frame.world).state;
        } finally { initial.dispose(); }
        const away = setup(stored!); let restored: GrowingState;
        try {
            expect(forestIds(away.layer.root)).toEqual(expectedForest.filter(id => id !== owner.id));
            restored = applyIntent(stored!, { id: 'whole-forest-unstore', command: { type: 'unstore', id: owner.id, cell: destination } }, epoch, away.frame.world).state;
        } finally { away.dispose(); }
        const back = setup(restored!);
        try {
            expect(restored!.landmarks.find(value => value.id === owner.id)!.cell).toEqual(destination);
            expect(forestIds(back.layer.root)).toEqual(expectedForest);
            const returned = forest(back.layer.root).find(object => object.userData.ownerId === owner.id)!;
            expect(returned.userData.templateOwnerId).toBe(original!.userData.templateOwnerId);
            expect(meshes(returned).map(mesh => mesh.geometry)).toEqual(meshes(original!).map(mesh => mesh.geometry));
        } finally { back.dispose(); }
    }, 30_000);

    it('removes the gallery on a real four-owner separation and restores it after unstore while the forest remains', () => {
        const owner = state.landmarks.find(value => value.id === 'l10')!, initial = setup(); let stored: GrowingState;
        try {
            stored = applyIntent(state, { id: 'whole-gallery-store', command: { type: 'store', id: owner.id } }, epoch, initial.frame.world).state;
        } finally { initial.dispose(); }
        const away = setup(stored!); let restored: GrowingState;
        try {
            expect(stored!.landmarks.find(value => value.id === owner.id)!.cell).toBeUndefined();
            expect(galleries(away.layer.root)).toEqual([]);
            expect(away.layer.root.getObjectByName('place-native-shared-tree')).toBeUndefined();
            for (const id of ['l11', 'l12', 'l13']) expect(originals(away.layer.root, id).filter(visible)).toEqual([]);
            expect(forestIds(away.layer.root)).toEqual([...expectedForest, 'l11', 'l12', 'l13'].sort());
            expect(landCells(stored!, away.frame.world)).toHaveLength(75);
            restored = applyIntent(stored!, { id: 'whole-gallery-unstore', command: { type: 'unstore', id: owner.id, cell: owner.cell! } }, epoch, away.frame.world).state;
        } finally { away.dispose(); }
        const back = setup(restored!);
        try {
            expect(galleries(back.layer.root)).toHaveLength(1);
            expect(visible(back.layer.root.getObjectByName('place-native-shared-tree')!)).toBe(true);
            expect(forestIds(back.layer.root)).toEqual(expectedForest);
            expect(back.layer.objects.size).toBe(35);
        } finally { back.dispose(); }
    }, 30_000);
});
