import { afterEach, describe, expect, it, vi } from "vitest";
import { createSeededRandom } from "../../utils/random";
import { generateMathProblem, MATH_GENERATORS } from ".";

const generateAllSkills = (seed: string) => Object.keys(MATH_GENERATORS)
    .sort()
    .map((skillId) => generateMathProblem(skillId, {
        random: createSeededRandom(`${seed}:${skillId}`),
    }));

describe("deterministic math generation", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns deeply equal problems for the same explicit seed", () => {
        expect(generateAllSkills("same-seed")).toEqual(generateAllSkills("same-seed"));
    });

    it("does not consult global Math.random when a random source is injected", () => {
        vi.spyOn(Math, "random").mockImplementation(() => {
            throw new Error("Unexpected global Math.random call");
        });

        expect(() => generateAllSkills("explicit-random-only")).not.toThrow();
    });
});
