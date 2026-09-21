import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SkillRadarChart } from "./SkillRadarChart";
import {
    getSkillRadarChartA11y,
    getSkillRadarTooltipText,
    getUnpracticedSkillCategories,
} from "./statsChartAccessibility";
import {
    getSkillRadarMarkerPoints,
    getSkillRadarSegmentPath,
    getSkillRadarShapeSegments,
} from "./skillRadarGeometry";

const categories = [
    { category: "たす", value: 0, skillCount: 1, totalSkills: 3 },
    { category: "ひく", value: 0, skillCount: 0, totalSkills: 2 },
];

describe("SkillRadarChart", () => {
    it("distinguishes no practice from a recorded zero-percent result", () => {
        expect(getSkillRadarTooltipText(categories[0]!)).toContain("0%（記録あり 1/3スキル）");
        expect(getSkillRadarTooltipText(categories[1]!)).toContain("まだ練習記録がないよ（0/2スキル）");

        const description = getSkillRadarChartA11y(categories).desc;
        expect(description).toContain("たす: 0%、1/3スキルに練習記録あり");
        expect(description).toContain("ひく: まだ練習記録がありません");
        expect(getUnpracticedSkillCategories(categories)).toEqual(["ひく"]);
    });

    it("renders unpracticed categories as whole, labeled chips", () => {
        const markup = renderToStaticMarkup(createElement(SkillRadarChart, { data: categories }));

        expect(markup).toContain('aria-labelledby="skill-radar-unpracticed-label"');
        expect(markup).toContain("まだ練習記録がないカテゴリ");
        expect(markup).toContain("whitespace-nowrap");
        expect(markup).toContain(">ひく</span>");
    });

    it.each(["first", "last"] as const)("leaves a gap when the unpracticed category is %s", missingEdge => {
        const zeroPercent = { x: 50, y: 50, payload: { skillCount: 1, value: 0 } };
        const practiced = { x: 75, y: 50, payload: { skillCount: 2, value: 75 } };
        const missing = { x: 50, y: 5, payload: { skillCount: 0, value: 0 } };
        const points = missingEdge === "first"
            ? [missing, zeroPercent, practiced]
            : [zeroPercent, practiced, missing];
        const segments = getSkillRadarShapeSegments(points);

        expect(segments).toHaveLength(1);
        expect(segments[0]).toEqual({ points: [zeroPercent, practiced], closed: false });
        expect(segments[0]?.points).not.toContain(missing);
        expect(segments[0]?.points[0]).toBe(zeroPercent);
        expect(getSkillRadarSegmentPath(segments[0]!)).toBe("M50,50L75,50");
        expect(getSkillRadarMarkerPoints(points, segments)).toEqual([zeroPercent, practiced]);
    });

    it("keeps a complete radar closed and preserves a recorded zero-percent point", () => {
        const points = [
            { x: 50, y: 50, payload: { skillCount: 1, value: 0 } },
            { x: 75, y: 50, payload: { skillCount: 1, value: 65 } },
            { x: 50, y: 5, payload: { skillCount: 1, value: 35 } },
        ];
        const segments = getSkillRadarShapeSegments(points);
        expect(segments).toEqual([{ points, closed: true }]);
        expect(getSkillRadarSegmentPath(segments[0]!)).toBe("M50,50L75,50L50,5Z");
        expect(getSkillRadarMarkerPoints(points, segments)).toEqual([points[0]]);
    });

    it("splits measured categories into separate open runs around missing categories", () => {
        const points = [
            { x: 10, y: 10, payload: { skillCount: 1, value: 20 } },
            { x: 20, y: 20, payload: { skillCount: 0, value: 0 } },
            { x: 30, y: 30, payload: { skillCount: 1, value: 40 } },
            { x: 40, y: 40, payload: { skillCount: 0, value: 0 } },
        ];

        expect(getSkillRadarShapeSegments(points)).toEqual([
            { points: [points[2]], closed: false },
            { points: [points[0]], closed: false },
        ]);
    });

    it("does not produce a radar segment when no categories have practice", () => {
        const points = [
            { x: 10, y: 10, payload: { skillCount: 0, value: 0 } },
            { x: 20, y: 20, payload: { skillCount: 0, value: 0 } },
        ];

        expect(getSkillRadarShapeSegments(points)).toEqual([]);
    });
});
