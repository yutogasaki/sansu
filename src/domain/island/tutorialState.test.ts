import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearProfileTutorial, clearTutorialMemory, hasTutorialEvent, nextTutorial, recordTutorialEvent, tutorialKey, tutorialWasSeen } from './tutorialState';
let values: Map<string, string>;
beforeEach(() => {
    clearTutorialMemory(); values = new Map();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());
describe('contextual tutorial safety', () => {
    it('keeps existing profiles and learning free of automatic help', () => {
        expect(nextTutorial('home', false, true, true, () => false)).toBeUndefined();
        for (const screen of ['learning', 'placement', 'camera', 'help'] as const) expect(nextTutorial(screen, true, true, true, () => false)).toBeUndefined();
    });
    it('prioritizes actual growth and never promises unavailable view controls', () => {
        expect(nextTutorial('home', true, true, true, () => false)).toBe('growth');
        expect(nextTutorial('home', true, false, true, () => false)).toBe('view');
        expect(nextTutorial('home', true, false, false, () => false)).toBeUndefined();
        expect(nextTutorial('home', true, true, true, id => id === 'growth')).toBe('view');
    });
    it('keeps independent cross-tab events and profiles without whole-state overwrite', () => {
        recordTutorialEvent('one', 'view', 'shown');
        values.set(tutorialKey('one', 'view', 'practiced'), '1');
        recordTutorialEvent('one', 'view', 'dismissed');
        clearTutorialMemory();
        expect(hasTutorialEvent('one', 'view', 'practiced')).toBe(true);
        expect(hasTutorialEvent('one', 'view', 'dismissed')).toBe(true);
        expect(tutorialWasSeen('two', 'view')).toBe(false);
        expect(nextTutorial('home', true, false, true, id => tutorialWasSeen('one', id))).toBeUndefined();
    });
    it('keeps help failure out of learning and deduplicates for this launch', () => {
        vi.stubGlobal('localStorage', { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('full'); } });
        expect(() => recordTutorialEvent('one', 'play', 'shown')).not.toThrow();
        expect(tutorialWasSeen('one', 'play')).toBe(true);
        expect(tutorialWasSeen('one', 'growth')).toBe(false);
    });
    it('clears only the removed profile after deletion', () => {
        recordTutorialEvent('one', 'play', 'shown'); recordTutorialEvent('two', 'play', 'shown');
        clearProfileTutorial('one'); expect(tutorialWasSeen('one', 'play')).toBe(false); expect(tutorialWasSeen('two', 'play')).toBe(true);
    });
});
