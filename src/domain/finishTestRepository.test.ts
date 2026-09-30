import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
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
    return profile;
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
        const problem = { ...generateMathProblem(skill, { profile }), subject: 'math' as const };
        const independent = learningEvidenceForProblem(problem, 'independent');
        // Unknown legacy answers count only as ordinary answers.
        await logAttempt(profile.id, 'math', skill, 'correct', false, false, false, 10);
        expect((await getProfile(profile.id))?.mathLevels?.find(level => level.level === 0)?.recentIndependentAnswersNonReview).toEqual([]);
        for (let index = 0; index < 19; index++) await logAttempt(profile.id, 'math', skill, 'correct', false, false, false, 10, independent);
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
        await logAttempt(profile.id, 'math', skill, 'correct', false, false, false, 10, independent);
        const saved = (await getProfile(profile.id))!;
        expect(saved.mathMainLevel).toBe(0);
        expect(saved.mathMaxUnlocked).toBe(0);
        expect(saved.mathLevels?.filter(level => level.level !== 0)).toEqual(oldOtherLevels);
        expect(finishEligibility(saved, 'math').status).toBe('ready');
        const reserved = await reserveFinishTest(profile.id, 'math');
        expect(reserved).toMatchObject({ level: 0, targetLevel: 1 });
        await answer(reserved);
        expect((await completeFinishTest(reserved, stats))?.result).toMatchObject({ passed: true, newLevel: 1 });
    });
    it('reads actual Lv11 practice coverage and refuses accuracy alone', async () => {
        const profile = await setup(11);
        await expect(reserveFinishTest(profile.id, 'math')).rejects.toThrow('準備中');
    });
});
