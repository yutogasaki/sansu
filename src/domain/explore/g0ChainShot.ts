import {
    getG0RunDuration,
    hasAcceptedG0Input,
    type G0MechanicCompletedRun,
    type G0MechanicOutcome,
    type G0MechanicRunBase,
    type G0MechanicTimedInput,
    type G0TargetClass,
} from "./g0MechanicTypes";

export const G0_CHAIN_SHOT_ID = "chain-shot" as const;
export const G0_CHAIN_MAX_ACTIONS = 4;

export const G0_CHAIN_GOAL = {
    id: "open-route-and-bank-carry",
    minActions: 2,
    routeProgress: 2,
    requiresBankedCarry: true,
    requiresStableWorld: true,
} as const;

export const G0_CHAIN_TARGET_IDS = [
    "safe-vein",
    "wild-pocket",
    "recovery-arc",
] as const;

export type G0ChainShotTargetId = typeof G0_CHAIN_TARGET_IDS[number];
export type G0ChainShotTargetClass = Exclude<G0TargetClass, "neutral">;
export type G0ChainShotCarryKey = "steady-trait" | "spring-trait";
export type G0ChainShotObservation =
    | "none"
    | "steady-seen"
    | "spring-seen"
    | "spring-confirmed";
export type G0ChainShotRiskState =
    | "none"
    | "entered"
    | "recovered"
    | "overextended";
export type G0ChainShotEnding =
    | "stable-route"
    | "spring-route"
    | "bright-detour";

export interface G0ChainShotTarget {
    id: G0ChainShotTargetId;
    targetClass: G0ChainShotTargetClass;
    cue: string;
    accessibleLabel: string;
    available: boolean;
    previewYield: number;
}

export interface G0ChainShotAcceptedAction {
    actionNumber: 1 | 2 | 3 | 4;
    targetId: G0ChainShotTargetId;
    targetClass: G0ChainShotTargetClass;
    clientActionId: string;
    acceptedAtMs: number;
    resolvedAtMs: number | null;
    yieldDelta: number;
}

export interface G0ChainShotPendingAction {
    targetId: G0ChainShotTargetId;
    targetClass: G0ChainShotTargetClass;
    clientActionId: string;
    reactionId: string;
}

export interface G0ChainShotOutcome extends G0MechanicOutcome {
    ending: G0ChainShotEnding;
    actionCount: number;
    finalYield: number;
}

export interface G0ChainShotCompletedRun extends G0MechanicCompletedRun {
    targetIds: G0ChainShotTargetId[];
    actionClasses: G0ChainShotTargetClass[];
    incomingCarryKey: G0ChainShotCarryKey | null;
    outgoingCarryKey: G0ChainShotCarryKey | null;
    finalYield: number;
    outcome: G0ChainShotOutcome;
}

export interface G0ChainShotState extends Omit<
    G0MechanicRunBase,
    "outcome" | "completedRuns"
> {
    mechanicId: typeof G0_CHAIN_SHOT_ID;
    sessionSeed: string;
    routeProgress: 0 | 1 | 2;
    observation: G0ChainShotObservation;
    bankedCarryKey: G0ChainShotCarryKey | null;
    equippedCarryKey: G0ChainShotCarryKey | null;
    instability: 0 | 1 | 2 | 3;
    riskState: G0ChainShotRiskState;
    yieldCount: number;
    history: G0ChainShotAcceptedAction[];
    pendingAction: G0ChainShotPendingAction | null;
    outcome: G0ChainShotOutcome | null;
    completedRuns: G0ChainShotCompletedRun[];
}

export type G0ChainShotEvent =
    | ({
        type: "WORLD_TARGET_TAPPED";
        targetId: G0ChainShotTargetId;
    } & G0MechanicTimedInput)
    | ({
        type: "REACTION_FINISHED";
        reactionId: string;
    } & Pick<G0MechanicTimedInput, "atMs">)
    | {
        type: "REPLAY";
    };

const TARGET_CATALOG: Record<
    G0ChainShotTargetId,
    Omit<G0ChainShotTarget, "available" | "previewYield">
> = {
    "safe-vein": {
        id: "safe-vein",
        targetClass: "safe",
        cue: "しずかな ひび",
        accessibleLabel: "しずかなひびをねらう",
    },
    "wild-pocket": {
        id: "wild-pocket",
        targetClass: "wild",
        cue: "コトコトする 土",
        accessibleLabel: "中で何かがコトコトする土をねらう",
    },
    "recovery-arc": {
        id: "recovery-arc",
        targetClass: "recovery",
        cue: "ぐるっと つなぐ",
        accessibleLabel: "跳ねたひびを受けとめて横道へつなぐ",
    },
};

const isCarryKey = (
    value: string | undefined,
): value is G0ChainShotCarryKey => (
    value === "steady-trait" || value === "spring-trait"
);

const getRunId = (runOrdinal: number): string => (
    `chain-shot:run-${runOrdinal}`
);

const createRunState = ({
    sessionSeed,
    runOrdinal,
    equippedCarryKey,
    completedRuns,
    replayStarts,
}: {
    sessionSeed: string;
    runOrdinal: number;
    equippedCarryKey: G0ChainShotCarryKey | null;
    completedRuns: G0ChainShotCompletedRun[];
    replayStarts: number;
}): G0ChainShotState => ({
    mechanicId: G0_CHAIN_SHOT_ID,
    sessionSeed,
    runOrdinal,
    runId: getRunId(runOrdinal),
    phase: "await-action",
    actionCount: 0,
    activeReactionId: null,
    acceptedClientActionIds: [],
    startedAtMs: null,
    routeProgress: 0,
    observation: "none",
    bankedCarryKey: null,
    equippedCarryKey,
    instability: 0,
    riskState: "none",
    yieldCount: 0,
    history: [],
    pendingAction: null,
    outcome: null,
    completedRuns,
    replayStarts,
});

export const createG0ChainShotState = (
    sessionSeed = "g0-chain-shot-v1",
): G0ChainShotState => createRunState({
    sessionSeed,
    runOrdinal: 0,
    equippedCarryKey: null,
    completedRuns: [],
    replayStarts: 0,
});

const getCarryYieldBonus = (
    carryKey: G0ChainShotCarryKey | null,
    targetClass: G0ChainShotTargetClass,
): number => {
    if (
        carryKey === "steady-trait"
        && (targetClass === "safe" || targetClass === "recovery")
    ) {
        return 1;
    }
    if (carryKey === "spring-trait" && targetClass === "wild") {
        return 1;
    }
    return 0;
};

const getBaseYield = (
    targetClass: G0ChainShotTargetClass,
): number => targetClass === "wild" ? 2 : 1;

const getTargetYield = (
    state: G0ChainShotState,
    targetClass: G0ChainShotTargetClass,
): number => (
    getBaseYield(targetClass)
    + getCarryYieldBonus(state.equippedCarryKey, targetClass)
);

const isTargetAvailable = (
    state: G0ChainShotState,
    targetClass: G0ChainShotTargetClass,
): boolean => {
    if (
        state.phase !== "await-action"
        || state.actionCount >= G0_CHAIN_MAX_ACTIONS
    ) {
        return false;
    }

    if (targetClass === "safe") {
        return state.instability === 0;
    }
    if (targetClass === "recovery") {
        return state.instability > 0;
    }
    return true;
};

export const getG0ChainShotTargets = (
    state: G0ChainShotState,
): G0ChainShotTarget[] => G0_CHAIN_TARGET_IDS.map((targetId) => {
    const target = TARGET_CATALOG[targetId];
    return {
        ...target,
        available: isTargetAvailable(state, target.targetClass),
        previewYield: getTargetYield(state, target.targetClass),
    };
});

const incrementRoute = (
    routeProgress: G0ChainShotState["routeProgress"],
): G0ChainShotState["routeProgress"] => (
    Math.min(G0_CHAIN_GOAL.routeProgress, routeProgress + 1) as
        G0ChainShotState["routeProgress"]
);

const incrementInstability = (
    instability: G0ChainShotState["instability"],
): G0ChainShotState["instability"] => (
    Math.min(3, instability + 1) as G0ChainShotState["instability"]
);

const getDiscoveryKey = (
    observation: G0ChainShotObservation,
): string | undefined => {
    if (observation === "steady-seen") return "steady-seam";
    if (observation === "spring-seen") return "spring-pocket";
    if (observation === "spring-confirmed") return "deep-spring";
    return undefined;
};

const applyTargetEffect = (
    state: G0ChainShotState,
    pending: G0ChainShotPendingAction,
): G0ChainShotState => {
    const routeProgress = incrementRoute(state.routeProgress);
    const yieldDelta = getTargetYield(state, pending.targetClass);
    const history = state.history.map((action) => (
        action.clientActionId === pending.clientActionId
            ? { ...action, yieldDelta }
            : action
    ));

    if (pending.targetClass === "safe") {
        return {
            ...state,
            routeProgress,
            observation: state.observation === "none"
                ? "steady-seen"
                : state.observation,
            bankedCarryKey: routeProgress >= G0_CHAIN_GOAL.routeProgress
                ? "steady-trait"
                : state.bankedCarryKey,
            yieldCount: state.yieldCount + yieldDelta,
            history,
        };
    }

    if (pending.targetClass === "recovery") {
        return {
            ...state,
            routeProgress,
            bankedCarryKey: "spring-trait",
            instability: 0,
            riskState: "recovered",
            yieldCount: state.yieldCount + yieldDelta,
            history,
        };
    }

    return {
        ...state,
        routeProgress,
        observation: state.observation === "spring-seen"
            || state.observation === "spring-confirmed"
            ? "spring-confirmed"
            : "spring-seen",
        instability: incrementInstability(state.instability),
        riskState: "entered",
        yieldCount: state.yieldCount + yieldDelta,
        history,
    };
};

const hasReachedGoal = (state: G0ChainShotState): boolean => (
    state.actionCount >= G0_CHAIN_GOAL.minActions
    && state.routeProgress >= G0_CHAIN_GOAL.routeProgress
    && state.bankedCarryKey !== null
    && state.instability === 0
);

const buildOutcome = (
    state: G0ChainShotState,
    forcedDetour: boolean,
): G0ChainShotOutcome => {
    const riskTaken = state.history.some(
        (action) => action.targetClass === "wild",
    );
    const discoveryKey = getDiscoveryKey(state.observation);

    if (forcedDetour) {
        return {
            id: "bright-detour",
            ending: "bright-detour",
            title: "横道へ ころん！",
            detail: "連鎖は明るい横道へ着地。見つけたことは記録に残った。",
            goalReached: false,
            riskTaken,
            riskRecovered: false,
            discoveryKey,
            actionCount: state.actionCount,
            finalYield: state.yieldCount,
        };
    }

    const springCarry = state.bankedCarryKey === "spring-trait";
    return {
        id: springCarry ? "spring-route" : "stable-route",
        ending: springCarry ? "spring-route" : "stable-route",
        title: springCarry
            ? "はねた先も つながった！"
            : "まっすぐ つながった！",
        detail: springCarry
            ? "コトコトの連鎖を受けとめ、横道のクセを持ち帰れた。"
            : "しずかなひびが道になり、見つけたクセを持ち帰れた。",
        goalReached: true,
        riskTaken,
        riskRecovered: state.riskState === "recovered",
        carryKey: state.bankedCarryKey ?? undefined,
        discoveryKey,
        actionCount: state.actionCount,
        finalYield: state.yieldCount,
    };
};

const completeRun = (
    state: G0ChainShotState,
    atMs: number,
    forcedDetour: boolean,
): G0ChainShotState => {
    const settledState: G0ChainShotState = forcedDetour
        ? {
            ...state,
            bankedCarryKey: null,
            riskState: "overextended",
        }
        : state;
    const outcome = buildOutcome(settledState, forcedDetour);
    const targetIds = settledState.history.map((action) => action.targetId);
    const actionClasses = settledState.history.map(
        (action) => action.targetClass,
    );
    const strategySignature = [
        actionClasses.join(">"),
        `incoming:${settledState.equippedCarryKey ?? "none"}`,
        `outgoing:${settledState.bankedCarryKey ?? "none"}`,
        `yield:${settledState.yieldCount}`,
    ].join("|");

    return {
        ...settledState,
        phase: "payoff",
        activeReactionId: null,
        pendingAction: null,
        outcome,
        completedRuns: [
            ...settledState.completedRuns,
            {
                actionIds: targetIds,
                targetIds,
                actionClasses,
                durationMs: getG0RunDuration(settledState, atMs),
                incomingCarryKey: settledState.equippedCarryKey,
                outgoingCarryKey: settledState.bankedCarryKey,
                finalYield: settledState.yieldCount,
                outcome,
                strategySignature,
            },
        ],
    };
};

const acceptTarget = (
    state: G0ChainShotState,
    event: Extract<G0ChainShotEvent, { type: "WORLD_TARGET_TAPPED" }>,
    target: G0ChainShotTarget,
): G0ChainShotState => {
    const actionNumber = (state.actionCount + 1) as 1 | 2 | 3 | 4;
    const reactionId = `${state.runId}:reaction-${actionNumber}`;
    const pendingAction: G0ChainShotPendingAction = {
        targetId: target.id,
        targetClass: target.targetClass,
        clientActionId: event.clientActionId,
        reactionId,
    };

    return {
        ...state,
        phase: "reacting",
        actionCount: actionNumber,
        activeReactionId: reactionId,
        acceptedClientActionIds: [
            ...state.acceptedClientActionIds,
            event.clientActionId,
        ],
        startedAtMs: state.startedAtMs ?? event.atMs,
        history: [
            ...state.history,
            {
                actionNumber,
                targetId: target.id,
                targetClass: target.targetClass,
                clientActionId: event.clientActionId,
                acceptedAtMs: event.atMs,
                resolvedAtMs: null,
                yieldDelta: 0,
            },
        ],
        pendingAction,
    };
};

export const reduceG0ChainShotState = (
    state: G0ChainShotState,
    event: G0ChainShotEvent,
): G0ChainShotState => {
    switch (event.type) {
        case "WORLD_TARGET_TAPPED": {
            if (
                state.phase !== "await-action"
                || hasAcceptedG0Input(state, event.clientActionId)
            ) {
                return state;
            }

            const target = getG0ChainShotTargets(state).find(
                (candidate) => (
                    candidate.id === event.targetId && candidate.available
                ),
            );
            if (!target) return state;

            return acceptTarget(state, event, target);
        }
        case "REACTION_FINISHED": {
            if (
                state.phase !== "reacting"
                || state.activeReactionId !== event.reactionId
                || state.pendingAction?.reactionId !== event.reactionId
            ) {
                return state;
            }

            const pending = state.pendingAction;
            const resolvedHistory = state.history.map((action) => (
                action.clientActionId === pending.clientActionId
                    ? { ...action, resolvedAtMs: event.atMs }
                    : action
            ));
            const reacted = applyTargetEffect(
                {
                    ...state,
                    history: resolvedHistory,
                },
                pending,
            );
            const readyState: G0ChainShotState = {
                ...reacted,
                phase: "await-action",
                activeReactionId: null,
                pendingAction: null,
            };

            if (hasReachedGoal(readyState)) {
                return completeRun(readyState, event.atMs, false);
            }
            if (readyState.actionCount >= G0_CHAIN_MAX_ACTIONS) {
                return completeRun(readyState, event.atMs, true);
            }
            return readyState;
        }
        case "REPLAY": {
            if (state.phase !== "payoff" || !state.outcome) {
                return state;
            }

            const outgoingCarry = isCarryKey(state.outcome.carryKey)
                ? state.outcome.carryKey
                : state.equippedCarryKey;
            return createRunState({
                sessionSeed: state.sessionSeed,
                runOrdinal: state.runOrdinal + 1,
                equippedCarryKey: outgoingCarry,
                completedRuns: state.completedRuns,
                replayStarts: state.replayStarts + 1,
            });
        }
    }
};
