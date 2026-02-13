// ============================================================
// Battle Mode Type Definitions
// ============================================================

export type PlayerId = "p1" | "p2";
export type BattleGrade = 1 | 2 | 3 | 4 | 5 | 6;
export type BattlePhase = "setup" | "countdown" | "playing" | "result";

export interface PlayerConfig {
    name: string;
    grade: BattleGrade;
    emoji: string;
}

export interface BattleProblem {
    id: string;
    questionText: string;
    correctAnswer: string;
    skillId: string;
    showDecimal: boolean;
}

export interface PlayerGameState {
    config: PlayerConfig;
    currentProblem: BattleProblem | null;
    userInput: string;
    correctCount: number;
    incorrectCount: number;
}

export interface BattleGameState {
    phase: BattlePhase;
    ropePosition: number; // -maxSteps(P1 wins) to +maxSteps(P2 wins)
    maxSteps: number;
    winner: PlayerId | null;
    p1: PlayerGameState;
    p2: PlayerGameState;
    startedAt: number | null;
    finishedAt: number | null;
}

export type BattleAction =
    | { type: "CORRECT_ANSWER"; player: PlayerId }
    | { type: "INCORRECT_ANSWER"; player: PlayerId }
    | { type: "SET_PROBLEM"; player: PlayerId; problem: BattleProblem }
    | { type: "SET_INPUT"; player: PlayerId; input: string }
    | { type: "START_GAME"; p1Config: PlayerConfig; p2Config: PlayerConfig }
    | { type: "COUNTDOWN_DONE" }
    | { type: "RESET" };
