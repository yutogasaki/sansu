import { describe, expect, it } from 'vitest';
import { canShowOrdinaryInterest, isResidentInterestItem, residentInterestVerb, sampleResidentInterest } from './residentInterest';

const species = ['otter', 'rabbit', 'fox'] as const;

describe('one resident interest across existing reply and visit clocks', () => {
    it.each(species)('%s returns exactly to rest without extending either clock', animal => {
        for (const phase of [-1, 0, 1, 2, NaN, Infinity]) {
            expect(sampleResidentInterest(animal, phase, false)).toEqual({ headPitch: 0, headRoll: 0, look: 0, lowPaw: 0, life: 0 });
        }
        for (let phase = 0; phase <= 1; phase += .025) {
            const value = sampleResidentInterest(animal, phase, false);
            expect(Object.values(value).every(Number.isFinite)).toBe(true);
            expect(value.life).toBeGreaterThanOrEqual(0); expect(value.life).toBeLessThanOrEqual(.5);
        }
    });

    it('shows two nods, one head tilt, and a slower look before a low paw, not just different amplitudes', () => {
        const otter = [.25, .47, .68].map(phase => sampleResidentInterest('otter', phase, false));
        expect(otter[0].headPitch).toBeGreaterThan(.14); expect(otter[1].headPitch).toBe(0); expect(otter[2].headPitch).toBeGreaterThan(.14);
        expect(otter.every(value => value.lowPaw === 0 && value.headRoll === 0)).toBe(true);
        expect(sampleResidentInterest('rabbit', .44, false)).toMatchObject({ headRoll: .21, lowPaw: 0 });
        expect(sampleResidentInterest('rabbit', .85, false).headRoll).toBeLessThan(.05);
        expect(sampleResidentInterest('fox', .2, false).look).toBeGreaterThan(0);
        expect(sampleResidentInterest('fox', .2, false).lowPaw).toBe(0);
        expect(sampleResidentInterest('fox', .66, false).lowPaw).toBe(1);
    });

    it.each(species)('%s has one material response even when the head nods twice', animal => {
        const life = Array.from({ length: 101 }, (_, index) => sampleResidentInterest(animal, index / 100, false).life);
        const maxima = life.flatMap((value, i) => i > 0 && i < 100 && value > life[i - 1] && value > life[i + 1] ? [i] : []);
        expect(maxima).toEqual([60]);
    });

    it.each(species)('%s has a time-independent reduced pose and no fictional movement caption', animal => {
        const staticPose = sampleResidentInterest(animal, 0, true);
        expect(staticPose.life).toBe(.22); expect(staticPose.look).toBe(.34);
        for (const phase of [.25, .7, 1, 20]) expect(sampleResidentInterest(animal, phase, true)).toEqual(staticPose);
        expect(residentInterestVerb(animal, true)).toBe('そっと みている');
    });

    it('admits only an actual ordinary visit, with no shared source/seat or moving actor leaking through', () => {
        const ordinary = { visible: true, learning: false, editing: false, shared: false, clearing: false };
        for (const [kind, action] of [['flower', 'sniff'], ['lantern', 'admire'], ['fountain', 'watch']]) {
            expect(isResidentInterestItem(kind)).toBe(true);
            expect(canShowOrdinaryInterest({ ...ordinary, kind, action })).toBe(true);
            for (const key of ['learning', 'editing', 'shared', 'clearing']) expect(canShowOrdinaryInterest({ ...ordinary, kind, action, [key]: true })).toBe(false);
            expect(canShowOrdinaryInterest({ ...ordinary, kind, action, visible: false })).toBe(false);
            expect(canShowOrdinaryInterest({ ...ordinary, kind, action: 'walk' })).toBe(false);
        }
        expect(isResidentInterestItem('bench')).toBe(false);
        expect(canShowOrdinaryInterest({ ...ordinary, kind: 'flower', action: 'sit' })).toBe(false);
        expect(canShowOrdinaryInterest({ ...ordinary, kind: 'swing', action: 'swing' })).toBe(false);
    });
});
