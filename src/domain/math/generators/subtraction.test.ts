import { describe, expect, it } from "vitest";
import { generators } from "./subtraction";

describe("subtraction generators visuals", () => {
    it("sub_1d1d_nc starts from subtracting 1 with a subtraction visual", () => {
        const problem = generators.sub_1d1d_nc({
            profile: { mathSkills: { sub_1d1d_nc: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.correctAnswer).toBe("1");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.count).toBe(2);
            expect(problem.questionVisual.group.crossedOutCount).toBe(1);
        }
    });

    it("sub_1d1d_c starts from the smallest cross-ten case with a subtraction visual", () => {
        const problem = generators.sub_1d1d_c({
            profile: { mathSkills: { sub_1d1d_c: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        expect(problem.correctAnswer).toBe("9");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.count).toBe(11);
            expect(problem.questionVisual.group.crossedOutCount).toBe(2);
        }
    });
});
