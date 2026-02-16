import { describe, expect, it } from "vitest";
import {
    generateAdditionGrid,
    generateDivisionGrid,
    generateMultiplicationGrid,
    generateSubtractionGrid,
    generateHissanGrid,
    parseQuestionText,
} from "./hissanEngine";

describe("hissanEngine", () => {
    it("parseQuestionText parses basic operator expressions", () => {
        expect(parseQuestionText("456 + 789 =")).toEqual({ a: 456, b: 789, op: "+" });
        expect(parseQuestionText("834 − 567 =")).toEqual({ a: 834, b: 567, op: "−" });
        expect(parseQuestionText("12 × 3 =")).toEqual({ a: 12, b: 3, op: "×" });
    });

    it("parseQuestionText returns null for invalid text", () => {
        expect(parseQuestionText("abc")).toBeNull();
        expect(parseQuestionText("1 + =")).toBeNull();
    });

    it("generateAdditionGrid builds answer and metadata", () => {
        const grid = generateAdditionGrid(456, 789);
        expect(grid.operation).toBe("addition");
        expect(grid.finalAnswer).toBe("1245");
        expect(grid.steps.length).toBe(1);
        expect(grid.steps[0].rowIndex).toBe(3);
        expect(grid.rows.length).toBe(4);
        expect(grid.columnCount).toBe(5);
    });

    it("generateSubtractionGrid builds answer and metadata", () => {
        const grid = generateSubtractionGrid(834, 567);
        expect(grid.operation).toBe("subtraction");
        expect(grid.finalAnswer).toBe("267");
        expect(grid.steps.length).toBe(1);
        expect(grid.rows.length).toBe(4);
        expect(grid.columnCount).toBe(4);
    });

    it("generateHissanGrid supports + and - operators", () => {
        const add = generateHissanGrid("add_3d3d", "456 + 789 =");
        const sub = generateHissanGrid("sub_3d3d", "834 - 567 =");
        const mul = generateHissanGrid("mul_2d1d", "12 × 3 =");
        const div = generateHissanGrid("div_2d1d_exact", "12 ÷ 3 =");
        expect(add?.operation).toBe("addition");
        expect(sub?.operation).toBe("subtraction");
        expect(mul?.operation).toBe("multiplication");
        expect(div?.operation).toBe("division");
    });

    it("generateMultiplicationGrid and generateDivisionGrid build final answers", () => {
        const mul = generateMultiplicationGrid(12, 3);
        const div = generateDivisionGrid(12, 3);
        expect(mul.finalAnswer).toBe("36");
        expect(div.finalAnswer).toBe("4");
    });

    it("generateHissanGrid returns null for division by zero", () => {
        const divByZero = generateHissanGrid("div_2d1d_exact", "12 ÷ 0 =");
        expect(divByZero).toBeNull();
    });
});
