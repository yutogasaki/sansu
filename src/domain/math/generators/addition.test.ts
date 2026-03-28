import { describe, expect, it } from "vitest";
import { generators } from "./addition";

describe("addition generators", () => {
    it("add_1d_1 starts from 1 + 1 as a numeric expression", () => {
        const problem = generators.add_1d_1({
            profile: { mathSkills: { add_1d_1: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("1 + 1 =");
        expect(problem.correctAnswer).toBe("2");
        expect(problem.questionVisual).toBeUndefined();
    });

    it("add_1d_2 keeps the make-ten progression as a numeric expression", () => {
        const problem = generators.add_1d_2({
            profile: { mathSkills: { add_1d_2: { totalAnswers: 12 } } },
        } as any);

        expect(problem.questionText).toBe("1 + 9 =");
        expect(problem.correctAnswer).toBe("10");
        expect(problem.questionVisual).toBeUndefined();
    });
});
