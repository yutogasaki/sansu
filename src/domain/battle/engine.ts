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
const BOSS_MAX_HP = 100;
const BOSS_TIME_LIMIT_SEC = 90;
const BASE_DAMAGE = 10;
const COMBO_DAMAGE = 15;
const COMBO_THRESHOLD = 3;
const INCORRECT_LOCK_SEC = 2;

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
    combo: 0,
    damageDealt: 0,
    lockSeconds: 0,
};

export function createInitialBattleState(): BattleGameState {
    return {
        phase: "setup",
        gameMode: "tug_of_war",
        ropePosition: 0,
        maxSteps: MAX_STEPS,
        winner: null,
        bossHp: BOSS_MAX_HP,
        bossMaxHp: BOSS_MAX_HP,
        bossCleared: false,
        timeLimitSec: BOSS_TIME_LIMIT_SEC,
        remainingSec: BOSS_TIME_LIMIT_SEC,
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
            const pKey = action.player;

            if (state.gameMode === "boss_coop") {
                const prevCombo = state[pKey].combo;
                const nextCombo = prevCombo + 1;
                const damage = nextCombo >= COMBO_THRESHOLD ? COMBO_DAMAGE : BASE_DAMAGE;
                const nextBossHp = Math.max(0, state.bossHp - damage);
                const bossCleared = nextBossHp <= 0;

                return {
                    ...state,
                    bossHp: nextBossHp,
                    bossCleared,
                    [pKey]: {
                        ...state[pKey],
                        correctCount: state[pKey].correctCount + 1,
                        combo: nextCombo,
                        damageDealt: state[pKey].damageDealt + damage,
                        lockSeconds: 0,
                    },
                    phase: bossCleared ? "result" : "playing",
                    finishedAt: bossCleared ? Date.now() : state.finishedAt,
                };
            }

            const delta = action.player === "p1" ? -1 : 1;
            const newPos = Math.max(
                -state.maxSteps,
                Math.min(state.maxSteps, state.ropePosition + delta)
            );

            const newPlayer = {
                ...state[pKey],
                correctCount: state[pKey].correctCount + 1,
                combo: state[pKey].combo + 1,
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
                finishedAt: winner ? Date.now() : state.finishedAt,
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
                    combo: 0,
                    lockSeconds: state.gameMode === "boss_coop" ? INCORRECT_LOCK_SEC : 0,
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
                gameMode: action.mode,
                winner: null,
                ropePosition: 0,
                bossHp: BOSS_MAX_HP,
                bossMaxHp: BOSS_MAX_HP,
                bossCleared: false,
                timeLimitSec: BOSS_TIME_LIMIT_SEC,
                remainingSec: BOSS_TIME_LIMIT_SEC,
                startedAt: null,
                finishedAt: null,
                p1: {
                    ...defaultPlayerState,
                    config: action.p1Config,
                },
                p2: {
                    ...defaultPlayerState,
                    config: action.p2Config,
                },
            };

        case "COUNTDOWN_DONE":
            return {
                ...state,
                phase: "playing",
                startedAt: Date.now(),
            };

        case "TICK":
            if (state.phase !== "playing" || state.gameMode !== "boss_coop" || state.bossCleared) return state;
            if (state.remainingSec <= 1) {
                return {
                    ...state,
                    remainingSec: 0,
                    phase: "result",
                    finishedAt: Date.now(),
                    p1: { ...state.p1, lockSeconds: 0 },
                    p2: { ...state.p2, lockSeconds: 0 },
                };
            }
            return {
                ...state,
                remainingSec: state.remainingSec - 1,
                p1: {
                    ...state.p1,
                    lockSeconds: Math.max(0, state.p1.lockSeconds - 1),
                },
                p2: {
                    ...state.p2,
                    lockSeconds: Math.max(0, state.p2.lockSeconds - 1),
                },
            };

        case "RESET":
            return createInitialBattleState();

        default:
            return state;
    }
}
