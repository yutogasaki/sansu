import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { getWordsByLevel } from "../domain/english/words";
import { checkVocabMainPromotion, checkVocabUnlockReadiness } from "../domain/english/service";
import { getSkillsForLevel } from "../domain/math/curriculum";
import { generateMathProblem } from '../domain/math';
import { learningEvidenceForProblem as mathLearningEvidence } from '../domain/learning/attemptContext';
import { createLearningProblemContext } from "../domain/learning/context";
import { getSkippedItemsToday, logAttempt } from "../domain/learningRepository";
import { checkPeriodTestTrigger } from "../domain/test/trigger";
import { buildPeriodicTestSet } from "../domain/test/testSet";
import { createInitialProfile } from "../domain/user/profile";
import { getProfile, saveProfile } from "../domain/user/repository";
import type { MemoryState, UserProfile } from "../domain/types";
import {
    buildVocabLevelWeights,
    generateSingleVocabProblem,
    generateWeakReviewBlock,
    markPicked,
} from "./blockGenerators";
import {
    applyPendingPeriodicTestTrigger,
    applyResolvedProgressionToLatestProfile,
    resolvePeriodicTestTriggerProfile,
    removeStoppedPendingQuestions,
    resolveProfileProgressionAfterAttempt,
} from "./useStudySession.logic";

const memory = (id: string, strength = 1): MemoryState => ({
    id, strength, nextReview: new Date().toISOString(), totalAnswers: 1,
    correctAnswers: 1, independentCorrectAnswers: 1, incorrectAnswers: 0, skippedAnswers: 0,
    updatedAt: new Date().toISOString(),
});

const normalVocabBlock = (profile: UserProfile) => {
    const blockCounts = new Map<string, number>();
    const pendingVocabIds: string[] = [];
    let plusCount = 0;
    return Array.from({ length: 10 }, () => {
        const result = generateSingleVocabProblem({
            profile, vocabDue: [], vocabLevelWeights: buildVocabLevelWeights(profile),
            options: { blockCounts, recentIds: pendingVocabIds.slice(-5), cooldownIds: [], skippedTodayIds: [] },
            canAddReview: false, forceReviewBlock: false, weakVocabPool: [],
            currentWeakCount: 0, plusCount, pendingVocabIds, buildCooldownIds: () => [],
        });
        const isPlusOne = result.newPlusCount > plusCount;
        plusCount = result.newPlusCount;
        markPicked(result.problem.categoryId, blockCounts);
        pendingVocabIds.push(result.problem.categoryId);
        return { ...result, isPlusOne };
    });
};

const resolveVocabProgression = (profile: UserProfile) => resolveProfileProgressionAfterAttempt({
    currentProfile: profile, subject: "vocab", nowIso: new Date().toISOString(),
    checkMathUnlock: async () => false, checkMathPromotion: async () => false,
    checkVocabUnlockReadiness, checkVocabPromotion: checkVocabMainPromotion,
});

const weakContext = {
    weakMathIds: [], weakVocabIds: [], maintenanceMathIds: [], mathDue: [], vocabDue: [],
};

describe("learning progression from real generated questions", () => {
    beforeEach(async () => {
        await Promise.all([db.appData.clear(), db.profiles.clear(), db.memoryMath.clear(), db.memoryVocab.clear(), db.logs.clear()]);
    });
    afterEach(() => vi.restoreAllMocks());

    it("keeps locked or disabled vocab levels out of normal blocks, including lower levels", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const profile = createInitialProfile("T", 1, 1, 3, "vocab");
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 2 ? { ...level, enabled: false } : level);
        expect(buildVocabLevelWeights(profile).map(item => item.level)).toEqual([3, 1]);
        profile.vocabMaxUnlocked = 4;
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 4 ? { ...level, unlocked: true, enabled: false } : level);
        expect(buildVocabLevelWeights(profile).map(item => item.level)).toEqual([3, 1]);
        const allowed = new Set(getWordsByLevel(3).map(word => word.id));
        expect(normalVocabBlock(profile).every(item => allowed.has(item.problem.categoryId))).toBe(true);
    });

    it("caps unlocked next-level practice at three while preferring unattempted words", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        profile.vocabMaxUnlocked = 2;
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 2 ? { ...level, unlocked: true, enabled: true } : level);
        const words = getWordsByLevel(2);
        profile.vocabWords[words[0].id] = memory(words[0].id);
        const nextIds = new Set(words.map(word => word.id));
        const next = normalVocabBlock(profile).filter(item => item.isPlusOne);
        expect(next).toHaveLength(3);
        expect(new Set(next.map(item => item.problem.categoryId)).size).toBe(3);
        expect(next.every(item => nextIds.has(item.problem.categoryId))).toBe(true);
        expect(next.every(item => item.problem.categoryId !== words[0].id)).toBe(true);
        expect(next.every(item => !item.isReview && !item.countsTowardReviewCap)).toBe(true);
    });

    it("enables only the newly unlocked vocab level in the atomic merge", async () => {
        const profile = createInitialProfile("T", 1, 1, 2, "vocab");
        profile.vocabLevels = profile.vocabLevels?.map(level => ({ ...level,
            enabled: level.level === 1 ? false : level.enabled,
            recentIndependentAnswersNonReview: level.level === 2 ? Array(20).fill(true) : [],
        }));
        const resolved = await resolveVocabProgression(profile);
        const merged = applyResolvedProgressionToLatestProfile({
            baseProfile: profile, resolvedProfile: resolved, latestProfile: profile, subject: "vocab",
        });
        expect(merged.vocabLevels?.find(level => level.level === 3)).toMatchObject({ unlocked: true, enabled: true });
        expect(merged.vocabLevels?.find(level => level.level === 1)?.enabled).toBe(false);
    });

    it("reaches 70% promotion through generated normal blocks and persisted answers", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        let profile = createInitialProfile("T", 1, 1, 1, "vocab");
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 1
            ? { ...level, recentIndependentAnswersNonReview: Array(20).fill(true) } : level);
        profile = await resolveVocabProgression(profile);
        expect(profile.vocabLevels?.find(level => level.level === 2)?.enabled).toBe(true);
        await saveProfile(profile);
        const targetIds = new Set(getWordsByLevel(2).map(word => word.id));
        const threshold = Math.ceil(getWordsByLevel(2).length * 0.7);
        for (let block = 0; block < Math.ceil(threshold / 3) && profile.vocabMainLevel === 1; block++) {
            const questions = normalVocabBlock(profile);
            expect(questions.filter(item => item.isPlusOne)).toHaveLength(3);
            for (const item of questions) {
                const problem = createLearningProblemContext('vocab', item.problem);
                expect(problem).toBeDefined();
                await logAttempt(profile.id, "vocab", item.problem.categoryId, "correct", false, false, false, 1000, {
                    problem: problem!, completion: 'whole-problem', assistance: 'independent',
                });
                const hydrated = await getProfile(profile.id);
                profile = await resolveVocabProgression(hydrated!);
                await saveProfile(profile);
                const reached = [...targetIds].filter(id => (profile.vocabWords[id]?.independentCorrectAnswers ?? 0) > 0).length;
                expect(profile.vocabMainLevel).toBe(reached >= threshold ? 2 : 1);
                if (profile.vocabMainLevel === 2) break;
            }
        }
        expect(profile.vocabMainLevel).toBe(2);
        expect(profile.pendingLevelUpNotification?.newLevel).toBe(2);
    }, 15000);

    it('keeps unknown vocabulary answers out of the independent unlock window', async () => {
        const profile = createInitialProfile('T', 1, 1, 1, 'vocab');
        profile.vocabLevels = profile.vocabLevels?.map(level => level.level === 1
            ? { ...level, recentAnswersNonReview: Array(20).fill(true) } : level);
        expect(checkVocabUnlockReadiness(profile)).toBe(false);
        await saveProfile(profile);
        for (let index = 0; index < 20; index += 1) {
            await logAttempt(profile.id, 'vocab', 'apple', 'correct');
        }
        const hydrated = (await getProfile(profile.id))!;
        expect(hydrated.vocabWords.apple.correctAnswers).toBe(20);
        expect(hydrated.vocabWords.apple.independentCorrectAnswers ?? 0).toBe(0);
        expect(checkVocabUnlockReadiness(hydrated)).toBe(false);
        expect((await resolveVocabProgression(hydrated)).vocabMaxUnlocked).toBe(1);
    });

    it("holds the old math test range when the persisted 30th answer promotes the main level", async () => {
        const profile = createInitialProfile("T", 1, 7, 1, "math");
        profile.mathMaxUnlocked = 9;
        profile.mathMainLevelStartedAt = new Date(Date.now() - 15 * 86400000).toISOString();
        profile.mathLevels = profile.mathLevels?.map(level => level.level === 9 ? { ...level, unlocked: true, enabled: true } : level);
        await saveProfile(profile);
        const skill = getSkillsForLevel(9)[0];
        const answer = () => logAttempt(profile.id, 'math', skill, 'correct', false, false, false, undefined,
            mathLearningEvidence({ ...generateMathProblem(skill, { profile }), subject: 'math' }, 'independent'));
        for (let i = 0; i < 29; i++) await answer();
        const before = await getProfile(profile.id);
        expect(before?.mathMainLevel).toBe(8);
        await answer();
        const after = (await getProfile(profile.id))!;
        expect(after.mathMainLevel).toBe(9);
        const triggerProfile = resolvePeriodicTestTriggerProfile(before, after, "math");
        const trigger = await checkPeriodTestTrigger(triggerProfile, "math");
        expect(trigger).toEqual({ isTriggered: true, reason: "slow" });
        const testSet = buildPeriodicTestSet(triggerProfile, "math");
        const withPending = applyPendingPeriodicTestTrigger(after, "math", trigger, testSet)!;
        expect(withPending.mathMainLevel).toBe(9);
        expect(withPending.periodicTestSets?.math?.level).toBe(8);
        expect(testSet.problems.every(item => getSkillsForLevel(8).includes(item.categoryId))).toBe(true);
    });

    it("keeps weak review in the test range despite lower-level Due, maintenance, and followups", async () => {
        const profile = createInitialProfile("T", 1, 7, 1, "math");
        profile.recentAttempts = [{ id: "recent", timestamp: new Date().toISOString(), subject: "math", skillId: "add_tiny", result: "correct" }];
        const queue = await generateWeakReviewBlock(profile, {
            ...weakContext, mathDue: [{ id: "count_10" }], maintenanceMathIds: ["count_5"], weakMathIds: ["count_dot"],
        });
        expect(queue).toHaveLength(10);
        expect(queue.every(item => getSkillsForLevel(8).includes(item.categoryId))).toBe(true);
        const counts = getSkillsForLevel(8).map(id => queue.filter(item => item.categoryId === id).length);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });

    it("prioritizes current-level weak vocab then low strength and excludes outside Due", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const profile = createInitialProfile("T", 1, 7, 2, "vocab");
        const words = getWordsByLevel(2).map(word => word.id);
        profile.vocabWords = Object.fromEntries(words.map(id => [id, memory(id, 5)]));
        profile.vocabWords[words[1]].strength = 1;
        const queue = await generateWeakReviewBlock(profile, {
            ...weakContext, weakVocabIds: [words[0], "apple"], vocabDue: [{ id: "apple" }],
        });
        expect(queue).toHaveLength(10);
        expect(queue.slice(0, 2).every(item => item.categoryId === words[0])).toBe(true);
        expect(queue[2].categoryId).toBe(words[1]);
        expect(queue.every(item => words.includes(item.categoryId))).toBe(true);
    });

    it("uses the pending automatic test level after promotion", async () => {
        const profile = createInitialProfile("T", 1, 7, 1, "math");
        const set = buildPeriodicTestSet(profile, "math");
        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.periodicTestSets = { math: set };
        profile.periodicTestState = {
            math: { isPending: true, lastTriggeredAt: null, reason: "slow" },
            vocab: { isPending: false, lastTriggeredAt: null, reason: null },
        };
        const queue = await generateWeakReviewBlock(profile, weakContext);
        expect(queue).toHaveLength(10);
        expect(queue.every(item => getSkillsForLevel(8).includes(item.categoryId))).toBe(true);
    });

    it("honors the actual three-skip day stop even when the remaining level pool is tiny", async () => {
        const profile = createInitialProfile("T", 1, 7, 1, "math");
        await saveProfile(profile);
        const skills = getSkillsForLevel(8);
        const reserved = await generateWeakReviewBlock(profile, { ...weakContext, skippedMathIds: [skills[1]] });
        expect(reserved).toHaveLength(10);
        for (let i = 0; i < 3; i++) await logAttempt(profile.id, "math", skills[0], "incorrect", true, true);
        const skippedMathIds = await getSkippedItemsToday(profile.id, "math");
        expect(skippedMathIds).toContain(skills[0]);
        const remaining = removeStoppedPendingQuestions(reserved, reserved[2], skippedMathIds);
        expect(remaining).toEqual(reserved.slice(0, 3));
        const queue = await generateWeakReviewBlock(profile, { ...weakContext, weakMathIds: skills, skippedMathIds });
        expect(queue).toHaveLength(10);
        expect(queue.every(item => item.categoryId === skills[1])).toBe(true);
        expect(await generateWeakReviewBlock(profile, { ...weakContext, skippedMathIds: skills })).toEqual([]);
    });

    it("rejects failed generators instead of claiming the review is finished for today", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const generator = vi.spyOn(await import("../domain/math"), "generateMathProblem")
            .mockImplementation(() => { throw new Error("generator unavailable"); });
        const profile = createInitialProfile("T", 1, 7, 1, "math");
        await expect(generateWeakReviewBlock(profile, weakContext))
            .rejects.toThrow("Unable to generate weak review for math level 8");
        expect(generator).toHaveBeenCalledTimes(getSkillsForLevel(8).length);
    });

    it("rejects a partially generated mixed review when the remaining subject fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(await import("../domain/english/generator"), "generateVocabProblem")
            .mockImplementation(() => { throw new Error("vocab generator unavailable"); });
        const profile = createInitialProfile("T", 1, 7, 1, "mix");
        await expect(generateWeakReviewBlock(profile, weakContext))
            .rejects.toThrow("Unable to generate weak review for vocab level 1");
    });
});
