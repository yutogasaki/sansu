import { describe, expect, it } from "vitest";
import { appendExploreAnswerInput, deleteExploreAnswerInput } from "./exploreAnswerInput";

const INTEGER_PROBLEM = { inputType: "number" as const, correctAnswer: "12" };
const DECIMAL_PROBLEM = { inputType: "number" as const, correctAnswer: "1.2" };

describe("explore answer input", () => {
    it("appends digits up to the exploration answer limit", () => {
        expect(appendExploreAnswerInput("12", 3, INTEGER_PROBLEM)).toBe("123");
        expect(appendExploreAnswerInput("12345678", 9, INTEGER_PROBLEM)).toBe("12345678");
    });

    it("accepts one decimal point only for decimal answers", () => {
        expect(appendExploreAnswerInput("", ".", DECIMAL_PROBLEM)).toBe("0.");
        expect(appendExploreAnswerInput("1.", ".", DECIMAL_PROBLEM)).toBe("1.");
        expect(appendExploreAnswerInput("1", ".", INTEGER_PROBLEM)).toBe("1");
    });

    it("deletes the final character", () => {
        expect(deleteExploreAnswerInput("123")).toBe("12");
    });
});
