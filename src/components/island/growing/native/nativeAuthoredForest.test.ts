import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { authoredAccessWorld } from '../../../../domain/growingIsland/authoredWorldAccess.fixture';
import { compileWorldDefinition } from '../../../../domain/growingIsland/worldDefinition';
import { newLegacyIsland as newIsland } from '../../../../domain/growingIsland/legacy.fixture';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import { RULES } from '../../../../domain/growingIsland/rules';
import { treeAge } from '../../../../domain/growingIsland/nature';
import { GardenGeometry } from '../../three/garden/geometry';
import { IslandMaterials } from '../../three/primitives';
import { buildObjectLayer } from '../objectLayer';
import { sceneLayout } from '../sceneLayout';
import { treeForm, type TreeForm } from '../treeSilhouettes';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { buildNativePlaceGrove } from './nativePlaceGrove';

let kit: NativeGrowingKit;
beforeAll(async () => {
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
}, 20000);
afterAll(() => kit?.dispose());

const ownerIds = (['spread', 'spire', 'branch', 'spread'] as TreeForm[]).map((form, owner) =>
    Array.from({ length: 100 }, (_, i) => `forest-${owner}-${i}`).find(id => treeForm(id) === form)!);
const sourcePart = (form: TreeForm) => form === 'spread' ? 'willow' : form === 'spire' ? 'spire' : 'birch';
const meshes = (root: T.Object3D) => {
    const found: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) found.push(object); }); return found;
};
function fixture(growth = [18, 18, 0, 6], freeform = false) {
    const state = newIsland('authored-forest-render-fixture', 1000), { definition, world } = authoredAccessWorld();
    // Explicit rendering fixtures prove preservation of the supplied ages, not
    // real elapsed-time maturation or purchasing. Production clock QA is separate.
    state.nature.hours = RULES.bigTreeHours + 1;
    state.landmarks = growth.map((value, i) => ({ id: ownerIds[i], kind: 'sapling' as const,
        cell: freeform && i === 3 ? { x: 2, z: -3 } : { x: i, z: -2 }, growth: value,
        ...(value >= 18 ? { maturedAt: 0 } : {}) }));
    state.landmarks.push({ id: 'forest-seat', kind: 'bench', cell: { x: 0, z: -1 }, growth: 0 });
    return { state, definition, world, layout: sceneLayout(state, false, world) };
}
function dispose(g: GardenGeometry) {
    for (const mesh of meshes(g.root)) if (!mesh.userData.nativeSharedGeometry) mesh.geometry.dispose();
    g.dispose();
}

describe('authored noncompact forests preserve their actual owners', () => {
    it('restores the source species and supplied growth when a new seed joins an already grown P01', () => {
        for (const hours of [RULES.bigTreeHours + 1, RULES.lordTreeHours + 1]) for (const newGrowth of [0, 6, 18]) {
            const { state, layout } = fixture([18, 18, newGrowth, 6]); state.nature.hours = hours;
            const before = structuredClone(state);
            const material = new IslandMaterials('moon-garden'), layer = buildObjectLayer(material, state, layout, undefined, undefined, [], kit);
            const place = layer.places.find(place => place.ruleId === 'P01')!;
            expect(place.stage, JSON.stringify(place.missing)).toBe('grown'); expect(place.mainIds).toHaveLength(4);
            const trees = layer.placeRoot.getObjectsByProperty('name', 'place-native-owned-tree');
            expect(trees.map(tree => tree.userData.ownerId).sort()).toEqual([...ownerIds].sort());
            for (const root of trees) {
                const owner = state.landmarks.find(owner => owner.id === root.userData.ownerId)!, tree = root.children[0];
                const expected = kit.tree(owner.id, owner.growth, .45);
                const age = treeAge(state, owner.id); expected.scale.multiplyScalar(age === 'lord' ? 1.75 : age === 'big' ? 1.3 : 1);
                expect(layer.objects.get(owner.id)!.children[0].visible).toBe(false);
                expect(tree.visible).toBe(true); expect(root.userData.growth).toBe(owner.growth); expect(root.userData.sourceScale).toBe(.45);
                expect(tree.userData.nativePart).toBe(sourcePart(treeForm(owner.id))); expect(tree.userData.treeForm).toBe(treeForm(owner.id));
                expect(tree.scale.toArray()).toEqual(expected.scale.toArray()); expect(root.position.toArray()).toEqual(layout.point(owner.cell!).toArray());
                const actualSize = new T.Box3().setFromObject(tree).getSize(new T.Vector3()), sourceSize = new T.Box3().setFromObject(expected).getSize(new T.Vector3());
                for (const axis of ['x', 'y', 'z'] as const) expect(actualSize[axis]).toBeCloseTo(sourceSize[axis], 9);
                expect(meshes(tree).every(mesh => mesh.userData.objectId === owner.id && mesh.userData.ownerId === owner.id
                    && mesh.userData.nativeSharedGeometry && mesh.userData.nativeSharedMaterial)).toBe(true);
            }
            const young = trees.find(tree => tree.userData.ownerId === ownerIds[2])!.children[0];
            expect(young.scale.x).toBeCloseTo(newGrowth === 0 ? .45 * .22 / 1.75 : newGrowth === 6 ? .45 * .57 : .45 * (hours > RULES.lordTreeHours ? 1.75 : 1.3), 12);
            expect(new Set(trees.map(tree => tree.children[0].userData.nativePart)).size).toBe(3);
            expect(layer.placeRoot.getObjectByName('place-native-fan-crown')).toBeUndefined();
            const sourceGeometry = meshes(trees[0])[0].geometry, released = vi.spyOn(sourceGeometry, 'dispose');
            layer.dispose(); expect(released).not.toHaveBeenCalled(); released.mockRestore(); material.dispose();
            expect(state).toEqual(before);
        }
    });
    it('keeps source lane and freeform P02 forests without replacing them with a fan, hollow trunk or gallery', () => {
        for (const freeform of [false, true]) {
            const { state, layout, world } = fixture([18, 18, 18, 18], freeform);
            state.plots.push({ id: 'forest-home', kind: 'home', cell: { x: 4, z: -2 }, style: 'tree', stage: 2,
                growth: 0, plantedAt: 0, builtAt: 6, origin: 'seed', paid: 40 });
            const place = derivePlaces(state, world).find(place => place.ruleId === 'P02')!, before = structuredClone(state);
            expect(place).toBeDefined(); expect(place.stage, JSON.stringify(place.missing)).toBe('grown');
            expect(place.variant).toBe(freeform ? 'freeform' : 'lane'); expect(place.walkSurface).toEqual([]);
            const g = new GardenGeometry(), gallery = vi.fn(() => new T.Group());
            buildNativePlaceGrove(g, state, layout, place, kit, gallery);
            const trees = g.root.getObjectsByProperty('name', 'place-native-owned-tree');
            expect(trees.map(tree => tree.userData.ownerId)).toEqual(place.mainIds);
            expect(trees.every(tree => tree.userData.sourceScale === .45 && tree.children[0].scale.x === .45 * 1.3)).toBe(true);
            expect(meshes(g.root).filter(mesh => mesh.userData.nativeSharedGeometry).length).toBeGreaterThan(0);
            for (const part of ['hollow-trunk', 'fan-crown']) {
                const replacements: T.Object3D[] = []; g.root.traverse(object => { if (object.userData.nativePart === part) replacements.push(object); });
                expect(replacements).toEqual([]);
            }
            expect(g.root.getObjectByName('place-root-room')).toBeUndefined(); expect(g.root.getObjectByName('place-physical-gallery')).toBeUndefined();
            expect(g.root.userData.authoredGalleryArt).toBe('pending'); expect(gallery).not.toHaveBeenCalled();
            expect(state).toEqual(before); expect(place.walkSurface).toEqual([]); dispose(g);
        }
    });
    it('joins only actual mature pairs and drops the visual branch when their explicit join grant disappears', () => {
        const { state, layout, world, definition } = fixture(), place = derivePlaces(state, world).find(place => place.ruleId === 'P01')!;
        expect(place.stage).toBe('grown');
        const before = structuredClone(state), g = new GardenGeometry(), gallery = vi.fn(() => new T.Group());
        buildNativePlaceGrove(g, state, layout, place, kit, gallery);
        const branches = g.root.getObjectsByProperty('name', 'place-native-mature-branch');
        expect(branches).toHaveLength(1); expect(branches[0].userData.ownerIds.sort()).toEqual(ownerIds.slice(0, 2).sort());
        expect(branches[0].userData.visualOnly).toBe(true); expect(branches[0].userData.floorRoute).toBeUndefined();
        expect(branches[0].userData.galleryTarget).toBeUndefined(); expect(gallery).not.toHaveBeenCalled();
        definition.edges = definition.edges.filter(edge => !(edge.allows.includes('join')
            && ['0,-2', '1,-2'].includes(edge.from.siteId) && ['0,-2', '1,-2'].includes(edge.to.siteId)));
        const nextWorld = compileWorldDefinition(definition), split = new GardenGeometry();
        // Even a stale place receipt cannot restore the removed current join.
        buildNativePlaceGrove(split, state, sceneLayout(state, false, nextWorld), place, kit, gallery);
        expect(split.root.getObjectsByProperty('name', 'place-native-owned-tree')).toHaveLength(4);
        expect(split.root.getObjectsByProperty('name', 'place-native-mature-branch')).toHaveLength(0);
        expect(state).toEqual(before); expect(place.useTargets.some(target => target.kind === 'gallery')).toBe(false); dispose(g); dispose(split);
    });
});
