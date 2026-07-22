import { afterEach, describe, expect, it, vi } from "vitest";
import { generators } from "./fraction";

afterEach(() => {
    vi.restoreAllMocks();
});

describe("fraction generators", () => {
    it("generates different denominators without retrying when random is constant", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.frac_add_diff();

        expect(problem.questionText).toBe("1/2 + 1/3 =");
        expect(problem.correctAnswer).toEqual(["5", "6"]);
    });

    it("keeps different-denominator subtraction positive and non-zero when random is constant", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.frac_sub_diff();
        const match = problem.questionText.match(/^(\d+)\/(\d+) - (\d+)\/(\d+) =$/);

        expect(match).not.toBeNull();
        const [, leftNumerator, leftDenominator, rightNumerator, rightDenominator] = match!;
        expect(Number(leftDenominator)).not.toBe(Number(rightDenominator));
        expect(
            Number(leftNumerator) * Number(rightDenominator)
            - Number(rightNumerator) * Number(leftDenominator),
        ).toBeGreaterThan(0);
        expect(problem.correctAnswer).toEqual(["1", "6"]);
    });

    it("repairs equivalent operands in different-denominator subtraction", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0) // first denominator: 2
            .mockReturnValueOnce(0.25) // offset 2 -> second denominator: 4
            .mockReturnValueOnce(0) // first numerator: 1
            .mockReturnValueOnce(0.5); // second numerator: 2 (equivalent to 1/2)

        const problem = generators.frac_sub_diff();

        expect(problem.questionText).toBe("3/4 - 1/2 =");
        expect(problem.correctAnswer).toEqual(["1", "4"]);
    });

    it("generates mixed subtraction without recursion when random is constant", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.frac_mixed_sub();

        expect(problem.questionText).toBe("2 1/3 - 1 2/3 =");
        expect(problem.inputType).toBe("multi-number");
        expect(problem.correctAnswer).toEqual(["2", "3"]);
    });

    it("keeps same-denominator subtraction operands proper when random is constant", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.frac_sub_same();

        expect(problem.questionText).toBe("2/3 - 1/3 =");
        expect(problem.correctAnswer).toEqual(["1", "3"]);
    });

    it("keeps mixed addition on the documented multi-number input contract", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.frac_mixed();

        expect(problem.questionText).toBe("1 1/3 + 1 1/3 =");
        expect(problem.inputType).toBe("multi-number");
        expect(problem.correctAnswer).toEqual(["2", "2", "3"]);
    });
});
