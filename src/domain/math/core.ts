import { Problem, UserProfile } from "../types";
import type { RandomSource } from "../../utils/random";

export interface MathGeneratorContext {
    profile?: UserProfile;
    random?: RandomSource;
}

export type GeneratorFn = (context?: MathGeneratorContext) => Omit<Problem, 'id' | 'subject' | 'isReview'>;

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
    return {
        categoryId: skillId,
        questionText: question,
        correctAnswer: answer,
        inputType,
        inputConfig,
        ...displayConfig
    };
};
