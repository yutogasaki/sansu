import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../domain/user/profile";
import {
    buildMathCooldownIds,
    buildVocabCooldownIds,
    calculateRecentReviewRatio,
    canAddSessionReview,
    generateLevelBlock,
    generateSingleMathProblem,
    generateSingleVocabProblem,
    generateWeakReviewBlock,
    getMixSubject,
    pickId,
    pickLeastUsedMathSkillId,
    pickMathSkillId,
    pickOrderedId,
    shouldForceVocabReviewBlock,
    type GeneratorOptions,
} from "./blockGenerators";
import { getMathSkillFamily } from "../domain/math/curriculum";

describe("blockGenerators utilities", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("canAddSessionReview respects session review cap", () => {
        const sessionHistory = [
            { id: "a", subject: "math" as const, isReview: true },
            { id: "b", subject: "vocab" as const, isReview: true },
            { id: "c", subject: "math" as const, isReview: false },
        ];
        const pending = [
            { isReview: true },
            { isReview: false },
        ];
        expect(canAddSessionReview(sessionHistory, pending)).toBe(false);
    });

    it("canAddSessionReview uses the configured sliding window and counts weak-like items", () => {
        const oldNormal = Array.from({ length: 20 }, (_, index) => ({
            id: `old-${index}`,
            subject: "math" as const,
            isReview: false,
        }));
        const recent = Array.from({ length: 9 }, (_, index) => ({
            id: `recent-${index}`,
            subject: "math" as const,
            isReview: false,
            countsTowardReviewCap: index >= 1 && index <= 5,
        }));

        expect(canAddSessionReview([...oldNormal, ...recent], [], 10)).toBe(true);
        expect(canAddSessionReview(
            [...oldNormal, ...recent],
            [{ isReview: false, countsTowardReviewCap: true }],
            10,
        )).toBe(false);
    });

    it("calculateRecentReviewRatio returns 0 for empty input", () => {
        expect(calculateRecentReviewRatio([])).toBe(0);
    });

    it("buildVocabCooldownIds deduplicates and excludes skipped attempts", () => {
        const recent = [
            { subject: "vocab" as const, itemId: "apple", result: "correct" },
            { subject: "vocab" as const, itemId: "apple", result: "incorrect" },
            { subject: "vocab" as const, itemId: "cat", result: "skipped" },
            { subject: "math" as const, itemId: "m1", result: "correct" },
        ];
        const history = [
            { id: "banana", subject: "vocab" as const, isReview: false },
            { id: "apple", subject: "vocab" as const, isReview: false },
        ];
        const ids = buildVocabCooldownIds(recent, history, ["orange"]);
        expect(ids).toEqual(["apple", "banana", "orange"]);
    });

    it("buildMathCooldownIds restores only math IDs from the shared five-question window", () => {
        const recent = [
            { subject: "math" as const, itemId: "count_10" },
            { subject: "vocab" as const, itemId: "apple" },
            { subject: "math" as const, itemId: "count_10" },
            { subject: "math" as const, itemId: "count_read" },
            { subject: "vocab" as const, itemId: "orange" },
            { subject: "math" as const, itemId: "outside-window" },
        ];

        expect(buildMathCooldownIds(recent)).toEqual(["count_10", "count_read"]);
        expect(buildMathCooldownIds(recent, 2)).toEqual(["count_10"]);
        expect(buildMathCooldownIds(recent, 5)).toEqual([]);
    });

    it("pickId avoids skipped and overused ids", () => {
        const options: GeneratorOptions = {
            cooldownIds: [],
            skippedTodayIds: ["s1"],
            blockCounts: new Map([["a1", 2]]),
            recentIds: [],
        };
        const selected = pickId(["s1", "a1", "ok"], options);
        expect(selected).toBe("ok");
    });

    it("pickId prefers targets outside the vocab cooldown", () => {
        const options: GeneratorOptions = {
            cooldownIds: ["recent"],
            skippedTodayIds: [],
            blockCounts: new Map(),
            recentIds: [],
        };

        expect(pickId(["recent", "fresh"], options)).toBe("fresh");
    });

    it("pickMathSkillId prefers a different family when available", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const options: GeneratorOptions = {
            cooldownIds: [],
            skippedTodayIds: [],
            blockCounts: new Map(),
            recentIds: ["count_5"],
        };

        const selected = pickMathSkillId(["count_dot", "count_read"], options);
        expect(selected).toBe("count_read");
    });

    it("pickMathSkillId honors cooldown restored from an earlier session", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const options: GeneratorOptions = {
            cooldownIds: ["count_dot"],
            skippedTodayIds: [],
            blockCounts: new Map(),
            recentIds: [],
        };

        expect(pickMathSkillId(["count_dot", "count_read"], options)).toBe("count_read");
    });

    it("pickLeastUsedMathSkillId gives cooldown precedence over family spreading", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const options: GeneratorOptions = {
            cooldownIds: ["count_read"],
            skippedTodayIds: [],
            blockCounts: new Map([
                ["count_dot", 2],
                ["count_read", 2],
            ]),
            recentIds: ["count_5"],
        };

        expect(pickLeastUsedMathSkillId(
            ["count_dot", "count_read"],
            options,
        )).toBe("count_dot");
    });

    it("pickOrderedId preserves priority after skip, cooldown, and block-cap guards", () => {
        const options: GeneratorOptions = {
            cooldownIds: ["cooling"],
            skippedTodayIds: ["skipped"],
            blockCounts: new Map([["capped", 2]]),
            recentIds: [],
        };

        expect(pickOrderedId(
            ["skipped", "cooling", "capped", "highest-eligible", "later"],
            options,
        )).toBe("highest-eligible");
    });

    it("getMixSubject balances toward underrepresented subject", () => {
        const recent = Array.from({ length: 10 }, (_, i) => ({
            subject: i < 8 ? ("math" as const) : ("vocab" as const),
            isReview: false,
        }));
        expect(getMixSubject(recent)).toBe("vocab");
    });

    it("getMixSubject uses random when history is insufficient", () => {
        const spy = vi.spyOn(Math, "random").mockReturnValue(0.9);
        const recent = [
            { subject: "math" as const, isReview: false },
            { subject: "vocab" as const, isReview: false },
        ];
        expect(getMixSubject(recent)).toBe("math");
        spy.mockRestore();
    });

    it("generateSingleMathProblem prioritizes due review items", () => {
        const profile = createInitialProfile("T", 1, 2, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [{ id: "count_10" }],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(true);
        expect(result.isMaintenanceCheck).toBe(false);
        expect(result.source).toBe("due");
        expect(result.problem.categoryId).toBe("count_10");
    });

    it("generateSingleMathProblem preserves overdue order ahead of family spreading", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 1, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [{ id: "count_dot" }, { id: "count_read" }],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: ["count_5"],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(true);
        expect(result.problem.categoryId).toBe("count_dot");
    });

    it("generateSingleMathProblem advances to the next Due item while the first is cooling down", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [{ id: "count_dot" }, { id: "count_read" }],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: ["count_dot"],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(true);
        expect(result.problem.categoryId).toBe("count_read");
    });

    it("generateSingleMathProblem prioritizes maintenance checks when the rate fires", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 2, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: ["count_10"],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.isMaintenanceCheck).toBe(true);
        expect(result.countsTowardReviewCap).toBe(true);
        expect(result.source).toBe("maintenance");
        expect(result.problem.categoryId).toBe("count_10");
    });

    it("generateSingleMathProblem maintenance path softly avoids repeating the last math family", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 1, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: ["count_dot", "count_read"],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: ["count_5"],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isMaintenanceCheck).toBe(true);
        expect(result.problem.categoryId).toBe("count_read");
    });

    it("generateSingleMathProblem weak path softly avoids repeating the last math family", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 1, 1, "math");
        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: ["count_dot", "count_read"],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: ["count_5"],
            },
            canAddReview: true,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.countsTowardReviewCap).toBe(true);
        expect(result.source).toBe("weak");
        expect(result.problem.categoryId).toBe("count_read");
    });

    it("generateSingleMathProblem uses bridge follow-up after a symbolic miss", () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 9;
        profile.mathMaxUnlocked = 9;
        profile.recentAttempts = [
            {
                id: "attempt-symbol-miss",
                timestamp: new Date(2026, 2, 28, 10, 0, 0).toISOString(),
                subject: "math",
                skillId: "add_1d_2",
                result: "incorrect",
            },
        ];

        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: false,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.source).toBe("followup");
        expect(result.problem.categoryId).toBe("add_1d_2_bridge");
    });

    it("generateSingleMathProblem uses bridge follow-up after a concrete success", () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 8;
        profile.mathMaxUnlocked = 8;
        profile.recentAttempts = [
            {
                id: "attempt-concrete-success",
                timestamp: new Date(2026, 2, 28, 10, 5, 0).toISOString(),
                subject: "math",
                skillId: "add_tiny",
                result: "correct",
            },
        ];

        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: false,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.problem.categoryId).toBe("add_1d_1_bridge");
    });

    it("generateSingleMathProblem uses mental follow-up after a base-ten bridge success", () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 11;
        profile.mathMaxUnlocked = 11;
        profile.recentAttempts = [
            {
                id: "attempt-bridge-success-2d",
                timestamp: new Date(2026, 2, 28, 10, 8, 0).toISOString(),
                subject: "math",
                skillId: "add_2d1d_nc_bridge",
                result: "correct",
            },
        ];

        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: false,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.problem.categoryId).toBe("add_2d1d_mental_nc");
    });

    it("generateSingleMathProblem uses hissan follow-up after a mental success", () => {
        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 11;
        profile.mathMaxUnlocked = 11;
        profile.recentAttempts = [
            {
                id: "attempt-mental-success-2d",
                timestamp: new Date(2026, 2, 28, 10, 9, 0).toISOString(),
                subject: "math",
                skillId: "add_2d1d_mental_nc",
                result: "correct",
            },
        ];

        const result = generateSingleMathProblem({
            profile,
            mathDue: [],
            weakMathPool: [],
            maintenanceMathIds: [],
            retiredMathIds: [],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: false,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.problem.categoryId).toBe("add_2d1d_hissan_nc");
    });

    it("generateSingleVocabProblem prioritizes forced review blocks", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        const result = generateSingleVocabProblem({
            profile,
            vocabDue: [{ id: "apple" }],
            vocabLevelWeights: [{ level: 1, weight: 1 }],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            forceReviewBlock: true,
            weakVocabPool: [],
            currentWeakCount: 0,
            pendingVocabIds: [],
            buildCooldownIds: () => [],
        });

        expect(result.isReview).toBe(true);
        expect(result.problem.categoryId).toBe("apple");
        expect(result.countsTowardReviewCap).toBe(true);
    });

    it("generateSingleVocabProblem preserves Due order and advances past cooldown", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        const generate = (cooldownIds: string[]) => generateSingleVocabProblem({
            profile,
            vocabDue: [{ id: "apple" }, { id: "orange" }],
            vocabLevelWeights: [{ level: 1, weight: 1 }],
            options: {
                cooldownIds,
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            forceReviewBlock: true,
            weakVocabPool: [],
            currentWeakCount: 0,
            pendingVocabIds: [],
            buildCooldownIds: () => cooldownIds,
        });

        vi.spyOn(Math, "random").mockReturnValue(0.99);
        expect(generate([]).problem.categoryId).toBe("apple");
        expect(generate(["apple"]).problem.categoryId).toBe("orange");
    });

    it("generateSingleVocabProblem injects weak vocab within the remediation cap", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const profile = createInitialProfile("T", 1, 1, 1, "vocab");
        const result = generateSingleVocabProblem({
            profile,
            vocabDue: [],
            vocabLevelWeights: [{ level: 1, weight: 1 }],
            options: {
                cooldownIds: [],
                skippedTodayIds: [],
                blockCounts: new Map(),
                recentIds: [],
            },
            canAddReview: true,
            forceReviewBlock: false,
            weakVocabPool: ["apple"],
            currentWeakCount: 0,
            pendingVocabIds: [],
            buildCooldownIds: () => [],
        });

        expect(result.problem.categoryId).toBe("apple");
        expect(result.isReview).toBe(false);
        expect(result.countsTowardReviewCap).toBe(true);
    });

    it("forces vocab Due review in vocab-only and mix modes", () => {
        const recent = Array.from({ length: 10 }, () => ({ isReview: false }));
        expect(shouldForceVocabReviewBlock("vocab", 1, recent)).toBe(true);
        expect(shouldForceVocabReviewBlock("mix", 1, recent)).toBe(true);
        expect(shouldForceVocabReviewBlock("math", 1, recent)).toBe(false);
        expect(shouldForceVocabReviewBlock("vocab", 0, recent)).toBe(false);
    });

    it("generateLevelBlock alternates subjects in mix mode", () => {
        const profile = createInitialProfile("T", 1, 1, 1, "mix");
        const queue = generateLevelBlock(profile, 4);

        expect(queue.map(problem => problem.subject)).toEqual([
            "math",
            "vocab",
            "math",
            "vocab",
        ]);
        expect(queue.every(problem => problem.isReview === false)).toBe(true);
    });

    it("generateLevelBlock spreads early math families within a block", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 0;
        profile.mathMaxUnlocked = 0;

        const queue = generateLevelBlock(profile, 2, "math");
        const families = queue.map(problem => getMathSkillFamily(problem.categoryId));

        expect(queue[0]?.categoryId).toBe("count_5");
        expect(queue[1]?.categoryId).toBe("count_read");
        expect(families[0]).not.toBe(families[1]);
    });

    it("generateLevelBlock balances unavoidable repeats across a small level pool", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const profile = createInitialProfile("T", 1, 12, 1, "math");
        profile.mathMainLevel = 12;
        profile.mathMaxUnlocked = 12;

        const queue = generateLevelBlock(profile, 10, "math");
        const counts = new Map<string, number>();
        queue.forEach(problem => counts.set(
            problem.categoryId,
            (counts.get(problem.categoryId) || 0) + 1,
        ));
        const values = [...counts.values()];

        expect(queue).toHaveLength(10);
        expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    });

    it("generateWeakReviewBlock softly spreads math families in review mode", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 0, 1, "math");
        profile.mathMainLevel = 0;
        profile.mathMaxUnlocked = 0;

        const queue = await generateWeakReviewBlock(profile, {
            weakMathIds: [],
            maintenanceMathIds: [],
            mathDue: [{ id: "count_dot" }, { id: "count_read" }],
            vocabDue: [],
        });
        const mathQueue = queue.filter(problem => problem.subject === "math");
        const families = mathQueue.slice(0, 2).map(problem => getMathSkillFamily(problem.categoryId));

        expect(mathQueue[0]?.categoryId).toBe("count_dot");
        expect(mathQueue[1]?.categoryId).toBe("count_read");
        expect(families[0]).not.toBe(families[1]);
        expect(mathQueue[0]?.isReview).toBe(true);
        expect(mathQueue[1]?.isReview).toBe(true);
    });
});
