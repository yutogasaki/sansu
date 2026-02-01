import { Problem } from "../types";

export type GeneratorFn = () => Omit<Problem, 'id' | 'subject' | 'isReview'>;

export const randomInt = (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomChoice = <T>(arr: T[]): T => {
    return arr[randomInt(0, arr.length - 1)];
};

export const createProblem = (
    skillId: string,
    question: string,
    answer: string | string[],
    inputType: Problem["inputType"],
    inputConfig?: Problem["inputConfig"]
): Omit<Problem, 'id' | 'subject' | 'isReview'> => {
    return {
        categoryId: skillId,
        questionText: question,
        correctAnswer: answer,
        inputType,
        inputConfig
    };
};
