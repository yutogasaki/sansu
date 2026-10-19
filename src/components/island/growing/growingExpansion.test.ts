import { describe, expect, it } from 'vitest';
import { newLegacyIsland } from '../../../domain/growingIsland/legacy.fixture';
import { newIsland } from '../../../domain/growingIsland/island';
import { landQuote } from '../../../domain/growingIsland/commands';
import { RULES } from '../../../domain/growingIsland/rules';
import { growingExpansionLock } from './growingExpansion';

describe('visible expansion conditions', () => {
    it('explains both cape gates, including when the balance covers the cost', () => {
        const state = newLegacyIsland('expansion-visibility', 0);
        state.land = { expanded: 'west', extra: ['east', 'south'], capes: [] };
        state.drops = 1148;
        state.genki.best = RULES.genkiLevels[3];
        const before = structuredClone(state);
        expect(landQuote(state)).toBeUndefined();
        expect(growingExpansionLock(state)).toEqual({ requiredLevel: 5, currentLevel: 4, price: 720 });
        expect(state).toEqual(before);
        state.genki.best = RULES.genkiLevels[4];
        expect(growingExpansionLock(state)).toBeUndefined();
        expect(landQuote(state)?.price).toBe(720);
        state.land.capes.push('east');
        expect(growingExpansionLock(state)).toEqual({ requiredLevel: 6, currentLevel: 5, price: 960 });
        state.genki.best = RULES.genkiLevels[5];
        expect(growingExpansionLock(state)).toBeUndefined();
        expect(landQuote(state)?.price).toBe(960);
    });
    it('offers both capes under v0.4 without a level requirement', () => {
        const state = newIsland('growth-expansion', 0);
        state.land = { expanded: 'west', extra: ['east', 'south'], capes: [] }; state.drops = 2000;
        expect(growingExpansionLock(state)).toBeUndefined(); expect(landQuote(state)?.price).toBe(720);
        state.land.capes.push('east');
        expect(growingExpansionLock(state)).toBeUndefined(); expect(landQuote(state)?.price).toBe(960);
    });
    it('does not introduce a gate before the first purchase or after both capes', () => {
        const state = newIsland('expansion-unlocked', 0);
        expect(growingExpansionLock(state)).toBeUndefined();
        expect(landQuote(state)?.price).toBe(120);
        state.land = { expanded: 'west', extra: ['east', 'south'], capes: ['east', 'west'] };
        expect(growingExpansionLock(state)).toBeUndefined();
        expect(landQuote(state)?.step).toBe(6);
    });
});
