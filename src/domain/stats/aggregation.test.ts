import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import type { AttemptLog } from "../../db";
import { buildWeeklyTrend } from "./aggregation";

const createLog = (timestamp: string, result: AttemptLog["result"]): AttemptLog => ({
    profileId: "p1",
    subject: "math",
    itemId: "add_1d_1",
    result,
    timestamp,
});

describe("buildWeeklyTrend", () => {
    it("assigns 00:00-03:59 logs to the previous learning day", () => {
        const todayStart = new Date(2026, 1, 2, 4, 0, 0, 0);
        const earlyMorning = new Date(2026, 1, 2, 2, 30, 0, 0).toISOString();
        const daytime = new Date(2026, 1, 2, 8, 0, 0, 0).toISOString();

        const trend = buildWeeklyTrend(
            [createLog(earlyMorning, "incorrect"), createLog(daytime, "correct")],
            todayStart,
            addDays
        );

        expect(trend).toHaveLength(7);
        expect(trend[5]?.count).toBe(1);
        expect(trend[5]?.correct).toBe(0);
        expect(trend[6]?.count).toBe(1);
        expect(trend[6]?.correct).toBe(1);
    });
});
