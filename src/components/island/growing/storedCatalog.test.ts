import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { storedCatalog } from './storedCatalog';

describe('stored belongings presentation', () => {
    it('compresses 100 identical items without mutating or losing their owners', () => {
        const state = newIsland('stored', 0);
        state.landmarks = Array.from({ length: 100 }, (_, i) => ({ id: `bench-${i}`, kind: 'bench', growth: 0 }));
        const before = JSON.stringify(state);
        const catalog = storedCatalog(state);
        expect(catalog.count).toBe(100);
        expect(catalog.groups).toHaveLength(1);
        expect(catalog.groups[0].items).toMatchObject([{ id: 'bench-0', count: 100 }]);
        expect(JSON.stringify(state)).toBe(before);
        state.landmarks[0].cell = { x: 0, z: 0 };
        const next = storedCatalog(state);
        expect(next.count).toBe(99);
        expect(next.groups[0]).toMatchObject({ name: 'しまに 多いもの', items: [{ id: 'bench-1', count: 99 }] });
    });
    it('retains colour, maturity, legacy, provenance, plot appearance and award identity', () => {
        const state = newIsland('variants', 0);
        state.plots = [0, 1].map(i => ({ id: `home-${i}`, kind: 'home', stage: 3, roof: i, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 }));
        state.landmarks = [
            { id: 'pink', kind: 'flower', color: 'pink', growth: 0 },
            { id: 'blue', kind: 'flower', color: 'blue', growth: 0 },
            { id: 'grown', kind: 'flower', color: 'pink', growth: 6 },
            { id: 'gift', kind: 'flower', color: 'pink', growth: 0, from: 'sibling' },
            { id: 'turned', kind: 'bench', growth: 0, rotation: 1 },
            { id: 'legacy', kind: 'bench', growth: 0, legacy: { foodStock: 2 } },
        ];
        state.keepsakes = [{ id: 'math', unitId: 'math:1' }, { id: 'english', unitId: 'english:1' }];
        const catalog = storedCatalog(state);
        expect(catalog.count).toBe(10);
        expect(catalog.groups.flatMap(g => g.items)).toHaveLength(10);
        expect(catalog.groups.flatMap(g => g.items).every(item => item.count === 1)).toBe(true);
    });
    it('keeps retired and legacy furniture reachable by category', () => {
        const state = newIsland('legacy-furniture', 0); state.plots = [];
        state.landmarks = ['pinwheel', 'flower-arch', 'sandbox', 'garden-hut', 'library'].map(kind => ({ id: kind, kind: kind as typeof state.landmarks[number]['kind'], growth: 0 }));
        expect(storedCatalog(state).groups.flatMap(g => g.items).map(i => i.id).sort()).toEqual(state.landmarks.map(i => i.id).sort());
    });
    it('ranks by actual placed count and keeps preferred items reachable through their own category', () => {
        const state = newIsland('ranking', 0);
        state.plots = [];
        state.landmarks = [
            { id: 'stored-bench', kind: 'bench', growth: 0 },
            { id: 'stored-water', kind: 'water-bowl', growth: 0 },
            { id: 'bench', kind: 'bench', growth: 0, cell: { x: 0, z: 0 } },
            { id: 'water1', kind: 'water-bowl', growth: 0, cell: { x: 1, z: 0 } },
            { id: 'water2', kind: 'water-bowl', growth: 0, cell: { x: 2, z: 0 } },
        ];
        const catalog = storedCatalog(state);
        expect(catalog.count).toBe(2);
        expect(catalog.groups[0].items.map(i => i.id)).toEqual(['stored-water', 'stored-bench']);
        expect(catalog.groups.find(g => g.name === 'あそぶ・やすむ')?.items[0].id).toBe('stored-bench');
    });
});
