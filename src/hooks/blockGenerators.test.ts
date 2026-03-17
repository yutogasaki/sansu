import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialProfile } from "../domain/user/profile";
import {
    buildVocabCooldownIds,
    calculateRecentReviewRatio,
    canAddSessionReview,
    generateLevelBlock,
    generateSingleMathProblem,
    generateSingleVocabProblem,
    getMixSubject,
    pickId,
    type GeneratorOptions,
} from "./blockGenerators";

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
        const profile = createInitialProfile("T", 1, 1, 1, "math");
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
        expect(result.problem.categoryId).toBe("count_10");
    });

    it("generateSingleMathProblem prioritizes maintenance checks when the rate fires", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const profile = createInitialProfile("T", 1, 1, 1, "math");
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
            canAddReview: false,
            currentWeakCount: 0,
            plusCount: 0,
            plusLimit: 0,
        });

        expect(result.isReview).toBe(false);
        expect(result.isMaintenanceCheck).toBe(true);
        expect(result.problem.categoryId).toBe("count_10");
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
            pendingVocabIds: [],
            buildCooldownIds: () => [],
        });

        expect(result.isReview).toBe(true);
        expect(result.problem.categoryId).toBe("apple");
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
});
