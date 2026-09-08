import { describe, expect, it } from 'vitest';
import { previewIslandCustomization, sameIslandCosmetics } from './islandCustomizationPreview';
import type { IslandCosmetics } from '../../domain/island/customization';
import { createIslandAppearance, resolveIslandAppearance } from '../../domain/island/appearance';

describe('temporary island looks', () => {
    it('tries different themes with the same accent and changes an accent without changing its theme', () => {
        const saved: IslandCosmetics = { themeId: 'starry', accentId: 'star-lanterns' };
        const candy = previewIslandCustomization(saved, 'candy');
        expect(candy).toMatchObject({ themeId: 'candy', accentId: 'star-lanterns' });
        expect(resolveIslandAppearance(candy).slots.houseRoof).toBe('parts-v1:candy:houseRoof');
        expect(previewIslandCustomization(candy, 'crystal-charms')).toEqual({ ...candy, accentId: 'crystal-charms' });
        expect(saved).toEqual({ themeId: 'starry', accentId: 'star-lanterns' });
        expect(sameIslandCosmetics(saved, candy)).toBe(false);
        expect(sameIslandCosmetics(saved, { ...saved })).toBe(true);
    });
    it('restores the original theme independently from an earned accent', () => {
        const original = previewIslandCustomization({ themeId: 'crystal', accentId: 'candy-flags' }, 'moon-garden');
        expect(original).toMatchObject({ themeId: 'moon-garden', accentId: 'candy-flags' });
        expect(resolveIslandAppearance(original)).toEqual(createIslandAppearance('moon-garden', 'legacy-v1'));
    });
    it('detects a changed roof even when the old theme and accent IDs have not changed', () => {
        const saved: IslandCosmetics = { themeId: 'moon-garden', accentId: null };
        const before = structuredClone(saved), roof = previewIslandCustomization(saved, 'starry-house', 'houseRoof');
        expect(roof.themeId).toBe(saved.themeId);
        expect(sameIslandCosmetics(saved, roof)).toBe(false);
        expect(resolveIslandAppearance(roof).slots.houseRoof).toBe('parts-v1:starry:houseRoof');
        expect(resolveIslandAppearance(roof).slots.houseWindows).toBe('legacy-v1:moon-garden:houseWindows');
        expect(saved).toEqual(before);
    });
    it('compares the resolved picture, including a captured old picture and a mixed picture with another base ID', () => {
        const old: IslandCosmetics = { themeId: 'candy', accentId: null };
        expect(sameIslandCosmetics(old, { ...old, appearance: createIslandAppearance('candy', 'legacy-v1') })).toBe(true);
        const appearance = createIslandAppearance('crystal');
        expect(sameIslandCosmetics({ ...old, appearance }, { themeId: 'starry', accentId: null, appearance })).toBe(true);
    });
});
