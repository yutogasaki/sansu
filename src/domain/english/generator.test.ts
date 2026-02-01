import { generateVocabProblem } from "./generator";
import { ENGLISH_WORDS } from "./words";

describe("generateVocabProblem", () => {
    it("includes the correct answer in choices", () => {
        const target = ENGLISH_WORDS[0];
        const problem = generateVocabProblem(target.id, { cooldownIds: [] });
        expect(problem.correctAnswer).toBe(target.id);
        expect(problem.inputConfig?.choices?.length).toBe(4);
        const ids = problem.inputConfig?.choices?.map(c => c.value) || [];
        expect(ids).toContain(target.id);
    });
});
