import { describe, expect, it } from 'vitest';
import { getIslandExpansionLevel } from './expansion';

describe('saved and legacy island land', () => {
    it('preserves each old island or snapshot completed-set land without changing it', () => {
        for (const [completedSets, expected] of [[0, 0], [1, 0], [2, 1], [11, 1], [12, 2], [40, 2]]) {
            const state = { completedSets, growth: {} };
            expect(getIslandExpansionLevel(state)).toBe(expected);
            expect(state).toEqual({ completedSets, growth: {} });
            expect(getIslandExpansionLevel({ completedSets })).toBe(expected);
        }
    });

    it('uses an explicit saved zero or one instead of retroactively applying legacy land thresholds', () => {
        expect(getIslandExpansionLevel({ completedSets: 12, growth: { expansionLevel: 0 } })).toBe(0);
        expect(getIslandExpansionLevel({ completedSets: 24, growth: { expansionLevel: 1 } })).toBe(1);
        expect(getIslandExpansionLevel({ completedSets: 24, growth: { expansionLevel: 2 } })).toBe(2);
    });
});
