import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededRandom } from '../utils/random';
import { evaluateFinishCoverage, finishContentKey, semanticFinishProblemKey } from './finishCoverage';
import { db } from '../db';
import { createInitialProfile } from './user/profile';
import { getAppData, saveAppData, saveProfile, updateProfileAtomically } from './user/repository';
import { reserveFinishTest, completeFinishTest, recordFinishTestAnswer } from './finishTestRepository';
import { logAttempt } from './learningRepository';
import { generateMathProblem } from './math';
import { learningEvidenceForProblem } from './learning/attemptContext';
import { getSkillsForLevel } from './math/curriculum';
import { finishEligibility } from './finishTest';
import { getProfile } from './user/repository';
import { ensurePeriodicTestSet } from './test/testSet';

async function setup(level = 8) {
    const profile = createInitialProfile('T', 1, level, 1, 'math');
    profile.mathMainLevel = level;
    profile.mathMaxUnlocked = level;
    profile.mathLevels = profile.mathLevels?.map(item => item.level === level
        ? { ...item, recentIndependentAnswersNonReview: Array(20).fill(true) } : item);
    await saveProfile(profile);
    const data = await getAppData();
    await saveAppData({ ...data, activeProfileId: profile.id });
    if (level !== 0 && level !== 11) for (let index = 0; index < 20; index++) await practice(profile, index);
    return profile;
}
const seen = new Map<string, Set<string>>();
async function practice(profile: Awaited<ReturnType<typeof setup>>, index: number) {
    const skill = getSkillsForLevel(profile.mathMainLevel)[index % getSkillsForLevel(profile.mathMainLevel).length];
    const keys = seen.get(`${profile.id}:${skill}`) ?? new Set<string>();
    const random = createSeededRandom(`fixture:${index}`);
    let problem = { ...generateMathProblem(skill, { random }), subject: 'math' as const };
    for (let attempt = 0; keys.has(finishContentKey(problem)) && attempt < 200; attempt++) problem = { ...generateMathProblem(skill, { random }), subject: 'math' as const };
    keys.add(finishContentKey(problem));
    seen.set(`${profile.id}:${skill}`, keys);
    await logAttempt(profile.id, 'math', skill, 'correct', false, false, false, 10, learningEvidenceForProblem(problem, 'independent'));
}
async function answer(set: Awaited<ReturnType<typeof reserveFinishTest>>) {
    for (let index = 0; index < 20; index++) await recordFinishTestAnswer(set, index, true);
}
const stats = { correct: 20, total: 20, durationSeconds: 50 };

describe('atomic finish test repository', () => {
    beforeEach(async () => { await Promise.all([db.appData.clear(), db.profiles.clear(), db.logs.clear(),
        db.parkEvents.clear(), db.islandEvents.clear(), db.challengeContacts.clear()]); });
    it('reserves a separate set, promotes atomically and preserves confirmation tests', async () => {
        const profile = await setup();
        const confirmation = await ensurePeriodicTestSet(profile, 'math');
        const reserved = await reserveFinishTest(profile.id, 'math');
        expect(reserved.problems).toHaveLength(20);
        expect(reserved.level).toBe(8);
        await answer(reserved);
        const completed = await completeFinishTest(reserved, stats);
        expect(completed?.result).toMatchObject({ passed: true, newLevel: 9 });
        const data = await getAppData();
        expect(data.profiles[profile.id].mathMainLevel).toBe(9);
        expect((await db.profiles.get(profile.id))?.mathMainLevel).toBe(9);
        expect(data.profiles[profile.id].periodicTestSets?.math).toEqual(confirmation);
        expect((await completeFinishTest(reserved, stats))?.result).toEqual(completed?.result);
    });
    it('resumes same reservation and persisted first responses without retrying mistakes', async () => {
        const profile = await setup();
        const old = await reserveFinishTest(profile.id, 'math');
        await recordFinishTestAnswer(old, 0, false);
        await recordFinishTestAnswer(old, 0, true);
        const current = await reserveFinishTest(profile.id, 'math');
        expect(old.id).toBe(current.id);
        expect(current.problems).toEqual(old.problems);
        expect(current.answers?.['0']).toBe(false);
        expect(await completeFinishTest(current, { ...stats, correct: 20 })).toBeNull();
        await answer(current);
        expect((await completeFinishTest(current, { ...stats, correct: 20 }))?.result).toMatchObject({ passed: false, correctCount: 19 });
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
        const failed = current.problems[0];
        const failedKey = semanticFinishProblemKey('math', failed);
        const recoveredKeys = new Set<string>();
        const random = createSeededRandom('recovery');
        for (let attempt = 0; recoveredKeys.size < 2 && attempt < 100; attempt++) {
            const problem = { ...generateMathProblem(failed.categoryId, { random }), subject: 'math' as const };
            const key = semanticFinishProblemKey('math', problem);
            if (key === failedKey || recoveredKeys.has(key)) continue;
            recoveredKeys.add(key);
            await logAttempt(profile.id, 'math', failed.categoryId, 'correct', false, false, false, 10, learningEvidenceForProblem(problem, 'independent'));
        }
        expect(recoveredKeys.size).toBe(2);
        const retry = await reserveFinishTest(profile.id, 'math');
        expect(retry.id).not.toBe(current.id);
        await answer(retry);
        expect((await completeFinishTest(retry, stats))?.result.passed).toBe(true);
    });
    it('rejects changes to active owner and parent-disabled target between start and save', async () => {
        const profile = await setup();
        const reserved = await reserveFinishTest(profile.id, 'math');
        const data = await getAppData();
        await saveAppData({ ...data, activeProfileId: null });
        expect(await completeFinishTest(reserved, stats)).toBeNull();
        await saveAppData(data);
        await updateProfileAtomically(profile.id, current => ({ ...current, mathMaxUnlocked: 9,
            mathLevels: current.mathLevels?.map(level => level.level === 9 ? { ...level, unlocked: true, enabled: false } : level) }));
        expect(await completeFinishTest(reserved, stats)).toBeNull();
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
    });
    it.each([false, true])('records real Lv0 readiness for new and legacy missing-state profiles (legacy=%s)', async legacy => {
        const profile = await setup(0);
        // setup readiness is intentionally removed: actual answers must earn it.
        profile.mathLevels = profile.mathLevels?.filter(level => !legacy || level.level !== 0)
            .map(level => ({ ...level, recentIndependentAnswersNonReview: [] }));
        const oldOtherLevels = structuredClone(profile.mathLevels?.filter(level => level.level !== 0));
        await saveProfile(profile);
        expect(finishEligibility(profile, 'math').status).toBe('practicing');
        const skill = getSkillsForLevel(0)[0];
        // Unknown legacy answers count only as ordinary answers.
        await logAttempt(profile.id, 'math', skill, 'correct', false, false, false, 10);
        expect((await getProfile(profile.id))?.mathLevels?.find(level => level.level === 0)?.recentIndependentAnswersNonReview).toEqual([]);
        for (let index = 0; index < 19; index++) await practice(profile, index);
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
        await practice(profile, 19);
        const saved = (await getProfile(profile.id))!;
        expect(saved.mathMainLevel).toBe(0);
        expect(saved.mathMaxUnlocked).toBe(0);
        expect(saved.mathLevels?.filter(level => level.level !== 0)).toEqual(oldOtherLevels);
        expect(finishEligibility(saved, 'math', undefined, evaluateFinishCoverage(saved, 'math', await db.logs.toArray())).status).toBe('ready');
        const reserved = await reserveFinishTest(profile.id, 'math');
        expect(reserved).toMatchObject({ level: 0, targetLevel: 1 });
        await answer(reserved);
        expect((await completeFinishTest(reserved, stats))?.result).toMatchObject({ passed: true, newLevel: 1 });
    });
    it('refuses corrupt stored response indices or nonboolean evidence instead of promoting', async () => {
        const profile = await setup();
        const reserved = await reserveFinishTest(profile.id, 'math');
        const complete = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [String(index), true]));
        for (const corrupt of [{ ...complete, '0': 'true' as unknown as boolean },
            Object.fromEntries([...Object.entries(complete).filter(([index]) => index !== '0'), ['99', true]])]) {
            await updateProfileAtomically(profile.id, current => ({ ...current,
                finishTestSets: { math: { ...reserved, answers: corrupt } } }));
            expect(await completeFinishTest(reserved, stats)).toBeNull();
            expect((await getProfile(profile.id))?.mathMainLevel).toBe(8);
        }
    });
    it('preserves admitted problems, written mode and first answers across expiry and settings changes', async () => {
        const profile = await setup();
        const reserved = await reserveFinishTest(profile.id, 'math');
        await recordFinishTestAnswer(reserved, 0, true);
        await updateProfileAtomically(profile.id, current => ({ ...current, hissanModeEnabled: !(current.hissanModeEnabled ?? true) }));
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(Date.now() + 8 * 86400000));
        try {
            const resumed = await reserveFinishTest(profile.id, 'math');
            expect(resumed.id).toBe(reserved.id);
            expect(resumed.problems).toEqual(reserved.problems);
            expect(resumed.answers?.['0']).toBe(true);
            await answer(resumed);
            expect((await completeFinishTest(resumed, stats))?.result.passed).toBe(true);
        } finally { vi.useRealTimers(); }
    });
    it('reads actual Lv11 practice coverage and refuses accuracy alone', async () => {
        const profile = await setup(11);
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
    });
});
