import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandPlacementPreview } from './placementPreview';
import { IslandMaterials } from './primitives';

describe('Island placement preview lifetime', () => {
    it('reuses one set of geometry while moving, rotating and changing validity', () => {
        const materials = new IslandMaterials(), preview = new IslandPlacementPreview(materials);
        const item = { id: 'bench-one', kind: 'bench' as const, rotation: 0, position: { x: 0, z: 1 } };
        preview.update(item, true);
        const before: string[] = [];
        preview.group.traverse(child => { if (child instanceof THREE.Mesh) before.push(child.geometry.uuid); });
        for (let i = 0; i < 100; i++) preview.update({ ...item, rotation: i * Math.PI / 2,
            position: { x: i % 12 * .25, z: 1 } }, i % 2 === 0);
        const after: string[] = [];
        preview.group.traverse(child => { if (child instanceof THREE.Mesh) after.push(child.geometry.uuid); });
        expect(after).toEqual(before);
        expect(preview.buildCount).toBe(1);
        expect(preview.group.position.x).toBe(.75);
        expect(preview.group.children.at(-1)?.visible).toBe(true);
        preview.dispose(); materials.dispose();
    });

    it('disposes preview-owned materials once while preserving the shared palette on cancel', () => {
        const materials = new IslandMaterials(), preview = new IslandPlacementPreview(materials);
        preview.update({ id: 'lamp', kind: 'lantern', rotation: 0, position: { x: 1, z: 1 } });
        let sharedDisposed = 0;
        materials.painted.addEventListener('dispose', () => { sharedDisposed++; });
        const owned = new Map<THREE.Material, number>();
        preview.group.traverse(child => {
            if (!(child instanceof THREE.Mesh)) return;
            for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
                expect(material.userData.islandOwned).toBe(true);
                if (owned.has(material)) continue;
                owned.set(material, 0);
                material.addEventListener('dispose', () => owned.set(material, owned.get(material)! + 1));
            }
        });
        preview.update(undefined);
        preview.update(undefined);
        expect(sharedDisposed).toBe(0);
        expect([...owned.values()]).toEqual([...owned.values()].map(() => 1));
        expect(preview.group.children).toHaveLength(0);
        expect(preview.group.visible).toBe(false);
        preview.dispose(); materials.dispose();
    });
});
