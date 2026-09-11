import { describe, expect, it } from 'vitest';
import { rewardDelta } from './rewardCue';

describe('rewardDelta', () => {
    it('does not announce the first visible value', () => {
        expect(rewardDelta(3, undefined)).toBeUndefined();
    });

    it('returns only the increase for a later visible value', () => {
        expect(rewardDelta(7, 3)).toBe(4);
    });

    it('does not replay a spend, unchanged value, or backwards correction', () => {
        expect(rewardDelta(3, 3)).toBeUndefined();
        expect(rewardDelta(2, 3)).toBeUndefined();
    });
});
