import { getLearningDayStart, getLearningDayEnd, LEARNING_DAY_START_HOUR, toLocaleDateKey } from "./learningDay";

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

describe("toLocaleDateKey", () => {
    it("returns local date string in YYYY-MM-DD format", () => {
        const date = new Date(2026, 0, 5, 23, 59, 59); // Jan 5, 23:59 local
        expect(toLocaleDateKey(date)).toBe("2026-01-05");
    });

    it("uses local timezone, not UTC", () => {
        // ローカル午前1時 → UTCでは前日の可能性がある
        const earlyMorning = new Date(2026, 2, 15, 1, 0, 0); // Mar 15, 01:00 local
        expect(toLocaleDateKey(earlyMorning)).toBe("2026-03-15");
    });

    it("pads single-digit month and day", () => {
        const date = new Date(2026, 0, 1, 12, 0, 0); // Jan 1
        expect(toLocaleDateKey(date)).toBe("2026-01-01");
    });
});
