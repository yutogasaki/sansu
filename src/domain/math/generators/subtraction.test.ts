import { describe, expect, it } from "vitest";
import { generators } from "./subtraction";

describe("subtraction generators", () => {
    it("sub_1d1d_nc starts from subtracting 1 as a numeric expression", () => {
        const problem = generators.sub_1d1d_nc({
            profile: { mathSkills: { sub_1d1d_nc: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("2 - 1 =");
        expect(problem.correctAnswer).toBe("1");
        expect(problem.questionVisual).toBeUndefined();
    });

    it("sub_1d1d_c starts from the smallest cross-ten case as a numeric expression", () => {
        const problem = generators.sub_1d1d_c({
            profile: { mathSkills: { sub_1d1d_c: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("11 - 2 =");
        expect(problem.correctAnswer).toBe("9");
        expect(problem.questionVisual).toBeUndefined();
    });
});
