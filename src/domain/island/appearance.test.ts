import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { APPEARANCE_FAMILIES, ISLAND_APPEARANCE_PART_IDS, ISLAND_APPEARANCE_PART_SLOTS, ISLAND_APPEARANCE_SLOT_IDS,
    createIslandAppearance, getIslandAppearancePart, getIslandAppearanceStyle, hasValidIslandAppearance, islandAppearanceStyleId,
    resolveIslandAppearance, sameIslandAppearance, type IslandAppearanceSlotId, type IslandResolvedAppearance } from './appearance';
import { CUSTOMIZATION_CATALOG, ISLAND_CUSTOMIZATION_FAMILIES, ISLAND_THEME_ACCENTS, canonicalIslandCustomizationAction,
    captureIslandCosmetics, getIslandCosmetics, getIslandCustomization, getIslandCustomizationEntitlements, hasIslandCustomizationItem,
    hasValidIslandCustomization, previewIslandCustomization, quoteIslandCustomization, reduceIslandCustomization,
    type IslandCustomizationAction, type IslandCustomizationItemId } from './customization';
import { assertIsland } from './repository';

function funded() {
    const island = createIsland('child', 0);
    island.customization = { ...getIslandCustomization(island), points: 1000 };
    return island;
}
const buy = (island: ReturnType<typeof funded>, itemId: IslandCustomizationItemId, slot?: IslandAppearanceSlotId) =>
    reduceIslandCustomization(island, { type: 'purchase', itemId, ...(slot ? { slot } : {}) });

describe('stable part styles and legacy rendering', () => {
    it('partitions the twelve surfaces into six acquisition parts and bounds every style id', () => {
        expect(ISLAND_APPEARANCE_PART_IDS.flatMap(part => [...ISLAND_APPEARANCE_PART_SLOTS[part]])).toEqual(ISLAND_APPEARANCE_SLOT_IDS);
        for (const family of APPEARANCE_FAMILIES) for (const version of ['legacy-v1', 'parts-v1'] as const) {
            const style = createIslandAppearance(family, version);
            expect(hasValidIslandAppearance(style)).toBe(true);
            for (const slot of ISLAND_APPEARANCE_SLOT_IDS) {
                expect(getIslandAppearanceStyle(style.slots[slot])).toEqual({ family, slot, version });
                expect(ISLAND_APPEARANCE_PART_SLOTS[getIslandAppearancePart(slot)]).toContain(slot);
            }
        }
    });
    it('keeps omitted old scenes on the legacy revision and freezes detached resolved copies', () => {
        const island = funded();
        island.customization = { ...island.customization!, themeId: 'starry', ownedItemIds: ['moon-garden', 'starry'] };
        const before = structuredClone(island), old = getIslandCosmetics(island), captured = captureIslandCosmetics(island);
        expect(old).toEqual({ themeId: 'starry', accentId: null });
        expect(captured.appearance).toEqual(createIslandAppearance('starry', 'legacy-v1'));
        expect(getIslandCustomizationEntitlements(island)).toContain('starry-water');
        expect(island).toEqual(before);
        captured.appearance!.slots.sky = islandAppearanceStyleId('candy', 'sky');
        expect(resolveIslandAppearance(old).slots.sky).toBe('legacy-v1:starry:sky');
        const equipped = buy(island, 'starry-water');
        const appearance = resolveIslandAppearance(getIslandCosmetics(equipped));
        expect(appearance.slots.water).toBe('parts-v1:starry:water');
        expect(appearance.slots.sky).toBe('legacy-v1:starry:sky');
        expect(equipped.customization!.points).toBe(1000);
        expect(island).toEqual(before);
    });
    it('rejects unknown revisions, unknown fields, missing slots and cross-slot styles instead of normalizing', () => {
        const valid = createIslandAppearance('starry');
        const missing = { ...valid.slots }; delete (missing as Partial<typeof missing>).sky;
        for (const appearance of [null, { ...valid, version: 2 }, { ...valid, extra: true }, { ...valid, slots: missing },
            { ...valid, slots: { ...valid.slots, unknown: 'parts-v1:starry:sky' } },
            { ...valid, slots: { ...valid.slots, sky: 'parts-v2:starry:sky' } },
            { ...valid, slots: { ...valid.slots, sky: 'parts-v1:starry:water' } }]) {
            expect(hasValidIslandAppearance(appearance)).toBe(false);
            expect(() => resolveIslandAppearance({ themeId: 'starry', appearance: appearance as IslandResolvedAppearance })).toThrow();
        }
        expect(sameIslandAppearance(valid, createIslandAppearance('starry', 'legacy-v1'))).toBe(false);
    });
});

describe('one wallet, eighteen parts, three completed recipes', () => {
    it('keeps the original price totals and exposes exactly eighteen paid parts plus three set recipes', () => {
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'part')).toHaveLength(18);
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'set')).toHaveLength(3);
        for (const [family, total, complete] of [['starry', 60, 75], ['candy', 100, 120], ['crystal', 150, 175]] as const) {
            const island = funded();
            expect(quoteIslandCustomization(island, family).price).toBe(total);
            expect(quoteIslandCustomization(island, `${family}-complete`).price).toBe(complete);
        }
    });
    it('charges each component once for every prior-ownership subset, independent of purchase order', () => {
        for (const family of ISLAND_CUSTOMIZATION_FAMILIES) for (let mask = 0; mask < 64; mask++) {
            let island = funded();
            for (const [i, part] of ISLAND_APPEARANCE_PART_IDS.entries()) if (mask & 1 << i) island = buy(island, `${family}-${part}`);
            if (mask % 2) island = buy(island, ISLAND_THEME_ACCENTS[family]);
            const completePrice = quoteIslandCustomization(funded(), `${family}-complete`).price;
            expect(1000 - island.customization!.points + quoteIslandCustomization(island, `${family}-complete`).price).toBe(completePrice);
            const rawBefore = [...island.customization!.ownedItemIds];
            const quote = quoteIslandCustomization(island, family);
            expect(island.customization!.ownedItemIds).toEqual(rawBefore);
            island = buy(island, family);
            expect(quoteIslandCustomization(island, family).owned).toBe(true);
            expect(island.customization!.points).toBe(1000 - completePrice + (mask % 2 ? 0 : quoteIslandCustomization(funded(), ISLAND_THEME_ACCENTS[family]).price));
            expect(quote.price).toBeGreaterThanOrEqual(0);
            island = buy(island, `${family}-complete`);
            expect(island.customization!.points).toBe(1000 - completePrice);
            for (const part of ISLAND_APPEARANCE_PART_IDS) island = buy(island, `${family}-${part}`);
            expect(island.customization!.points).toBe(1000 - completePrice);
            expect(hasIslandCustomizationItem(island, `${family}-complete`)).toBe(true);
            assertIsland(island);
        }
    });
    it('all six raw single grants unlock the old theme without a fabricated bundle purchase', () => {
        let singles = funded();
        for (const part of [...ISLAND_APPEARANCE_PART_IDS].reverse()) singles = buy(singles, `starry-${part}`);
        expect(singles.customization!.ownedItemIds).not.toContain('starry');
        expect(hasIslandCustomizationItem(singles, 'starry')).toBe(true);
        const bundled = buy(funded(), 'starry');
        expect(getIslandCustomizationEntitlements(singles)).toEqual(getIslandCustomizationEntitlements(bundled));
        expect(resolveIslandAppearance(getIslandCosmetics(singles))).toEqual(resolveIslandAppearance(getIslandCosmetics(bundled)));
        singles = reduceIslandCustomization(singles, { type: 'equip', itemId: 'starry' });
        expect(singles.customization!.points).toBe(940);
        expect(singles.customization!.ownedItemIds).not.toContain('starry');
        assertIsland(singles);
    });
    it('updates a set goal as parts are bought and clears it when the last component becomes owned', () => {
        let island = reduceIslandCustomization(funded(), { type: 'desire', itemId: 'candy-complete' });
        island = buy(island, 'candy-house', 'houseWindows');
        expect(island.customization!.desiredItemId).toBe('candy-complete');
        expect(quoteIslandCustomization(island, 'candy-complete').price).toBe(95);
        island = buy(island, 'candy');
        expect(quoteIslandCustomization(island, 'candy-complete').price).toBe(20);
        island = buy(island, 'candy-flags');
        expect(island.customization!.desiredItemId).toBeNull();
    });
    it('purchases a whole entitlement while applying only the roof, never other unowned trial settings', () => {
        const island = funded(), original = structuredClone(island);
        let trial = previewIslandCustomization(getIslandCosmetics(island), { type: 'purchase', itemId: 'crystal-plants', slot: 'flower' });
        trial = previewIslandCustomization(trial, { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' });
        const actual = buy(island, 'candy-house', 'houseRoof'), appearance = resolveIslandAppearance(getIslandCosmetics(actual));
        expect(trial.appearance!.slots.flower).toBe('parts-v1:crystal:flower');
        expect(appearance.slots.flower).toBe('legacy-v1:moon-garden:flower');
        expect(appearance.slots.houseWindows).toBe('legacy-v1:moon-garden:houseWindows');
        expect(appearance.slots.houseRoof).toBe('parts-v1:candy:houseRoof');
        expect(actual.customization!.points).toBe(975);
        const windows = reduceIslandCustomization(actual, { type: 'equip', itemId: 'candy-house', slot: 'houseWindows' });
        expect(windows.customization!.points).toBe(975);
        expect(island).toEqual(original);
        expect(actual.items).toEqual(island.items);
        expect(actual.growth).toEqual(island.growth);
    });
    it('restores one slot or a whole part for free without resetting neighboring mix or accent', () => {
        let island = buy(funded(), 'crystal-complete');
        island = buy(island, 'candy-house', 'houseRoof');
        const points = island.customization!.points;
        island = reduceIslandCustomization(island, { type: 'restore-part', partId: 'house', slot: 'houseRoof' });
        expect(island.customization!.appearance!.slots.houseRoof).toBe('legacy-v1:moon-garden:houseRoof');
        expect(island.customization!.appearance!.slots.houseWindows).toBe('parts-v1:crystal:houseWindows');
        island = reduceIslandCustomization(island, { type: 'restore-part', partId: 'plants' });
        for (const slot of ['tree', 'flower', 'mushroom'] as const) expect(island.customization!.appearance!.slots[slot]).toBe(`legacy-v1:moon-garden:${slot}`);
        expect(island.customization!.points).toBe(points);
        expect(island.customization!.accentId).toBe('crystal-charms');
        island = reduceIslandCustomization(island, { type: 'equip', itemId: 'moon-garden' });
        expect(island.customization!.appearance).toEqual(createIslandAppearance('moon-garden', 'legacy-v1'));
        expect(island.customization!.accentId).toBe('crystal-charms');
    });
    it('binds canonical actions to their legal application scope and keeps old receipt JSON unchanged', () => {
        expect(canonicalIslandCustomizationAction({ itemId: 'starry', type: 'purchase' })).toEqual({ type: 'purchase', itemId: 'starry' });
        for (const action of [
            { type: 'purchase', itemId: 'starry-house', slot: 'water' }, { type: 'purchase', itemId: 'starry-complete', slot: 'sky' },
            { type: 'equip', itemId: 'star-lanterns', slot: 'sky' }, { type: 'desire', itemId: 'starry-house', slot: 'houseRoof' },
            { type: 'restore-part', partId: 'ground', slot: 'tree' }, { type: 'restore-part', partId: 'wrong' },
            { type: 'purchase', itemId: 'starry-house', price: 0 }, { type: 'clear-accent', appearance: {} },
        ]) expect(() => canonicalIslandCustomizationAction(action as IslandCustomizationAction)).toThrow();
    });
    it('rejects unowned styles, invalid extensions and sparse grants without silently resetting points', () => {
        const island = buy(funded(), 'starry-house', 'houseRoof');
        const style = island.customization!.appearance!;
        const sparse = ['moon-garden', 'starry-house', 'starry-house']; delete sparse[1];
        for (const change of [
            { appearance: { ...style, version: 2 } }, { appearance: { ...style, extra: true } },
            { appearance: { ...style, slots: { ...style.slots, water: 'parts-v1:crystal:water' } } },
            { ownedItemIds: sparse }, { unknownExtension: true },
        ]) expect(hasValidIslandCustomization({ ...island, customization: { ...island.customization!, ...change } as typeof island.customization })).toBe(false);
        const copy = getIslandCustomization(island);
        copy.appearance!.slots.houseRoof = islandAppearanceStyleId('moon-garden', 'houseRoof');
        expect(island.customization!.appearance!.slots.houseRoof).toBe('parts-v1:starry:houseRoof');
    });
    it('allows single-part ownership in a saved mix without requiring the whole series', () => {
        const island = buy(funded(), 'crystal-water');
        expect(island.customization!.ownedItemIds).toEqual(['moon-garden', 'crystal-water']);
        expect(hasValidIslandCustomization(island)).toBe(true);
        expect(hasIslandCustomizationItem(island, 'crystal')).toBe(false);
        expect(quoteIslandCustomization(island, 'crystal').price).toBe(125);
        expect(() => reduceIslandCustomization(island, { type: 'equip', itemId: 'crystal' })).toThrow();
    });
});
