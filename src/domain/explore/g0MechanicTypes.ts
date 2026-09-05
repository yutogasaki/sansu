export type G0MechanicPhase = "await-action" | "reacting" | "payoff";

export type G0TargetClass = "safe" | "wild" | "recovery" | "neutral";

export interface G0MechanicOutcome {
    id: string;
    title: string;
    detail: string;
    goalReached: boolean;
    riskTaken: boolean;
    riskRecovered: boolean;
    carryKey?: string;
    discoveryKey?: string;
}

export interface G0MechanicCompletedRun {
    actionIds: string[];
    durationMs: number;
    outcome: G0MechanicOutcome;
    strategySignature: string;
}

export interface G0MechanicRunBase {
    runOrdinal: number;
    runId: string;
    phase: G0MechanicPhase;
    actionCount: number;
    activeReactionId: string | null;
    acceptedClientActionIds: string[];
    startedAtMs: number | null;
    outcome: G0MechanicOutcome | null;
    completedRuns: G0MechanicCompletedRun[];
    replayStarts: number;
}

export interface G0MechanicTimedInput {
    clientActionId: string;
    atMs: number;
}

export const hasAcceptedG0Input = (
    state: Pick<G0MechanicRunBase, "acceptedClientActionIds">,
    clientActionId: string,
): boolean => state.acceptedClientActionIds.includes(clientActionId);

export const getG0RunDuration = (
    state: Pick<G0MechanicRunBase, "startedAtMs">,
    completedAtMs: number,
): number => Math.max(
    0,
    completedAtMs - (state.startedAtMs ?? completedAtMs),
);
