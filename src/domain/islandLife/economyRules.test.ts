import { describe, expect, it } from 'vitest';
import { HOUR } from './model';
import { effectiveGrowthHours, growthHoursRemaining, growthRateV3, initialLightBudget, issueFiniteLight } from './economyRules';
const times = (count: number, at = 0) => Array.from({ length: count }, () => at);
describe('v3 rolling learning growth', () => {
    it.each([[0, 12], [3, 8], [6, 6], [12, 6]])('grows a flower after %i completions in %i real hours', (count, hours) => {
        expect(growthHoursRemaining(times(count), 0, 6)).toBe(hours);
        expect(effectiveGrowthHours(times(count), 0, hours * HOUR)).toBe(6);
    });
    it('expires learning mid-growth and forecasts that expiry rather than dividing by the current rate', () => {
        expect(growthRateV3(times(6), 20 * HOUR)).toBe(1);
        expect(growthHoursRemaining(times(6), 20 * HOUR, 6)).toBe(8);
        expect(effectiveGrowthHours(times(6), 20 * HOUR, 28 * HOUR)).toBe(6);
        expect(growthRateV3(times(6), 24 * HOUR)).toBe(.5);
    });
    it('integrates staggered expiry, future completion boundaries, and split intervals identically', () => {
        const facts = [...times(3), ...times(3, HOUR)];
        expect(effectiveGrowthHours(facts, 23 * HOUR, 26 * HOUR)).toBe(2.25);
        const all = effectiveGrowthHours(facts, 0, 30 * HOUR);
        expect(effectiveGrowthHours(facts, 0, .5 * HOUR) + effectiveGrowthHours(facts, .5 * HOUR, 30 * HOUR)).toBeCloseTo(all);
        expect(growthHoursRemaining(times(6, HOUR), 0, 6)).toBe(12); // uncommitted future work is not promised
    });
    it('keeps base growth after long absence without learning and handles zero remaining time', () => {
        expect(effectiveGrowthHours([], 0, 30 * 24 * HOUR)).toBe(360);
        expect(growthHoursRemaining(times(6), 0, 0)).toBe(0);
        expect(() => effectiveGrowthHours([], HOUR, 0)).toThrow();
    });
});
describe('finite compatibility light', () => {
    it.each([[1000, ['original'], 0], [3, ['original', 'sunshine'], 1], [0, ['original'], 8], [0, ['original', 'sunshine', 'starlight'], 0]])('retains balance %i and bounds the remaining color rights', (light, styles, budget) => {
        expect(initialLightBudget(light as number, styles as string[])).toBe(budget);
    });
    it('does not refill the saved budget when a color is bought', () => {
        let state = issueFiniteLight(0, initialLightBudget(0, ['original']), 5);
        expect(state).toEqual({ light: 5, lightRemainingBudget: 3, issued: 5 });
        state = issueFiniteLight(state.light - 4, state.lightRemainingBudget, 100);
        expect(state).toEqual({ light: 4, lightRemainingBudget: 0, issued: 3 });
        expect(issueFiniteLight(1000, 0, 100)).toEqual({ light: 1000, lightRemainingBudget: 0, issued: 0 });
    });
});
