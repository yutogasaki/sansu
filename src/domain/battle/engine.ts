import { getAvailableSkills } from "../math/curriculum";
import { generateMathProblem } from "../math/index";
import { randomChoice } from "../math/core";
import {
    BattleGrade,
    BattleProblem,
    BattleGameState,
    BattleAction,
    PlayerConfig,
    PlayerGameState,
} from "./types";
import { GRADE_TO_LEVELS, EXCLUDED_SKILLS } from "./gradeMapping";

const MAX_STEPS = 5;

// ============================================================
// Problem Generation
// ============================================================

export function generateBattleProblem(grade: BattleGrade): BattleProblem {
    const { min, max } = GRADE_TO_LEVELS[grade];

    const allSkills = getAvailableSkills(max);
    const belowMin = min > 1 ? new Set(getAvailableSkills(min - 1)) : new Set<string>();

    const eligible = allSkills.filter(
        (s) => !belowMin.has(s) && !EXCLUDED_SKILLS.has(s)
    );

    // Fallback: if no eligible skills in range, use all non-excluded up to max
    const pool = eligible.length > 0
        ? eligible
        : allSkills.filter((s) => !EXCLUDED_SKILLS.has(s));

    const skillId = randomChoice(pool);
    const raw = generateMathProblem(skillId);

    // Safety: retry if somehow non-number type
    if (raw.inputType !== "number") {
        return generateBattleProblem(grade);
    }

    return {
        id: crypto.randomUUID(),
        questionText: raw.questionText || "",
        correctAnswer: raw.correctAnswer as string,
        skillId: raw.categoryId,
        showDecimal: raw.categoryId.startsWith("dec_"),
    };
}

// ============================================================
// Initial State
// ============================================================

const defaultPlayerConfig: PlayerConfig = {
    name: "",
    grade: 1,
    emoji: "",
};

const defaultPlayerState: PlayerGameState = {
    config: defaultPlayerConfig,
    currentProblem: null,
    userInput: "",
    correctCount: 0,
    incorrectCount: 0,
};

export function createInitialBattleState(): BattleGameState {
    return {
        phase: "setup",
        ropePosition: 0,
        maxSteps: MAX_STEPS,
        winner: null,
        p1: { ...defaultPlayerState },
        p2: { ...defaultPlayerState },
        startedAt: null,
        finishedAt: null,
    };
}

// ============================================================
// Reducer
// ============================================================

export function battleReducer(
    state: BattleGameState,
    action: BattleAction
): BattleGameState {
    switch (action.type) {
        case "CORRECT_ANSWER": {
            if (state.phase !== "playing" || state.winner) return state;

            const delta = action.player === "p1" ? -1 : 1;
            const newPos = Math.max(
                -state.maxSteps,
                Math.min(state.maxSteps, state.ropePosition + delta)
            );

            const pKey = action.player;
            const newPlayer = {
                ...state[pKey],
                correctCount: state[pKey].correctCount + 1,
            };

            const winner =
                newPos <= -state.maxSteps
                    ? "p1" as const
                    : newPos >= state.maxSteps
                        ? "p2" as const
                        : null;

            return {
                ...state,
                ropePosition: newPos,
                [pKey]: newPlayer,
                winner,
                phase: winner ? "result" : "playing",
                finishedAt: winner ? Date.now() : null,
            };
        }

        case "INCORRECT_ANSWER": {
            if (state.phase !== "playing" || state.winner) return state;
            const pKey = action.player;
            return {
                ...state,
                [pKey]: {
                    ...state[pKey],
                    incorrectCount: state[pKey].incorrectCount + 1,
                    userInput: "",
                },
            };
        }

        case "SET_PROBLEM": {
            const pKey = action.player;
            return {
                ...state,
                [pKey]: {
                    ...state[pKey],
                    currentProblem: action.problem,
                    userInput: "",
                },
            };
        }

        case "SET_INPUT": {
            const pKey = action.player;
            return {
                ...state,
                [pKey]: {
                    ...state[pKey],
                    userInput: action.input,
                },
            };
        }

        case "START_GAME":
            return {
                ...state,
                phase: "countdown",
                p1: { ...state.p1, config: action.p1Config },
                p2: { ...state.p2, config: action.p2Config },
            };

        case "COUNTDOWN_DONE":
            return {
                ...state,
                phase: "playing",
                startedAt: Date.now(),
            };

        case "RESET":
            return createInitialBattleState();

        default:
            return state;
    }
}
