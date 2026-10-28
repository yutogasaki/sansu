import { describe, expect, it } from 'vitest';
import { kokugoUnitLevel, KOKUGO_LEVEL_TITLES } from './progressView';

describe('national-language display levels', () => {
    it('does not treat free expression or a separate full-kanji course as earned starter levels', () => {
        expect(kokugoUnitLevel('E08')).toBeUndefined();
        expect(kokugoUnitLevel('H06')).toBeUndefined();
        expect(kokugoUnitLevel('KANJI1')).toBeUndefined();
        expect(kokugoUnitLevel('unknown')).toBeUndefined();
    });
    it('labels the actual first and final content bands without inventing a level zero curriculum', () => {
        expect(kokugoUnitLevel('K01')).toBe(1);
        expect(kokugoUnitLevel('R11')).toBe(20);
        expect(KOKUGO_LEVEL_TITLES).toHaveLength(20);
        expect(KOKUGO_LEVEL_TITLES[19]).toContain('しりょう');
    });
});
