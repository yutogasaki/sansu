import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    getEggOpenHitokoto,
    getOpenHitokoto,
    getStageHitokoto,
    getTapHitokoto,
    shouldShowHitokotoOnOpen,
} from './hitokoto';

const mockRandomSequence = (values: number[]) => {
    let idx = 0;
    return vi.spyOn(Math, 'random').mockImplementation(() => {
        const value = values[idx] ?? values[values.length - 1] ?? 0;
        idx += 1;
        return value;
    });
};

describe('ikimono hitokoto', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('returns kana/kanji variants for open hitokoto', () => {
        // open: skip compose -> skip time-of-day -> anytime first item
        mockRandomSequence([0.9, 0.9, 0]);
        const kana = getOpenHitokoto('kana');

        mockRandomSequence([0.9, 0.9, 0]);
        const kanji = getOpenHitokoto('kanji');

        expect(kana).toBe('また きたね');
        expect(kanji).toBe('また来たね');
    });

    it('returns composed tap hitokoto with mode-specific text', () => {
        // compose branch + prefix[0] + suffix[2]
        mockRandomSequence([0.1, 0, 0.45]);
        const kana = getTapHitokoto('kana');

        mockRandomSequence([0.1, 0, 0.45]);
        const kanji = getTapHitokoto('kanji');

        expect(kana).toBe('ちょっと たのしい');
        expect(kanji).toBe('ちょっと 楽しい');
    });

    it('returns kanji egg text when kanji mode is selected', () => {
        mockRandomSequence([0]);
        expect(getEggOpenHitokoto('kanji')).toContain('何');
    });

    it('respects open-hitokoto display probability threshold', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.32);
        expect(shouldShowHitokotoOnOpen()).toBe(true);

        vi.spyOn(Math, 'random').mockReturnValue(0.34);
        expect(shouldShowHitokotoOnOpen()).toBe(false);
    });

    it('returns null for stages without stage-specific hitokoto', () => {
        expect(getStageHitokoto('adult', 'kana')).toBeNull();
    });
});
