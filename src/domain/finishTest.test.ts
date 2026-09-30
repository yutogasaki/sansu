import { describe, expect, it } from 'vitest';
import { createInitialProfile } from './user/profile';
import { applyFinishTestCompletion, finishEligibility, type FinishTestReservation } from './finishTest';

function ready(subject: 'math' | 'vocab' = 'math') {
    const profile = createInitialProfile('T', 1, 1, 1, subject);
    const main = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const key = subject === 'math' ? 'mathLevels' : 'vocabLevels';
    profile[key] = profile[key]?.map(level => level.level === main
        ? { ...level, recentIndependentAnswersNonReview: Array(20).fill(true) } : level);
    const reservation: FinishTestReservation = { id: 'finish-a', profileId: profile.id, subject, level: main,
        targetLevel: main + 1, createdAt: '2026-10-01T00:00:00Z', problems: [] };
    profile.finishTestSets = { [subject]: reservation };
    return { profile, reservation };
}
const stats = { correct: 20, total: 20, durationSeconds: 100 };

describe('finish test progression', () => {
    it.each(['math', 'vocab'] as const)('passes and advances only adjacent %s while keeping old records', subject => {
        const { profile, reservation } = ready(subject);
        expect(finishEligibility(profile, subject).status).toBe('ready');
        const saved = applyFinishTestCompletion(profile, reservation, stats, 1);
        expect(saved.result?.newLevel).toBe(reservation.targetLevel);
        const key = subject === 'math' ? 'mathLevels' : 'vocabLevels';
        expect(saved.profile[key]?.find(level => level.level === reservation.targetLevel)).toMatchObject({ unlocked: true, enabled: true });
        expect(saved.profile[key]?.find(level => level.level === reservation.level)).toEqual(profile[key]?.find(level => level.level === reservation.level));
        expect(saved.profile.finishTestSets?.[subject]).toBeUndefined();
        expect(saved.profile.testHistory?.[0]).toMatchObject({ kind: 'finish', passed: true });
        expect(applyFinishTestCompletion(saved.profile, reservation, stats, 2).result).toEqual(saved.result);
    });
    it.each([{ correct: 0 }, { correct: 16 }, { correct: 17 }, { correct: 19 }, { timedOut: true }])('does not promote on incomplete, low or timed out result %j', override => {
        const { profile, reservation } = ready();
        const saved = applyFinishTestCompletion(profile, reservation, { ...stats, ...override }, 1);
        expect(saved.result?.passed).toBe(false);
        expect(saved.profile.mathMainLevel).toBe(profile.mathMainLevel);
        // A fresh reservation enables a new try; history remains.
        const retry = { ...reservation, id: 'finish-b' };
        const next = { ...saved.profile, finishTestSets: { math: retry } };
        expect(applyFinishTestCompletion(next, retry, stats, 2).result?.passed).toBe(true);
    });
    it.each([{ total: 19 }, { correct: 21 }, { correct: -1 }, { durationSeconds: NaN }])('rejects malformed results %j', override => {
        const { profile, reservation } = ready();
        expect(applyFinishTestCompletion(profile, reservation, { ...stats, ...override }, 1)).toEqual({ profile, result: null });
    });
    it('rejects stale ownership, main level, reservation replacement and lost readiness', () => {
        const { profile, reservation } = ready();
        for (const altered of [{ ...profile, id: 'other' }, { ...profile, mathMainLevel: profile.mathMainLevel + 1 },
            { ...profile, finishTestSets: { math: { ...reservation, id: 'new' } } },
            { ...profile, mathLevels: profile.mathLevels?.map(level => ({ ...level, recentIndependentAnswersNonReview: [] })) }]) {
            expect(applyFinishTestCompletion(altered, reservation, stats, 1)).toEqual({ profile: altered, result: null });
        }
    });
    it('preserves parent-disabled legacy ranges and higher unlock ceilings', () => {
        const { profile, reservation } = ready();
        const legacy = { ...profile, mathMaxUnlocked: reservation.targetLevel + 2,
            mathLevels: profile.mathLevels?.map(level => level.level === reservation.targetLevel
                ? { ...level, unlocked: true, enabled: false } : level) };
        expect(finishEligibility(legacy, 'math').status).toBe('paused');
        expect(applyFinishTestCompletion(legacy, reservation, stats, 1).result).toBeNull();
        const enabled = { ...legacy, mathLevels: legacy.mathLevels?.map(level => level.level === reservation.targetLevel ? { ...level, enabled: true } : level) };
        expect(applyFinishTestCompletion(enabled, reservation, stats, 1).profile.mathMaxUnlocked).toBe(legacy.mathMaxUnlocked);
    });
    it('supports Lv0 readiness without trusting legacy ordinary correct-answer windows', () => {
        const profile = createInitialProfile('T', 1, 0, 1, 'math');
        const lv0 = { ...profile, mathMainLevel: 0, mathMaxUnlocked: 0,
            mathLevels: profile.mathLevels?.map(level => level.level === 0
                ? { ...level, recentIndependentAnswersNonReview: Array(20).fill(true) } : level) };
        expect(finishEligibility(lv0, 'math')).toMatchObject({ status: 'ready', mainLevel: 0, nextLevel: 1, count: 20 });
        const legacy = { ...lv0, mathLevels: lv0.mathLevels?.map(level => level.level === 0
            ? { ...level, recentIndependentAnswersNonReview: undefined, recentAnswersNonReview: Array(20).fill(true) } : level) };
        expect(finishEligibility(legacy, 'math').status).toBe('practicing');
    });
    it('requires independent recent 20 and complete Lv11 unit coverage', () => {
        const { profile } = ready();
        const lv11 = { ...profile, mathMainLevel: 11, mathMaxUnlocked: 11,
            mathLevels: profile.mathLevels?.map(level => level.level === 11 ? { ...level, recentIndependentAnswersNonReview: Array(20).fill(true) } : level) };
        expect(finishEligibility(lv11, 'math').status).toBe('practicing');
        expect(finishEligibility(lv11, 'math', ['missing']).status).toBe('practicing');
        expect(finishEligibility(lv11, 'math', []).status).toBe('ready');
        const unsupported = { ...profile, mathLevels: profile.mathLevels?.map(level => ({ ...level, recentIndependentAnswersNonReview: [], recentAnswersNonReview: Array(20).fill(true) })) };
        expect(finishEligibility(unsupported, 'math').status).toBe('practicing');
    });
});
