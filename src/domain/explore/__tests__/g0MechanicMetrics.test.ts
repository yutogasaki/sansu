import { describe, expect, it } from "vitest";
import { getG0MechanicMetrics } from "../g0MechanicMetrics";
import type { G0MechanicRunBase } from "../g0MechanicTypes";

const makeState = (
    completedRuns: G0MechanicRunBase["completedRuns"],
): G0MechanicRunBase => ({
    runOrdinal: 2,
    runId: "metric:run-2",
    phase: "payoff",
    actionCount: 3,
    activeReactionId: null,
    acceptedClientActionIds: [],
    startedAtMs: 0,
    outcome: completedRuns.at(-1)?.outcome ?? null,
    completedRuns,
    replayStarts: 1,
});

describe("getG0MechanicMetrics", () => {
    it("keeps action diversity separate from outcomes and duration", () => {
        const state = makeState([
            {
                actionIds: ["safe", "safe"],
                durationMs: 1_000,
                strategySignature: "safe>safe",
                outcome: {
                    id: "open",
                    title: "open",
                    detail: "open",
                    goalReached: true,
                    riskTaken: false,
                    riskRecovered: false,
                },
            },
            {
                actionIds: ["wild", "recovery", "safe", "safe"],
                durationMs: 3_000,
                strategySignature: "wild>recovery>safe>safe",
                outcome: {
                    id: "recover",
                    title: "recover",
                    detail: "recover",
                    goalReached: false,
                    riskTaken: true,
                    riskRecovered: true,
                },
            },
        ]);

        expect(getG0MechanicMetrics(state)).toEqual({
            completedRuns: 2,
            replayStarts: 1,
            triedDifferentFirstActions: true,
            changedStrategy: true,
            goalReachedRuns: 1,
            recoveredRiskRuns: 1,
            averageActionCount: 3,
            averageDurationMs: 2_000,
        });
    });

    it("returns null averages before a run is completed", () => {
        expect(getG0MechanicMetrics(makeState([]))).toMatchObject({
            completedRuns: 0,
            averageActionCount: null,
            averageDurationMs: null,
        });
    });
});
