import { describe, expect, it } from 'vitest';
import { islandFocusScreen, islandLearningRequested, islandParentUrl, islandScreenFromSearch, withoutIslandLearning } from './navigation';

describe('island navigation contract', () => {
    it('opens home independently of reserved learning and rejects unknown views', () => {
        expect(islandScreenFromSearch('')).toBe('home');
        expect(islandScreenFromSearch('?view=invalid')).toBe('home');
        expect(islandLearningRequested('?view=home&pendingPlanId=reserved')).toBe(false);
        expect(islandLearningRequested('?learn=1')).toBe(true);
        expect(islandLearningRequested('?start=learn&profile=child')).toBe(true);
    });
    it('keeps normal lists available and gives focused work the viewport', () => {
        for (const view of ['home', 'inventory', 'album', 'photos', 'growth', 'furniture'] as const) expect(islandFocusScreen(view)).toBe(false);
        for (const view of ['learning', 'placement', 'camera', 'showcase', 'workshop', 'challenge'] as const) expect(islandFocusScreen(view)).toBe(true);
        expect(islandFocusScreen('photos', 'stored-photo')).toBe(true);
    });
    it('keeps the handbook addressable and returns learning to that same page', () => {
        expect(islandScreenFromSearch('?view=help')).toBe('help');
        expect(islandFocusScreen('help')).toBe(false);
        expect(islandParentUrl('/island', '?view=help&learn=1')).toBe('/island?view=help');
    });
    it('removes learning intent without losing settings depth or selected island page', () => {
        expect(withoutIslandLearning('/settings', '?section=learning&learn=1')).toBe('/settings?section=learning');
        expect(withoutIslandLearning('/island', '?view=album&learn=1')).toBe('/island?view=album');
        expect(withoutIslandLearning('/island', '?start=learn&profile=child')).toBe('/island');
    });
    it.each([
        ['/settings', '?section=profile', '/settings'],
        ['/settings/curriculum', '', '/settings?section=learning'],
        ['/settings', '?section=learning&learn=1', '/settings?section=learning'],
        ['/island', '?learn=1', '/island'],
        ['/island', '?view=challenge', '/island?view=keepsakes'],
        ['/island', '?view=placement', '/island?view=inventory'],
        ['/island', '?view=photos&photo=a', '/island?view=photos'],
    ])('has an in-app fallback for direct entry %s%s', (path, search, parent) => {
        expect(islandParentUrl(path, search)).toBe(parent);
    });
});
