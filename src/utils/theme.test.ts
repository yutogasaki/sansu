import { describe, expect, it } from "vitest";
import { getMsUntilNextThemeCheck, getThemeForHour } from "./theme";

describe("getThemeForHour", () => {
    it("returns evening during evening and night hours", () => {
        expect(getThemeForHour(18)).toBe("evening");
        expect(getThemeForHour(2)).toBe("evening");
    });

    it("returns day during daytime hours", () => {
        expect(getThemeForHour(10)).toBe("day");
        expect(getThemeForHour(17)).toBe("day");
    });

    it("returns null during morning hours", () => {
        expect(getThemeForHour(4)).toBeNull();
        expect(getThemeForHour(9)).toBeNull();
    });
});

describe("getMsUntilNextThemeCheck", () => {
    it("returns the remaining time until the next hour", () => {
        const date = new Date("2026-03-16T10:15:30.000Z");
        expect(getMsUntilNextThemeCheck(date)).toBe(2_670_000);
    });
});
