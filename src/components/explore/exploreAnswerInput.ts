import type { Problem } from "../../domain/types";
import { exploreProblemUsesDecimal } from "../../domain/explore";

export const EXPLORE_ANSWER_MAX_LENGTH = 8;

export const appendExploreAnswerInput = (
    current: string,
    value: number | string,
    problem: Pick<Problem, "inputType" | "correctAnswer">,
) => {
    if (current.length >= EXPLORE_ANSWER_MAX_LENGTH) return current;
    if (value === ".") {
        if (!exploreProblemUsesDecimal(problem) || current.includes(".")) return current;
        return `${current || "0"}.`;
    }
    return `${current}${value}`;
};

export const deleteExploreAnswerInput = (current: string) => current.slice(0, -1);
