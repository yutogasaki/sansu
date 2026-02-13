import { getAvailableSkills } from "../math/curriculum";
import { generateMathProblem } from "../math/index";
import { randomChoice } from "../math/core";
import { generateVocabProblem } from "../english/generator";
import { ENGLISH_WORDS } from "../english/words";
import {
    BattleGrade,
    BattleProblem,
    BattleSubject,
    BattleGameState,
    BattleAction,
    PlayerConfig,
    PlayerGameState,
} from "./types";
import { GRADE_TO_LEVELS, EXCLUDED_SKILLS } from "./gradeMapping";

const GRADE_TO_VOCAB_LEVELS: Record<BattleGrade, { min: number; max: number }> = {
    1: { min: 1, max: 2 },
    2: { min: 1, max: 3 },
    3: { min: 2, max: 4 },
    4: { min: 3, max: 5 },
    5: { min: 4, max: 6 },
    6: { min: 5, max: 8 },
};

const MAX_STEPS = 5;

// ============================================================
// Problem Generation
// ============================================================

export function generateBattleMathProblem(grade: BattleGrade): BattleProblem {
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
        return generateBattleMathProblem(grade);
    }

    return {
        id: crypto.randomUUID(),
        questionText: raw.questionText || "",
        correctAnswer: raw.correctAnswer as string,
        skillId: raw.categoryId,
        showDecimal: raw.categoryId.startsWith("dec_"),
        inputType: "number",
    };
}

export function generateBattleVocabProblem(grade: BattleGrade): BattleProblem {
    const { min, max } = GRADE_TO_VOCAB_LEVELS[grade];

    const eligible = ENGLISH_WORDS.filter(
        (w) => w.level >= min && w.level <= max
    );
    const pool = eligible.length > 0 ? eligible : ENGLISH_WORDS;
    const word = randomChoice(pool);

    const raw = generateVocabProblem(word.id);

    return {
        id: crypto.randomUUID(),
        questionText: raw.questionText || "",
        correctAnswer: raw.correctAnswer as string,
        skillId: word.id,
        showDecimal: false,
        inputType: "choice",
        choices: raw.inputConfig?.choices,
    };
}

export function generateBattleProblem(grade: BattleGrade, subject: BattleSubject = "math"): BattleProblem {
    return subject === "vocab"
        ? generateBattleVocabProblem(grade)
        : generateBattleMathProblem(grade);
}

// ============================================================
// Initial State
// ============================================================

const defaultPlayerConfig: PlayerConfig = {
    name: "",
    grade: 1,
    emoji: "",
    subject: "math",
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
