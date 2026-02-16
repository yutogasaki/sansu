import { describe, expect, it, vi } from "vitest";
import { battleReducer, createInitialBattleState } from "./engine";
import { PlayerConfig } from "./types";

const p1Config: PlayerConfig = { name: "P1", grade: 3, emoji: "A", subject: "math" };
const p2Config: PlayerConfig = { name: "P2", grade: 3, emoji: "B", subject: "math" };

describe("battleReducer", () => {
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
