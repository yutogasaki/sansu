import { describe, expect, it } from 'vitest';
import { deliverySample } from './delivery';
describe('delivery continuity', () => {
    it('stays finite at negative initial RAF time and all route boundaries', () => {
        for (const t of [-1, 0, 2.5, 5, 7.5, 10, 12, 16, 26, 35, NaN, Infinity])
            expect(deliverySample(t).position.every(Number.isFinite)).toBe(true);
    });
    it('holds the actor still while the parcel moves continuously from hand to table', () => {
        expect(deliverySample(10).position).toEqual(deliverySample(12).position);
        expect(deliverySample(10).placing).toBe(0);
        expect(deliverySample(11).placing).toBeCloseTo(.5);
        expect(deliverySample(12).placing).toBe(1);
        for (const t of [10, 12, 16, 26, 35]) {
            const a=deliverySample(t-.001), b=deliverySample(t+.001);
            expect(Math.hypot(...a.position.map((v,i)=>v-b.position[i]))).toBeLessThan(.01);
        }
    });
    it('shows a completed delivery with reduced motion, without a loop or reward mutation', () => {
        expect(deliverySample(1,true)).toEqual(deliverySample(100,true));
        expect(deliverySample(1,true)).toMatchObject({placing:1,walking:false,phase:'delivery-arrived'});
    });
    it('approaches the terrace from the visible right side before placing the parcel', () => {
        const approach = deliverySample(9.9);
        expect(approach.position[0]).toBeGreaterThan(1);
        expect(approach.position[2]).toBeGreaterThan(.7);
        expect(Math.abs(approach.heading)).toBeGreaterThan(2);
    });
});
