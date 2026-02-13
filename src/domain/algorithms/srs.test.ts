import { differenceInCalendarDays } from "date-fns";
import { getLearningDayStart } from "../../utils/learningDay";
import { getNextReviewDate, updateMemoryState, wilsonLower } from "./srs";
import { MemoryState } from "../types";

describe("srs", () => {
    it("calculates next review date from learning day boundary", () => {
        const start = getLearningDayStart();
        const next = getNextReviewDate(1);
        expect(differenceInCalendarDays(next, start)).toBe(1);
    });

    it("correct answer increases strength by 1", () => {
        const base: MemoryState = {
            id: "test",
            strength: 3,
            nextReview: new Date().toISOString(),
            totalAnswers: 10,
            correctAnswers: 7,
            incorrectAnswers: 3,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, true, false);
        expect(result.strength).toBe(4);
    });

    it("correct answer caps strength at 5", () => {
        const base: MemoryState = {
            id: "test",
            strength: 5,
            nextReview: new Date().toISOString(),
            totalAnswers: 50,
            correctAnswers: 45,
            incorrectAnswers: 5,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, true, false);
        expect(result.strength).toBe(5);
    });

    it("incorrect answer decreases strength by 1 (gentle penalty)", () => {
        const base: MemoryState = {
            id: "test",
            strength: 5,
            nextReview: new Date().toISOString(),
            totalAnswers: 50,
            correctAnswers: 45,
            incorrectAnswers: 5,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, false, false);
        expect(result.strength).toBe(4); // 5 - 1 = 4
    });

    it("incorrect answer floors strength at 1", () => {
        const base: MemoryState = {
            id: "test",
            strength: 1,
            nextReview: new Date().toISOString(),
            totalAnswers: 5,
            correctAnswers: 2,
            incorrectAnswers: 3,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, false, false);
        expect(result.strength).toBe(1); // max(1, 1-1) = 1
    });

    it("incorrect from strength 2 decreases to 1", () => {
        const base: MemoryState = {
            id: "test",
            strength: 2,
            nextReview: new Date().toISOString(),
            totalAnswers: 10,
            correctAnswers: 7,
            incorrectAnswers: 3,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, false, false);
        expect(result.strength).toBe(1); // 2 - 1 = 1
    });

    it("incorrect from strength 3 decreases to 2", () => {
        const base: MemoryState = {
            id: "test",
            strength: 3,
            nextReview: new Date().toISOString(),
            totalAnswers: 15,
            correctAnswers: 10,
            incorrectAnswers: 5,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, false, false);
        expect(result.strength).toBe(2); // 3 - 1 = 2
    });

    it("skip preserves strength but sets nextReview to today", () => {
        const base: MemoryState = {
            id: "test",
            strength: 4,
            nextReview: new Date().toISOString(),
            totalAnswers: 20,
            correctAnswers: 16,
            incorrectAnswers: 4,
            skippedAnswers: 0,
            updatedAt: new Date().toISOString()
        };

        const result = updateMemoryState(base, false, true);
        expect(result.strength).toBe(4); // strength preserved
        expect(result.skippedAnswers).toBe(1);
        // nextReview should be today (learning day start)
        expect(result.nextReview).toBe(getLearningDayStart().toISOString());
    });
});

describe("wilsonLower", () => {
    it("returns 0 for 0 total", () => {
        expect(wilsonLower(0, 0)).toBe(0);
    });

    it("returns lower bound for small sample (conservative)", () => {
        // 3/5 = 60% raw, but Wilson lower should be well below 60%
        const score = wilsonLower(3, 5);
        expect(score).toBeLessThan(0.6);
        expect(score).toBeGreaterThan(0.1);
    });

    it("returns higher lower bound for large sample", () => {
        // 6/10 = 60% raw, larger sample → closer to raw rate
        const small = wilsonLower(3, 5);
        const large = wilsonLower(6, 10);
        expect(large).toBeGreaterThan(small);
    });

    it("approaches raw rate with very large sample", () => {
        // 600/1000 = 60%, Wilson lower should be close to 0.6
        const score = wilsonLower(600, 1000);
        expect(score).toBeGreaterThan(0.57);
        expect(score).toBeLessThan(0.6);
    });

    it("perfect score gives high lower bound", () => {
        const score = wilsonLower(10, 10);
        expect(score).toBeGreaterThan(0.9);
    });

    it("zero correct gives low lower bound", () => {
        const score = wilsonLower(0, 10);
        expect(score).toBeLessThan(0.05);
    });
});
