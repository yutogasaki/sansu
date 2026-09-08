import { Problem, UserProfile } from "../types";
import type { RandomSource } from "../../utils/random";
import { createLearningProblemContext } from '../learning/context';

export interface MathGeneratorContext {
    profile?: UserProfile;
    random?: RandomSource;
}

export type GeneratorFn = (context?: MathGeneratorContext) => Omit<Problem, 'id' | 'subject' | 'isReview'>;

/** Only independently correct answers advance a learner's introductory sequence. */
export const getMathSkillProgress = (
    skillId: string,
    context?: MathGeneratorContext,
): number | undefined => {
    // A profile-free generation is also used for broad-range content inspection.
    if (!context?.profile) return undefined;
    const correctAnswers = context.profile.mathSkills?.[skillId]?.correctAnswers;
    return typeof correctAnswers === "number"
        && Number.isSafeInteger(correctAnswers)
        && correctAnswers >= 0
        ? correctAnswers
        : 0;
};

export const randomInt = (
    min: number,
    max: number,
    random: RandomSource = Math.random,
): number => {
    return Math.floor(random() * (max - min + 1)) + min;
};

export const randomChoice = <T>(arr: T[], random: RandomSource = Math.random): T => {
    return arr[randomInt(0, arr.length - 1, random)];
};

export const createProblem = (
    skillId: string,
    question: string,
    answer: string | string[],
    inputType: Problem["inputType"],
    inputConfig?: Problem["inputConfig"],
    displayConfig?: Partial<Pick<Problem, "questionImage" | "questionVisual" | "displayAnswer" | "hissanOperands">>
): Omit<Problem, 'id' | 'subject' | 'isReview'> => {
    const problem = {
        categoryId: skillId,
        questionText: question,
        correctAnswer: answer,
        inputType,
        inputConfig,
        ...displayConfig
    };
    return { ...problem, learningContext: createLearningProblemContext('math', problem) };
};
