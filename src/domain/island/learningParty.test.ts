import { describe, expect, it } from 'vitest';
import { advanceLearningParty, EMPTY_LEARNING_PARTY, learningPartyMoment, partyStampCount, validLearningParty } from './learningParty';

const correct = { completed: true, independent: true, breakStreak: false };
const miss = { completed: false, independent: false, breakStreak: true };
const supported = { completed: true, independent: false, breakStreak: false };
describe('Pokomoko consecutive-answer play', () => {
    it('builds to three, launches at five, then spends three whole questions without a clock', () => {
        let p = { ...EMPTY_LEARNING_PARTY };
        for (let i = 1; i <= 8; i++) {
            const next = advanceLearningParty(p, correct)!;
            expect(next.streak).toBe(i);
            if (i === 3) expect(learningPartyMoment(p, next)?.kind).toBe('jump');
            if (i === 5) expect(learningPartyMoment(p, next)?.kind).toBe('ride');
            expect(next.rideRemaining).toBe(i < 5 ? 0 : 8 - i);
            expect(next.light).toBe(i <= 5 ? i : 5 + (i - 5) * 2);
            p = next;
        }
        expect(partyStampCount(p)).toBe(1);
    });
    it('keeps earned light, stamps and ride after a miss/help; the corrected problem is not a new streak', () => {
        const p = { version: 1 as const, streak: 12, light: 18, rideRemaining: 1 };
        const broken = advanceLearningParty(p, miss)!;
        expect(broken).toEqual({ ...p, streak: 0 });
        expect(advanceLearningParty(broken, supported)).toEqual({ ...broken, light: 19, rideRemaining: 0 });
        expect(advanceLearningParty(p, supported)).toEqual({ ...p, streak: 0, light: 19, rideRemaining: 0 });
    });
    it('never awards an intermediate row, failed attempt, or old unknown independence', () => {
        expect(advanceLearningParty(undefined, miss)).toBeUndefined();
        const p = { version: 1 as const, streak: 4, light: 4, rideRemaining: 0 };
        expect(advanceLearningParty(p, { ...correct, completed: false })).toBe(p);
        expect(advanceLearningParty(p, supported)).toEqual({ ...p, streak: 0, light: 5 });
    });
    it('unlocks three finite souvenirs and continues the ride game after collection', () => {
        let p = { ...EMPTY_LEARNING_PARTY };
        const earned = [];
        for (let i = 1; i <= 30; i++) {
            const next = advanceLearningParty(p, correct)!;
            const moment = learningPartyMoment(p, next);
            if (moment?.stamp) earned.push(moment.stamp);
            p = next;
        }
        expect(earned).toEqual(['ほし', 'つき', 'にじ']);
        expect(p).toEqual({ version: 1, streak: 30, light: 30, rideRemaining: 3 });
    });
    it('accepts absent legacy state and rejects unsupported or corrupt progress', () => {
        expect(validLearningParty(undefined)).toBe(true);
        expect(validLearningParty(EMPTY_LEARNING_PARTY)).toBe(true);
        for (const invalid of [null, {}, { ...EMPTY_LEARNING_PARTY, version: 2 }, { ...EMPTY_LEARNING_PARTY, light: 31 },
            { ...EMPTY_LEARNING_PARTY, streak: NaN }, { ...EMPTY_LEARNING_PARTY, rideRemaining: -1 }, { ...EMPTY_LEARNING_PARTY, light: .5 }]) {
            expect(validLearningParty(invalid)).toBe(false);
        }
    });
});
