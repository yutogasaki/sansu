import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../prototypes/place-qa/native-shoulder-manifest.json';
import nativeManifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import type { GrowingState } from '../../../../domain/growingIsland';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import type { WorldDefinition } from '../../../../domain/growingIsland/worldTypes';
import { IslandMaterials } from '../../three/primitives';
import { buildObjectLayer, type ObjectLayer } from '../objectLayer';
import { sceneLayout } from '../sceneLayout';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { makeNativeAuthoredShoulder, shoulderFloorFingerprint, type NativeAuthoredShoulder } from './nativeAuthoredShoulder';

const sourceFolder = process.env.SANSU_SHOULDER_SOURCE_DIR ?? 'docs/design/2026-10-12-authored-central-shoulder';
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
const compressed = readFileSync('prototypes/place-qa/native-shoulder-components.glb.gz'), bytes = gunzipSync(compressed);
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
const triangles = (root: T.Object3D) => meshes(root).reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0);
async function load() {
    const scene = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    scene.userData.sourceId = manifest.source.id; scene.userData.sourceSha256 = sha(bytes); return scene;
}
let kit: NativeAuthoredShoulder, native: NativeGrowingKit, source: T.Group, original: T.Group;
let world: IslandWorld, state: GrowingState, layout: ReturnType<typeof sceneLayout>, layer: ObjectLayer, materials: IslandMaterials;
beforeAll(async () => {
    source = await load(); kit = makeNativeAuthoredShoulder(source, manifest);
    const raw = readFileSync(resolve(sourceFolder, 'central-shoulder-components-normal-v2.glb'));
    expect(sha(raw)).toBe(manifest.source.sha256);
    original = (await new GLTFLoader().parseAsync(Uint8Array.from(raw).buffer, '')).scene;
    world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync(resolve(sourceFolder, 'input/candidate-world.json.gz'))).toString()));
    state = JSON.parse(readFileSync(resolve(sourceFolder, 'input/candidate-state.json'), 'utf8')).state;
    const nativeBytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    expect(sha(nativeBytes)).toBe(nativeManifest.sha256);
    native = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(nativeBytes).buffer, '')).scene, nativeManifest);
    materials = new IslandMaterials('moon-garden'); layout = sceneLayout(state, false, world);
    layer = buildObjectLayer(materials, state, layout, undefined, undefined, [], native);
}, 30000);
afterAll(() => {
    layer?.dispose(); materials?.dispose(); native?.dispose(); kit?.dispose();
    if (original) {
        new Set(meshes(original).map(mesh => mesh.geometry)).forEach(value => value.dispose());
        new Set(meshes(original).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material])).forEach(value => value.dispose());
    }
});
function tree(ownerId: string) {
    const roots: T.Object3D[] = [];
    layer.root.traverse(node => {
        if (!/^growing-tree-/.test(node.name) || !node.userData.nativePart || (node.userData.ownerId ?? node.userData.objectId) !== ownerId) return;
        for (let parent: T.Object3D | null = node; parent; parent = parent.parent) if (!parent.visible) return;
        roots.push(node);
    });
    expect(roots).toHaveLength(1); return roots[0];
}
function geometryWorld(definition: WorldDefinition) {
    // Only the floor under the same real tree changes in these counterfactuals.
    // No invented site/edge can make an otherwise invalid root attachment pass.
    return compileWorldDefinition({ ...definition, edges: [], districts: definition.districts.map(district =>
        ({ ...district, sites: [], ports: [], shoreAccess: undefined })) });
}

describe('conditional authored shoulder component delivery', () => {
    it('delivers only source soil primitive 2 and three roots, preserving every selected attribute/index byte and material', () => {
        expect(sha(compressed)).toBe(manifest.artifact.sha256); expect(sha(bytes)).toBe(manifest.artifact.expandedSha256);
        expect(compressed.length).toBe(manifest.artifact.gzipBytes); expect(bytes.length).toBe(manifest.artifact.expandedBytes);
        expect(manifest.counts).toEqual({ nodes: 4, primitives: 4, triangles: 8677, materials: 3 });
        const rawSoil = original.children.find(node => node.userData.name === manifest.soil.node)!;
        expect(meshes(rawSoil).map(mesh => mesh.geometry.index!.count / 3)).toEqual([1722, 4893, 8569]);
        const selected = [meshes(rawSoil)[2], ...manifest.roots.map(root => meshes(original.children.find(node => node.userData.name === root.node)!)[0])];
        const delivered = meshes(source); expect(delivered).toHaveLength(4); expect(triangles(source)).toBe(8677);
        for (const [i, actual] of delivered.entries()) {
            const expected = selected[i];
            expect(actual.geometry.index!.array).toEqual(expected.geometry.index!.array);
            expect(Object.keys(actual.geometry.attributes)).toEqual(Object.keys(expected.geometry.attributes));
            for (const name of Object.keys(expected.geometry.attributes))
                expect(actual.geometry.getAttribute(name).array).toEqual(expected.geometry.getAttribute(name).array);
            const a = actual.material as T.MeshStandardMaterial, b = expected.material as T.MeshStandardMaterial;
            expect(a.name).toBe(b.name); expect(a.color.toArray()).toEqual(b.color.toArray());
            expect([a.roughness, a.metalness, a.side]).toEqual([b.roughness, b.metalness, b.side]);
        }
    });

    it('renders source-world geometry once with only renderer translation, and soil never supplies pointer support', () => {
        const soil = kit.instanceSoil(layout)!; expect(soil).toBeDefined(); expect(triangles(soil)).toBe(8569);
        const instances = [soil, ...manifest.roots.map(root => kit.instanceRoots(state, layout, tree(root.ownerId), native.manifest)!)];
        expect(instances.every(Boolean)).toBe(true);
        for (const [i, instance] of instances.entries()) {
            instance.updateWorldMatrix(true, true); expect(instance.scale.toArray()).toEqual([1, 1, 1]);
            expect(instance.position.toArray()).toEqual([-layout.center, 0, -2]);
            const actual = meshes(instance)[0], expected = meshes(source)[i];
            expect(actual.geometry).toBe(expected.geometry); expect(actual.material).toBe(expected.material);
            let difference = 0;
            const attribute = actual.geometry.getAttribute('position'), a = new T.Vector3(), b = new T.Vector3();
            for (let v = 0; v < attribute.count; v++) {
                a.fromBufferAttribute(attribute, v).applyMatrix4(actual.matrixWorld);
                b.fromBufferAttribute(expected.geometry.getAttribute('position'), v).add(new T.Vector3(-layout.center, 0, -2));
                difference = Math.max(difference, a.distanceTo(b));
            }
            expect(difference).toBeLessThan(1e-12);
            expect(actual.userData).toMatchObject({ sourceId: manifest.source.id, sourceSha256: manifest.source.sha256,
                artifactSha256: manifest.artifact.expandedSha256, nativeSharedGeometry: true, nativeSharedMaterial: true, noNewOwnerOrRights: true });
            if (i) {
                expect(instance.name).toBe('authored-tree-root-continuation'); expect(triangles(instance)).toBe(36);
                expect(actual.userData).toMatchObject({ objectId: manifest.roots[i - 1].ownerId, ownerIds: [manifest.roots[i - 1].ownerId] });
            }
        }
        const ray = new T.Raycaster(new T.Vector3(7 - layout.center, 10, -8), new T.Vector3(0, -1, 0));
        expect(ray.intersectObject(soil, true)).toEqual([]);
        expect(kit.instanceSoil({ ...layout, authored: false })).toBeUndefined();
    });

    it('accepts the actual native trees after non-geometric time changes, and removes roots on move/store/young/scale/source/visibility changes', () => {
        for (const root of manifest.roots) {
            const actual = tree(root.ownerId), unchanged = structuredClone(state);
            const later = unchanged.landmarks.find(owner => owner.id === root.ownerId)!;
            later.growth += 1; later.maturedAt = (later.maturedAt ?? 0) + 1;
            expect(kit.instanceRoots(unchanged, layout, actual, native.manifest)).toBeDefined();
            for (const variant of ['move', 'store', 'young'] as const) {
                const next = structuredClone(state), owner = next.landmarks.find(value => value.id === root.ownerId)!;
                if (variant === 'move') owner.cell = { ...owner.cell!, x: owner.cell!.x + 1 };
                if (variant === 'store') owner.cell = undefined;
                if (variant === 'young') owner.growth = 6;
                expect(kit.instanceRoots(next, layout, actual, native.manifest)).toBeUndefined();
            }
            const scale = actual.scale.clone(); actual.scale.multiplyScalar(1.3);
            expect(kit.instanceRoots(state, layout, actual, native.manifest)).toBeUndefined(); actual.scale.copy(scale);
            actual.position.x += .001; expect(kit.instanceRoots(state, layout, actual, native.manifest)).toBeUndefined(); actual.position.x -= .001;
            expect(kit.instanceRoots(state, layout, actual, { ...native.manifest, sha256: 'changed' })).toBeUndefined();
            const part = actual.userData.nativePart; actual.userData.nativePart = 'hollow-trunk';
            expect(kit.instanceRoots(state, layout, actual, native.manifest)).toBeUndefined(); actual.userData.nativePart = part;
            actual.visible = false; expect(kit.instanceRoots(state, layout, actual, native.manifest)).toBeUndefined();
            actual.userData.authoredPreviewHidden = true;
            expect(kit.instanceRoots(state, layout, actual, native.manifest)).toBeDefined();
            delete actual.userData.authoredPreviewHidden; actual.visible = true;
        }
    });

    it('keeps root contact after normal/PBR/floor-ID/material splitting and triangle reordering, but rejects changed physical support', () => {
        const definition = structuredClone(world.definition);
        definition.revision = 'same-geometry-different-shading';
        definition.districts = definition.districts.map(district => ({ ...district, floors: district.floors.flatMap(floor => {
            const vertices = floor.vertices.map(vertex => ({ ...vertex, normal: { x: .2, y: .9, z: .3 } }));
            const groups: number[][] = [[], []];
            for (let i = floor.indices.length - 3; i >= 0; i -= 3) groups[(i / 3) % 2].push(floor.indices[i + 1], floor.indices[i + 2], floor.indices[i]);
            return groups.filter(indices => indices.length).map((indices, i) => ({ ...floor, id: `${floor.id}-material-${i}`, vertices, indices,
                material: { roughness: .7, metalness: .1, doubleSided: true } }));
        }) }));
        const split = geometryWorld(definition), splitLayout = { ...layout, world: split };
        expect(kit.instanceSoil(splitLayout)).toBeDefined();
        for (const part of manifest.roots) {
            expect(shoulderFloorFingerprint(split.floors, part.binding.localFloor)).toBe(part.binding.localFloor.fingerprint);
            expect(kit.instanceRoots(state, splitLayout, tree(part.ownerId), native.manifest)).toBeDefined();
        }
        const changed = structuredClone(definition);
        changed.districts = changed.districts.map(district => ({ ...district, floors: district.floors.map(floor => ({ ...floor,
            vertices: floor.vertices.map(vertex => ({ ...vertex, point: { ...vertex.point, y: vertex.point.y + .001 } })) })) }));
        const differentFloor = { ...layout, world: geometryWorld(changed) };
        expect(kit.instanceSoil(differentFloor)).toBeUndefined();
        for (const part of manifest.roots) expect(kit.instanceRoots(state, differentFloor, tree(part.ownerId), native.manifest)).toBeUndefined();
    });

    it('omits closed soil when the extension is absent or its top union was cut, while leaving the domain floor untouched', () => {
        const definition = structuredClone(world.definition), snapshot = JSON.stringify(world.definition);
        definition.districts = definition.districts.filter(district => district.id !== manifest.extension.districtId);
        expect(kit.instanceSoil({ ...layout, world: geometryWorld(definition) })).toBeUndefined();
        const cut = structuredClone(world.definition), district = cut.districts.find(value => value.id === manifest.extension.districtId)!;
        district.floors = district.floors.map(floor => ({ ...floor, indices: floor.indices.slice(3) }));
        expect(kit.instanceSoil({ ...layout, world: geometryWorld(cut) })).toBeUndefined();
        expect(JSON.stringify(world.definition)).toBe(snapshot); expect(world.floorAt({ x: 7, z: -6 })).toBeDefined();
    });

    it('shares immutable resources, isolates instance metadata and disposes each source resource exactly once', async () => {
        const source = await load(), geometries = [...new Set(meshes(source).map(mesh => mesh.geometry))];
        const materials = [...new Set(meshes(source).map(mesh => mesh.material as T.Material))];
        const disposal = [...geometries, ...materials].map(resource => vi.spyOn(resource, 'dispose'));
        const own = makeNativeAuthoredShoulder(source, manifest), first = own.instanceRoots(state, layout, tree('l33'), native.manifest)!;
        const second = own.instanceRoots(state, layout, tree('l33'), native.manifest)!;
        expect(meshes(first)[0].geometry).toBe(meshes(second)[0].geometry); expect(meshes(first)[0].material).toBe(meshes(second)[0].material);
        first.userData.ownerIds.push('other'); expect(second.userData.ownerIds).toEqual(['l33']); expect(meshes(first)[0].userData.ownerIds).toEqual(['l33']);
        first.removeFromParent(); expect(disposal.every(spy => spy.mock.calls.length === 0)).toBe(true);
        own.dispose(); own.dispose(); disposal.forEach(spy => expect(spy).toHaveBeenCalledOnce());
        expect(() => own.instanceSoil(layout)).toThrow('disposed');
    });
});
