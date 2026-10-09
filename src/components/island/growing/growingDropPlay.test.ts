import { describe, expect, it } from 'vitest';
import { DROP_PLAY_MS, sampleDropPlay } from './growingDropPlay';

describe('short placed play', () => {
    it('shows distinct bench rest and swing travel, then settles completely', () => {
        const bench = sampleDropPlay('bench', 1200, false);
        const swing = [620, 1050, 1450].map(ms => sampleDropPlay('swing', ms, false));
        expect(bench.bodyPitch).toBeLessThan(-.2);
        expect(bench.leftFoot).toBeGreaterThan(.15);
        expect(bench.travel).toBe(0);
        expect(Math.max(...swing.map(frame => frame.travel)) - Math.min(...swing.map(frame => frame.travel))).toBeGreaterThan(.4);
        expect(sampleDropPlay('bench', DROP_PLAY_MS, false).rootPitch).toBeCloseTo(0);
        expect(sampleDropPlay('swing', DROP_PLAY_MS, false).travel).toBeCloseTo(0);
    });

    it('keeps readable held poses without oscillation when motion is reduced', () => {
        for (const kind of ['bench', 'swing'] as const) {
            const first = sampleDropPlay(kind, 1000, true), later = sampleDropPlay(kind, 1800, true);
            expect(first).toEqual(later);
            expect(first.bodyPitch).not.toBe(0);
            expect(first.lift).toBe(0);
            expect(first.travel).toBeCloseTo(0);
        }
    });
});
