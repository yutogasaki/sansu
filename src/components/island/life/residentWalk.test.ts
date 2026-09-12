import { describe, expect, it } from 'vitest';
import { sampleWalkEdge, turnToward } from './residentWalk';

describe('resident path presentation', () => {
    it.each([[true, false], [false, false], [false, true], [true, true]])(
        'stays inside its reserved edge and keeps cell arrival times (%s, %s)', (first, last) => {
            let previous = 0;
            for (let i = 0; i <= 100; i++) {
                const { fraction, weight } = sampleWalkEdge(i / 100, first, last);
                expect(fraction).toBeGreaterThanOrEqual(previous);
                expect(fraction).toBeLessThanOrEqual(1);
                expect(weight).toBeGreaterThanOrEqual(0);
                expect(weight).toBeLessThanOrEqual(1);
                previous = fraction;
            }
            expect(sampleWalkEdge(0, first, last).fraction).toBe(0);
            expect(sampleWalkEdge(1, first, last).fraction).toBe(1);
        },
    );
    it('eases departure and arrival without stopping at intermediate cells', () => {
        expect(sampleWalkEdge(.1, true, false).fraction).toBeLessThan(.1);
        expect(sampleWalkEdge(.9, false, true).fraction).toBeGreaterThan(.9);
        expect(sampleWalkEdge(.37, false, false)).toEqual({ fraction: .37, weight: 1 });
        expect(sampleWalkEdge(0, true, false).weight).toBe(0);
        expect(sampleWalkEdge(1, false, true).weight).toBe(0);
    });
    it('turns through the short arc at the angle seam, without overshoot', () => {
        const from = Math.PI - .1, to = -Math.PI + .1;
        expect(turnToward(from, to, 0)).toBe(from);
        expect(turnToward(from, to, .5)).toBeCloseTo(Math.PI);
        expect(turnToward(from, to, 1)).toBeCloseTo(Math.PI + .1);
        expect(turnToward(0, Math.PI / 2, 2)).toBeCloseTo(Math.PI / 2);
    });
});
