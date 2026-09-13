import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildLifeItem } from './itemGeometry';
import { buildPlantMagic } from './plantMagic';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import type { LifeItem } from '../../../domain/islandLife/model';
describe('new single-cell goods keep their usable neighbors clear', () => {
    it('keeps the entire mature tree and bowl envelope inside one cell', () => {
        for (const kind of ['sapling', 'water-bowl'] as const) for (const growth of [0, 6, 18]) {
            const materials = new IslandMaterials(), item: LifeItem = { id: 'new', kind, growth, style: 'original' };
            const before = structuredClone(item), model = buildLifeItem(item, materials), bounds = new T.Box3().setFromObject(model.root);
            try {
                expect(bounds.min.x).toBeGreaterThan(-.49); expect(bounds.max.x).toBeLessThan(.49);
                expect(bounds.min.z).toBeGreaterThan(-.49); expect(bounds.max.z).toBeLessThan(.49);
                expect(bounds.min.y).toBeGreaterThan(-.04); expect(bounds.max.y).toBeLessThan(1.25);
                expect(item).toEqual(before);
            } finally { disposeGeometry(model.root); materials.dispose(); }
        }
    });
    it('lifts leaves from a tree at every stage without replacing the owned plant or producing flower petals', () => {
        for (const growth of [0, 6, 18]) {
            const materials = new IslandMaterials(), item: LifeItem = { id: 'tree', kind: 'sapling', growth, style: 'original' };
            const before = structuredClone(item), magic = buildPlantMagic(item, materials);
            try {
                expect(magic.petals).toBe(false); magic.sample(1000, false); expect(magic.root.visible).toBe(true);
                magic.sample(3000, false); expect(magic.root.visible).toBe(false); expect(item).toEqual(before);
            } finally { disposeGeometry(magic.root); materials.dispose(); }
        }
    });
});
