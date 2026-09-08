import { describe, expect, it } from 'vitest';
import { previewIslandCustomization, sameIslandCosmetics } from './islandCustomizationPreview';
import type { IslandCosmetics } from '../../domain/island/customization';

describe('temporary island looks', () => {
    it('tries different themes with the same accent and changes an accent without changing its theme', () => {
        const saved: IslandCosmetics = { themeId: 'starry', accentId: 'star-lanterns' };
        const candy = previewIslandCustomization(saved, 'candy');
        expect(candy).toEqual({ themeId: 'candy', accentId: 'star-lanterns' });
        expect(previewIslandCustomization(candy, 'crystal-charms')).toEqual({ themeId: 'candy', accentId: 'crystal-charms' });
        expect(saved).toEqual({ themeId: 'starry', accentId: 'star-lanterns' });
        expect(sameIslandCosmetics(saved, candy)).toBe(false);
        expect(sameIslandCosmetics(saved, { ...saved })).toBe(true);
    });
    it('restores the original theme independently from an earned accent', () => {
        expect(previewIslandCustomization({ themeId: 'crystal', accentId: 'candy-flags' }, 'moon-garden'))
            .toEqual({ themeId: 'moon-garden', accentId: 'candy-flags' });
    });
});
