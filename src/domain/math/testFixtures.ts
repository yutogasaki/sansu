import { createDefaultMemoryState, type MemoryState } from "../types";
import { createInitialProfile } from "../user/profile";

export const createMathProgressProfile = (
    skillId: string,
    correctAnswers = 0,
    overrides: Partial<MemoryState> = {},
) => {
    const profile = createInitialProfile("Math progress", 1, 7, 1, "math");
    profile.mathSkills[skillId] = {
        ...createDefaultMemoryState(skillId, "math", false),
        totalAnswers: correctAnswers,
        correctAnswers,
        incorrectAnswers: 0,
        ...overrides,
    };
    return profile;
};
