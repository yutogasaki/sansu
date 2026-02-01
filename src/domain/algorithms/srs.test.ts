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

    it("updates strength correctly", () => {
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

        const correct = updateMemoryState(base, true, false);
        expect(correct.strength).toBe(4);

        const incorrect = updateMemoryState(base, false, false);
        expect(incorrect.strength).toBe(1);

        const skipped = updateMemoryState(base, false, true);
        expect(skipped.strength).toBe(1);
        expect(skipped.skippedAnswers).toBe(1);
    });
});
