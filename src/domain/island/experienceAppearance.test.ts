import { describe, expect, it } from 'vitest';
import { createIslandExpressionSelection } from './expression';
import { createIsland } from './catalog';
import { createIslandAppearance, islandAppearanceStyleId } from './appearance';
import { getIslandCustomization, getIslandCosmetics, reduceIslandCustomization } from './customization';
import { getIslandExperience, hasValidIslandExperience, IslandExperienceConflict, previewIslandLayout, reduceIslandExperience,
    type IslandExperienceState } from './experience';
import { assertIsland } from './repository';

function mixed() {
    let island = createIsland('child', 0);
    island.customization = { ...getIslandCustomization(island), points: 200 };
    island = reduceIslandCustomization(island, { type: 'purchase', itemId: 'starry-house', slot: 'houseWindows' });
    island = reduceIslandCustomization(island, { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' });
    island = reduceIslandExperience(island, { type: 'resident', residentId: 'rabbit', name: 'うさ', look: 'cap' }, 1);
    island = reduceIslandExperience(island, { type: 'ambience', ambience: 'brook' }, 1);
    return reduceIslandExperience(island, { type: 'emblem', emblem: 'flower' }, 1);
}
const save = (island = mixed()) => reduceIslandExperience(island, { type: 'save-layout', layoutId: 'slot-1', name: 'あわせた けしき' }, 2);

describe('versioned complete scene memories', () => {
    it('captures all resolved styles, looks, ambience and emblem independently of later changes', () => {
        const original = mixed(), saved = save(original), layout = saved.experience!.layouts[0];
        expect(layout.cosmetics).toEqual(getIslandCosmetics(original));
        expect(layout.sceneStyle).toEqual({ version: 2, residentLooks: { otter: 'original', rabbit: 'cap', fox: 'original' }, ambience: 'brook', emblem: 'flower',
            expression: createIslandExpressionSelection() });
        original.customization!.appearance!.slots.houseRoof = islandAppearanceStyleId('moon-garden', 'houseRoof');
        expect(layout.cosmetics.appearance!.slots.houseRoof).toBe('parts-v1:candy:houseRoof');
        const copy = getIslandExperience(saved);
        copy.layouts[0].sceneStyle!.residentLooks.rabbit = 'original';
        copy.layouts[0].cosmetics.appearance!.slots.houseWindows = islandAppearanceStyleId('moon-garden', 'houseWindows');
        expect(layout.sceneStyle!.residentLooks.rabbit).toBe('cap');
        expect(layout.cosmetics.appearance!.slots.houseWindows).toBe('parts-v1:starry:houseWindows');
    });
    it('restores the same saved mix and presentation while keeping current names, funds and learning state', () => {
        let island = save();
        island = reduceIslandCustomization(island, { type: 'purchase', itemId: 'crystal-water' });
        island = reduceIslandExperience(island, { type: 'resident', residentId: 'rabbit', name: 'いまの なまえ', look: 'scarf' }, 3);
        island = reduceIslandExperience(island, { type: 'rename-island', name: 'いまの しま' }, 3);
        island = reduceIslandExperience(island, { type: 'ambience', ambience: 'off' }, 3);
        island = reduceIslandExperience(island, { type: 'emblem', emblem: 'wave' }, 3);
        island.pendingPlanId = 'same-reservation';
        island.items.push({ id: 'later-earned', kind: 'bench', rotation: 1 });
        const before = structuredClone(island), preview = previewIslandLayout(island, 'slot-1');
        expect(preview).toEqual(reduceIslandExperience(island, { type: 'apply-layout', layoutId: 'slot-1' }, 4));
        expect(getIslandCosmetics(preview)).toEqual(island.experience!.layouts[0].cosmetics);
        expect(preview.experience).toMatchObject({ islandName: 'いまの しま', ambience: 'brook', emblem: 'flower', residents: { rabbit: { name: 'いまの なまえ', look: 'cap' } } });
        expect(preview.customization!.points).toBe(before.customization!.points);
        expect(preview.customization!.ownedItemIds).toEqual(before.customization!.ownedItemIds);
        expect(preview.growth).toEqual(before.growth);
        expect(preview.items.at(-1)).toEqual(before.items.at(-1));
        expect(preview.pendingPlanId).toBe(before.pendingPlanId);
        expect(island).toEqual(before);
        assertIsland(preview);
    });
    it('old layouts restore their original theme but preserve current outfits, sound and emblem', () => {
        let island = save();
        const old = island.experience!.layouts[0];
        old.cosmetics = { themeId: 'moon-garden', accentId: null };
        delete old.sceneStyle;
        island = reduceIslandExperience(island, { type: 'resident', residentId: 'fox', name: 'こん', look: 'cap' }, 3);
        const before = structuredClone(island), restored = previewIslandLayout(island, 'slot-1');
        expect(restored.customization!.appearance).toBeUndefined();
        expect(getIslandCosmetics(restored)).toEqual({ themeId: 'moon-garden', accentId: null });
        expect(restored.experience).toEqual(before.experience);
        expect(island).toEqual(before);
        expect(old.cosmetics.appearance).toBeUndefined();
    });
    it('a snapshot with a part the owner lacks is rejected atomically even though the base theme is free', () => {
        const island = save();
        island.experience!.layouts[0].cosmetics.appearance!.slots.water = islandAppearanceStyleId('crystal', 'water');
        const before = structuredClone(island);
        expect(() => previewIslandLayout(island, 'slot-1')).toThrow(IslandExperienceConflict);
        expect(island).toEqual(before);
    });
    it('rejects malformed optional scene snapshots without replacing valid old records', () => {
        const island = save(), base = island.experience!;
        const invalid = [null, { version: 2 }, { ...base.layouts[0].sceneStyle, extra: 1 },
            { ...base.layouts[0].sceneStyle, residentLooks: { otter: 'cap', rabbit: 'original' } },
            { ...base.layouts[0].sceneStyle, residentLooks: { otter: 'cap', rabbit: 'original', fox: 'mask' } },
            { ...base.layouts[0].sceneStyle, ambience: 'rain' }, { ...base.layouts[0].sceneStyle, emblem: 'invalid' }];
        for (const sceneStyle of invalid) {
            const value = { ...base, layouts: [{ ...base.layouts[0], sceneStyle }] } as unknown as IslandExperienceState;
            expect(hasValidIslandExperience({ experience: value })).toBe(false);
        }
        const legacy = createIsland('old', 0);
        legacy.experience = { ...getIslandExperience(legacy), layouts: [{ id: 'slot-1', name: 'もとの しま', capturedAt: 1, poses: [],
            cosmetics: { themeId: 'moon-garden', accentId: null } }] };
        const before = structuredClone(legacy);
        expect(hasValidIslandExperience(legacy)).toBe(true);
        getIslandExperience(legacy);
        expect(legacy).toEqual(before);
        expect(createIslandAppearance('moon-garden', 'legacy-v1').slots.sky).toBe('legacy-v1:moon-garden:sky');
    });
});
