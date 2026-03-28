import { describe, expect, it } from "vitest";
import { generators } from "./subtraction";

describe("subtraction generators", () => {
    it("sub_1d1d_nc_bridge starts from subtracting 1 with visual support", () => {
        const problem = generators.sub_1d1d_nc_bridge({
            profile: { mathSkills: { sub_1d1d_nc_bridge: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("2 - 1 =");
        expect(problem.correctAnswer).toBe("1");
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.count).toBe(2);
            expect(problem.questionVisual.group.crossedOutCount).toBe(1);
            expect(problem.questionVisual.takenAwayCount).toBe(1);
        }
    });

    it("sub_1d1d_nc starts from subtracting 1 as a numeric expression", () => {
        const problem = generators.sub_1d1d_nc({
            profile: { mathSkills: { sub_1d1d_nc: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("2 - 1 =");
        expect(problem.correctAnswer).toBe("1");
        expect(problem.questionVisual).toBeUndefined();
    });

    it("sub_1d1d_c_bridge starts from the smallest cross-ten case with visual support", () => {
        const problem = generators.sub_1d1d_c_bridge({
            profile: { mathSkills: { sub_1d1d_c_bridge: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("11 - 2 =");
        expect(problem.correctAnswer).toBe("9");
        expect(problem.questionVisual?.kind).toBe("subtraction-items");
        if (problem.questionVisual?.kind === "subtraction-items") {
            expect(problem.questionVisual.group.count).toBe(11);
            expect(problem.questionVisual.group.crossedOutCount).toBe(2);
            expect(problem.questionVisual.takenAwayCount).toBe(2);
        }
    });

    it("sub_1d1d_c starts from the smallest cross-ten case as a numeric expression", () => {
        const problem = generators.sub_1d1d_c({
            profile: { mathSkills: { sub_1d1d_c: { totalAnswers: 0 } } },
        } as any);

        expect(problem.questionText).toBe("11 - 2 =");
        expect(problem.correctAnswer).toBe("9");
        expect(problem.questionVisual).toBeUndefined();
    });

    it("sub_2d1d_nc_bridge shows a base-10 visual without borrow", () => {
        const problem = generators.sub_2d1d_nc_bridge({} as any);

        expect(problem.questionVisual?.kind).toBe("operation-base10");
        if (problem.questionVisual?.kind === "operation-base10") {
            expect(problem.questionVisual.operator).toBe("−");
            const left = problem.questionVisual.groups[0]?.value ?? 0;
            const right = problem.questionVisual.groups[1]?.value ?? 0;
            expect(left % 10).toBeGreaterThanOrEqual(right);
        }
    });

    it("sub_2d1d_diff shows a left-moving number line", () => {
        const problem = generators.sub_2d1d_diff({} as any);

        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBeLessThan(0);
            expect(problem.questionVisual.line.hiddenTarget).toBe(true);
        }
    });

    it("sub_2d1d_hissan_nc keeps the no-borrow case as a plain expression", () => {
        const problem = generators.sub_2d1d_hissan_nc({} as any);

        expect(problem.questionText).toMatch(/^\d+ - \d+ =$/);
        expect(problem.questionVisual).toBeUndefined();
    });

    it("sub_2d1d_c_bridge shows a base-10 visual with borrow", () => {
        const problem = generators.sub_2d1d_c_bridge({} as any);

        expect(problem.questionVisual?.kind).toBe("operation-base10");
        if (problem.questionVisual?.kind === "operation-base10") {
            expect(problem.questionVisual.operator).toBe("−");
            const left = problem.questionVisual.groups[0]?.value ?? 0;
            const right = problem.questionVisual.groups[1]?.value ?? 0;
            expect(left % 10).toBeLessThan(right);
        }
    });

    it("sub_2d1d_back_add hides the missing start on a reverse number line", () => {
        const problem = generators.sub_2d1d_back_add({} as any);

        expect(problem.questionVisual?.kind).toBe("number-line");
        if (problem.questionVisual?.kind === "number-line") {
            expect(problem.questionVisual.line.step).toBeGreaterThan(0);
            expect(problem.questionVisual.line.hiddenTarget).toBe(false);
            expect(problem.questionVisual.line.hiddenValues).toContain(problem.questionVisual.line.start);
        }
    });

    it("sub_2d1d_hissan_c keeps the borrow case as a plain expression", () => {
        const problem = generators.sub_2d1d_hissan_c({} as any);

        expect(problem.questionText).toMatch(/^\d+ - \d+ =$/);
        expect(problem.questionVisual).toBeUndefined();
    });
});
