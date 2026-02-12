import { differenceInCalendarDays } from "date-fns";
import { getLearningDayStart } from "../../utils/learningDay";
import { getNextReviewDate, updateMemoryState } from "./srs";
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

    it("incorrect answer decreases strength by 2 (gradual decline)", () => {
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
        expect(result.strength).toBe(3); // 5 - 2 = 3
    });

    it("incorrect answer floors strength at 1", () => {
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
        expect(result.strength).toBe(1); // max(1, 2-2) = 1
    });

    it("incorrect from strength 1 stays at 1", () => {
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
        expect(result.strength).toBe(1);
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
