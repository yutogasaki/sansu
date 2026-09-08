import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, type AttemptLog } from '../db';
import { getNextPromotionLevel, hasMathPromotionEvidence } from './levelProgression';
import { createInitialProfile, syncLevelState } from './user/profile';
import { getProfile, saveProfile } from './user/repository';
import { logAttempt } from './learningRepository';
import { checkMathMainPromotion } from './math/service';
import { checkEnglishLevelProgression } from './english/service';
import { getWordsByLevel } from './english/words';
import type { MemoryState, SubjectKey } from './types';
import { applyResolvedProgressionToLatestProfile } from '../hooks/useStudySession.logic';
import { getLearningAttemptTransactionTables, writeLearningAttemptInTransaction } from './learningAttemptWriter';
import { getLearningDayStart, toLocaleDateKey } from '../utils/learningDay';
import { generateMathProblem } from './math';
import { generateVocabProblem } from './english/generator';
import { learningEvidenceForProblem } from './learning/attemptContext';

const evidence = (subject: SubjectKey, itemId: string) => learningEvidenceForProblem({
    ...(subject === 'math' ? generateMathProblem(itemId) : generateVocabProblem(itemId)),
    id: 'verified-attempt', subject, isReview: false,
}, 'independent');

const attempt = (result: AttemptLog['result'], index: number, isReview = false): AttemptLog => ({
    id: index, profileId: 'p', subject: 'math', itemId: 'count_100', result, isReview,
    timestamp: new Date(2026, 8, 8, 10, index).toISOString(),
    learningEvidence: evidence('math', 'count_100'),
});
const history = (correctInLast20: number) => [
    ...Array.from({ length: 10 }, (_, i) => attempt('correct', i)),
    ...Array.from({ length: 20 }, (_, i) => attempt(i < correctInLast20 ? 'correct' : 'incorrect', i + 10)),
];

describe('evidence required for level progression', () => {
    beforeEach(async () => {
        await Promise.all([db.logs.clear(), db.memoryMath.clear(), db.memoryVocab.clear(), db.profiles.clear(), db.appData.clear()]);
    });

    it('requires 30 scored exposures and 17 of the most recent 20 correct', () => {
        expect(hasMathPromotionEvidence(history(17).slice(1))).toBe(false);
        expect(hasMathPromotionEvidence(history(16))).toBe(false);
        expect(hasMathPromotionEvidence(history(17))).toBe(true);
        expect(hasMathPromotionEvidence(Array.from({ length: 40 }, (_, i) => attempt('incorrect', i)))).toBe(false);
    });

    it('uses timestamp order and includes skips in accuracy but excludes reviews', () => {
        const passed = history(20);
        expect(hasMathPromotionEvidence([...passed].reverse())).toBe(true);
        const reviews = Array.from({ length: 20 }, (_, i) => attempt('incorrect', i + 30, true));
        expect(hasMathPromotionEvidence([...passed, ...reviews])).toBe(true);
        const skips = Array.from({ length: 4 }, (_, i) => attempt('skipped', i + 50));
        expect(hasMathPromotionEvidence([...passed, ...skips])).toBe(false);
    });

    it('recognizes the legacy skipped flag in exposure and accuracy', () => {
        const oldSkips = Array.from({ length: 10 }, (_, i) => ({ ...attempt('incorrect', i), skipped: true }));
        const correct = Array.from({ length: 20 }, (_, i) => attempt('correct', i + 10));
        expect(hasMathPromotionEvidence([...oldSkips, ...correct])).toBe(false);
        const mislabeledSkips = Array.from({ length: 4 }, (_, i) => ({ ...attempt('correct', i + 30), skipped: true }));
        expect(hasMathPromotionEvidence([...history(20), ...mislabeledSkips])).toBe(false);
    });

    it.each<SubjectKey>(['math', 'vocab'])('respects manual downgrade and adjacent levels for %s', subject => {
        let profile = syncLevelState(createInitialProfile('T', 1, 1, 1, subject), subject, 5);
        profile = syncLevelState(profile, subject, 2);
        expect(getNextPromotionLevel(profile, subject)).toBeNull();
        const key = subject === 'math' ? 'mathLevels' : 'vocabLevels';
        profile[key] = profile[key]?.map(level => level.level === 3 ? { ...level, enabled: true } : level);
        expect(getNextPromotionLevel(profile, subject)).toBe(3);
        expect(getNextPromotionLevel({ ...profile, [key]: undefined }, subject)).toBe(3);
    });

    it.each<SubjectKey>(['math', 'vocab'])('does not apply stale async %s progression after Settings changes', subject => {
        const original = createInitialProfile('T', 1, 1, 1, subject);
        const base = syncLevelState(original, subject, 3);
        const resolved = syncLevelState(base, subject, 4);
        const latest = syncLevelState(base, subject, 1);
        expect(applyResolvedProgressionToLatestProfile({
            baseProfile: base, resolvedProfile: resolved, latestProfile: latest, subject,
        })).toBe(latest);
    });

    it('uses the same math evidence in the atomic writer and Study service', async () => {
        const profile = createInitialProfile('T', 1, 1, 1, 'math'); // main 2
        profile.mathMaxUnlocked = 3;
        profile.mathLevels = profile.mathLevels?.map(level => level.level === 3 ? { ...level, unlocked: true, enabled: true } : level);
        await saveProfile(profile);
        for (let i = 0; i < 30; i++) await logAttempt(profile.id, 'math', 'count_10', 'incorrect', false, false, false, undefined, evidence('math', 'count_10'));
        let stored = (await getProfile(profile.id))!;
        expect(stored.mathMainLevel).toBe(2);
        expect(await checkMathMainPromotion(stored, 3)).toBe(false);
        for (let i = 0; i < 17; i++) await logAttempt(profile.id, 'math', 'count_10', 'correct', false, false, false, undefined, evidence('math', 'count_10'));
        stored = (await getProfile(profile.id))!;
        expect(stored.mathMainLevel).toBe(3);
        expect(await checkMathMainPromotion(profile, 3)).toBe(true);
        const downgraded = syncLevelState(stored, 'math', 2);
        await saveProfile(downgraded);
        await logAttempt(profile.id, 'math', 'one_more', 'correct');
        expect((await getProfile(profile.id))!.mathMainLevel).toBe(2);
        expect(await checkMathMainPromotion(downgraded, 3)).toBe(false);
    }, 15000);

    it('requires successful distinct English words at the adjacent enabled level', async () => {
        const profile = createInitialProfile('T', 1, 1, 1, 'vocab');
        profile.vocabMaxUnlocked = 5;
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level <= 5 ? { ...level, unlocked: true, enabled: true } : level);
        const words = getWordsByLevel(2);
        const threshold = Math.ceil(words.length * 0.7);
        const memory: Record<string, MemoryState> = Object.fromEntries(words.slice(0, threshold).map(word => [word.id, {
            id: word.id, strength: 1, nextReview: new Date().toISOString(), updatedAt: new Date().toISOString(),
            totalAnswers: 10, correctAnswers: 0, independentCorrectAnswers: 0, incorrectAnswers: 10, skippedAnswers: 10,
        }]));
        expect(await checkEnglishLevelProgression(profile, memory)).toBe(false);
        Object.values(memory).forEach(item => { item.correctAnswers = 1; });
        expect(await checkEnglishLevelProgression(profile, memory)).toBe(false);
        Object.values(memory).slice(0, -1).forEach(item => { item.independentCorrectAnswers = 1; });
        expect(await checkEnglishLevelProgression(profile, memory)).toBe(false);
        Object.values(memory).forEach(item => { item.independentCorrectAnswers = 1; });
        expect(await checkEnglishLevelProgression(profile, memory)).toBe(true);
        await db.memoryVocab.bulkPut(Object.values(memory).map(item => ({ ...item, profileId: profile.id })));
        expect(await checkEnglishLevelProgression(profile)).toBe(true);
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        expect(await checkEnglishLevelProgression(profile, memory)).toBe(false);
    });

    it('persists first learning and next-day retrieval using the answer timestamp throughout', async () => {
        const profile = createInitialProfile('T', 1, 1, 1, 'vocab');
        await saveProfile(profile);
        const write = (date: Date) => db.transaction('rw', getLearningAttemptTransactionTables(db), async () =>
            writeLearningAttemptInTransaction(db, {
                profileId: profile.id, subject: 'vocab', itemId: 'apple', result: 'correct',
                isReview: false, isMaintenanceCheck: false, timestamp: date.toISOString(),
                learningEvidence: evidence('vocab', 'apple'),
            }));
        const firstDay = new Date(2026, 0, 10, 20);
        const first = await write(firstDay);
        expect(first.memory.strength).toBe(1);
        expect(first.profile?.lastStudyDate).toBe(toLocaleDateKey(getLearningDayStart(firstDay)));
        const repeat = await write(new Date(2026, 0, 11, 3, 59));
        expect(repeat.memory.strength).toBe(1);
        expect(repeat.memory.nextReview).toBe(first.memory.nextReview);
        expect(repeat.profile?.todayCount).toBe(2);
        const nextDay = await write(new Date(2026, 0, 11, 4));
        expect(nextDay.memory.strength).toBe(1);
        expect(nextDay.profile?.todayCount).toBe(1);
        expect(nextDay.profile?.streak).toBe(2);
        const spaced = await write(new Date(2026, 0, 12, 4));
        expect(spaced.memory.strength).toBe(2);
    });
});
