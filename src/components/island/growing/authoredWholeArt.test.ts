import * as T from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { GrowingState } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';
import type { NativeGrowingKit } from './native/nativeGrowingKit';
import { attachAuthoredWholeArt, type AuthoredWholeArt } from './authoredWholeArt';
import { hasAuthoredObstructionRoots } from './authoredFlowerObstructions';

const state = {} as GrowingState;
const layout = { authored: true } as SceneLayout;
const native = { manifest: { candidate: 'source-kit' } } as NativeGrowingKit;
function tree(owner = 'l14') {
    const root = new T.Group(); root.name = 'growing-tree-spread';
    root.userData = { nativePart: 'willow', ownerId: owner, placeId: 'forest' };
    root.add(new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial()));
    return root;
}
function instance(name: string, owners: string[]) {
    const root = new T.Group(); root.name = name;
    root.userData = { ownerIds: owners, ownerId: owners[0], sourceSha256: 'source' };
    const mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
    mesh.userData = { nativeSharedGeometry: true, nativeSharedMaterial: true };
    root.add(mesh); return root;
}
function factories(forest?: T.Group, gallery?: T.Group) {
    return { forest: { instance: vi.fn(() => forest) }, gallery: { instance: vi.fn(() => gallery) } } as unknown as AuthoredWholeArt;
}

describe('saved whole-island source attachment', () => {
    it('replaces each visible owned tree once and adds the gallery beside its original shared tree', () => {
        const root = new T.Group(), owned = tree(), hidden = tree('hidden'), shared = new T.Group();
        hidden.visible = false; shared.name = 'place-native-shared-tree'; shared.userData.placeId = 'p02';
        root.add(owned, hidden, shared);
        const forest = instance('authored-forest-tree', ['l14']), gallery = instance('authored-gallery-structure', ['l10', 'l11', 'l12', 'l13']);
        const art = factories(forest, gallery), raycast = vi.fn(); owned.children[0].raycast = raycast;
        const attached = attachAuthoredWholeArt(root, state, layout, native, art);
        expect(attached).toHaveLength(2);
        expect(art.forest.instance).toHaveBeenCalledTimes(1);
        expect(art.forest.instance).toHaveBeenCalledWith(state, layout, owned, native.manifest);
        expect(art.gallery.instance).toHaveBeenCalledTimes(1);
        expect(art.gallery.instance).toHaveBeenCalledWith(state, layout, shared, native.manifest);
        expect(owned.visible).toBe(false); expect(hidden.visible).toBe(false); expect(shared.visible).toBe(true);
        owned.children[0].raycast(new T.Raycaster(), []); expect(raycast).not.toHaveBeenCalled();
        expect(gallery.userData.placeId).toBe('p02'); expect(gallery.userData.galleryTraversalEnabled).toBe(false);
        expect(hasAuthoredObstructionRoots(root)).toBe(true);
    });

    it('keeps ordinary models when source conditions reject an instance or the option is absent', () => {
        const root = new T.Group(), owned = tree(); root.add(owned);
        const raycast = owned.children[0].raycast;
        expect(attachAuthoredWholeArt(root, state, layout, native, factories())).toEqual([]);
        expect(attachAuthoredWholeArt(root, state, layout, native, undefined)).toEqual([]);
        expect(attachAuthoredWholeArt(root, state, { ...layout, authored: false }, native, factories())).toEqual([]);
        expect(owned.visible).toBe(true); expect(owned.children[0].raycast).toBe(raycast); expect(root.children).toEqual([owned]);
    });

    it('clones preview materials while sharing geometry and never adds future geometry to the committed guard', () => {
        const scan = new T.Group(), output = new T.Group(), owned = tree(); scan.add(owned);
        output.name = 'growing-place-preview';
        const forest = instance('authored-forest-tree', ['l14']), mesh = forest.children[0] as T.Mesh;
        const material = mesh.material as T.Material, geometry = mesh.geometry;
        attachAuthoredWholeArt(scan, state, layout, native, factories(forest), output, true);
        expect(mesh.geometry).toBe(geometry); expect(mesh.material).not.toBe(material);
        expect(material.opacity).toBe(1); expect((mesh.material as T.Material).opacity).toBe(.32);
        expect(mesh.userData.nativeSharedGeometry).toBe(true); expect(mesh.userData.ownMaterial).toBe(true);
        expect(hasAuthoredObstructionRoots(output)).toBe(false);
        expect(output.children).toEqual([forest]);
    });

    it('retains the same committed obstacle when only its drawing is hidden by a placement preview', () => {
        const root = new T.Group(), structure = instance('authored-gallery-structure', ['l10']); root.add(structure);
        structure.visible = false;
        expect(hasAuthoredObstructionRoots(root)).toBe(false);
        structure.userData.authoredPreviewHidden = true;
        expect(hasAuthoredObstructionRoots(root)).toBe(true);
        delete structure.userData.authoredPreviewHidden;
        expect(hasAuthoredObstructionRoots(root)).toBe(false);
    });

    it('keeps source world placement when attaching to a transformed preview parent', () => {
        const scan = new T.Group(), owned = tree(), parent = new T.Group(), output = new T.Group(); scan.add(owned);
        parent.position.set(5, 2, -3); parent.rotation.y = .6; parent.scale.setScalar(1.4);
        output.position.set(-2, 1, 4); parent.add(output);
        const forest = instance('authored-forest-tree', ['l14']);
        forest.matrixAutoUpdate = false;
        forest.matrix.compose(new T.Vector3(3, 4, 8), new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), -.3), new T.Vector3(.7, .7, .7));
        forest.updateMatrixWorld(true);
        const before = forest.children[0].matrixWorld.clone();
        attachAuthoredWholeArt(scan, state, layout, native, factories(forest), output, true);
        parent.updateMatrixWorld(true);
        forest.children[0].matrixWorld.elements.forEach((value, index) => expect(value).toBeCloseTo(before.elements[index], 12));
    });
});
