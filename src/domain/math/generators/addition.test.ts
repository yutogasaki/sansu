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

    it("add_2d1d_nc_bridge shows a base-10 visual without carry", () => {
        const problem = generators.add_2d1d_nc_bridge({} as any);

        expect(problem.questionVisual?.kind).toBe("operation-base10");
        if (problem.questionVisual?.kind === "operation-base10") {
            expect(problem.questionVisual.operator).toBe("+");
            expect(problem.questionVisual.groups[0]?.value).toBeGreaterThanOrEqual(10);
            expect(problem.questionVisual.groups[1]?.value).toBeGreaterThanOrEqual(1);
        }
    });

    it("add_2d1d_mental_nc shows a number line for mental jumps", () => {
        const problem = generators.add_2d1d_mental_nc({} as any);

        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBeGreaterThan(0);
            expect(problem.questionVisual.line.hiddenTarget).toBe(true);
        }
    });

    it("add_2d1d_hissan_nc keeps the same arithmetic as a plain expression", () => {
        const problem = generators.add_2d1d_hissan_nc({} as any);

        expect(problem.questionText).toMatch(/^\d+ \+ \d+ =$/);
        expect(problem.questionVisual).toBeUndefined();
    });

    it("add_2d1d_c_bridge shows a base-10 visual with carry", () => {
        const problem = generators.add_2d1d_c_bridge({} as any);

        expect(problem.questionVisual?.kind).toBe("operation-base10");
        if (problem.questionVisual?.kind === "operation-base10") {
            expect(problem.questionVisual.operator).toBe("+");
            const left = problem.questionVisual.groups[0]?.value ?? 0;
            const right = problem.questionVisual.groups[1]?.value ?? 0;
            expect((left % 10) + right).toBeGreaterThanOrEqual(10);
        }
    });

    it("add_2d1d_make10 highlights the make-ten waypoint on a number line", () => {
        const problem = generators.add_2d1d_make10({} as any);

        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            const values = problem.questionVisual.line.highlightValues ?? [];
            expect(values).toHaveLength(3);
            expect(problem.questionVisual.line.hiddenValues).toContain(problem.questionVisual.line.end);
        }
    });

    it("add_2d1d_hissan_c keeps the carry case as a plain expression", () => {
        const problem = generators.add_2d1d_hissan_c({} as any);

        expect(problem.questionText).toMatch(/^\d+ \+ \d+ =$/);
        expect(problem.questionVisual).toBeUndefined();
    });
});
