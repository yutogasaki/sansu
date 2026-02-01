import { getLearningDayStart, getLearningDayEnd, LEARNING_DAY_START_HOUR } from "./learningDay";

describe("learningDay", () => {
    it("uses previous day when time is before boundary", () => {
        const before = new Date(2026, 1, 1, 3, 0, 0); // Feb 1, 03:00 local
        const start = getLearningDayStart(before);
        expect(start.getHours()).toBe(LEARNING_DAY_START_HOUR);
        expect(start.getMinutes()).toBe(0);
        expect(start.getDate()).toBe(31);
    });

    it("uses same day when time is after boundary", () => {
        const after = new Date(2026, 1, 1, 5, 0, 0); // Feb 1, 05:00 local
        const start = getLearningDayStart(after);
        const end = getLearningDayEnd(after);
        expect(start.getHours()).toBe(LEARNING_DAY_START_HOUR);
        expect(end.getHours()).toBe(LEARNING_DAY_START_HOUR);
        expect(end.getDate()).toBe(2);
    });
});
