import { describe, expect, it, vi } from "vitest";
import { battleReducer, createInitialBattleState, generateBattleMathProblem } from "./engine";
import { EXCLUDED_SKILLS, GRADE_TO_LEVELS } from "./gradeMapping";
import { getAvailableSkills } from "../math/curriculum";
import { PlayerConfig } from "./types";

const p1Config: PlayerConfig = { name: "P1", grade: 3, emoji: "A", subject: "math" };
const p2Config: PlayerConfig = { name: "P2", grade: 3, emoji: "B", subject: "math" };

describe("battleReducer", () => {
    it("enumerates every question-visual kind available to Battle grades", () => {
        const originalRandom = Math.random;
        const randomSpy = vi.spyOn(Math, "random");
        const visuals = new Set<string>();

        try {
            for (const grade of [-2, -1, 0, 1, 2, 3, 4, 5, 6] as const) {
                const { min, max } = GRADE_TO_LEVELS[grade];
                const skills = getAvailableSkills(max);
                const belowMin = min > 1 ? new Set(getAvailableSkills(min - 1)) : new Set<string>();
                const eligible = skills.filter(skill => !belowMin.has(skill) && !EXCLUDED_SKILLS.has(skill));
                const pool = eligible.length > 0
                    ? eligible
                    : skills.filter(skill => !EXCLUDED_SKILLS.has(skill));

                for (let index = 0; index < pool.length; index += 1) {
                    let randomCalls = 0;
                    randomSpy.mockImplementation(() => {
                        randomCalls += 1;
                        return randomCalls === 1 ? (index + 0.5) / pool.length : originalRandom();
                    });

                    const problem = generateBattleMathProblem(grade);
                    if (problem.questionVisual) {
                        visuals.add(problem.questionVisual.kind);
                    }
                }
            }
        } finally {
            randomSpy.mockRestore();
        }

        expect([...visuals].sort()).toEqual([
            "addition-items",
            "number-line",
            "operation-base10",
            "single-items",
            "subtraction-items",
        ]);
    });

    it("keeps math visuals on battle problems when the source skill has a visual prompt", () => {
        const spy = vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generateBattleMathProblem(-2);

        expect(problem.skillId).toBe("count_5");
        expect(problem.inputType).toBe("choice");
        expect(problem.choices?.map(choice => choice.value)).toContain(problem.correctAnswer);
        expect(problem.questionVisual?.kind).toBe("single-items");

        spy.mockRestore();
    });

    it("keeps number input for numeric math problems", () => {
        const spy = vi.spyOn(Math, "random").mockReturnValue(0);

        const problem = generateBattleMathProblem(3);

        expect(problem.skillId).toBe("count_100");
        expect(problem.inputType).toBe("number");
        expect(problem.choices).toBeUndefined();

        spy.mockRestore();
    });

    it("starts game in countdown with reset counters", () => {
        const state = createInitialBattleState();
        const next = battleReducer(state, { type: "START_GAME", p1Config, p2Config, mode: "tug_of_war" });

        expect(next.phase).toBe("countdown");
        expect(next.gameMode).toBe("tug_of_war");
        expect(next.ropePosition).toBe(0);
        expect(next.p1.correctCount).toBe(0);
        expect(next.p2.correctCount).toBe(0);
    });

    it("moves to playing on countdown done", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-02-16T12:00:00.000Z"));

        const started = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "tug_of_war" });
        const next = battleReducer(started, { type: "COUNTDOWN_DONE" });

        expect(next.phase).toBe("playing");
        expect(next.startedAt).toBe(Date.now());
    });

    it("updates rope and determines winner in tug_of_war", () => {
        let state = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "tug_of_war" });
        state = battleReducer(state, { type: "COUNTDOWN_DONE" });

        for (let i = 0; i < state.maxSteps; i++) {
            state = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" });
        }

        expect(state.winner).toBe("p1");
        expect(state.phase).toBe("result");
        expect(state.ropePosition).toBe(-state.maxSteps);
    });

    it("applies combo damage in boss_coop", () => {
        let state = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "boss_coop" });
        state = battleReducer(state, { type: "COUNTDOWN_DONE" });

        state = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" }); // 10
        state = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" }); // 10
        state = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" }); // 15

        expect(state.bossHp).toBe(65);
        expect(state.p1.damageDealt).toBe(35);
        expect(state.p1.combo).toBe(3);
    });

    it("sets lock on incorrect answer in boss_coop", () => {
        let state = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "boss_coop" });
        state = battleReducer(state, { type: "COUNTDOWN_DONE" });
        state = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" });
        state = battleReducer(state, { type: "INCORRECT_ANSWER", player: "p1" });

        expect(state.p1.combo).toBe(0);
        expect(state.p1.lockSeconds).toBe(2);
    });

    it("ticks timer and ends game when time reaches zero in boss_coop", () => {
        let state = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "boss_coop" });
        state = battleReducer(state, { type: "COUNTDOWN_DONE" });
        state = { ...state, remainingSec: 1 };

        const next = battleReducer(state, { type: "TICK" });

        expect(next.remainingSec).toBe(0);
        expect(next.phase).toBe("result");
    });

    it("ignores correct answer outside playing phase", () => {
        const state = createInitialBattleState(); // setup
        const next = battleReducer(state, { type: "CORRECT_ANSWER", player: "p1" });
        expect(next).toEqual(state);
    });

    it("does not process TICK in tug_of_war mode", () => {
        let state = battleReducer(createInitialBattleState(), { type: "START_GAME", p1Config, p2Config, mode: "tug_of_war" });
        state = battleReducer(state, { type: "COUNTDOWN_DONE" });
        const next = battleReducer(state, { type: "TICK" });
        expect(next).toEqual(state);
    });
});
