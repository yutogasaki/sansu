import { describe, expect, it } from 'vitest';
import { buildPlantMagic, PLANT_MAGIC_MS } from './plantMagic';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import type { LifeItem } from '../../../domain/islandLife/model';

describe('M2 is a bounded display, not growth or reward', () => {
    it('uses leaves before bloom and petals at bloom without changing the plant', () => {
        for (const growth of [0, 2, 6]) {
            const item: LifeItem = { id: 'plant', kind: 'flower', cell: { x: 0, z: 2 }, growth, style: 'original', paidDrops: 2 };
            const original = structuredClone(item), materials = new IslandMaterials(), magic = buildPlantMagic(item, materials);
            try {
                expect(magic.petals).toBe(growth === 6); expect(magic.root.children).toHaveLength(7);
                magic.sample(-1, false); expect(magic.root.visible).toBe(false);
                magic.sample(600, false); const low = magic.root.children.map(bit => bit.position.y);
                magic.sample(1200, false);
                expect(magic.root.children.every(bit => bit.scale.x <= .12 && bit.scale.y <= .032 && bit.scale.y < bit.scale.x)).toBe(true);
                expect(magic.root.children.every((bit, i) => bit.position.y > low[i])).toBe(true);
                magic.sample(PLANT_MAGIC_MS, false); expect(magic.root.visible).toBe(false);
                expect(item).toEqual(original);
            } finally { disposeGeometry(magic.root); materials.dispose(); }
        }
    });
    it('keeps a visible static difference in reduced motion and removes it at the same end', () => {
        const materials = new IslandMaterials(), magic = buildPlantMagic({ id: 'plant', kind: 'flower', growth: 0, style: 'original' }, materials);
        try {
            magic.sample(100, true); const first = magic.root.children.map(bit => [bit.position.toArray(), bit.rotation.toArray(), bit.scale.toArray()]);
            expect(magic.root.children.every(bit => bit.position.y > .7 && bit.scale.x === .12 && bit.scale.y === .025)).toBe(true);
            magic.sample(2900, true); expect(magic.root.children.map(bit => [bit.position.toArray(), bit.rotation.toArray(), bit.scale.toArray()])).toEqual(first);
            magic.sample(3000, true); expect(magic.root.visible).toBe(false);
        } finally { disposeGeometry(magic.root); materials.dispose(); }
    });
});
