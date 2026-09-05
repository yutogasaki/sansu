import { describe, expect, it, vi } from "vitest";
import {
    G0_NUMBER_VESSEL_CAPACITY,
    G0_NUMBER_VESSEL_ID,
    G0_NUMBER_VESSEL_INITIAL_AMOUNTS,
    G0_NUMBER_VESSEL_MAX_ACTIONS,
    G0_NUMBER_VESSEL_MIN_ACTIONS,
    G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
    createG0NumberVesselState,
    getG0NumberVesselNextPreviewAmount,
    getG0NumberVesselRecipeKey,
    reduceG0NumberVesselState,
    type G0NumberVesselState,
    type G0NumberVesselToken,
} from "../g0NumberVessel";

const getToken = (
    state: G0NumberVesselState,
    predicate: (token: G0NumberVesselToken) => boolean,
): G0NumberVesselToken => {
    const token = state.tokens.find(predicate);
    if (!token) throw new Error("Expected a matching number-vessel token");
    return token;
};

const getTokenByAmount = (
    state: G0NumberVesselState,
    amount: number,
    excludedIds: readonly string[] = [],
): G0NumberVesselToken => getToken(
    state,
    (token) => token.amount === amount && !excludedIds.includes(token.id),
);

const tapToken = (
    state: G0NumberVesselState,
    tokenId: string,
    clientActionId: string,
    atMs: number,
): G0NumberVesselState => reduceG0NumberVesselState(state, {
    type: "TOKEN_TAPPED",
    tokenId,
    clientActionId,
    atMs,
});

const finishReaction = (
    state: G0NumberVesselState,
    atMs: number,
): G0NumberVesselState => {
    const reactionId = state.activeReactionId;
    if (!reactionId) throw new Error("Expected an active vessel reaction");
    return reduceG0NumberVesselState(state, {
        type: "REACTION_FINISHED",
        reactionId,
        atMs,
    });
};

const composeTokens = (
    state: G0NumberVesselState,
    sourceId: string,
    targetId: string,
    actionKey: string,
    atMs: number,
): G0NumberVesselState => {
    let next = tapToken(
        state,
        sourceId,
        `${actionKey}:source`,
        atMs,
    );
    next = tapToken(
        next,
        targetId,
        `${actionKey}:target`,
        atMs + 1,
    );
    return finishReaction(next, atMs + 10);
};

const splitToken = (
    state: G0NumberVesselState,
    tokenId: string,
    actionKey: string,
    atMs: number,
): G0NumberVesselState => {
    let next = tapToken(
        state,
        tokenId,
        `${actionKey}:source`,
        atMs,
    );
    next = reduceG0NumberVesselState(next, {
        type: "SPLIT_SELECTED",
        clientActionId: `${actionKey}:split`,
        atMs: atMs + 1,
    });
    return finishReaction(next, atMs + 10);
};

describe("G0 number vessel", () => {
    it("starts with deterministic quantity clusters and a visible preview", () => {
        const state = createG0NumberVesselState("initial-seed");

        expect(state).toMatchObject({
            mechanicId: G0_NUMBER_VESSEL_ID,
            runId: "number-vessel:run-0",
            phase: "await-action",
            actionCount: 0,
            selectedTokenId: null,
            overflowRecoveryAvailable: true,
            overflowRecoveryPending: false,
        });
        expect(state.tokens.map((token) => token.amount)).toEqual(
            G0_NUMBER_VESSEL_INITIAL_AMOUNTS,
        );
        expect(state.tokens).toHaveLength(4);
        expect(getG0NumberVesselNextPreviewAmount(state)).toBe(1);
        expect(G0_NUMBER_VESSEL_CAPACITY).toBe(6);
        expect(G0_NUMBER_VESSEL_MIN_ACTIONS).toBe(2);
        expect(G0_NUMBER_VESSEL_MAX_ACTIONS).toBe(4);
    });

    it("selects one token, composes with another, then adds one preview", () => {
        let state = createG0NumberVesselState("compose-seed");
        const first = getTokenByAmount(state, 2);
        const second = getTokenByAmount(state, 2, [first.id]);
        const quantityBefore = state.tokens.reduce(
            (sum, token) => sum + token.amount,
            0,
        );

        state = tapToken(state, first.id, "compose:source", 100);
        expect(state).toMatchObject({
            phase: "await-action",
            actionCount: 0,
            selectedTokenId: first.id,
            startedAtMs: 100,
        });

        state = tapToken(state, second.id, "compose:target", 110);
        expect(state).toMatchObject({
            phase: "reacting",
            actionCount: 1,
            selectedTokenId: null,
            activeReactionId: "number-vessel:run-0:reaction-1",
        });
        expect(state.pendingOperation).toMatchObject({
            kind: "compose",
            sourceAmounts: [2, 2],
            resultAmounts: [4],
            recovery: false,
        });
        expect(state.tokens.reduce(
            (sum, token) => sum + token.amount,
            0,
        )).toBe(quantityBefore);

        const duringReaction = tapToken(
            state,
            state.tokens[0].id,
            "compose:too-soon",
            111,
        );
        expect(duringReaction).toBe(state);

        state = finishReaction(state, 120);
        expect(state).toMatchObject({
            phase: "await-action",
            actionCount: 1,
            previewIndex: 1,
        });
        expect(state.tokens).toHaveLength(4);
        expect(state.tokens.reduce(
            (sum, token) => sum + token.amount,
            0,
        )).toBe(quantityBefore + 1);
        expect(state.discoveredRecipeKeys).toEqual(["2+2=4"]);
        expect(state.operationHistory).toHaveLength(1);
        expect(getG0NumberVesselNextPreviewAmount(state)).toBe(3);
    });

    it("splits the selected token without consuming a preview", () => {
        let state = createG0NumberVesselState("split-seed");
        const source = getTokenByAmount(state, 3);
        const quantityBefore = state.tokens.reduce(
            (sum, token) => sum + token.amount,
            0,
        );

        state = splitToken(state, source.id, "split-one", 100);

        expect(state).toMatchObject({
            phase: "await-action",
            actionCount: 1,
            previewIndex: 0,
        });
        expect(state.tokens).toHaveLength(5);
        expect(state.tokens.reduce(
            (sum, token) => sum + token.amount,
            0,
        )).toBe(quantityBefore);
        expect(state.tokens.filter(
            (token) => token.origin === "split",
        ).map((token) => token.amount)).toEqual([1, 2]);
        expect(state.discoveredRecipeKeys).toEqual(["1+2=3"]);
        expect(getG0NumberVesselNextPreviewAmount(state)).toBe(1);
    });

    it("uses one canonical recipe for compose and inverse split", () => {
        expect(getG0NumberVesselRecipeKey(4, 1)).toBe(
            G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
        );
        expect(getG0NumberVesselRecipeKey(1, 4)).toBe(
            G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
        );

        let state = createG0NumberVesselState("inverse-seed");
        const four = getTokenByAmount(state, 4);
        state = splitToken(state, four.id, "inverse-split", 100);
        const splitTwo = getToken(
            state,
            (token) => token.origin === "split" && token.amount === 2,
        );
        const otherTwo = getTokenByAmount(state, 2, [splitTwo.id]);
        state = composeTokens(
            state,
            splitTwo.id,
            otherTwo.id,
            "inverse-compose",
            200,
        );

        expect(state.runRecipeKeys).toEqual(["2+2=4"]);
        expect(state.discoveredRecipeKeys).toEqual(["2+2=4"]);
    });

    it("can finish on the signature recipe after the minimum two actions", () => {
        let state = createG0NumberVesselState("two-action-seed");
        const firstTwo = getTokenByAmount(state, 2);
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-1",
            100,
        );

        const one = getToken(
            state,
            (token) => token.origin === "preview" && token.amount === 1,
        );
        const four = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 4,
        );
        state = composeTokens(
            state,
            four.id,
            one.id,
            "action-2",
            200,
        );

        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 2,
            endReason: "signature-recipe",
            outcome: {
                id: "number-vessel-signature-recipe",
                goalReached: true,
                discoveryKey: G0_NUMBER_VESSEL_SIGNATURE_RECIPE_KEY,
            },
        });
        expect(state.completedRuns).toEqual([
            expect.objectContaining({
                actionIds: ["compose:2+2", "compose:1+4"],
                durationMs: 110,
            }),
        ]);
        expect(state.operationHistory.map(
            (operation) => operation.clientActionId,
        )).toEqual(["action-1:target", "action-2:target"]);
    });

    it("can reach the same signature recipe on action three", () => {
        let state = createG0NumberVesselState("three-action-seed");
        const initialFour = getTokenByAmount(state, 4);
        state = splitToken(state, initialFour.id, "action-1", 100);

        const firstTwo = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 2,
        );
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-2",
            200,
        );

        const composedFour = getToken(
            state,
            (token) => token.id.endsWith("compose-2"),
        );
        const previewOne = getToken(
            state,
            (token) => token.origin === "preview" && token.amount === 1,
        );
        state = composeTokens(
            state,
            composedFour.id,
            previewOne.id,
            "action-3",
            300,
        );

        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 3,
            endReason: "signature-recipe",
        });
    });

    it("ends after four actions when the signature recipe is not formed", () => {
        let state = createG0NumberVesselState("four-action-seed");
        const firstTwo = getTokenByAmount(state, 2);
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-1",
            100,
        );

        const initialThree = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 3,
        );
        const initialFour = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 4,
        );
        state = composeTokens(
            state,
            initialThree.id,
            initialFour.id,
            "action-2",
            200,
        );

        const previewOne = getToken(
            state,
            (token) => token.id.endsWith("preview-1"),
        );
        const previewThree = getToken(
            state,
            (token) => token.id.endsWith("preview-2"),
        );
        state = composeTokens(
            state,
            previewOne.id,
            previewThree.id,
            "action-3",
            300,
        );

        const composedFour = getToken(
            state,
            (token) => token.id.endsWith("compose-3"),
        );
        const previewTwo = getToken(
            state,
            (token) => token.id.endsWith("preview-3"),
        );
        state = composeTokens(
            state,
            composedFour.id,
            previewTwo.id,
            "action-4",
            400,
        );

        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 4,
            endReason: "max-actions",
            outcome: {
                id: "number-vessel-four-actions",
                goalReached: false,
            },
        });
        expect(state.operationHistory).toHaveLength(4);
    });

    it("allows one no-feed compose to recover from overflow", () => {
        let state = createG0NumberVesselState("recovery-seed");
        const initialFour = getTokenByAmount(state, 4);
        state = splitToken(state, initialFour.id, "action-1", 100);
        const initialThree = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 3,
        );
        state = splitToken(state, initialThree.id, "action-2", 200);
        const splittableTwo = getTokenByAmount(state, 2);
        state = splitToken(state, splittableTwo.id, "action-3", 300);

        expect(state).toMatchObject({
            phase: "await-action",
            actionCount: 3,
            overflowRecoveryPending: true,
            overflowRecoveryAvailable: true,
            overflowEntered: true,
        });
        expect(state.tokens).toHaveLength(7);

        const recoverySource = state.tokens[0];
        state = tapToken(
            state,
            recoverySource.id,
            "recovery:source",
            400,
        );
        const splitDuringRecovery = reduceG0NumberVesselState(state, {
            type: "SPLIT_SELECTED",
            clientActionId: "recovery:invalid-split",
            atMs: 401,
        });
        expect(splitDuringRecovery).toBe(state);

        const recoveryTarget = state.tokens.find(
            (token) => token.id !== recoverySource.id,
        );
        if (!recoveryTarget) throw new Error("Expected a recovery target");
        state = tapToken(
            state,
            recoveryTarget.id,
            "recovery:target",
            402,
        );
        expect(state.pendingOperation).toMatchObject({
            kind: "compose",
            recovery: true,
        });
        expect(state).toMatchObject({
            phase: "reacting",
            actionCount: 4,
            overflowRecoveryAvailable: false,
        });

        state = finishReaction(state, 410);
        expect(state.tokens).toHaveLength(G0_NUMBER_VESSEL_CAPACITY);
        expect(state).toMatchObject({
            phase: "payoff",
            endReason: "max-actions",
            recoverySucceeded: true,
            previewIndex: 0,
            outcome: {
                id: "number-vessel-recovered",
                riskTaken: true,
                riskRecovered: true,
            },
        });
    });

    it("ends in overflow when the fourth action exceeds capacity", () => {
        let state = createG0NumberVesselState("late-overflow-seed");
        const firstTwo = getTokenByAmount(state, 2);
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-1",
            100,
        );

        const initialThree = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 3,
        );
        state = splitToken(state, initialThree.id, "action-2", 200);
        const initialFour = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 4,
        );
        state = splitToken(state, initialFour.id, "action-3", 300);
        const nextTwo = getTokenByAmount(state, 2);
        state = splitToken(state, nextTwo.id, "action-4", 400);

        expect(state.tokens).toHaveLength(7);
        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 4,
            endReason: "overflow",
            overflowEntered: true,
            recoverySucceeded: false,
            outcome: {
                id: "number-vessel-overflow",
                goalReached: false,
                riskTaken: true,
                riskRecovered: false,
            },
        });
    });

    it("preserves discoveries and completed evidence across replay", () => {
        let state = createG0NumberVesselState("replay-seed");
        const firstTwo = getTokenByAmount(state, 2);
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-1",
            100,
        );
        const previewOne = getToken(
            state,
            (token) => token.origin === "preview" && token.amount === 1,
        );
        const initialFour = getToken(
            state,
            (token) => token.origin === "initial" && token.amount === 4,
        );
        state = composeTokens(
            state,
            previewOne.id,
            initialFour.id,
            "action-2",
            200,
        );
        const discoveries = state.discoveredRecipeKeys;

        state = reduceG0NumberVesselState(state, { type: "REPLAY" });

        expect(state).toMatchObject({
            runOrdinal: 1,
            runId: "number-vessel:run-1",
            phase: "await-action",
            actionCount: 0,
            replayStarts: 1,
            runRecipeKeys: [],
            endReason: null,
        });
        expect(state.tokens.map((token) => token.amount)).toEqual(
            G0_NUMBER_VESSEL_INITIAL_AMOUNTS,
        );
        expect(state.discoveredRecipeKeys).toEqual(discoveries);
        expect(state.completedRuns).toHaveLength(1);
        expect(state.outcome).toBeNull();
    });

    it("ignores duplicate input, invalid targets, and stale reactions", () => {
        let state = createG0NumberVesselState("guard-seed");
        const missingTarget = tapToken(
            state,
            "missing-token",
            "missing",
            90,
        );
        expect(missingTarget).toBe(state);

        const source = getTokenByAmount(state, 2);
        state = tapToken(state, source.id, "source", 100);
        const afterDuplicate = tapToken(state, source.id, "source", 101);
        expect(afterDuplicate).toBe(state);

        const target = getTokenByAmount(state, 2, [source.id]);
        state = tapToken(state, target.id, "target", 110);
        const staleReaction = reduceG0NumberVesselState(state, {
            type: "REACTION_FINISHED",
            reactionId: "number-vessel:run-0:reaction-stale",
            atMs: 120,
        });
        expect(staleReaction).toBe(state);

        const reactionId = state.activeReactionId;
        state = finishReaction(state, 130);
        const afterDuplicateReaction = reduceG0NumberVesselState(state, {
            type: "REACTION_FINISHED",
            reactionId: reactionId ?? "missing",
            atMs: 140,
        });
        expect(afterDuplicateReaction).toBe(state);
    });

    it("does not split a one-token or consume its invalid event", () => {
        let state = createG0NumberVesselState("invalid-split-seed");
        const firstTwo = getTokenByAmount(state, 2);
        const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
        state = composeTokens(
            state,
            firstTwo.id,
            secondTwo.id,
            "action-1",
            100,
        );
        const previewOne = getToken(
            state,
            (token) => token.origin === "preview" && token.amount === 1,
        );
        state = tapToken(state, previewOne.id, "select-one", 200);

        const afterInvalidSplit = reduceG0NumberVesselState(state, {
            type: "SPLIT_SELECTED",
            clientActionId: "invalid-split",
            atMs: 201,
        });

        expect(afterInvalidSplit).toBe(state);
        expect(afterInvalidSplit.selectedTokenId).toBe(previewOne.id);
        expect(afterInvalidSplit.acceptedClientActionIds).not.toContain(
            "invalid-split",
        );
    });

    it("is deterministic and never calls Math.random", () => {
        const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
            throw new Error("number-vessel must not use Math.random");
        });

        try {
            const play = (): G0NumberVesselState => {
                let state = createG0NumberVesselState("deterministic-seed");
                const firstTwo = getTokenByAmount(state, 2);
                const secondTwo = getTokenByAmount(state, 2, [firstTwo.id]);
                state = composeTokens(
                    state,
                    firstTwo.id,
                    secondTwo.id,
                    "action-1",
                    100,
                );
                const initialThree = getToken(
                    state,
                    (token) => token.origin === "initial"
                        && token.amount === 3,
                );
                return splitToken(
                    state,
                    initialThree.id,
                    "action-2",
                    200,
                );
            };

            expect(play()).toEqual(play());
        } finally {
            randomSpy.mockRestore();
        }
    });
});
