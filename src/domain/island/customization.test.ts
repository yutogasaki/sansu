import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { createIslandAppearance } from './appearance';
import { DEFAULT_ISLAND_COSMETICS, earnIslandCustomizationStars, getIslandCosmetics, getIslandCustomization,
    hasValidIslandCosmetics, hasValidIslandCustomization, type IslandCustomizationState } from './customization';
import { growIslandAfterCompletedSet, initializeIslandGrowth } from './growth';
import { assertIsland, IslandConflict } from './repository';

describe('island cosmetic state and legacy compatibility', () => {
    it('reads legacy credit without writing or confusing it with habitat mastery', () => {
        const island = { ...createIsland('child', 0), completedSets: 12 };
        const before = structuredClone(island);
        expect(getIslandCustomization(island)).toEqual({ version: 1, points: 120,
            themeId: 'moon-garden', accentId: null, ownedItemIds: ['moon-garden'], desiredItemId: null });
        expect(getIslandCosmetics(island)).toEqual(DEFAULT_ISLAND_COSMETICS);
        expect(island).toEqual(before);
        expect(island.growth?.progress.garden).toBe(0);
    });

    it('keeps spent points spent and returns copies without mutating ownership', () => {
        const island = { ...createIsland('child', 0), completedSets: 12 };
        island.customization = { ...getIslandCustomization(island), points: 3, ownedItemIds: ['moon-garden', 'starry'], themeId: 'starry' };
        const state = getIslandCustomization(island);
        state.ownedItemIds.push('candy');
        expect(getIslandCustomization(island).points).toBe(3);
        expect(island.customization.ownedItemIds).toEqual(['moon-garden', 'starry']);
        expect(earnIslandCustomizationStars(island, { slots: [] }).points).toBe(13);
        expect(island.customization.points).toBe(3);
    });

    it.each([
        { version: 2 }, { points: -1 }, { points: 1.5 }, { points: Infinity }, { points: Number.MAX_SAFE_INTEGER + 1 },
        { ownedItemIds: ['moon-garden', 'moon-garden'] }, { ownedItemIds: ['moon-garden', 'fake'] },
        { ownedItemIds: [] }, { themeId: 'starry' }, { themeId: 'unknown' },
        { accentId: 'star-lanterns' }, { accentId: 'starry' }, { desiredItemId: 'unknown' },
        { desiredItemId: 'moon-garden' }, { desiredItemId: undefined },
    ])('rejects invalid optional state rather than regenerating stars: %j', fields => {
        const island = createIsland('child', 0);
        island.customization = { ...getIslandCustomization(island), ...fields } as IslandCustomizationState;
        expect(hasValidIslandCustomization(island)).toBe(false);
        expect(() => assertIsland(island)).toThrow(IslandConflict);
    });

    it('validates runtime nulls, unknown snapshot cosmetics, and unsafe legacy credit', () => {
        const island = createIsland('child', 0);
        island.customization = null as unknown as IslandCustomizationState;
        expect(() => assertIsland(island)).toThrow(IslandConflict);
        expect(() => getIslandCustomization(island)).toThrow('Invalid island customization');
        delete island.customization;
        island.completedSets = Number.MAX_SAFE_INTEGER;
        expect(() => assertIsland(island)).toThrow(IslandConflict);
        expect(hasValidIslandCosmetics({ themeId: 'candy', accentId: 'crystal-charms' })).toBe(true);
        expect(hasValidIslandCosmetics({ themeId: 'starry', accentId: undefined })).toBe(false);
    });

    it('freezes cosmetic copies only in newly captured growth memories, preserving legacy omissions', () => {
        const island = createIsland('child', 0);
        delete island.growth!.memories[0].cosmetics;
        island.customization = { ...getIslandCustomization(island), themeId: 'starry', accentId: 'candy-flags',
            ownedItemIds: ['moon-garden', 'starry', 'candy-flags'] };
        let grown = island;
        for (let set = 1; set <= 6; set++) grown = growIslandAfterCompletedSet({ ...grown, completedSets: set }, 'garden', set);
        const memory = grown.growth!.memories[1];
        expect(grown.growth!.memories[0].cosmetics).toBeUndefined();
        expect(memory.cosmetics).toEqual({ themeId: 'starry', accentId: 'candy-flags', appearance: createIslandAppearance('starry', 'legacy-v1') });
        expect(grown.customization?.points).toBe(0); // Growth cannot grant currency by itself.
        grown.customization!.themeId = 'moon-garden';
        expect(memory.cosmetics?.themeId).toBe('starry');
        assertIsland(grown);
        memory.cosmetics!.themeId = 'invalid' as 'starry';
        expect(() => assertIsland(grown)).toThrow(IslandConflict);
    });

    it('captures current cosmetics when first initializing legacy growth without granting more credit', () => {
        const legacy = { ...createIsland('child', 0), completedSets: 3 };
        delete legacy.growth;
        legacy.customization = { ...getIslandCustomization(legacy), points: 0, themeId: 'starry', ownedItemIds: ['moon-garden', 'starry'] };
        const initialized = initializeIslandGrowth(legacy, 10);
        expect(initialized.growth?.memories[0].cosmetics).toEqual({ themeId: 'starry', accentId: null, appearance: createIslandAppearance('starry', 'legacy-v1') });
        expect(initialized.customization?.points).toBe(0);
    });
});
