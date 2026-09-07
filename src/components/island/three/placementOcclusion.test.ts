import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandPlacementOcclusion } from './placementOcclusion';
import { IslandPlacementPreview } from './placementPreview';
import { disposeGeometry, IslandMaterials } from './primitives';
import { makeFurniture } from './furniture';
import { IslandResident } from './animals';
import { makeStarTree } from './scenery';

describe('editing-only preview visibility', () => {
    it.each(['bench', 'flower', 'lantern', 'swing', 'mushroom', 'fountain'] as const)('reveals %s behind a resident and restores original materials on cancel', kind => {
        const materials = new IslandMaterials(), preview = new IslandPlacementPreview(materials), occlusion = new IslandPlacementOcclusion();
        const view = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 30);
        view.position.set(0, 3, 10); view.lookAt(0, .5, 0); view.updateMatrixWorld(true);
        const resident = new IslandResident('otter', materials, [0, 0, .7], () => undefined);
        const source = makeFurniture(kind, materials); source.visible = false;
        const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
        resident.group.traverse(child => { if (child instanceof THREE.Mesh) originals.set(child, child.material); });
        preview.update({ id: 'preview', kind, position: { x: 0, z: 0 }, rotation: 0 });
        occlusion.update(preview.group, [resident.group, source], view);
        expect([...originals].every(([child, material]) => child.material !== material)).toBe(true);
        expect([...originals.keys()].every(child => !Array.isArray(child.material) && child.material.opacity === .18 && !child.material.depthWrite)).toBe(true);
        expect(materials.painted.opacity).toBe(1);
        const clones = [...originals.keys()].map(child => child.material);
        occlusion.update(preview.group, [resident.group, source], view);
        expect([...originals.keys()].map(child => child.material)).toEqual(clones);
        const position = resident.group.position.toArray();
        preview.update(undefined); occlusion.update(preview.group, [resident.group], view);
        expect([...originals].every(([child, material]) => child.material === material && child.renderOrder === 0)).toBe(true);
        expect(resident.group.position.toArray()).toEqual(position); expect(source.visible).toBe(false);
        preview.dispose(); disposeGeometry(resident.group); disposeGeometry(source); materials.dispose();
    });

    it('restores objects when the preview moves away and leaves non-occluding objects opaque', () => {
        const materials = new IslandMaterials(), preview = new IslandPlacementPreview(materials), occlusion = new IslandPlacementOcclusion();
        const view = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 30);
        view.position.set(0, 3, 10); view.lookAt(0, .5, 0); view.updateMatrixWorld(true);
        const furniture = makeFurniture('swing', materials); furniture.position.z = 1;
        preview.update({ id: 'preview', kind: 'lantern', position: { x: 0, z: 0 }, rotation: 0 });
        const first = furniture.getObjectByProperty('isMesh', true) as THREE.Mesh, original = first.material;
        occlusion.update(preview.group, [furniture], view); expect(first.material).not.toBe(original);
        preview.update({ id: 'preview', kind: 'lantern', position: { x: 4, z: 0 }, rotation: 0 });
        occlusion.update(preview.group, [furniture], view); expect(first.material).toBe(original);
        occlusion.restore(); preview.dispose(); disposeGeometry(furniture); materials.dispose();
    });

    it('keeps the real phone-placement tree opaque and fades only obstructing scenery pieces', () => {
        const materials = new IslandMaterials(), preview = new IslandPlacementPreview(materials), occlusion = new IslandPlacementOcclusion();
        const view = new THREE.OrthographicCamera(-6, 6, 6, -6, .1, 100);
        const focus = new THREE.Vector3(-.08, .85, -.03);
        view.position.copy(focus).add(new THREE.Vector3(4.7, 8.8, 13.5)); view.lookAt(focus); view.updateMatrixWorld(true);
        const tree = makeStarTree(materials), resident = new IslandResident('otter', materials, [.1, 0, 1.6], () => undefined);
        const originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
        tree.traverse(child => { if (child instanceof THREE.Mesh) originals.set(child, child.material); });
        const bench = { id: 'preview', kind: 'bench' as const, position: { x: 0, z: 1 }, rotation: 0 };
        preview.update(bench); occlusion.update(preview.group, [resident.group], view, [tree]);
        expect([...originals].every(([child, material]) => child.material === material)).toBe(true);
        resident.group.traverse(child => {
            if (child instanceof THREE.Mesh) expect((child.material as THREE.Material).opacity).toBe(.18);
        });
        preview.update({ ...bench, position: { x: 1.6, z: -2.5 } });
        occlusion.update(preview.group, [resident.group], view, [tree]);
        const faded = [...originals].filter(([child, material]) => child.material !== material);
        expect(faded.length).toBeGreaterThan(0); expect(faded.length).toBeLessThan(originals.size);
        const crown = [...originals].filter(([child]) => new THREE.Box3().setFromObject(child).min.y > 1.9);
        expect(crown.some(([child, material]) => child.material === material)).toBe(true);
        preview.update(undefined); occlusion.update(preview.group, [resident.group], view, [tree]);
        expect([...originals].every(([child, material]) => child.material === material)).toBe(true);
        preview.dispose(); disposeGeometry(tree); disposeGeometry(resident.group); materials.dispose();
    });
});
