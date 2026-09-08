import { describe, expect, it } from 'vitest';
import { createIsland, findAvailablePosition, ISLAND_ITEMS, isValidIslandPlacement, islandRewardChoices } from './catalog';
import { getIslandCustomization } from './customization';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from './growth';
import { hasValidIslandGrowth } from './growthValidation';
import { assertIsland } from './repository';
import { ISLAND_OPTIONAL_FURNITURE_KINDS, type IslandItem, type IslandRecord } from './types';
import { canonicalIslandFurnitureAction, getOwnedIslandFurniture, hasValidIslandFurnitureItems, IslandFurnitureConflict,
    islandFurnitureItemId, quoteIslandFurniture, reduceIslandFurniture, type IslandFurnitureAction } from './furniture';

function island() {
    const value = createIsland('child', 1);
    value.customization = { ...getIslandCustomization(value), points: 100, desiredItemId: 'candy-complete' };
    return value;
}
const buy = (value: IslandRecord, kind: typeof ISLAND_OPTIONAL_FURNITURE_KINDS[number]) => reduceIslandFurniture(value, { type: 'acquire-furniture', kind });
const grow = (value: IslandRecord) => growIslandAfterCompletedSet({ ...value, completedSets: value.completedSets + 1 }, getIslandGrowthTarget(value), value.completedSets + 2);

describe('three optional possessions alongside finite basic growth', () => {
    it('spends 95 existing stars once, grants stored objects, and preserves the appearance goal and every non-purchase field', () => {
        const before = island(), copy = structuredClone(before);
        const updated = ISLAND_OPTIONAL_FURNITURE_KINDS.reduce(buy, before);
        expect(updated.customization!.points).toBe(5);
        expect(updated.customization!.desiredItemId).toBe('candy-complete');
        expect(updated.customization!.ownedItemIds).toEqual(before.customization!.ownedItemIds);
        expect(updated.items.slice(before.items.length)).toEqual(ISLAND_OPTIONAL_FURNITURE_KINDS.map(kind => ({ id: islandFurnitureItemId(kind), kind, rotation: 0 })));
        expect({ ...updated, items: before.items, customization: before.customization }).toEqual(before);
        expect(before).toEqual(copy);
        for (const kind of ISLAND_OPTIONAL_FURNITURE_KINDS) {
            expect(quoteIslandFurniture(updated, kind)).toMatchObject({ price: 0, owned: true, missingStars: 0 });
            expect(() => buy(updated, kind)).toThrow(IslandFurnitureConflict);
        }
    });
    it('quotes missing stars without materializing old credit or changing the saved scene', () => {
        const legacy = createIsland('child', 1); legacy.completedSets = 3;
        const before = structuredClone(legacy);
        expect(quoteIslandFurniture(legacy, 'tea-table')).toMatchObject({ price: 40, listPrice: 40, points: 30, missingStars: 10, owned: false });
        expect(() => buy(legacy, 'tea-table')).toThrow('ほしが');
        expect(legacy).toEqual(before); expect(legacy.customization).toBeUndefined();
        const acquired = buy(legacy, 'telescope');
        expect(acquired.customization!.points).toBe(0); expect(acquired.growth).toEqual(legacy.growth);
    });
    it('keeps optional poses and old duplicates through all basic growth, without inserting objects into old snapshots', () => {
        let current = ISLAND_OPTIONAL_FURNITURE_KINDS.reduce(buy, island());
        current.items.push({ id: 'old-extra-bench', kind: 'bench', rotation: 1.3 });
        const telescope = getOwnedIslandFurniture(current, 'telescope')!;
        const position = findAvailablePosition(current, telescope.kind, telescope.id)!;
        expect(position).toBeDefined();
        current.items = current.items.map(item => item.id === telescope.id ? { ...item, position, rotation: .7 } : item);
        const optional = structuredClone(current.items.filter(item => ISLAND_OPTIONAL_FURNITURE_KINDS.includes(item.kind as typeof ISLAND_OPTIONAL_FURNITURE_KINDS[number])));
        const initial = structuredClone(current.growth!.memories[0]);
        for (let index = 0; index < 40; index++) current = grow(current);
        expect(current.items).toHaveLength(10); // One old bench is reused by the seven basic instances.
        expect(current.items.find(item => item.id === 'old-extra-bench')!.rotation).toBe(1.3);
        expect(current.items.find(item => item.id === 'old-extra-bench')!.position).toBeUndefined();
        expect(current.items.filter(item => ISLAND_OPTIONAL_FURNITURE_KINDS.includes(item.kind as typeof ISLAND_OPTIONAL_FURNITURE_KINDS[number]))).toEqual(optional);
        expect(current.growth!.memories[0]).toEqual(initial);
        expect(current.growth!.memories.at(-1)!.items.some(item => item.id === telescope.id)).toBe(true);
        expect(() => assertIsland(current)).not.toThrow();
        const duplicates = { ...current, items: [...current.items, { id: 'another-old-bench', kind: 'bench' as const, rotation: 0 }] };
        expect(() => assertIsland(duplicates)).not.toThrow();
        expect(grow(duplicates).items).toHaveLength(11);
    });
    it('uses the same footprint for optional furniture and later automatically granted basic furniture', () => {
        const current = buy(island(), 'tea-table');
        current.items = current.items.map(item => item.kind === 'tea-table' ? { ...item, position: { x: -.1, z: 1 } } : { ...item, position: undefined });
        const tea = current.items.find(item => item.kind === 'tea-table')!;
        expect(isValidIslandPlacement(current, tea.id, tea.position!, tea.rotation)).toBe(true);
        const grown = grow(current), bench = grown.items.find(item => item.kind === 'bench')!;
        expect(grown.items.find(item => item.id === tea.id)).toEqual(tea);
        expect(bench).toBeDefined();
        if (bench.position) {
            expect(Math.hypot(bench.position.x - tea.position!.x, bench.position.z - tea.position!.z)).toBeGreaterThanOrEqual(ISLAND_ITEMS['tea-table'].radius + ISLAND_ITEMS.bench.radius + .08);
            expect(isValidIslandPlacement(grown, bench.id, bench.position, bench.rotation)).toBe(true);
        } else expect(bench.autoPlacementBlocked).toBe(true);
    });
    it('keeps the larger purchased footprint inside an earned shore instead of inheriting the smaller basic furniture boundary', () => {
        for (const kind of ISLAND_OPTIONAL_FURNITURE_KINDS) {
            const current = buy(island(), kind), id = islandFurnitureItemId(kind);
            const unlocked = { ...current, growth: { ...current.growth!, expansionLevel: 1 as const } };
            expect(isValidIslandPlacement(unlocked, id, { x: 8.8, z: 1 }, 0)).toBe(true);
            expect(isValidIslandPlacement(current, id, { x: 8.8, z: 1 }, 0)).toBe(false);
            expect(isValidIslandPlacement(unlocked, id, { x: 9, z: 1 }, 0)).toBe(kind !== 'tea-table');
            expect(isValidIslandPlacement(unlocked, id, { x: 10.3, z: 0 }, 0)).toBe(false);
        }
    });
});

describe('optional kind and snapshot validation', () => {
    it.each([
        { type: 'acquire-furniture', kind: 'bench' },
        { type: 'acquire-furniture', kind: 'unknown' },
        { type: 'acquire-furniture', kind: 'telescope', position: { x: 0, z: 0 } },
        { type: 'acquire-furniture', kind: 'telescope', price: 0 },
    ])('rejects forged acquisition input %j', input => {
        expect(() => canonicalIslandFurnitureAction(input as IslandFurnitureAction)).toThrow(IslandFurnitureConflict);
    });
    it('rejects duplicate, aliased, growth-bearing and malformed optional items in both current and historical rows', () => {
        const current = buy(island(), 'hammock'), item = getOwnedIslandFurniture(current, 'hammock')!;
        const invalid: IslandItem[][] = [
            [item, { ...item }], [{ ...item, id: 'arbitrary' }], [{ ...item, kind: 'bench' }],
            [{ ...item, habitatId: 'grove' }], [{ ...item, growthLevel: 0 }], [{ ...item, appearanceLevel: 0 }],
            [{ ...item, autoPlacementBlocked: true }], [{ ...item, position: { x: NaN, z: 0 } }],
            [{ ...item, rotation: Infinity }], new Array<IslandItem>(1),
        ];
        for (const items of invalid) {
            expect(hasValidIslandFurnitureItems(items)).toBe(false);
            expect(() => assertIsland({ ...current, items })).toThrow();
            const historical = structuredClone(current); historical.growth!.memories[0].items = items;
            expect(hasValidIslandGrowth(historical)).toBe(false);
        }
        expect(hasValidIslandFurnitureItems(current.items)).toBe(true);
        const positioned = { ...current, items: [{ ...item, position: { x: 2, z: 1 } }] };
        const detached = getOwnedIslandFurniture(positioned, 'hammock')!;
        detached.position!.x = 9;
        expect(positioned.items[0].position.x).toBe(2);
    });
    it('keeps every old gift choice in the six basic kinds', () => {
        for (let sequence = 0; sequence < 40; sequence++) {
            const choices = islandRewardChoices(sequence);
            expect(choices).toHaveLength(3);
            expect(choices.some(kind => ISLAND_OPTIONAL_FURNITURE_KINDS.some(optional => String(kind) === optional))).toBe(false);
        }
    });
});
