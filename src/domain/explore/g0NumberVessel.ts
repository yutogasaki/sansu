import {
    getG0RunDuration,
    hasAcceptedG0Input,
    type G0MechanicCompletedRun,
    type G0MechanicOutcome,
    type G0MechanicRunBase,
    type G0MechanicTimedInput,
} from "./g0MechanicTypes";

export const G0_NUMBER_VESSEL_ID = "number-vessel" as const;
export const G0_NUMBER_VESSEL_CAPACITY = 6;
export const G0_NUMBER_VESSEL_MIN_ACTIONS = 2;
export const G0_NUMBER_VESSEL_MAX_ACTIONS = 4;
export const G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY = "1+4=5";

export const G0_NUMBER_VESSEL_INITIAL_AMOUNTS = [2, 2, 3, 4] as const;
export const G0_NUMBER_VESSEL_PREVIEW_AMOUNTS = [1, 3, 2, 1] as const;

export type G0NumberVesselTokenOrigin =
    | "initial"
    | "preview"
    | "compose"
    | "split";

export interface G0NumberVesselToken {
    id: string;
    amount: number;
    origin: G0NumberVesselTokenOrigin;
}

export type G0NumberVesselOperationKind = "compose" | "split";

export interface G0NumberVesselOperation {
    id: string;
    actionNumber: 1 | 2 | 3 | 4;
    kind: G0NumberVesselOperationKind;
    sourceTokenIds: string[];
    resultTokenIds: string[];
    sourceAmounts: number[];
    resultAmounts: number[];
    recipeKey: string;
    clientActionId: string;
    acceptedAtMs: number;
    recovery: boolean;
}

export type G0NumberVesselEndReason =
    | "signature-recipe"
    | "overflow"
    | "max-actions";

export interface G0NumberVesselState extends G0MechanicRunBase {
    mechanicId: typeof G0_NUMBER_VESSEL_ID;
    sessionSeed: string;
    tokens: G0NumberVesselToken[];
    selectedTokenId: string | null;
    previewQueue: number[];
    previewIndex: number;
    pendingOperation: G0NumberVesselOperation | null;
    operationHistory: G0NumberVesselOperation[];
    discoveredRecipeKeys: string[];
    runRecipeKeys: string[];
    overflowRecoveryAvailable: boolean;
    overflowRecoveryPending: boolean;
    overflowEntered: boolean;
    recoverySucceeded: boolean;
    endReason: G0NumberVesselEndReason | null;
}

export type G0NumberVesselEvent =
    | ({
        type: "TOKEN_TAPPED";
        tokenId: string;
    } & G0MechanicTimedInput)
    | ({
        type: "SPLIT_SELECTED";
    } & G0MechanicTimedInput)
    | {
        type: "REACTION_FINISHED";
        reactionId: string;
        atMs: number;
    }
    | {
        type: "REPLAY";
    };

const getRunId = (runOrdinal: number): string => (
    `${G0_NUMBER_VESSEL_ID}:run-${runOrdinal}`
);

const createInitialTokens = (
    runId: string,
): G0NumberVesselToken[] => G0_NUMBER_VESSEL_INITIAL_AMOUNTS.map(
    (amount, index) => ({
        id: `${runId}:initial-${index + 1}`,
        amount,
        origin: "initial",
    }),
);

export const createG0NumberVesselState = (
    sessionSeed = "g0-number-vessel-v1",
    runOrdinal = 0,
): G0NumberVesselState => {
    const runId = getRunId(runOrdinal);

    return {
        mechanicId: G0_NUMBER_VESSEL_ID,
        sessionSeed,
        runOrdinal,
        runId,
        phase: "await-action",
        actionCount: 0,
        activeReactionId: null,
        acceptedClientActionIds: [],
        startedAtMs: null,
        outcome: null,
        completedRuns: [],
        replayStarts: 0,
        tokens: createInitialTokens(runId),
        selectedTokenId: null,
        previewQueue: [...G0_NUMBER_VESSEL_PREVIEW_AMOUNTS],
        previewIndex: 0,
        pendingOperation: null,
        operationHistory: [],
        discoveredRecipeKeys: [],
        runRecipeKeys: [],
        overflowRecoveryAvailable: true,
        overflowRecoveryPending: false,
        overflowEntered: false,
        recoverySucceeded: false,
        endReason: null,
    };
};

export const getG0NumberVesselRecipeKey = (
    firstAmount: number,
    secondAmount: number,
): string => {
    const lower = Math.min(firstAmount, secondAmount);
    const higher = Math.max(firstAmount, secondAmount);
    return `${lower}+${higher}=${lower + higher}`;
};

export const getG0NumberVesselNextPreviewAmount = (
    state: Pick<G0NumberVesselState, "previewIndex" | "previewQueue">,
): number | null => state.previewQueue[state.previewIndex] ?? null;

const appendUnique = (
    values: readonly string[],
    value: string,
): string[] => values.includes(value)
    ? [...values]
    : [...values, value];

const acceptTimedInput = (
    state: G0NumberVesselState,
    input: G0MechanicTimedInput,
): Pick<
    G0NumberVesselState,
    "acceptedClientActionIds" | "startedAtMs"
> => ({
    acceptedClientActionIds: [
        ...state.acceptedClientActionIds,
        input.clientActionId,
    ],
    startedAtMs: state.startedAtMs ?? input.atMs,
});

const getToken = (
    state: G0NumberVesselState,
    tokenId: string,
): G0NumberVesselToken | undefined => state.tokens.find(
    (token) => token.id === tokenId,
);

const getActionNumber = (
    state: G0NumberVesselState,
): G0NumberVesselOperation["actionNumber"] => (
    state.actionCount + 1
) as G0NumberVesselOperation["actionNumber"];

const getReactionId = (
    state: G0NumberVesselState,
    actionNumber: G0NumberVesselOperation["actionNumber"],
): string => `${state.runId}:reaction-${actionNumber}`;

const commitCompose = (
    state: G0NumberVesselState,
    source: G0NumberVesselToken,
    target: G0NumberVesselToken,
    input: G0MechanicTimedInput,
): G0NumberVesselState => {
    const actionNumber = getActionNumber(state);
    const reactionId = getReactionId(state, actionNumber);
    const resultId = `${state.runId}:compose-${actionNumber}`;
    const operation: G0NumberVesselOperation = {
        id: reactionId,
        actionNumber,
        kind: "compose",
        sourceTokenIds: [source.id, target.id],
        resultTokenIds: [resultId],
        sourceAmounts: [source.amount, target.amount],
        resultAmounts: [source.amount + target.amount],
        recipeKey: getG0NumberVesselRecipeKey(source.amount, target.amount),
        clientActionId: input.clientActionId,
        acceptedAtMs: input.atMs,
        recovery: state.overflowRecoveryPending,
    };
    const removedIds = new Set(operation.sourceTokenIds);

    return {
        ...state,
        ...acceptTimedInput(state, input),
        phase: "reacting",
        actionCount: actionNumber,
        activeReactionId: reactionId,
        tokens: [
            ...state.tokens.filter((token) => !removedIds.has(token.id)),
            {
                id: resultId,
                amount: source.amount + target.amount,
                origin: "compose",
            },
        ],
        selectedTokenId: null,
        pendingOperation: operation,
        overflowRecoveryAvailable: state.overflowRecoveryPending
            ? false
            : state.overflowRecoveryAvailable,
        overflowRecoveryPending: false,
    };
};

const commitSplit = (
    state: G0NumberVesselState,
    source: G0NumberVesselToken,
    input: G0MechanicTimedInput,
): G0NumberVesselState => {
    const actionNumber = getActionNumber(state);
    const reactionId = getReactionId(state, actionNumber);
    const lowerAmount = Math.floor(source.amount / 2);
    const higherAmount = source.amount - lowerAmount;
    const lowerId = `${state.runId}:split-${actionNumber}-a`;
    const higherId = `${state.runId}:split-${actionNumber}-b`;
    const operation: G0NumberVesselOperation = {
        id: reactionId,
        actionNumber,
        kind: "split",
        sourceTokenIds: [source.id],
        resultTokenIds: [lowerId, higherId],
        sourceAmounts: [source.amount],
        resultAmounts: [lowerAmount, higherAmount],
        recipeKey: getG0NumberVesselRecipeKey(lowerAmount, higherAmount),
        clientActionId: input.clientActionId,
        acceptedAtMs: input.atMs,
        recovery: false,
    };

    return {
        ...state,
        ...acceptTimedInput(state, input),
        phase: "reacting",
        actionCount: actionNumber,
        activeReactionId: reactionId,
        tokens: [
            ...state.tokens.filter((token) => token.id !== source.id),
            {
                id: lowerId,
                amount: lowerAmount,
                origin: "split",
            },
            {
                id: higherId,
                amount: higherAmount,
                origin: "split",
            },
        ],
        selectedTokenId: null,
        pendingOperation: operation,
    };
};

const getStrategySignature = (
    operations: readonly G0NumberVesselOperation[],
): string => operations.map((operation) => {
    const source = [...operation.sourceAmounts]
        .sort((first, second) => first - second)
        .join("+");
    const result = operation.resultAmounts.join("+");
    const recovery = operation.recovery ? "recovery:" : "";
    return `${recovery}${operation.kind}:${source}>${result}`;
}).join("|");

const getOperationSemanticKey = (
    operation: G0NumberVesselOperation,
): string => {
    if (operation.kind === "split") {
        return `split:${operation.sourceAmounts[0]}`;
    }

    const operands = [...operation.sourceAmounts]
        .sort((first, second) => first - second)
        .join("+");
    return `compose:${operands}`;
};

const getOutcome = (
    state: G0NumberVesselState,
    endReason: G0NumberVesselEndReason,
): G0MechanicOutcome => {
    const latestRecipe = state.runRecipeKeys[
        state.runRecipeKeys.length - 1
    ];

    if (endReason === "signature-recipe") {
        return {
            id: "number-vessel-signature-recipe",
            title: "ひみつの組み合わせを見つけた",
            detail: "一つと四つが合わさり、五つのまとまりになった。",
            goalReached: true,
            riskTaken: state.overflowEntered,
            riskRecovered: state.recoverySucceeded,
            carryKey: G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
            discoveryKey: G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
        };
    }

    if (endReason === "overflow") {
        return {
            id: "number-vessel-overflow",
            title: "うつわから、そっとこぼれた",
            detail: "見つけた組み合わせを残して、この実験を終えた。",
            goalReached: false,
            riskTaken: true,
            riskRecovered: false,
            discoveryKey: latestRecipe,
        };
    }

    return {
        id: state.recoverySucceeded
            ? "number-vessel-recovered"
            : "number-vessel-four-actions",
        title: state.recoverySucceeded
            ? "いっぱいから戻せた"
            : "四つの変化を試した",
        detail: state.recoverySucceeded
            ? "合体で場所を空け、見つけた組み合わせを守った。"
            : "見つけた組み合わせを残して、この実験を終えた。",
        goalReached: false,
        riskTaken: state.overflowEntered,
        riskRecovered: state.recoverySucceeded,
        discoveryKey: latestRecipe,
    };
};

const completeRun = (
    state: G0NumberVesselState,
    endReason: G0NumberVesselEndReason,
    completedAtMs: number,
): G0NumberVesselState => {
    const outcome = getOutcome(state, endReason);
    const completedRun: G0MechanicCompletedRun = {
        actionIds: state.operationHistory.map(
            getOperationSemanticKey,
        ),
        durationMs: getG0RunDuration(state, completedAtMs),
        outcome,
        strategySignature: getStrategySignature(state.operationHistory),
    };

    return {
        ...state,
        phase: "payoff",
        activeReactionId: null,
        selectedTokenId: null,
        pendingOperation: null,
        overflowRecoveryPending: false,
        outcome,
        completedRuns: [...state.completedRuns, completedRun],
        endReason,
    };
};

const settleReaction = (
    state: G0NumberVesselState,
    atMs: number,
): G0NumberVesselState => {
    const operation = state.pendingOperation;
    if (!operation) return state;

    const previewAmount = (
        operation.kind === "compose" && !operation.recovery
            ? getG0NumberVesselNextPreviewAmount(state)
            : null
    );
    const previewToken: G0NumberVesselToken | null = previewAmount === null
        ? null
        : {
            id: `${state.runId}:preview-${state.previewIndex + 1}`,
            amount: previewAmount,
            origin: "preview",
        };
    const tokens = previewToken
        ? [...state.tokens, previewToken]
        : state.tokens;
    const previewIndex = previewToken
        ? state.previewIndex + 1
        : state.previewIndex;
    const discoveredRecipeKeys = appendUnique(
        state.discoveredRecipeKeys,
        operation.recipeKey,
    );
    const runRecipeKeys = appendUnique(
        state.runRecipeKeys,
        operation.recipeKey,
    );
    const operationHistory = [...state.operationHistory, operation];
    const recoverySucceeded = (
        state.recoverySucceeded
        || (operation.recovery && tokens.length <= G0_NUMBER_VESSEL_CAPACITY)
    );
    const settledState: G0NumberVesselState = {
        ...state,
        phase: "await-action",
        activeReactionId: null,
        tokens,
        previewIndex,
        pendingOperation: null,
        operationHistory,
        discoveredRecipeKeys,
        runRecipeKeys,
        recoverySucceeded,
    };
    const overflowed = tokens.length > G0_NUMBER_VESSEL_CAPACITY;

    if (overflowed) {
        const overflowState: G0NumberVesselState = {
            ...settledState,
            overflowEntered: true,
        };
        if (
            overflowState.overflowRecoveryAvailable
            && overflowState.actionCount < G0_NUMBER_VESSEL_MAX_ACTIONS
        ) {
            return {
                ...overflowState,
                overflowRecoveryPending: true,
            };
        }
        return completeRun(overflowState, "overflow", atMs);
    }

    if (
        settledState.actionCount >= G0_NUMBER_VESSEL_MIN_ACTIONS
        && settledState.runRecipeKeys.includes(
            G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
        )
    ) {
        return completeRun(settledState, "signature-recipe", atMs);
    }

    if (settledState.actionCount >= G0_NUMBER_VESSEL_MAX_ACTIONS) {
        return completeRun(settledState, "max-actions", atMs);
    }

    return settledState;
};

export const reduceG0NumberVesselState = (
    state: G0NumberVesselState,
    event: G0NumberVesselEvent,
): G0NumberVesselState => {
    switch (event.type) {
        case "TOKEN_TAPPED": {
            if (
                state.phase !== "await-action"
                || hasAcceptedG0Input(state, event.clientActionId)
            ) {
                return state;
            }

            const tappedToken = getToken(state, event.tokenId);
            if (!tappedToken) return state;

            if (state.selectedTokenId === null) {
                return {
                    ...state,
                    ...acceptTimedInput(state, event),
                    selectedTokenId: tappedToken.id,
                };
            }

            if (state.selectedTokenId === tappedToken.id) {
                return {
                    ...state,
                    ...acceptTimedInput(state, event),
                    selectedTokenId: null,
                };
            }

            const selectedToken = getToken(state, state.selectedTokenId);
            if (!selectedToken) {
                return {
                    ...state,
                    ...acceptTimedInput(state, event),
                    selectedTokenId: tappedToken.id,
                };
            }

            return commitCompose(state, selectedToken, tappedToken, event);
        }
        case "SPLIT_SELECTED": {
            if (
                state.phase !== "await-action"
                || state.overflowRecoveryPending
                || state.selectedTokenId === null
                || hasAcceptedG0Input(state, event.clientActionId)
            ) {
                return state;
            }

            const selectedToken = getToken(state, state.selectedTokenId);
            if (!selectedToken || selectedToken.amount < 2) return state;

            return commitSplit(state, selectedToken, event);
        }
        case "REACTION_FINISHED":
            if (
                state.phase !== "reacting"
                || state.activeReactionId !== event.reactionId
            ) {
                return state;
            }
            return settleReaction(state, event.atMs);
        case "REPLAY": {
            if (state.phase !== "payoff") return state;

            const fresh = createG0NumberVesselState(
                state.sessionSeed,
                state.runOrdinal + 1,
            );
            return {
                ...fresh,
                discoveredRecipeKeys: [...state.discoveredRecipeKeys],
                completedRuns: [...state.completedRuns],
                replayStarts: state.replayStarts + 1,
            };
        }
    }
};
