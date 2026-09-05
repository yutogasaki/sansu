import type { G0MechanicRunBase } from "./g0MechanicTypes";

export interface G0MechanicMetrics {
    completedRuns: number;
    replayStarts: number;
    triedDifferentFirstActions: boolean;
    changedStrategy: boolean;
    goalReachedRuns: number;
    recoveredRiskRuns: number;
    averageActionCount: number | null;
    averageDurationMs: number | null;
}

export const getG0MechanicMetrics = (
    state: G0MechanicRunBase,
): G0MechanicMetrics => {
    const firstActions = new Set(
        state.completedRuns
            .map((run) => run.actionIds[0])
            .filter((actionId): actionId is string => Boolean(actionId)),
    );
    const strategies = new Set(
        state.completedRuns.map((run) => run.strategySignature),
    );
    const totals = state.completedRuns.reduce(
        (current, run) => ({
            durationMs: current.durationMs + run.durationMs,
            actionCount: current.actionCount + run.actionIds.length,
            goalReached: current.goalReached + (run.outcome.goalReached ? 1 : 0),
            recoveredRisk: current.recoveredRisk + (
                run.outcome.riskRecovered ? 1 : 0
            ),
        }),
        {
            durationMs: 0,
            actionCount: 0,
            goalReached: 0,
            recoveredRisk: 0,
        },
    );
    const completedRuns = state.completedRuns.length;

    return {
        completedRuns,
        replayStarts: state.replayStarts,
        triedDifferentFirstActions: firstActions.size >= 2,
        changedStrategy: strategies.size >= 2,
        goalReachedRuns: totals.goalReached,
        recoveredRiskRuns: totals.recoveredRisk,
        averageActionCount: completedRuns > 0
            ? totals.actionCount / completedRuns
            : null,
        averageDurationMs: completedRuns > 0
            ? totals.durationMs / completedRuns
            : null,
    };
};
