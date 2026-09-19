import { expect, it } from 'vitest';
import { effectiveGrowthHours, GROWTH_WINDOW_MS } from './economyRules';
const HOUR = 3600000;
// Independent frozen pre-optimization formula: require exact results, not a tolerance.
function reference(times: number[], from: number, to: number) {
    const bounds = [...new Set([from, to, ...times.flatMap(t => [t, t + GROWTH_WINDOW_MS]).filter(t => t > from && t < to)])].sort((a, b) => a - b);
    return bounds.slice(1).reduce((sum, end, i) => sum + (end - bounds[i]) / HOUR
        * (.5 + .5 * Math.min(times.filter(t => t <= bounds[i] && t > bounds[i] - GROWTH_WINDOW_MS).length / 6, 1)), 0);
}
it('exactly preserves unsorted, repeated, future and expiry-boundary integration', () => {
    let seed = 17;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    for (let i = 0; i < 2000; i++) {
        const times = Array.from({ length: i % 20 }, () => Math.floor(random() * 40) * HOUR);
        const from = Math.floor(random() * 70) * HOUR + (i % 3 ? 0 : .125);
        const to = from + (i % 2 ? 7000 : Math.floor(random() * 40) * HOUR);
        expect(effectiveGrowthHours(times, from, to)).toBe(reference(times, from, to));
    }
    for (const from of [0, HOUR, 24 * HOUR, 25 * HOUR]) for (const to of [from, from + 1, from + 24 * HOUR]) {
        const times = [HOUR, 0, HOUR, 0, 0, 0];
        expect(effectiveGrowthHours(times, from, to)).toBe(reference(times, from, to));
    }
});
it('still rejects invalid facts even in zero-duration or otherwise constant intervals', () => {
    for (const value of [NaN, Infinity, -Infinity]) {
        expect(() => effectiveGrowthHours([0, value], 0, 0)).toThrow();
        expect(() => effectiveGrowthHours([], value, 0)).toThrow();
        expect(() => effectiveGrowthHours([], 0, value)).toThrow();
    }
    expect(() => effectiveGrowthHours([], 2, 1)).toThrow();
});
