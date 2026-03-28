import { describe, expect, it } from "vitest";
import { generators } from "./addition";

describe("addition generators", () => {
    it("add_1d_1_bridge starts from 1 + 1 with visual support", () => {
        const problem = generators.add_1d_1_bridge({
            profile: { mathSkills: { add_1d_1_bridge: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("1 + 1 =");
        expect(problem.correctAnswer).toBe("2");
        expect(problem.questionVisual?.kind).toBe("addition-items");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[0]?.count).toBe(1);
            expect(problem.questionVisual.groups[1]?.count).toBe(1);
        }
    });

    it("add_1d_1 starts from 1 + 1 as a numeric expression", () => {
        const problem = generators.add_1d_1({
            profile: { mathSkills: { add_1d_1: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("1 + 1 =");
        expect(problem.correctAnswer).toBe("2");
        expect(problem.questionVisual).toBeUndefined();
    });

    it("add_1d_2_bridge keeps the make-ten progression with visual support", () => {
        const problem = generators.add_1d_2_bridge({
            profile: { mathSkills: { add_1d_2_bridge: { totalAnswers: 12 } } },
        } as any);

        expect(problem.questionText).toBe("1 + 9 =");
        expect(problem.correctAnswer).toBe("10");
        expect(problem.questionVisual?.kind).toBe("addition-items");
        if (problem.questionVisual?.kind === "addition-items") {
            expect(problem.questionVisual.groups[0]?.count).toBe(1);
            expect(problem.questionVisual.groups[1]?.count).toBe(9);
        }
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
