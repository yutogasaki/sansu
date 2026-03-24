import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";
import type { AttemptLog } from "../../db";
import type { MemoryState } from "../types";
import { buildRadarData, buildWeeklyTrend } from "./aggregation";

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

describe("buildRadarData", () => {
    it("includes level 0 skills in radar aggregation", () => {
        const mathMemory: MemoryState[] = [
            {
                id: "count_5",
                strength: 1,
                nextReview: "2026-03-25",
                totalAnswers: 4,
                correctAnswers: 3,
                incorrectAnswers: 1,
                skippedAnswers: 0,
                updatedAt: "2026-03-24T00:00:00.000Z",
                status: "active",
            },
        ];

        const radar = buildRadarData(mathMemory, 0);
        const counting = radar.find(point => point.category === "かぞえ");

        expect(counting?.skillCount).toBe(1);
        expect(counting?.value).toBe(75);
        expect(counting?.totalSkills).toBeGreaterThan(0);
    });
});
