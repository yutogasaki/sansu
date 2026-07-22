import { afterEach, describe, expect, it, vi } from "vitest";
import { generators } from "./division";

const parseExactDivision = (questionText: string) => {
    const match = questionText.match(/^(\d+) ÷ (\d+) =$/);
    expect(match).not.toBeNull();
    if (!match) throw new Error(`Unexpected division question: ${questionText}`);

    return {
        dividend: Number(match[1]),
        divisor: Number(match[2]),
    };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe("division generators", () => {
    it("keeps 2-digit by 1-digit exact division within the specified quotient range", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0) // divisor: 2
            .mockReturnValueOnce(0.999999); // quotient upper bound: 11

        const problem = generators.div_2d1d_exact();
        const { dividend, divisor } = parseExactDivision(problem.questionText);
        const quotient = Number(problem.correctAnswer);

        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(9);
        expect(dividend).toBeGreaterThanOrEqual(10);
        expect(dividend).toBeLessThanOrEqual(99);
        expect(quotient).toBeGreaterThanOrEqual(2);
        expect(quotient).toBeLessThanOrEqual(11);
        expect(dividend).toBe(divisor * quotient);
    });

    it("keeps 3-digit by 1-digit exact division within the specified quotient range", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0) // divisor: 2
            .mockReturnValueOnce(0.999999); // quotient upper bound: 111

        const problem = generators.div_3d1d_exact();
        const { dividend, divisor } = parseExactDivision(problem.questionText);
        const quotient = Number(problem.correctAnswer);

        expect(divisor).toBeGreaterThanOrEqual(2);
        expect(divisor).toBeLessThanOrEqual(9);
        expect(dividend).toBeGreaterThanOrEqual(100);
        expect(dividend).toBeLessThanOrEqual(999);
        expect(quotient).toBeGreaterThanOrEqual(12);
        expect(quotient).toBeLessThanOrEqual(111);
        expect(dividend).toBe(divisor * quotient);
    });

    it("keeps 3-digit by 2-digit exact division valid at the lower random boundary", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generators.div_3d2d_exact();
        const { dividend, divisor } = parseExactDivision(problem.questionText);
        const quotient = Number(problem.correctAnswer);

        expect(divisor).toBeGreaterThanOrEqual(10);
        expect(divisor).toBeLessThanOrEqual(99);
        expect(dividend).toBeGreaterThanOrEqual(100);
        expect(dividend).toBeLessThanOrEqual(999);
        expect(quotient).toBeGreaterThanOrEqual(2);
        expect(quotient).toBeLessThanOrEqual(9);
        expect(dividend).toBe(divisor * quotient);
    });

    it.each([
        ["div_99_rev", 1, 9, 1, 9, 1, 81],
        ["div_2d2d_exact", 10, 99, 1, 9, 10, 99],
    ] as const)(
        "%s produces an exact result inside its divisor, quotient, and dividend ranges",
        (skillId, minDivisor, maxDivisor, minQuotient, maxQuotient, minDividend, maxDividend) => {
            for (let sample = 0; sample < 100; sample += 1) {
                const problem = generators[skillId]();
                const { dividend, divisor } = parseExactDivision(problem.questionText);
                const quotient = Number(problem.correctAnswer);

                expect(divisor).toBeGreaterThanOrEqual(minDivisor);
                expect(divisor).toBeLessThanOrEqual(maxDivisor);
                expect(quotient).toBeGreaterThanOrEqual(minQuotient);
                expect(quotient).toBeLessThanOrEqual(maxQuotient);
                expect(dividend).toBeGreaterThanOrEqual(minDividend);
                expect(dividend).toBeLessThanOrEqual(maxDividend);
                expect(dividend).toBe(divisor * quotient);
            }
        },
    );
});
