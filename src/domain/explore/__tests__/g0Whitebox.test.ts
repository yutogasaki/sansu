import { describe, expect, it, vi } from "vitest";
import {
    G0_ACTIONS_PER_RUN,
    G0_PROTOTYPE_IDS,
    G0_PROTOTYPES,
    createInitialG0LabState,
    getG0PrototypeMetrics,
    getG0Targets,
    reduceG0LabState,
    resolveG0Outcome,
    type G0LabState,
    type G0PrototypeId,
} from "../g0Whitebox";

const tapCurrentTarget = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    targetIndex: 0 | 1,
    clientActionId: string,
    atMs: number,
): G0LabState => {
    const target = getG0Targets(state, prototypeId)[targetIndex];
    return reduceG0LabState(state, {
        type: "WORLD_TARGET_TAPPED",
        prototypeId,
        targetId: target.id,
        clientActionId,
        atMs,
    });
};

const finishCurrentReaction = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    atMs: number,
): G0LabState => {
    const reactionId = state.prototypes[prototypeId].activeReactionId;
    if (!reactionId) {
        throw new Error("Expected an active G0 reaction");
    }

    return reduceG0LabState(state, {
        type: "REACTION_FINISHED",
        prototypeId,
        reactionId,
        atMs,
    });
};

const completeRun = (
    prototypeId: G0PrototypeId,
    targetIndexes: readonly [0 | 1, 0 | 1, 0 | 1] = [0, 1, 0],
    seed = "test-seed",
    startAtMs = 100,
): G0LabState => {
    let state = createInitialG0LabState(prototypeId, seed);

    targetIndexes.forEach((targetIndex, turnIndex) => {
        const tapAtMs = startAtMs + turnIndex * 100;
        state = tapCurrentTarget(
            state,
            prototypeId,
            targetIndex,
            `${prototypeId}:tap-${turnIndex + 1}`,
            tapAtMs,
        );
        state = finishCurrentReaction(state, prototypeId, tapAtMs + 50);
    });

    return state;
};

describe("G0 whitebox model", () => {
    it("defines four comparable prototypes with two direct stage targets per turn", () => {
        expect(G0_PROTOTYPE_IDS).toHaveLength(4);

        for (const prototypeId of G0_PROTOTYPE_IDS) {
            const definition = G0_PROTOTYPES[prototypeId];
            let state = createInitialG0LabState(prototypeId, "target-audit");

            expect(definition.promptByTurn).toHaveLength(G0_ACTIONS_PER_RUN);
            for (let turnIndex = 0; turnIndex < G0_ACTIONS_PER_RUN; turnIndex += 1) {
                const targets = getG0Targets(state, prototypeId);
                expect(targets).toHaveLength(2);
                expect(targets[0].id).not.toBe(targets[1].id);

                state = tapCurrentTarget(
                    state,
                    prototypeId,
                    0,
                    `${prototypeId}:audit-${turnIndex}`,
                    100 + turnIndex * 100,
                );
                state = finishCurrentReaction(
                    state,
                    prototypeId,
                    150 + turnIndex * 100,
                );
            }
        }
    });

    it.each(G0_PROTOTYPE_IDS)(
        "%s reacts to the first world tap and pays off after exactly three",
        (prototypeId) => {
            let state = createInitialG0LabState(prototypeId, "stable-seed");

            state = tapCurrentTarget(
                state,
                prototypeId,
                1,
                `${prototypeId}:tap-1`,
                100,
            );
            expect(state.prototypes[prototypeId]).toMatchObject({
                phase: "reacting",
                turn: 1,
            });
            expect(state.prototypes[prototypeId].history).toHaveLength(1);

            state = finishCurrentReaction(state, prototypeId, 150);
            expect(state.prototypes[prototypeId].phase).toBe("await-action");

            state = tapCurrentTarget(
                state,
                prototypeId,
                0,
                `${prototypeId}:tap-2`,
                200,
            );
            state = finishCurrentReaction(state, prototypeId, 250);
            expect(state.prototypes[prototypeId]).toMatchObject({
                phase: "await-action",
                turn: 2,
            });

            state = tapCurrentTarget(
                state,
                prototypeId,
                1,
                `${prototypeId}:tap-3`,
                300,
            );
            expect(state.prototypes[prototypeId].phase).toBe("reacting");
            state = finishCurrentReaction(state, prototypeId, 350);

            expect(state.prototypes[prototypeId]).toMatchObject({
                phase: "payoff",
                turn: 3,
            });
            expect(state.prototypes[prototypeId].completedRuns).toEqual([
                expect.objectContaining({
                    durationMs: 250,
                    targetIds: expect.any(Array),
                }),
            ]);
            expect(state.prototypes[prototypeId].outcome).not.toBeNull();

            const afterExtraTap = reduceG0LabState(state, {
                type: "WORLD_TARGET_TAPPED",
                prototypeId,
                targetId: "part-beam",
                clientActionId: `${prototypeId}:tap-extra`,
                atMs: 400,
            });
            expect(afterExtraTap).toBe(state);
        },
    );

    it("queues at most one next tap during a reaction without double advancing", () => {
        const prototypeId = "droplet-ricochet";
        let state = createInitialG0LabState(prototypeId, "queue-seed");

        state = tapCurrentTarget(state, prototypeId, 0, "tap-1", 100);
        const firstReactionId = state.prototypes[prototypeId].activeReactionId;
        state = tapCurrentTarget(state, prototypeId, 1, "tap-2", 110);
        expect(state.prototypes[prototypeId]).toMatchObject({
            turn: 1,
            queuedAction: expect.objectContaining({ clientActionId: "tap-2" }),
        });

        const afterThirdRapidTap = tapCurrentTarget(
            state,
            prototypeId,
            0,
            "tap-too-soon",
            120,
        );
        expect(afterThirdRapidTap).toBe(state);

        state = finishCurrentReaction(state, prototypeId, 150);
        expect(state.prototypes[prototypeId]).toMatchObject({
            phase: "reacting",
            turn: 2,
            queuedAction: null,
        });
        expect(state.prototypes[prototypeId].history).toHaveLength(2);

        const afterDuplicate = reduceG0LabState(state, {
            type: "WORLD_TARGET_TAPPED",
            prototypeId,
            targetId: "bumper-wide",
            clientActionId: "tap-2",
            atMs: 160,
        });
        expect(afterDuplicate).toBe(state);

        const afterStaleReaction = reduceG0LabState(state, {
            type: "REACTION_FINISHED",
            prototypeId,
            reactionId: firstReactionId ?? "missing",
            atMs: 170,
        });
        expect(afterStaleReaction).toBe(state);
    });

    it("settles an in-flight reaction after the comparison tab changes", () => {
        let state = createInitialG0LabState("chain-excavation", "switch-seed");
        state = tapCurrentTarget(
            state,
            "chain-excavation",
            0,
            "chain-tap-1",
            100,
        );
        const reactionId = state.prototypes["chain-excavation"].activeReactionId;
        state = reduceG0LabState(state, {
            type: "SWITCH_PROTOTYPE",
            prototypeId: "underground-craft",
        });
        state = reduceG0LabState(state, {
            type: "REACTION_FINISHED",
            prototypeId: "chain-excavation",
            reactionId: reactionId ?? "missing",
            atMs: 150,
        });

        expect(state.activePrototypeId).toBe("underground-craft");
        expect(state.prototypes["chain-excavation"]).toMatchObject({
            phase: "await-action",
            turn: 1,
        });
    });

    it("does not let a reaction from before reset settle the new run", () => {
        const prototypeId = "chain-excavation";
        let state = createInitialG0LabState(prototypeId, "reset-seed");
        state = tapCurrentTarget(state, prototypeId, 0, "old-tap", 100);
        const staleReactionId = state.prototypes[prototypeId].activeReactionId;

        state = reduceG0LabState(state, {
            type: "RESET_PROTOTYPE",
            prototypeId,
        });
        state = tapCurrentTarget(state, prototypeId, 0, "new-tap", 200);
        const newReactionId = state.prototypes[prototypeId].activeReactionId;

        expect(newReactionId).not.toBe(staleReactionId);
        const afterStaleReaction = reduceG0LabState(state, {
            type: "REACTION_FINISHED",
            prototypeId,
            reactionId: staleReactionId ?? "missing",
            atMs: 250,
        });
        expect(afterStaleReaction).toBe(state);
        expect(afterStaleReaction.prototypes[prototypeId].phase).toBe("reacting");
    });

    it("is deterministic for the same seed and event sequence without Math.random", () => {
        const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
            throw new Error("G0 must not use Math.random");
        });

        try {
            const first = completeRun(
                "droplet-ricochet",
                [0, 1, 1],
                "comparison-seed",
            );
            const second = completeRun(
                "droplet-ricochet",
                [0, 1, 1],
                "comparison-seed",
            );
            expect(first).toEqual(second);
        } finally {
            randomSpy.mockRestore();
        }
    });

    it("gives materially different outcomes for different three-tap paths", () => {
        for (const prototypeId of G0_PROTOTYPE_IDS) {
            const first = completeRun(
                prototypeId,
                [0, 0, 0],
                "outcome-seed",
            ).prototypes[prototypeId].outcome;
            const second = completeRun(
                prototypeId,
                [0, 1, 0],
                "outcome-seed",
            ).prototypes[prototypeId].outcome;

            expect(first?.id).not.toBe(second?.id);
        }

        expect(() => resolveG0Outcome(
            "chain-excavation",
            ["lane-upper"],
            "invalid",
        )).toThrow(/exactly three/);
    });

    it("records risk recovery only when the next decision actually recovers it", () => {
        const chainSeed = "risk-seed";
        const chainState = createInitialG0LabState(
            "chain-excavation",
            chainSeed,
        );
        const [springTarget, safeTarget] = getG0Targets(
            chainState,
            "chain-excavation",
        ).sort((first, second) => (
            first.targetClass === "wild"
                ? -1
                : second.targetClass === "wild"
                    ? 1
                    : 0
        ));

        const recoveredChain = resolveG0Outcome(
            "chain-excavation",
            [springTarget.id, safeTarget.id, safeTarget.id],
            chainSeed,
        );
        const lateRiskChain = resolveG0Outcome(
            "chain-excavation",
            [safeTarget.id, safeTarget.id, springTarget.id],
            chainSeed,
        );
        expect(recoveredChain).toMatchObject({
            riskTaken: true,
            riskRecovered: true,
        });
        expect(lateRiskChain).toMatchObject({
            riskTaken: true,
            riskRecovered: false,
        });

        expect(resolveG0Outcome(
            "droplet-ricochet",
            ["inlet-top", "inlet-bottom", "bumper-wide"],
            chainSeed,
        )).toMatchObject({
            riskTaken: true,
            riskRecovered: true,
        });
        expect(resolveG0Outcome(
            "droplet-ricochet",
            ["inlet-top", "inlet-bottom", "bumper-pin"],
            chainSeed,
        )).toMatchObject({
            riskTaken: true,
            riskRecovered: false,
        });
    });

    it("preserves evidence on replay and records trying another first target", () => {
        const prototypeId = "creature-experiment";
        let state = completeRun(prototypeId, [0, 0, 0], "replay-seed", 100);
        state = reduceG0LabState(state, {
            type: "REPLAY",
            prototypeId,
        });

        expect(state.prototypes[prototypeId]).toMatchObject({
            phase: "await-action",
            turn: 0,
            replayStarts: 1,
        });
        expect(state.prototypes[prototypeId].completedRuns).toHaveLength(1);

        for (let turnIndex = 0; turnIndex < G0_ACTIONS_PER_RUN; turnIndex += 1) {
            const tapAtMs = 600 + turnIndex * 100;
            state = tapCurrentTarget(
                state,
                prototypeId,
                1,
                `replay-tap-${turnIndex + 1}`,
                tapAtMs,
            );
            state = finishCurrentReaction(state, prototypeId, tapAtMs + 50);
        }

        expect(getG0PrototypeMetrics(state.prototypes[prototypeId])).toEqual({
            completedRuns: 2,
            replayStarts: 1,
            triedDifferentFirstTargets: true,
            averageDurationMs: 250,
        });
    });

    it("keeps each prototype's run evidence when switching comparisons", () => {
        let state = completeRun("chain-excavation", [0, 1, 0]);
        state = reduceG0LabState(state, {
            type: "SWITCH_PROTOTYPE",
            prototypeId: "underground-craft",
        });

        expect(state.activePrototypeId).toBe("underground-craft");
        expect(state.prototypes["chain-excavation"].completedRuns).toHaveLength(1);
        expect(state.prototypes["underground-craft"].completedRuns).toHaveLength(0);
    });
});
