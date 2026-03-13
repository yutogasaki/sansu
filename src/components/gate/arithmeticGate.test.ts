import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createAdditionGateChallenge,
    createMultiplicationGateChallenge,
    normalizeGateAnswer,
} from "./arithmeticGate";

describe("normalizeGateAnswer", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("keeps only ASCII digits and converts full-width digits", () => {
        expect(normalizeGateAnswer(" １2３a-4 ")).toBe("1234");
    });

    it("builds an addition challenge with the expected answer", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.999);

        expect(createAdditionGateChallenge()).toEqual({
            prompt: "3 + 7 = ?",
            answer: "10",
        });
    });

    it("builds a multiplication challenge with the expected answer", () => {
        vi.spyOn(Math, "random")
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.999);

        expect(createMultiplicationGateChallenge()).toEqual({
            prompt: "2 × 9 = ?",
            answer: "18",
        });
    });
});
