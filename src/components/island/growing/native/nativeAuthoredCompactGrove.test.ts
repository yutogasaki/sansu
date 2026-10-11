import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import type { GrowingState } from '../../../../domain/growingIsland/types';
import { GardenGeometry } from '../../three/garden/geometry';
import { IslandMaterials } from '../../three/primitives';
import { sceneLayout } from '../sceneLayout';
import { buildObjectLayer } from '../objectLayer';
import { makeNativeGrowingKit, type NativeGrowingKit, type NativeGrowingPart } from './nativeGrowingKit';
import { buildNativePlaceGrove } from './nativePlaceGrove';

let kit: NativeGrowingKit, world: IslandWorld, diagnostic: GrowingState;
beforeAll(async () => {
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
    world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz')).toString()));
    diagnostic = JSON.parse(readFileSync('prototypes/place-qa/authored-fixture.json', 'utf8')).state;
}, 20000);
afterAll(() => kit?.dispose());

const parts = (root: T.Object3D, part: NativeGrowingPart) => {
    const found: T.Object3D[] = []; root.traverse(object => { if (object.userData.nativePart === part) found.push(object); }); return found;
};
const meshes = (root: T.Object3D) => {
    const found: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) found.push(object); }); return found;
};
function fixture() {
    const state = structuredClone(diagnostic), layout = sceneLayout(state, false, world);
    const place = derivePlaces(state, world).find(place => place.ruleId === 'P02' && place.variant === 'cluster')!;
    expect(place.stage).toBe('grown'); expect(place.mainIds).toHaveLength(4);
    return { state, layout, place };
}

describe('the authored compact four-owner grove uses one source construction', () => {
    it('preserves source scale and crown-to-root position on the real four-cell support', () => {
        const { state, layout, place } = fixture(), before = structuredClone(state), g = new GardenGeometry(), gallery = vi.fn(() => new T.Group());
        buildNativePlaceGrove(g, state, layout, place, kit, gallery); g.root.updateMatrixWorld(true);
        const shared = g.root.getObjectByName('place-native-shared-tree')!;
        const trunks = parts(g.root, 'hollow-trunk'), crowns = parts(g.root, 'fan-crown');
        expect(trunks).toHaveLength(1); expect(crowns).toHaveLength(1);
        expect(g.root.getObjectsByProperty('name', 'place-native-owned-tree')).toHaveLength(0);
        expect(shared.children).toHaveLength(2);
        for (const part of [trunks[0], crowns[0]]) expect(part.scale.toArray()).toEqual([.45, .45, .45]);
        const ownerCells = place.mainIds.map(id => state.landmarks.find(owner => owner.id === id)!.cell!);
        const ownerPoints = ownerCells.map(cell => layout.point(cell, 0));
        const expectedCenter = ownerPoints.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(.25);
        expect(shared.position.distanceTo(expectedCenter)).toBeLessThan(1e-10);
        expect(trunks[0].position.toArray()).toEqual([0, 0, 0]);
        expect(crowns[0].position.y).toBeCloseTo((manifest.parts['fan-crown'].min[1] - manifest.parts['hollow-trunk'].min[1]) * .45, 10);
        const trunkBounds = new T.Box3().setFromObject(trunks[0]), crownBounds = new T.Box3().setFromObject(crowns[0]);
        for (const [part, box] of [['hollow-trunk', trunkBounds], ['fan-crown', crownBounds]] as const) {
            const size = box.getSize(new T.Vector3());
            for (const [index, value] of size.toArray().entries()) expect(value).toBeCloseTo((manifest.parts[part].max[index] - manifest.parts[part].min[index]) * .45, 5);
        }
        expect(trunkBounds.min.y).toBeCloseTo(expectedCenter.y, 6);
        expect(trunkBounds.intersectsBox(crownBounds)).toBe(true);
        // The 1.5927-wide original trunk fits the owned 1.92-wide compact support.
        // Its footprint is evaluated against the actual source terrain, not bounds.
        const minX = Math.min(...ownerPoints.map(point => point.x)) - .46, maxX = Math.max(...ownerPoints.map(point => point.x)) + .46;
        const minZ = Math.min(...ownerPoints.map(point => point.z)) - .46, maxZ = Math.max(...ownerPoints.map(point => point.z)) + .46;
        expect(trunkBounds.min.x).toBeGreaterThan(minX); expect(trunkBounds.max.x).toBeLessThan(maxX);
        expect(trunkBounds.min.z).toBeGreaterThan(minZ); expect(trunkBounds.max.z).toBeLessThan(maxZ);
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
            const position = { x: T.MathUtils.lerp(trunkBounds.min.x, trunkBounds.max.x, i / 4), y: expectedCenter.y, z: T.MathUtils.lerp(trunkBounds.min.z, trunkBounds.max.z, j / 4) };
            expect(world.floorAt(layout.logicalAt(position)), JSON.stringify(position)).toBeDefined();
        }
        const sourceMeshes = meshes(shared);
        expect(sourceMeshes.every(mesh => mesh.userData.nativeSharedGeometry && mesh.userData.nativeSharedMaterial)).toBe(true);
        expect([...new Set(sourceMeshes.map(mesh => mesh.userData.ownerId))].sort()).toEqual([...place.mainIds].sort());
        expect(sourceMeshes.every(mesh => JSON.stringify(mesh.userData.ownerIds) === JSON.stringify(place.mainIds))).toBe(true);
        expect(shared.userData.supportCells).toEqual(ownerCells); expect(shared.userData.authoredGalleryArt).toBe('pending');
        expect(gallery).toHaveBeenCalledTimes(place.walkSurface.length ? 1 : 0);
        expect(state).toEqual(before); g.dispose();
    });
    it('keeps every member selectable and restores individual forms after the actual owner set splits', () => {
        const { state, layout, place } = fixture(), before = structuredClone(state), materials = new IslandMaterials('moon-garden');
        const joined = buildObjectLayer(materials, state, layout, undefined, undefined, [], kit);
        const sourceMeshes = meshes(joined.placeRoot.getObjectByName('place-native-shared-tree')!);
        expect(new Set(sourceMeshes.map(mesh => mesh.userData.objectId))).toEqual(new Set(place.mainIds));
        for (const id of place.mainIds) expect(joined.objects.has(id)).toBe(true);
        const movedId = place.mainIds[0], moved = structuredClone(state);
        moved.landmarks.find(owner => owner.id === movedId)!.cell = { x: 12, z: -9 };
        expect(world.owns({ x: 12, z: -9 })).toBe(true);
        expect(derivePlaces(moved, world).some(other => other.ruleId === 'P02' && other.mainIds.includes(movedId))).toBe(false);
        const split = buildObjectLayer(materials, moved, sceneLayout(moved, false, world), undefined, undefined, [], kit);
        expect(split.placeRoot.getObjectByName('place-native-shared-tree')).toBeUndefined();
        expect(split.objects.get(movedId)!.children[0].visible).toBe(true);
        expect(parts(split.objects.get(movedId)!, 'willow').length + parts(split.objects.get(movedId)!, 'birch').length + parts(split.objects.get(movedId)!, 'spire').length).toBe(1);
        for (const id of place.mainIds) expect(split.objects.has(id)).toBe(true);
        expect(state).toEqual(before); expect(moved.nature).toEqual(before.nature); expect(moved.town).toEqual(before.town); expect(moved.placeProgress).toEqual(before.placeProgress);
        joined.dispose(); split.dispose(); materials.dispose();
    });
    it('keeps legacy compact groves and the other authored variants on their existing construction', () => {
        const { state, place, layout } = fixture();
        for (const [candidateLayout, candidate] of [[sceneLayout(state), place], [layout, { ...place, variant: 'court', walkSurface: [] }]] as const) {
            const g = new GardenGeometry(); buildNativePlaceGrove(g, state, candidateLayout, candidate, kit, () => new T.Group());
            expect(g.root.getObjectByName('place-native-shared-tree')).toBeUndefined();
            expect(parts(g.root, 'hollow-trunk')).toHaveLength(4);
            expect(parts(g.root, 'hollow-trunk').every(trunk => trunk.scale.y === .39)).toBe(true);
            g.dispose();
        }
    });
});
