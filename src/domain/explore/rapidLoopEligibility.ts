import {
    getLevelForSkill,
    getMathSkillMetadata,
} from "../math/curriculum";
import type { Problem } from "../types";

export const RAPID_LOOP_MAX_INPUT_ACTIONS = 3;
export const RAPID_LOOP_CONFIRM_ACTIONS = 1;
export const RAPID_LOOP_MAX_COMPLETION_ACTIONS = 4;
export const EXPLORE_RAPID_FALLBACK_CATEGORY_ID = "explore_rapid_addition";

export type RapidLoopIneligibilityReason =
    | "unknown-skill"
    | "input-not-single-number"
    | "answer-not-supported"
    | "answer-over-action-budget"
    | "written-method-surface"
    | "high-cognitive-load";

export type RapidLoopEligibilityResult =
    | {
        eligible: true;
        reason: null;
        inputActions: number;
        completionActions: number;
    }
    | {
        eligible: false;
        reason: RapidLoopIneligibilityReason;
        inputActions: number | null;
        completionActions: number | null;
    };

type RapidLoopProblem = Pick<
    Problem,
    | "categoryId"
    | "inputType"
    | "inputConfig"
    | "correctAnswer"
    | "hissanOperands"
>;

const HIGH_COGNITIVE_LOAD_FAMILIES = new Set([
    "application",
    "number-advanced",
]);

/**
 * These legacy skills are described as three-or-more-digit written work in the
 * curriculum, but predate explicit `algorithm` metadata. Keep them closed until
 * they have a deliberately authored rapid representation.
 */
const LEGACY_HIGH_COGNITIVE_LOAD_SKILLS = new Set([
    "add_3d3d",
    "sub_3d3d",
    "add_4d",
    "sub_4d",
]);

const reject = (
    reason: RapidLoopIneligibilityReason,
    inputActions: number | null = null,
): RapidLoopEligibilityResult => ({
    eligible: false,
    reason,
    inputActions,
    completionActions: inputActions === null
        ? null
        : inputActions + RAPID_LOOP_CONFIRM_ACTIONS,
});

const getNormalizedNonNegativeAnswer = (
    answer: Problem["correctAnswer"],
): string | null => {
    if (typeof answer !== "string" || answer.length === 0) return null;

    const numeric = Number(answer);
    if (!Number.isFinite(numeric) || numeric < 0) return null;

    // String(number) is the canonical keypad spelling: no sign, leading zero,
    // trailing decimal zero, exponent notation, or whitespace.
    return String(numeric) === answer ? answer : null;
};

/**
 * Evaluates an already-generated problem for a newly reserved Explore slot.
 * Persisted slots are first-writer truth and must not be passed through this
 * policy while restoring or committing an existing run.
 */
export const evaluateRapidLoopEligibility = (
    problem: RapidLoopProblem,
): RapidLoopEligibilityResult => {
    const isSystemFallback = problem.categoryId === EXPLORE_RAPID_FALLBACK_CATEGORY_ID;
    if (getLevelForSkill(problem.categoryId) === null && !isSystemFallback) {
        return reject("unknown-skill");
    }

    const metadata = isSystemFallback
        ? { family: "addition-basic", representation: "concrete" as const }
        : getMathSkillMetadata(problem.categoryId);
    if (
        problem.inputType === "hissan"
        || problem.hissanOperands !== undefined
        || metadata.representation === "algorithm"
    ) {
        return reject("written-method-surface");
    }

    if (
        HIGH_COGNITIVE_LOAD_FAMILIES.has(metadata.family)
        || LEGACY_HIGH_COGNITIVE_LOAD_SKILLS.has(problem.categoryId)
    ) {
        return reject("high-cognitive-load");
    }

    if (
        problem.inputType !== "number"
        || problem.inputConfig?.fields !== undefined
        || problem.inputConfig?.choices !== undefined
    ) {
        return reject("input-not-single-number");
    }

    const answer = getNormalizedNonNegativeAnswer(problem.correctAnswer);
    if (answer === null) {
        return reject("answer-not-supported");
    }

    const inputActions = answer.length;
    const completionActions = inputActions + RAPID_LOOP_CONFIRM_ACTIONS;
    if (
        inputActions > RAPID_LOOP_MAX_INPUT_ACTIONS
        || completionActions > RAPID_LOOP_MAX_COMPLETION_ACTIONS
    ) {
        return reject("answer-over-action-budget", inputActions);
    }

    return {
        eligible: true,
        reason: null,
        inputActions,
        completionActions,
    };
};

export const isRapidLoopEligibleProblem = (problem: RapidLoopProblem): boolean => (
    evaluateRapidLoopEligibility(problem).eligible
);
