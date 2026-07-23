import { describe, expect, it } from "vitest";
import {
    createExploreLearningSegmentId,
    getExploreLearningSegmentKey,
    getExploreLearningSegmentWindow,
    projectExploreLearningSegmentGates,
} from "../learningSegment";
import type {
    ExploreEdge,
    ExploreNode,
    ExploreNodeKind,
    ExploreProblemGate,
    ExploreRunState,
} from "../types";

const createNode = (
    id: string,
    depth: number,
    x: number,
    kind: ExploreNodeKind = "soil",
): ExploreNode => ({
    id,
    depth,
    lane: 0,
    x,
    y: 90 - depth * 10,
    kind,
    title: id,
    hint: id,
});

const createEdge = (from: string, to: string): ExploreEdge => ({
    id: `${from}-${to}`,
    from,
    to,
});

const createProjectionState = ({
    step,
    nodes,
    edges,
    currentNodeId,
    gateNodeId,
    openedNodeIds,
}: {
    step: number;
    nodes: ExploreNode[];
    edges: ExploreEdge[];
    currentNodeId: string;
    gateNodeId: string;
    openedNodeIds: string[];
}): ExploreRunState => {
    const gateNode = nodes.find((node) => node.id === gateNodeId);
    if (!gateNode) throw new Error(`Missing gate node ${gateNodeId}`);
    const actionType = gateNode.kind === "bridge" ? "bridge" : "dig";
    const pendingProblem: ExploreProblemGate = {
        gateId: `run-1:${gateNode.id}`,
        nodeId: gateNode.id,
        actionType,
        attemptCount: 0,
        ...(actionType === "bridge" ? { bridgePlan: "stones" as const } : {}),
    };

    return {
        runId: "run-1",
        profileId: "profile-1",
        seed: "segment-seed",
        status: "active",
        startedAt: 100,
        currentNodeId,
        energy: 12,
        maxEnergy: 12,
        combo: 0,
        steps: step,
        incorrectAnswers: 0,
        nodes,
        edges,
        openedNodeIds,
        temporaryFinds: [],
        confirmedFinds: [],
        attempts: [],
        committedAttemptKeys: [],
        pendingProblem,
        lastEvent: { type: "node-selected", nodeId: gateNodeId },
        rescuePending: false,
        config: {
            maxEnergy: 12,
            correctEnergyCost: 1,
            incorrectEnergyCost: 1,
        },
    };
};

describe("learning segment windows", () => {
    it.each([
        [0, "0", 0, 3, 0],
        [1, "0", 0, 3, 1],
        [2, "0", 0, 3, 2],
        [3, "3", 3, 6, 3],
        [4, "3", 3, 6, 4],
        [5, "3", 3, 6, 5],
        [6, "6", 6, 8, 6],
        [7, "6", 6, 8, 7],
    ] as const)(
        "maps step %i to segment %s",
        (step, key, startStep, endStepExclusive, plannedFromStep) => {
            expect(getExploreLearningSegmentWindow(step)).toEqual({
                key,
                startStep,
                endStepExclusive,
                plannedFromStep,
            });
            expect(getExploreLearningSegmentKey(step)).toBe(key);
        },
    );

    it.each([-1, 8, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
        "fails closed outside the eight-answer run at %s",
        (step) => {
            expect(getExploreLearningSegmentWindow(step)).toBeUndefined();
            expect(getExploreLearningSegmentKey(step)).toBeUndefined();
        },
    );

    it("creates a stable, segment-scoped ID", () => {
        const q1Id = createExploreLearningSegmentId("run:with:separators", 0);
        expect(createExploreLearningSegmentId("run:with:separators", 2)).toBe(q1Id);
        expect(createExploreLearningSegmentId("run:with:separators", 3)).not.toBe(q1Id);
        expect(createExploreLearningSegmentId("", 0)).toBeUndefined();
        expect(createExploreLearningSegmentId("run-1", 8)).toBeUndefined();
    });
});

describe("learning segment gate projection", () => {
    it("projects the three Q1 gates from the current real gate", () => {
        const nodes = [
            createNode("start", 0, 50, "start"),
            createNode("q1", 1, 42),
            createNode("q2-far", 2, 82),
            createNode("q2-near", 2, 44),
            createNode("q3", 3, 48),
        ];
        const state = createProjectionState({
            step: 0,
            nodes,
            edges: [
                createEdge("start", "q1"),
                createEdge("q1", "q2-far"),
                createEdge("q1", "q2-near"),
                createEdge("q2-near", "q3"),
            ],
            currentNodeId: "start",
            gateNodeId: "q1",
            openedNodeIds: ["start"],
        });
        const snapshot = structuredClone(state);

        const projection = projectExploreLearningSegmentGates(state);

        expect(projection).toMatchObject({
            segmentKey: "0",
            startStep: 0,
            endStepExclusive: 3,
            plannedFromStep: 0,
        });
        expect(projection?.slots.map(({ step, gate }) => [step, gate.nodeId]))
            .toEqual([[0, "q1"], [1, "q2-near"], [2, "q3"]]);
        expect(projection?.slots.slice(1).every(({ gate }) => gate.attemptCount === 0))
            .toBe(true);
        expect(state).toEqual(snapshot);
    });

    it("uses lower x and then lexical id for deterministic branch ties", () => {
        const nodes = [
            createNode("current", 0, 50, "start"),
            createNode("q1", 1, 50),
            createNode("a-right", 2, 60),
            createNode("z-left", 2, 40),
            createNode("a-same-x", 3, 40),
            createNode("z-same-x", 3, 40),
        ];
        const projection = projectExploreLearningSegmentGates(createProjectionState({
            step: 0,
            nodes,
            edges: [
                createEdge("current", "q1"),
                createEdge("q1", "a-right"),
                createEdge("q1", "z-left"),
                createEdge("z-left", "z-same-x"),
                createEdge("z-left", "a-same-x"),
            ],
            currentNodeId: "current",
            gateNodeId: "q1",
            openedNodeIds: ["current"],
        }));

        expect(projection?.slots.map(({ gate }) => gate.nodeId))
            .toEqual(["q1", "z-left", "a-same-x"]);
    });

    it("projects Q4-Q6 and assigns stones to a future bridge", () => {
        const nodes = [
            createNode("q3", 3, 50),
            createNode("q4", 4, 48),
            createNode("q5-bridge", 5, 50, "bridge"),
            createNode("q6", 6, 52),
        ];
        const projection = projectExploreLearningSegmentGates(createProjectionState({
            step: 3,
            nodes,
            edges: [
                createEdge("q3", "q4"),
                createEdge("q4", "q5-bridge"),
                createEdge("q5-bridge", "q6"),
            ],
            currentNodeId: "q3",
            gateNodeId: "q4",
            openedNodeIds: ["q3"],
        }));

        expect(projection).toMatchObject({
            segmentKey: "3",
            startStep: 3,
            endStepExclusive: 6,
            plannedFromStep: 3,
        });
        expect(projection?.slots).toHaveLength(3);
        expect(projection?.slots[1]).toEqual({
            step: 4,
            gate: {
                gateId: "run-1:q5-bridge",
                nodeId: "q5-bridge",
                actionType: "bridge",
                attemptCount: 0,
                bridgePlan: "stones",
            },
        });
    });

    it("projects the two-slot Q7-Q8 segment", () => {
        const nodes = [
            createNode("q6", 6, 50),
            createNode("q7", 7, 48),
            createNode("q8", 8, 50),
        ];
        const projection = projectExploreLearningSegmentGates(createProjectionState({
            step: 6,
            nodes,
            edges: [createEdge("q6", "q7"), createEdge("q7", "q8")],
            currentNodeId: "q6",
            gateNodeId: "q7",
            openedNodeIds: ["q6"],
        }));

        expect(projection).toMatchObject({
            segmentKey: "6",
            startStep: 6,
            endStepExclusive: 8,
            plannedFromStep: 6,
        });
        expect(projection?.slots.map(({ step, gate }) => [step, gate.nodeId]))
            .toEqual([[6, "q7"], [7, "q8"]]);
    });

    it("supports planning only the unplanned tail of a legacy segment", () => {
        const nodes = [
            createNode("q1", 1, 50),
            createNode("q2", 2, 48),
            createNode("q3", 3, 50),
        ];
        const projection = projectExploreLearningSegmentGates(createProjectionState({
            step: 1,
            nodes,
            edges: [createEdge("q1", "q2"), createEdge("q2", "q3")],
            currentNodeId: "q1",
            gateNodeId: "q2",
            openedNodeIds: ["q1"],
        }));

        expect(projection).toMatchObject({
            startStep: 0,
            endStepExclusive: 3,
            plannedFromStep: 1,
        });
        expect(projection?.slots.map(({ step }) => step)).toEqual([1, 2]);
    });

    it("fails closed for a mismatched current gate or an incomplete graph", () => {
        const nodes = [
            createNode("start", 0, 50, "start"),
            createNode("q1", 1, 50),
            createNode("q2", 2, 50),
        ];
        const base = createProjectionState({
            step: 0,
            nodes,
            edges: [createEdge("start", "q1"), createEdge("q1", "q2")],
            currentNodeId: "start",
            gateNodeId: "q1",
            openedNodeIds: ["start"],
        });

        expect(projectExploreLearningSegmentGates({
            ...base,
            pendingProblem: {
                ...base.pendingProblem!,
                gateId: "run-1:another-node",
            },
        })).toBeUndefined();
        expect(projectExploreLearningSegmentGates(base)).toBeUndefined();
        expect(projectExploreLearningSegmentGates({ ...base, steps: 8 })).toBeUndefined();
    });
});
