import { describe, expect, it } from "vitest";
import { generators } from "./advanced";

const compareValues = (left: number, right: number): string => {
    if (Math.abs(left - right) < 1e-9) return "=";
    return left > right ? ">" : "<";
};

describe("advanced generators", () => {
    it("large_number_unit converts numbers into man or oku units", () => {
        const problem = generators.large_number_unit();
        const match = problem.questionText.match(/^([\d,]+) は なん(まん|おく)？$/);

        expect(match).not.toBeNull();
        if (!match) return;

        const value = Number(match[1].replaceAll(",", ""));
        const unit = match[2];
        const divisor = unit === "まん" ? 10000 : 100000000;

        expect(problem.correctAnswer).toBe(String(value / divisor));
    });

    it("dec_compare returns the correct comparison symbol", () => {
        const problem = generators.dec_compare();
        const match = problem.questionText.match(/^(\d+(?:\.\d+)?) □ (\d+(?:\.\d+)?)$/);

        expect(problem.inputType).toBe("choice");
        expect(match).not.toBeNull();
        if (!match) return;

        const left = Number(match[1]);
        const right = Number(match[2]);
        expect(problem.correctAnswer).toBe(compareValues(left, right));
    });

    it("frac_compare returns the correct fraction comparison symbol", () => {
        const problem = generators.frac_compare();
        const match = problem.questionText.match(/^(\d+)\/(\d+) □ (\d+)\/(\d+)$/);

        expect(problem.inputType).toBe("choice");
        expect(match).not.toBeNull();
        if (!match) return;

        const left = Number(match[1]) / Number(match[2]);
        const right = Number(match[3]) / Number(match[4]);
        expect(problem.correctAnswer).toBe(compareValues(left, right));
    });

    it("percent_basic supports both percent directions", () => {
        const problem = generators.percent_basic();
        const fromWhole = problem.questionText.match(/^(\d+) は (\d+) の なん%？$/);
        const fromPercent = problem.questionText.match(/^(\d+) の (\d+)% は？$/);

        expect(problem.inputType).toBe("number");
        expect(Boolean(fromWhole || fromPercent)).toBe(true);

        if (fromWhole) {
            const part = Number(fromWhole[1]);
            const whole = Number(fromWhole[2]);
            expect(problem.correctAnswer).toBe(String((part / whole) * 100));
        }

        if (fromPercent) {
            const whole = Number(fromPercent[1]);
            const percent = Number(fromPercent[2]);
            expect(problem.correctAnswer).toBe(String((whole * percent) / 100));
        }
    });

    it("average_basic returns the arithmetic mean", () => {
        const problem = generators.average_basic();
        const match = problem.questionText.match(/^([\d、]+) の へいきんは？$/);

        expect(match).not.toBeNull();
        if (!match) return;

        const numbers = match[1].split("、").map(Number);
        const average = numbers.reduce((sum, value) => sum + value, 0) / numbers.length;

        expect(problem.correctAnswer).toBe(String(average));
    });

    it("ratio_basic solves the missing term in an equivalent ratio", () => {
        const problem = generators.ratio_basic();
        const rightBlank = problem.questionText.match(/^(\d+) : (\d+) = (\d+) : □$/);
        const leftBlank = problem.questionText.match(/^(\d+) : (\d+) = □ : (\d+)$/);

        expect(Boolean(rightBlank || leftBlank)).toBe(true);

        if (rightBlank) {
            const a = Number(rightBlank[1]);
            const b = Number(rightBlank[2]);
            const c = Number(rightBlank[3]);
            expect(problem.correctAnswer).toBe(String((b * c) / a));
        }

        if (leftBlank) {
            const a = Number(leftBlank[1]);
            const b = Number(leftBlank[2]);
            const d = Number(leftBlank[3]);
            expect(problem.correctAnswer).toBe(String((a * d) / b));
        }
    });

    it("speed_basic solves distance, speed, or time from the prompt", () => {
        const problem = generators.speed_basic();
        const asksDistance = problem.questionText.match(/^はやさ (\d+) km\/h で (\d+) じかん。きょりは？$/);
        const asksSpeed = problem.questionText.match(/^きょり (\d+) km を (\d+) じかん。はやさは？$/);
        const asksTime = problem.questionText.match(/^きょり (\d+) km を はやさ (\d+) km\/h。じかんは？$/);

        expect(Boolean(asksDistance || asksSpeed || asksTime)).toBe(true);

        if (asksDistance) {
            const speed = Number(asksDistance[1]);
            const hours = Number(asksDistance[2]);
            expect(problem.correctAnswer).toBe(String(speed * hours));
        }

        if (asksSpeed) {
            const distance = Number(asksSpeed[1]);
            const hours = Number(asksSpeed[2]);
            expect(problem.correctAnswer).toBe(String(distance / hours));
        }

        if (asksTime) {
            const distance = Number(asksTime[1]);
            const speed = Number(asksTime[2]);
            expect(problem.correctAnswer).toBe(String(distance / speed));
        }
    });
});
