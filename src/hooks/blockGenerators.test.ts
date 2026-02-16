import { describe, expect, it, vi } from "vitest";
import {
    buildVocabCooldownIds,
    calculateRecentReviewRatio,
    canAddSessionReview,
    getMixSubject,
    pickId,
    type GeneratorOptions,
} from "./blockGenerators";

describe("blockGenerators utilities", () => {
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
});

