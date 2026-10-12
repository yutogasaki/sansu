import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json';
import profile from '../../../../../docs/design/2026-10-12-authored-cove-entrance/profile-boundaries.json';
import type { AuthoredCoveAssembly } from '../../../../domain/growingIsland/authoredCoveWorld';
import { cloneGrowingPreviewMaterial } from '../growingShaderWarmup';
import { makeNativeAuthoredCove, type NativeAuthoredCove } from './nativeAuthoredCove';

const compressed = readFileSync(manifest.artifact.path.slice(1));
const bytes = gunzipSync(compressed);
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const meshes = (root: T.Object3D) => {
    const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) result.push(object); }); return result;
};
async function load() {
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    // Same identity handshake as the loader, after checking the downloaded bytes.
    gltf.scene.userData.sourceId = manifest.source.id;
    gltf.scene.userData.sourceSha256 = sha(bytes);
    return gltf.scene;
}
function assembly(): AuthoredCoveAssembly {
    return { sourceId: manifest.source.id, sourceSha256: manifest.source.sha256,
        placeId: 'P04:p6,p7,p9', placeRevision: 'fixture-current-P04', ownerIds: ['p6', 'p7', 'p9', 'l32'], playId: 'p9',
        transform: { pivot: [13.9, .89, 1.2], position: { x: 8, y: .0475, z: .5 }, scale: .45, yaw: 0 } };
}
let source: T.Group, kit: NativeAuthoredCove;
beforeAll(async () => { source = await load(); kit = makeNativeAuthoredCove(source, manifest); });
afterAll(() => kit?.dispose());

/** Compare every delivered vertex/normal, not just bounds or the manifest. */
function compareGeometry(source: T.Group, instance: T.Group, plan: AuthoredCoveAssembly, center: number) {
    source.updateMatrixWorld(true); instance.updateMatrixWorld(true);
    const sourceMeshes = meshes(source), resultMeshes = meshes(instance);
    expect(resultMeshes).toHaveLength(sourceMeshes.length);
    const pivot = new T.Vector3(...plan.transform.pivot), rotation = new T.Matrix4().makeRotationY(plan.transform.yaw);
    const expected = new T.Vector3(), actual = new T.Vector3();
    let maxPositionError = 0, maxNormalError = 0, vertices = 0;
    for (const [index, original] of sourceMeshes.entries()) {
        const result = resultMeshes[index];
        expect(result.material).toBe(original.material);
        expect(result.geometry.index!.array).toEqual(original.geometry.index!.array);
        expect(Object.keys(result.geometry.attributes)).toEqual(Object.keys(original.geometry.attributes));
        const positions = original.geometry.getAttribute('position'), normals = original.geometry.getAttribute('normal');
        const resultPositions = result.geometry.getAttribute('position'), resultNormals = result.geometry.getAttribute('normal');
        const sourceNormalMatrix = new T.Matrix3().getNormalMatrix(original.matrixWorld);
        const resultNormalMatrix = new T.Matrix3().getNormalMatrix(result.matrixWorld);
        for (let vertex = 0; vertex < positions.count; vertex++) {
            expected.fromBufferAttribute(positions, vertex).applyMatrix4(original.matrixWorld).sub(pivot)
                .multiplyScalar(plan.transform.scale).applyMatrix4(rotation)
                .add(new T.Vector3(plan.transform.position.x - center, plan.transform.position.y, plan.transform.position.z - 2));
            actual.fromBufferAttribute(resultPositions, vertex).applyMatrix4(result.matrixWorld);
            maxPositionError = Math.max(maxPositionError, expected.distanceTo(actual));
            expected.fromBufferAttribute(normals, vertex).applyNormalMatrix(sourceNormalMatrix).transformDirection(rotation);
            actual.fromBufferAttribute(resultNormals, vertex).applyNormalMatrix(resultNormalMatrix);
            maxNormalError = Math.max(maxNormalError, expected.distanceTo(actual));
            vertices++;
        }
    }
    expect(vertices).toBeGreaterThan(40000);
    expect(maxPositionError).toBeLessThan(2e-6);
    expect(maxNormalError).toBeLessThan(2e-7);
}

describe('authored P04 cove shell delivery', () => {
    it('expands to the exact reviewed source and excludes all apron/floor geometry', () => {
        expect(bytes.equals(readFileSync(manifest.source.artifact))).toBe(true);
        expect(sha(bytes)).toBe(manifest.source.sha256);
        expect(sha(bytes)).toBe(manifest.artifact.expandedSha256);
        expect(sha(compressed)).toBe(manifest.artifact.sha256);
        expect(bytes.length).toBe(manifest.artifact.expandedBytes);
        expect(compressed.length).toBe(manifest.artifact.gzipBytes);
        expect(manifest.source.sha256).toBe(profile.sourceGLBSha256);
        expect(manifest.counts).toEqual({ nodes: 18, primitives: 19, triangles: 79384, materials: 4 });
        expect(source.children.map(node => node.userData.name)).toEqual(profile.nodes.map(node => node.name));
        const instance = kit.instance(assembly(), { center: 5 });
        expect(meshes(instance).reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0)).toBe(79384);
        expect(meshes(instance).some(mesh => /apron|bank|floor/i.test(mesh.name))).toBe(false);
        expect([...new Set(meshes(instance).flatMap(mesh => mesh.userData.sourceNative05Names))]).toEqual(profile.nodes.map(node => node.name));
    });

    it('preserves every source vertex/normal and the exact original four material objects under rigid transforms', () => {
        // Rotated/moved cases test the adapter math only, not new domain eligibility.
        for (const [center, yaw, x, y, z] of [[5, 0, 8, .0475, .5], [7, .7, 8, .0475, .5], [-3, -1.2, 10, .15, -2]]) {
            const plan = { ...assembly(), transform: { ...assembly().transform, yaw, position: { x, y, z } } };
            compareGeometry(source, kit.instance(plan, { center }), plan, center);
        }
        const materials = [...new Set(meshes(source).map(mesh => mesh.material as T.MeshStandardMaterial))];
        expect(materials).toHaveLength(4);
        for (const material of materials) {
            const original = profile.materials.find(entry => entry.name === material.name)!;
            expect(material.color.toArray()).toEqual(original.pbrMetallicRoughness.baseColorFactor.slice(0, 3));
            expect(material.roughness).toBe(original.pbrMetallicRoughness.roughnessFactor);
            expect(material.metalness).toBe(original.pbrMetallicRoughness.metallicFactor);
            expect(material.side).toBe(T.DoubleSide);
            if (material instanceof T.MeshPhysicalMaterial) {
                expect(material.transmission).toBe(original.extensions!.KHR_materials_transmission.transmissionFactor);
                expect(material.ior).toBe(original.extensions!.KHR_materials_ior.ior);
            }
        }
    });

    it('bakes full nested node transforms once, including their source normals', async () => {
        const nested = await load();
        nested.position.set(.17, .23, -.14); nested.rotation.y = .31;
        nested.children[3].rotation.z = -.21; nested.children[3].scale.set(1.04, .98, 1.02);
        const transformed = makeNativeAuthoredCove(nested, manifest), plan = assembly();
        compareGeometry(nested, transformed.instance(plan, { center: 5 }), plan, 5);
        transformed.dispose();
    });

    it('binds all source primitives only to the current P04 owners without mutating the assembly', () => {
        const plan = assembly(), before = structuredClone(plan), root = kit.instance(plan, { center: 5 });
        expect(root.name).toBe('authored-cove-shell');
        for (const node of [root, ...meshes(root)]) {
            expect(node.userData).toMatchObject({ nativePart: 'authored-cove-shell', sourceId: manifest.source.id,
                sourceSha256: manifest.source.sha256, ownerId: 'p9', objectId: 'p9', ownerIds: ['p6', 'p7', 'p9', 'l32'],
                placeId: plan.placeId, placeRevision: plan.placeRevision });
        }
        root.userData.ownerIds.push('unrelated');
        expect(meshes(root)[0].userData.ownerIds).toEqual(plan.ownerIds);
        expect(plan).toEqual(before);
    });

    it('shares geometry/materials between instances and disposes them exactly once at factory shutdown', async () => {
        const loaded = await load(), originalGeometry = [...new Set(meshes(loaded).map(mesh => mesh.geometry))];
        const originalDisposed = originalGeometry.map(geometry => vi.spyOn(geometry, 'dispose'));
        const shared = makeNativeAuthoredCove(loaded, manifest);
        expect(originalDisposed.every(spy => spy.mock.calls.length === 1)).toBe(true);
        const first = shared.instance(assembly(), { center: 5 }), second = shared.instance(assembly(), { center: 5 });
        const firstMeshes = meshes(first), secondMeshes = meshes(second);
        const geometryDisposes = firstMeshes.map(mesh => vi.spyOn(mesh.geometry, 'dispose'));
        const materialDisposes = [...new Set(firstMeshes.map(mesh => mesh.material as T.Material))].map(material => vi.spyOn(material, 'dispose'));
        for (const [index, mesh] of firstMeshes.entries()) {
            expect(mesh.geometry).toBe(secondMeshes[index].geometry); expect(mesh.material).toBe(secondMeshes[index].material);
            expect(mesh.userData.nativeSharedGeometry).toBe(true); expect(mesh.userData.nativeSharedMaterial).toBe(true);
            const preview = cloneGrowingPreviewMaterial(mesh.material as T.Material);
            preview.transparent = true; preview.opacity = .4;
            expect((mesh.material as T.Material).opacity).toBe(1);
            expect(preview).not.toBe(mesh.material); preview.dispose();
        }
        first.removeFromParent(); first.clear();
        expect(geometryDisposes.every(spy => spy.mock.calls.length === 0)).toBe(true);
        expect(materialDisposes.every(spy => spy.mock.calls.length === 0)).toBe(true);
        shared.dispose(); shared.dispose();
        expect(geometryDisposes.every(spy => spy.mock.calls.length === 1)).toBe(true);
        expect(materialDisposes.every(spy => spy.mock.calls.length === 1)).toBe(true);
        expect(() => shared.instance(assembly(), { center: 5 })).toThrow('disposed');
    });

    it('rejects source/plan mismatches, lost primitives, unproved pivots/scales and missing owner bindings', () => {
        const wrongIdentity = source.clone(true); wrongIdentity.userData.sourceSha256 = '0'.repeat(64);
        expect(() => makeNativeAuthoredCove(wrongIdentity, manifest)).toThrow('source identity');
        const lost = source.clone(true); lost.remove(lost.children[0]);
        expect(() => makeNativeAuthoredCove(lost, manifest)).toThrow('counts differ');
        const extra = source.clone(true), added = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
        added.name = 'unowned-floor'; extra.add(added);
        expect(() => makeNativeAuthoredCove(extra, manifest)).toThrow('boundary differs');
        added.geometry.dispose(); (added.material as T.Material).dispose();
        for (const changed of [
            { ...assembly(), sourceSha256: '0'.repeat(64) },
            { ...assembly(), sourceId: 'different-candidate' },
            { ...assembly(), ownerIds: ['p6', 'p7'] },
            { ...assembly(), ownerIds: ['p9', 'p9'] },
            { ...assembly(), transform: { ...assembly().transform, scale: .46 } },
            { ...assembly(), transform: { ...assembly().transform, pivot: [0, 0, 0] as [number, number, number] } },
            { ...assembly(), transform: { ...assembly().transform, yaw: NaN } },
        ]) expect(() => kit.instance(changed, { center: 5 })).toThrow();
    });
});
