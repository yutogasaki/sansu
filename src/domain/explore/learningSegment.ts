import { getAvailableNodeIds } from "./generator";
import {
    RAPID_LOOP_AUTO_BRIDGE_PLAN,
    selectDeterministicRapidLoopNodeId,
} from "./rapidLoop";
import type {
    ExploreNode,
    ExploreProblemGate,
    ExploreRunState,
} from "./types";

export const EXPLORE_LEARNING_SEGMENT_ID_VERSION = "explore-learning-segment-v1";

export type ExploreLearningStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type ExploreLearningSegmentKey = "0" | "3" | "6";
export type ExploreLearningSegmentStartStep = 0 | 3 | 6;
export type ExploreLearningSegmentEndStepExclusive = 3 | 6 | 8;

interface ExploreLearningSegmentDefinition {
    readonly key: ExploreLearningSegmentKey;
    readonly startStep: ExploreLearningSegmentStartStep;
    readonly endStepExclusive: ExploreLearningSegmentEndStepExclusive;
}

const EXPLORE_LEARNING_SEGMENTS: readonly ExploreLearningSegmentDefinition[] = [
    { key: "0", startStep: 0, endStepExclusive: 3 },
    { key: "3", startStep: 3, endStepExclusive: 6 },
    { key: "6", startStep: 6, endStepExclusive: 8 },
];

export interface ExploreLearningSegmentWindow extends ExploreLearningSegmentDefinition {
    /** The first unplanned absolute answer step, including a legacy partial segment. */
    readonly plannedFromStep: ExploreLearningStep;
}

export interface ExploreLearningSegmentGateSlot {
    readonly step: ExploreLearningStep;
    readonly gate: ExploreProblemGate;
}

export interface ExploreLearningSegmentGateProjection {
    readonly segmentId: string;
    readonly segmentKey: ExploreLearningSegmentKey;
    readonly startStep: ExploreLearningSegmentStartStep;
    readonly endStepExclusive: ExploreLearningSegmentEndStepExclusive;
    readonly plannedFromStep: ExploreLearningStep;
    readonly slots: readonly ExploreLearningSegmentGateSlot[];
}

type ExploreLearningSegmentProjectionState = Pick<
    ExploreRunState,
    | "runId"
    | "status"
    | "rescuePending"
    | "steps"
    | "currentNodeId"
    | "nodes"
    | "edges"
    | "openedNodeIds"
    | "pendingProblem"
>;

const isExploreLearningStep = (step: number): step is ExploreLearningStep => (
    Number.isInteger(step) && step >= 0 && step < 8
);

export const getExploreLearningSegmentWindow = (
    plannedFromStep: number,
): ExploreLearningSegmentWindow | undefined => {
    if (!isExploreLearningStep(plannedFromStep)) return undefined;

    const definition = EXPLORE_LEARNING_SEGMENTS.find(
        ({ startStep, endStepExclusive }) => (
            plannedFromStep >= startStep && plannedFromStep < endStepExclusive
        ),
    );
    if (!definition) return undefined;

    return { ...definition, plannedFromStep };
};

export const getExploreLearningSegmentKey = (
    step: number,
): ExploreLearningSegmentKey | undefined => getExploreLearningSegmentWindow(step)?.key;

export const createExploreLearningSegmentId = (
    runId: string,
    step: number,
): string | undefined => {
    const window = getExploreLearningSegmentWindow(step);
    if (!runId || !window) return undefined;

    return JSON.stringify([
        EXPLORE_LEARNING_SEGMENT_ID_VERSION,
        runId,
        window.startStep,
        window.endStepExclusive,
    ]);
};

const getNodeActionType = (
    node: Pick<ExploreNode, "kind">,
): ExploreProblemGate["actionType"] => node.kind === "bridge" ? "bridge" : "dig";

const createNodeMap = (
    nodes: readonly ExploreNode[],
): ReadonlyMap<string, ExploreNode> | undefined => {
    const result = new Map<string, ExploreNode>();
    for (const node of nodes) {
        if (!node.id || result.has(node.id)) return undefined;
        result.set(node.id, node);
    }
    return result;
};

const isCurrentGateConsistent = (
    state: ExploreLearningSegmentProjectionState,
    gate: ExploreProblemGate,
    currentNode: ExploreNode,
    gateNode: ExploreNode,
): boolean => {
    if (!Number.isInteger(gate.attemptCount) || gate.attemptCount < 0) return false;
    if (currentNode.depth !== state.steps || gateNode.depth !== state.steps + 1) return false;
    if (!state.openedNodeIds.includes(currentNode.id)) return false;
    if (state.openedNodeIds.includes(gateNode.id)) return false;
    if (gate.gateId !== `${state.runId}:${gateNode.id}`) return false;
    if (gate.actionType !== getNodeActionType(gateNode)) return false;
    if (gate.actionType === "bridge") {
        if (gate.bridgePlan !== RAPID_LOOP_AUTO_BRIDGE_PLAN) return false;
    } else if (gate.bridgePlan !== undefined) {
        return false;
    }

    return getAvailableNodeIds(
        currentNode.id,
        state.edges,
        state.openedNodeIds,
    ).includes(gateNode.id);
};

/**
 * Projects the real gates remaining in the current 3/3/2 learning segment.
 *
 * The current pending gate is treated as authoritative only after validating
 * it against the graph. Later gates are selected with the same distance and
 * tie-break policy as the rapid loop. No reducer state is mutated or guessed.
 */
export const projectExploreLearningSegmentGates = (
    state: ExploreLearningSegmentProjectionState,
): ExploreLearningSegmentGateProjection | undefined => {
    const window = getExploreLearningSegmentWindow(state.steps);
    const segmentId = createExploreLearningSegmentId(state.runId, state.steps);
    const currentGate = state.pendingProblem;
    if (
        !window
        || !segmentId
        || state.status !== "active"
        || state.rescuePending
        || !currentGate
    ) return undefined;

    const nodesById = createNodeMap(state.nodes);
    if (!nodesById) return undefined;
    if (
        new Set(state.openedNodeIds).size !== state.openedNodeIds.length
        || state.openedNodeIds.some((nodeId) => !nodesById.has(nodeId))
    ) return undefined;

    const currentNode = nodesById.get(state.currentNodeId);
    const gateNode = nodesById.get(currentGate.nodeId);
    if (
        !currentNode
        || !gateNode
        || !isCurrentGateConsistent(state, currentGate, currentNode, gateNode)
    ) return undefined;

    const slots: ExploreLearningSegmentGateSlot[] = [{
        step: window.plannedFromStep,
        gate: { ...currentGate },
    }];
    const projectedOpenedNodeIds = [...state.openedNodeIds, gateNode.id];
    let projectedCurrentNode = gateNode;

    for (
        let step = window.plannedFromStep + 1;
        step < window.endStepExclusive;
        step += 1
    ) {
        const availableIds = new Set(getAvailableNodeIds(
            projectedCurrentNode.id,
            state.edges,
            projectedOpenedNodeIds,
        ));
        const availableNodes = state.nodes.filter((node) => availableIds.has(node.id));
        const nodeId = selectDeterministicRapidLoopNodeId(
            availableNodes,
            projectedCurrentNode.x,
        );
        const node = nodeId ? nodesById.get(nodeId) : undefined;
        if (!node || node.depth !== step + 1) return undefined;

        const actionType = getNodeActionType(node);
        const gate: ExploreProblemGate = {
            gateId: `${state.runId}:${node.id}`,
            nodeId: node.id,
            actionType,
            attemptCount: 0,
            ...(actionType === "bridge"
                ? { bridgePlan: RAPID_LOOP_AUTO_BRIDGE_PLAN }
                : {}),
        };
        slots.push({ step: step as ExploreLearningStep, gate });
        projectedOpenedNodeIds.push(node.id);
        projectedCurrentNode = node;
    }

    return {
        segmentId,
        segmentKey: window.key,
        startStep: window.startStep,
        endStepExclusive: window.endStepExclusive,
        plannedFromStep: window.plannedFromStep,
        slots,
    };
};
