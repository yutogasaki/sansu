import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../prototypes/place-qa/native-forest-stage4-manifest.json';
import nativeManifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import type { GrowingState } from '../../../../domain/growingIsland';
import { treeAge } from '../../../../domain/growingIsland/nature';
import { RULES } from '../../../../domain/growingIsland/rules';
import { treeForm } from '../treeSilhouettes';
import { compileWorldDefinition } from '../../../../domain/growingIsland/worldDefinition';
import { sceneLayout } from '../sceneLayout';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { makeNativeAuthoredForest, type NativeAuthoredForest } from './nativeAuthoredForest';

const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const compressed = readFileSync('prototypes/place-qa/native-forest-stage4.glb.gz'), bytes = gunzipSync(compressed);
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
async function load() {
    const scene = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    scene.userData.sourceId = manifest.source.id; scene.userData.sourceSha256 = sha(bytes); return scene;
}
let source: T.Group, factory: NativeAuthoredForest, native: NativeGrowingKit, state: GrowingState, layout: ReturnType<typeof sceneLayout>;
const trees = new Map<string, T.Group>();
beforeAll(async () => {
    source = await load(); factory = makeNativeAuthoredForest(source, manifest);
    const nativeBytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    native = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(nativeBytes).buffer, '')).scene, nativeManifest);
    state = JSON.parse(readFileSync('prototypes/place-qa/authored-shoulder-reference-mature.json', 'utf8')).state;
    const world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world-source-shading.json.gz')).toString()));
    layout = sceneLayout(state, false, world);
    for (const part of manifest.parts) trees.set(part.ownerId, placedTree(state, part.ownerId));
}, 30000);
afterAll(() => { factory?.dispose(); native?.dispose(); });

function placedTree(current: GrowingState, id: string) {
    const owner = current.landmarks.find(value => value.id === id)!;
    const tree = native.tree(id, owner.growth, .45), age = treeAge(current, id);
    tree.scale.multiplyScalar(age === 'lord' ? 1.75 : age === 'big' ? 1.3 : 1);
    tree.userData.ownerId = id;
    const holder = new T.Group(); holder.position.copy(layout.point(owner.cell!)); holder.add(tree); holder.updateMatrixWorld(true);
    return tree;
}

// This test observes the saved delivery, not a synthetic geometry substitute.
describe('stage4 HOLD forest delivery', () => {
    it('contains exactly the saved 128 roles and six boughs, no context/floor, with source local positions intact', () => {
        expect(sha(compressed)).toBe(manifest.artifact.sha256); expect(sha(bytes)).toBe(manifest.artifact.expandedSha256);
        expect([compressed.length, bytes.length]).toEqual([manifest.artifact.gzipBytes, manifest.artifact.expandedBytes]);
        expect(sha(readFileSync(manifest.source.artifact))).toBe(manifest.source.sha256);
        expect(manifest.counts).toMatchObject({ meshes: 134, primitives: 134, triangles: 51088, materials: 10, originalRoles: 128, derivedBoughs: 6 });
        const proof = JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native-forest-stage4-source-proof.json.gz')).toString());
        expect(proof.source.originalObjectsAndMaterialsExact).toBe(true);
        const delivered = meshes(source); expect(delivered).toHaveLength(134);
        expect(delivered.filter(mesh => mesh.userData.forestDeliveryDerived)).toHaveLength(6);
        expect(new Set(delivered.map(mesh => mesh.userData.forestDeliveryOwner))).toEqual(new Set(['l14', 'l15', 'l28', 'l29']));
        for (const mesh of delivered) {
            const row = proof.source.sourceRows[mesh.userData.forestDeliveryId]; expect(row).toBeDefined();
            expect(mesh.geometry.index!.count / 3).toBe(row.triangles);
            const position = mesh.geometry.getAttribute('position'), normal = mesh.geometry.getAttribute('normal');
            const key = (values: number[]) => Array.from(new Float32Array(values)).map(v => v === 0 ? 0 : v).join(',');
            const expected = new Set<string>(row.sourceLocalPositions.map(([x, y, z]: number[]) => key([x, z, -y])));
            const observed = new Set<string>();
            for (let i = 0; i < position.count; i++) observed.add(key([position.getX(i), position.getY(i), position.getZ(i)]));
            expect(observed).toEqual(expected);
            expect(normal.count).toBe(position.count); expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
        }
        expect(manifest.status).toMatchObject({ visual: 'HOLD', devCompositionOnly: true, strictWorldGeometryGate: false, certifiedContactPass: false });
    });

    it('matches real native tree placement and preserves every GLB vertex, normal, material and hierarchy with only renderer translation', () => {
        source.updateMatrixWorld(true);
        for (const part of manifest.parts) {
            const instance = factory.instance(state, layout, trees.get(part.ownerId)!, native.manifest)!; expect(instance).toBeDefined();
            expect(instance.name).toBe('authored-forest-tree');
            instance.position.toArray().forEach((value, i) => expect(value).toBeCloseTo([-layout.center, 0, -2][i], 12));
            instance.scale.toArray().forEach(value => expect(value).toBeCloseTo(1, 12)); instance.updateMatrixWorld(true);
            const original = source.children.find(node => node.userData.nativeForestOwner === part.ownerId)!;
            const originals = new Map(meshes(original).map(mesh => [mesh.userData.forestDeliveryId, mesh]));
            expect(meshes(instance)).toHaveLength(part.meshes);
            for (const mesh of meshes(instance)) {
                const expected = originals.get(mesh.userData.forestDeliveryId)!;
                expect(mesh.geometry).toBe(expected.geometry); expect(mesh.material).toBe(expected.material);
                expect(mesh.matrix.elements).toEqual(expected.matrix.elements);
                expect(mesh.userData).toMatchObject({ ownerId: part.ownerId, objectId: part.ownerId, ownerIds: [part.ownerId],
                    nativeSharedGeometry: true, nativeSharedMaterial: true, artStatus: 'HOLD', nativePart: 'authored-forest-tree' });
                const attribute = mesh.geometry.getAttribute('position'), a = new T.Vector3(), b = new T.Vector3();
                let maximum = 0;
                for (let i = 0; i < attribute.count; i++) {
                    a.fromBufferAttribute(attribute, i).applyMatrix4(mesh.matrixWorld);
                    b.fromBufferAttribute(attribute, i).applyMatrix4(expected.matrixWorld).add(new T.Vector3(-layout.center, 0, -2));
                    maximum = Math.max(maximum, a.distanceTo(b));
                }
                expect(maximum).toBeLessThan(1e-12);
            }
        }
    });

    it('follows new owners, ordinary cells and all mature ages while preserving species and source resources', () => {
        const destination = { x: 12, z: -9 };
        for (const form of ['spread', 'branch', 'spire'] as const) {
            const id = Array.from({ length: 100 }, (_, i) => `new-tree-${i}`).find(value => treeForm(value) === form)!;
            const next = structuredClone(state), owner = next.landmarks.find(value => value.id === 'l14')!;
            owner.id = id; owner.cell = destination;
            let selected: string | undefined, firstSize: T.Vector3 | undefined;
            for (const [ageHours, scale] of [[0, 1], [RULES.bigTreeHours, 1.3], [RULES.lordTreeHours, 1.75]]) {
                owner.maturedAt = next.nature.hours - ageHours;
                const tree = placedTree(next, id), instance = factory.instance(next, layout, tree, native.manifest)!;
                expect(instance).toBeDefined(); instance.updateMatrixWorld(true);
                const template = manifest.parts.find(part => part.ownerId === instance.userData.templateOwnerId)!;
                expect(template.binding.sourcePart).toBe(tree.userData.nativePart);
                expect(instance.userData.ownerIds).toEqual([id]);
                selected ??= template.ownerId; expect(template.ownerId).toBe(selected);
                const original = source.children.find(node => node.userData.nativeForestOwner === template.ownerId)!;
                const sourceMeshes = new Map(meshes(original).map(mesh => [mesh.userData.forestDeliveryId, mesh]));
                for (const mesh of meshes(instance)) {
                    const sourceMesh = sourceMeshes.get(mesh.userData.forestDeliveryId)!;
                    expect(mesh.geometry).toBe(sourceMesh.geometry); expect(mesh.material).toBe(sourceMesh.material);
                    expect(mesh.matrix.elements).toEqual(sourceMesh.matrix.elements);
                    expect(mesh.userData).toMatchObject({ ownerId: id, templateOwnerId: template.ownerId });
                }
                // Authored tree origin maps to the real current floor placement.
                const sourceOrigin = new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(template.binding.authoredMatrixWorld));
                expect(sourceOrigin.applyMatrix4(instance.matrixWorld).distanceTo(tree.getWorldPosition(new T.Vector3()))).toBeLessThan(1e-12);
                const size = new T.Box3().setFromObject(instance).getSize(new T.Vector3());
                firstSize ??= size.clone();
                expect(size.clone().divideScalar(scale).distanceTo(firstSize)).toBeLessThan(1e-10);
            }
        }
    });

    it('rejects stored, young, wrong species, wrong kit/pivot, invalid transforms and hidden owners', () => {
        for (const part of manifest.parts) {
            const tree = trees.get(part.ownerId)!;
            for (const variant of ['store', 'young', 'no-age'] as const) {
                const next = structuredClone(state), owner = next.landmarks.find(value => value.id === part.ownerId)!;
                if (variant === 'store') owner.cell = undefined;
                if (variant === 'young') owner.growth = 0;
                if (variant === 'no-age') owner.maturedAt = undefined;
                expect(factory.instance(next, layout, tree, native.manifest)).toBeUndefined();
            }
            const original = tree.scale.clone(); tree.scale.setScalar(0);
            expect(factory.instance(state, layout, tree, native.manifest)).toBeUndefined(); tree.scale.copy(original);
            tree.position.x = NaN; expect(factory.instance(state, layout, tree, native.manifest)).toBeUndefined(); tree.position.x = 0;
            const species = tree.userData.nativePart; tree.userData.nativePart = species === 'birch' ? 'willow' : 'birch';
            expect(factory.instance(state, layout, tree, native.manifest)).toBeUndefined(); tree.userData.nativePart = species;
            expect(factory.instance(state, layout, tree, { ...native.manifest, sha256: 'wrong' })).toBeUndefined();
            const badPivot = structuredClone(native.manifest); badPivot.parts[part.binding.sourcePart as 'birch'].min[0] += .1;
            if (part.binding.sourcePart !== 'willow') expect(factory.instance(state, layout, tree, badPivot)).toBeUndefined();
            tree.visible = false; expect(factory.instance(state, layout, tree, native.manifest)).toBeUndefined();
            tree.userData.authoredPreviewHidden = true;
            expect(factory.instance(state, layout, tree, native.manifest)).toBeDefined();
            delete tree.userData.authoredPreviewHidden; tree.visible = true;
            expect(factory.instance(state, { ...layout, authored: false }, tree, native.manifest)).toBeUndefined();
        }
    });

    it('shares resources across instances, isolates metadata and disposes exactly once', async () => {
        const ownSource = await load(), resources = [...new Set(meshes(ownSource).map(mesh => mesh.geometry)), ...new Set(meshes(ownSource).map(mesh => mesh.material as T.Material))];
        const spies = resources.map(value => vi.spyOn(value, 'dispose')), own = makeNativeAuthoredForest(ownSource, manifest);
        const first = own.instance(state, layout, trees.get('l14')!, native.manifest)!, second = own.instance(state, layout, trees.get('l14')!, native.manifest)!;
        expect(meshes(first)[0].geometry).toBe(meshes(second)[0].geometry); expect(meshes(first)[0].material).toBe(meshes(second)[0].material);
        first.userData.ownerIds.push('other'); expect(second.userData.ownerIds).toEqual(['l14']); expect(meshes(first)[0].userData.ownerIds).toEqual(['l14']);
        first.removeFromParent(); expect(spies.every(spy => spy.mock.calls.length === 0)).toBe(true);
        own.dispose(); own.dispose(); spies.forEach(spy => expect(spy).toHaveBeenCalledOnce());
        expect(() => own.instance(state, layout, trees.get('l14')!, native.manifest)).toThrow('disposed');
    });

    it('rejects wrong source hashes, extra geometry and swapped owner roles before instancing', async () => {
        const wrong = await load(); wrong.userData.sourceSha256 = 'wrong';
        expect(() => makeNativeAuthoredForest(wrong, manifest)).toThrow('identity');
        wrong.userData.sourceSha256 = manifest.artifact.expandedSha256;
        const extra = meshes(wrong)[0].clone(); wrong.add(extra);
        expect(() => makeNativeAuthoredForest(wrong, manifest)).toThrow('unexpected'); wrong.remove(extra);
        const mesh = meshes(wrong)[0], owner = mesh.userData.forestDeliveryOwner; mesh.userData.forestDeliveryOwner = 'l33';
        expect(() => makeNativeAuthoredForest(wrong, manifest)).toThrow('primitive'); mesh.userData.forestDeliveryOwner = owner;
        makeNativeAuthoredForest(wrong, manifest).dispose();
    });
});
