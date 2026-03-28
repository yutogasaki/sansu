import { describe, expect, it } from "vitest";
import { MATH_CURRICULUM } from "../../domain/math/curriculum";
import { MATH_SKILL_LABELS } from "../../domain/math/labels";
import { getDevStudyAdjacentSelection, getDevStudyFlatItems } from "./devStudySelection";

describe("devStudySelection", () => {
    it("flattens math skills into a level-position list", () => {
        const items = getDevStudyFlatItems("math");
        const firstSkillId = MATH_CURRICULUM[0]?.[0] || "";
        const levelOneFirstSkillId = MATH_CURRICULUM[1]?.[0] || "";

        expect(items[0]).toMatchObject({
            id: firstSkillId,
            level: 0,
            position: 1,
            levelPositionLabel: "Lv.0-1",
            optionLabel: `Lv.0-1 ${MATH_SKILL_LABELS[firstSkillId]}`,
        });

        expect(items.find(item => item.id === levelOneFirstSkillId)?.levelPositionLabel).toBe("Lv.1-1");
    });

    it("moves to adjacent math skills using the flattened order", () => {
        const secondSkillId = MATH_CURRICULUM[0]?.[1] || "";

        expect(getDevStudyAdjacentSelection("math", secondSkillId, "prev-item")).toEqual({
            subject: "math",
            id: MATH_CURRICULUM[0]?.[0],
        });
        expect(getDevStudyAdjacentSelection("math", secondSkillId, "next-item")).toEqual({
            subject: "math",
            id: MATH_CURRICULUM[0]?.[2],
        });
    });
});
