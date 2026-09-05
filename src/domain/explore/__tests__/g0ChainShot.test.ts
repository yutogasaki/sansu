import { describe, expect, it, vi } from "vitest";
import {
    G0_CHAIN_GOAL,
    G0_CHAIN_MAX_ACTIONS,
    createG0ChainShotState,
    getG0ChainShotTargets,
    reduceG0ChainShotState,
    type G0ChainShotState,
    type G0ChainShotTargetId,
} from "../g0ChainShot";

const tap = (
    state: G0ChainShotState,
    targetId: G0ChainShotTargetId,
    clientActionId: string,
    atMs: number,
): G0ChainShotState => reduceG0ChainShotState(state, {
    type: "WORLD_TARGET_TAPPED",
    targetId,
    clientActionId,
    atMs,
});

const finish = (
    state: G0ChainShotState,
    atMs: number,
): G0ChainShotState => reduceG0ChainShotState(state, {
    type: "REACTION_FINISHED",
    reactionId: state.activeReactionId ?? "missing",
    atMs,
});

const act = (
    state: G0ChainShotState,
    targetId: G0ChainShotTargetId,
    ordinal: number,
): G0ChainShotState => finish(
    tap(state, targetId, `action-${ordinal}`, ordinal * 100),
    ordinal * 100 + 40,
);

const completePath = (
    targetIds: readonly G0ChainShotTargetId[],
    seed = "chain-test",
): G0ChainShotState => targetIds.reduce(
    (state, targetId, index) => act(state, targetId, index + 1),
    createG0ChainShotState(seed),
);

describe("G0 chain shot", () => {
    it("exposes the route-and-carry goal and three deterministic targets", () => {
        const state = createG0ChainShotState("target-seed");
        const targets = getG0ChainShotTargets(state);

        expect(G0_CHAIN_GOAL).toMatchObject({
            minActions: 2,
            routeProgress: 2,
            requiresBankedCarry: true,
            requiresStableWorld: true,
        });
        expect(G0_CHAIN_MAX_ACTIONS).toBe(4);
        expect(state.runId).toBe("chain-shot:run-0");
        expect(targets.map((target) => target.targetClass)).toEqual([
            "safe",
            "wild",
            "recovery",
        ]);
        expect(targets.map((target) => target.available)).toEqual([
            true,
            true,
            false,
        ]);
    });

    it("finishes the stable route in two safe actions", () => {
        const state = completePath(["safe-vein", "safe-vein"]);

        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 2,
            routeProgress: 2,
            bankedCarryKey: "steady-trait",
            instability: 0,
            outcome: {
                id: "stable-route",
                goalReached: true,
                riskTaken: false,
                riskRecovered: false,
                carryKey: "steady-trait",
            },
        });
        expect(state.completedRuns).toEqual([
            expect.objectContaining({
                actionIds: ["safe-vein", "safe-vein"],
                targetIds: ["safe-vein", "safe-vein"],
                actionClasses: ["safe", "safe"],
                outgoingCarryKey: "steady-trait",
                finalYield: 2,
            }),
        ]);
    });

    it("makes recovery available after wild and records recovered risk", () => {
        let state = createG0ChainShotState("recovery-seed");
        state = act(state, "wild-pocket", 1);

        expect(getG0ChainShotTargets(state).map((target) => ({
            kind: target.targetClass,
            available: target.available,
        }))).toEqual([
            { kind: "safe", available: false },
            { kind: "wild", available: true },
            { kind: "recovery", available: true },
        ]);

        state = act(state, "recovery-arc", 2);
        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 2,
            bankedCarryKey: "spring-trait",
            instability: 0,
            riskState: "recovered",
            outcome: {
                id: "spring-route",
                goalReached: true,
                riskTaken: true,
                riskRecovered: true,
                carryKey: "spring-trait",
            },
        });
    });

    it.each([
        {
            path: ["safe-vein", "wild-pocket", "recovery-arc"],
            actionCount: 3,
        },
        {
            path: ["wild-pocket", "wild-pocket", "recovery-arc"],
            actionCount: 3,
        },
        {
            path: [
                "safe-vein",
                "wild-pocket",
                "wild-pocket",
                "recovery-arc",
            ],
            actionCount: 4,
        },
    ] as const)(
        "supports a $actionCount-action recovered route",
        ({ path, actionCount }) => {
            const state = completePath(path);
            expect(state).toMatchObject({
                phase: "payoff",
                actionCount,
                riskState: "recovered",
                outcome: {
                    goalReached: true,
                    riskTaken: true,
                    riskRecovered: true,
                },
            });
        },
    );

    it("ends an overextended fourth wild action in a bright detour", () => {
        const state = completePath([
            "wild-pocket",
            "wild-pocket",
            "wild-pocket",
            "wild-pocket",
        ]);

        expect(state).toMatchObject({
            phase: "payoff",
            actionCount: 4,
            riskState: "overextended",
            bankedCarryKey: null,
            outcome: {
                id: "bright-detour",
                ending: "bright-detour",
                goalReached: false,
                riskTaken: true,
                riskRecovered: false,
            },
        });
        expect(state.outcome).not.toHaveProperty("carryKey");
        expect(getG0ChainShotTargets(state).every(
            (target) => !target.available,
        )).toBe(true);
    });

    it("does not queue or apply input received during a reaction", () => {
        let state = createG0ChainShotState("lock-seed");
        state = tap(state, "wild-pocket", "first", 100);
        const reacting = state;

        state = tap(state, "recovery-arc", "blocked", 110);
        expect(state).toBe(reacting);
        expect(state.actionCount).toBe(1);
        expect(state.history).toHaveLength(1);

        state = finish(state, 140);
        expect(state).toMatchObject({
            phase: "await-action",
            actionCount: 1,
        });
        expect(state.history.map((action) => action.clientActionId)).toEqual([
            "first",
        ]);
    });

    it("ignores duplicate input and stale reaction completions", () => {
        let state = createG0ChainShotState("identity-seed");
        state = tap(state, "safe-vein", "same-action", 100);
        const firstReactionId = state.activeReactionId;
        state = finish(state, 140);

        const afterDuplicate = tap(
            state,
            "safe-vein",
            "same-action",
            200,
        );
        expect(afterDuplicate).toBe(state);

        state = tap(state, "safe-vein", "second-action", 210);
        const beforeStale = state;
        const afterStale = reduceG0ChainShotState(state, {
            type: "REACTION_FINISHED",
            reactionId: firstReactionId ?? "missing",
            atMs: 240,
        });
        expect(afterStale).toBe(beforeStale);

        state = finish(state, 250);
        const afterDuplicateFinish = reduceG0ChainShotState(state, {
            type: "REACTION_FINISHED",
            reactionId: beforeStale.activeReactionId ?? "missing",
            atMs: 260,
        });
        expect(afterDuplicateFinish).toBe(state);
    });

    it("keeps every reachable path between two and four actions", () => {
        const completedActionCounts = new Set<number>();
        const visit = (state: G0ChainShotState, depth: number): void => {
            if (state.phase === "payoff") {
                completedActionCounts.add(state.actionCount);
                expect(state.actionCount).toBeGreaterThanOrEqual(2);
                expect(state.actionCount).toBeLessThanOrEqual(4);
                return;
            }

            expect(depth).toBeLessThan(G0_CHAIN_MAX_ACTIONS);
            const available = getG0ChainShotTargets(state).filter(
                (target) => target.available,
            );
            expect(available).toHaveLength(2);
            available.forEach((target, index) => {
                const ordinal = depth + 1;
                const next = finish(
                    tap(
                        state,
                        target.id,
                        `branch-${depth}-${index}-${state.history
                            .map((action) => action.targetId)
                            .join("-")}`,
                        ordinal * 100,
                    ),
                    ordinal * 100 + 40,
                );
                visit(next, depth + 1);
            });
        };

        visit(createG0ChainShotState("exhaustive-seed"), 0);
        expect([...completedActionCounts].sort()).toEqual([2, 3, 4]);
    });

    it("uses a banked carry to change the next run yield and preserves evidence", () => {
        let state = completePath(["safe-vein", "safe-vein"], "carry-seed");
        expect(state.completedRuns).toHaveLength(1);
        expect(state.yieldCount).toBe(2);

        state = reduceG0ChainShotState(state, { type: "REPLAY" });
        expect(state).toMatchObject({
            runId: "chain-shot:run-1",
            phase: "await-action",
            equippedCarryKey: "steady-trait",
            replayStarts: 1,
            yieldCount: 0,
        });
        expect(state.completedRuns).toHaveLength(1);
        expect(getG0ChainShotTargets(state).find(
            (target) => target.id === "safe-vein",
        )?.previewYield).toBe(2);

        state = act(state, "safe-vein", 3);
        expect(state.yieldCount).toBe(2);
        state = act(state, "safe-vein", 4);
        expect(state.completedRuns).toHaveLength(2);
        expect(state.completedRuns[1]).toMatchObject({
            incomingCarryKey: "steady-trait",
            finalYield: 4,
        });
    });

    it("is deterministic and never reads Math.random", () => {
        const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
            throw new Error("G0 chain shot must not use Math.random");
        });

        try {
            const first = completePath([
                "wild-pocket",
                "wild-pocket",
                "recovery-arc",
            ], "deterministic-seed");
            const second = completePath([
                "wild-pocket",
                "wild-pocket",
                "recovery-arc",
            ], "deterministic-seed");
            expect(first).toEqual(second);
        } finally {
            randomSpy.mockRestore();
        }
    });
});
