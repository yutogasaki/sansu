import { describe, expect, it } from "vitest";
import { generators } from "./counting";

describe("counting generators visuals", () => {
    it("count_10 uses a single-items ten-frame visual", () => {
        const problem = generators.count_10();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.style).toBe("frame");
            expect(problem.questionVisual.frameSize).toBe(10);
        }
    });

    it("count_dot uses a single-items dot visual", () => {
        const problem = generators.count_dot();
        expect(problem.questionVisual?.kind).toBe("single-items");
        if (problem.questionVisual?.kind === "single-items") {
            expect(problem.questionVisual.group.emoji).toBe("●");
        }
    });

    it("count_which_more uses comparison visuals and choice labels without numeric hints", () => {
        const problem = generators.count_which_more();
        expect(problem.questionVisual?.kind).toBe("comparison-items");
        expect(problem.inputConfig?.choices?.every(choice => !/\d/.test(choice.label))).toBe(true);
    });

    it("count_order uses item-order visuals", () => {
        const problem = generators.count_order();
        expect(problem.questionVisual?.kind).toBe("item-order");
        if (problem.questionVisual?.kind === "item-order") {
            expect(problem.questionVisual.groups).toHaveLength(3);
        }
    });
});
