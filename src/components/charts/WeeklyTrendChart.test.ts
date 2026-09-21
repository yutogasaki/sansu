import { describe, expect, it } from "vitest";
import { getWeeklyTrendChartA11y, getWeeklyTrendChartData } from "./statsChartAccessibility";

const points = [
    { label: "月", count: 0, correct: 0, accuracy: 0 },
    { label: "火", count: 2, correct: 0, accuracy: 0 },
];

describe("WeeklyTrendChart", () => {
    it("leaves unanswered accuracy unmeasured and creates a line gap", () => {
        expect(getWeeklyTrendChartData(points, "accuracy").map(point => point.accuracy))
            .toEqual([null, 0]);
    });

    it("keeps zero-answer counts and distinguishes them in the accessible description", () => {
        expect(getWeeklyTrendChartData(points, "count").map(point => point.count))
            .toEqual([0, 2]);
        expect(getWeeklyTrendChartA11y(points, "accuracy").desc)
            .toContain("月曜日: 学習なし、正答率は未計測");
        expect(getWeeklyTrendChartA11y(points, "accuracy").desc)
            .toContain("火曜日: 0%（0/2問）");
    });
});
