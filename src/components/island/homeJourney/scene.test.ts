import { describe, expect, it } from 'vitest';
import { buildHomeJourney } from './scene';

describe('home journey authored growth', () => {
    it.each([
        [0, false, false],
        [9, true, false],
        [33, true, true],
    ])('keeps the same home identity while adding the stage %i structure', (answers, canopy, terrace) => {
        const content = buildHomeJourney({version:1, answers});
        const home = content.world.getObjectByName('home');
        expect(home?.getObjectByName('home-door')).toBeTruthy();
        expect(home?.getObjectByName('home-roof-trim')).toBeTruthy();
        expect(home?.getObjectByName('home-window-box')).toBeTruthy();
        expect(Boolean(home?.getObjectByName('home-canopy'))).toBe(canopy);
        expect(Boolean(home?.getObjectByName('home-terrace'))).toBe(terrace);
        content.dispose();
    });
});
