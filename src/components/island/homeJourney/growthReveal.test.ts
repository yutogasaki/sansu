import { describe, expect, it } from 'vitest';
import { crossedHomeJourneyStep, growthDeliverySeconds, growthRevealScale, homeJourneyGrowthTarget } from './growthReveal';

describe('home journey growth reveal', () => {
    it('finds only a newly crossed authored threshold', () => {
        expect(crossedHomeJourneyStep({version:1, answers:3}, {version:1, answers:9})?.at).toBe(9);
        expect(crossedHomeJourneyStep({version:1, answers:9}, {version:1, answers:9})).toBeUndefined();
        expect(crossedHomeJourneyStep({version:1, answers:39}, {version:1, answers:45})?.at).toBe(45);
    });
    it('maps all six thresholds to physical scene objects', () => {
        expect([3,9,15,21,33,45].map(homeJourneyGrowthTarget))
            .toEqual(['flower','home-canopy','shop','bench','home-terrace','parcel']);
    });
    it('settles exactly at full size and removes the bounce for reduced motion', () => {
        expect(growthRevealScale(0)).toBe(.04);
        expect(growthRevealScale(1.2)).toBeGreaterThan(1);
        expect(growthRevealScale(1.6)).toBe(1);
        expect(growthRevealScale(0, true)).toBe(1);
    });
    it('starts the final return on the visible placing action, then begins the ordinary loop', () => {
        expect(growthDeliverySeconds(0,45)).toBe(10);
        expect(growthDeliverySeconds(800,45)).toBe(11);
        expect(growthDeliverySeconds(1600,45)).toBe(12);
        expect(growthDeliverySeconds(2500,45)).toBe(0);
        expect(growthDeliverySeconds(2500,33)).toBe(2.5);
    });
});
