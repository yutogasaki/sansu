import { getAvailableExploreNodes, exploreReducer } from "./reducer";
import {
    EXPLORE_OPENING_ANSWER_COUNT,
    EXPLORE_RUN_ANSWER_COUNT,
} from "./runStructure";
import type {
    ExploreAction,
    ExploreBridgePlan,
    ExploreNode,
    ExploreProblemGate,
    ExploreRunState,
} from "./types";

export const RAPID_LOOP_SEGMENT_LENGTH = EXPLORE_OPENING_ANSWER_COUNT;
export const RAPID_LOOP_AUTO_BRIDGE_PLAN: ExploreBridgePlan = "stones";

export const shouldAutoRouteExplorePath = (
    steps: number,
    availableNodeCount: number,
): boolean => (
    steps < EXPLORE_RUN_ANSWER_COUNT
    && (
        availableNodeCount === 1
        || (
            availableNodeCount > 0
            && (
                steps === 0
                || steps % RAPID_LOOP_SEGMENT_LENGTH !== 0
            )
        )
    )
);

export const selectDeterministicRapidLoopNodeId = (
    nodes: readonly Pick<ExploreNode, "id" | "x">[],
    currentX: number,
): string | undefined => [...nodes].sort((left, right) => {
    const distanceDelta = Math.abs(left.x - currentX) - Math.abs(right.x - currentX);
    if (distanceDelta !== 0) return distanceDelta;
    if (left.x !== right.x) return left.x - right.x;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
})[0]?.id;

export type RapidLoopRouteAction = Extract<
    ExploreAction,
    { type: "SELECT_NODE" | "CHOOSE_BRIDGE" }
>;

export interface RapidLoopCorrectProjection {
    committedState: ExploreRunState;
    routedState: ExploreRunState;
    routeActions: readonly RapidLoopRouteAction[];
    nextGate: ExploreProblemGate;
}

/**
 * Projects the zero-tap route after a durable correct answer. The projection is
 * pure: callers may start reserving the next assignment while the current
 * success pose is still visible, then dispatch the returned actions only after
 * the real commit receipt has been validated.
 */
export const projectRapidLoopAfterCorrectCommit = (
    state: ExploreRunState,
    committedAction: Extract<ExploreAction, { type: "APPLY_COMMITTED_ATTEMPT" }>,
): RapidLoopCorrectProjection | undefined => {
    if (committedAction.expectedResult !== "correct") return undefined;

    const committedState = exploreReducer(state, committedAction);
    if (
        committedState === state
        || committedState.status !== "active"
        || committedState.rescuePending
        || committedState.steps !== state.steps + 1
    ) return undefined;

    const availableNodes = getAvailableExploreNodes(committedState);
    if (!shouldAutoRouteExplorePath(committedState.steps, availableNodes.length)) {
        return undefined;
    }

    const currentNodeX = committedState.nodes.find(
        (node) => node.id === committedState.currentNodeId,
    )?.x ?? 50;
    const nodeId = selectDeterministicRapidLoopNodeId(availableNodes, currentNodeX);
    if (!nodeId) return undefined;

    const selectAction = { type: "SELECT_NODE" as const, nodeId };
    let routedState = exploreReducer(committedState, selectAction);
    if (!routedState.pendingProblem || routedState === committedState) return undefined;

    const routeActions: RapidLoopRouteAction[] = [selectAction];
    if (
        routedState.pendingProblem.actionType === "bridge"
        && !routedState.pendingProblem.bridgePlan
    ) {
        const bridgeAction = {
            type: "CHOOSE_BRIDGE" as const,
            plan: RAPID_LOOP_AUTO_BRIDGE_PLAN,
        };
        routedState = exploreReducer(routedState, bridgeAction);
        routeActions.push(bridgeAction);
    }

    const nextGate = routedState.pendingProblem;
    if (!nextGate || (nextGate.actionType === "bridge" && !nextGate.bridgePlan)) {
        return undefined;
    }

    return {
        committedState,
        routedState,
        routeActions,
        nextGate,
    };
};

export type RapidLoopPrefetchResult<T> =
    | { status: "ready"; value: T }
    | { status: "error" }
    | { status: "timeout" }
    | { status: "none" };

/** Waits only inside the remaining interaction budget; late work is ignored. */
export const settleRapidLoopPrefetchWithin = async <T>(
    promise: Promise<T> | undefined,
    waitMs: number,
): Promise<RapidLoopPrefetchResult<T>> => {
    if (!promise) return { status: "none" };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<RapidLoopPrefetchResult<T>>((resolve) => {
        timeoutId = setTimeout(
            () => resolve({ status: "timeout" }),
            Math.max(0, waitMs),
        );
    });

    const settled: Promise<RapidLoopPrefetchResult<T>> = promise
        .then((value): RapidLoopPrefetchResult<T> => ({ status: "ready", value }))
        .catch((): RapidLoopPrefetchResult<T> => ({ status: "error" }));
    const result = await Promise.race([settled, timeout]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    return result;
};

export const getRemainingRapidLoopBudgetMs = (
    budgetMs: number,
    elapsedMs: number,
): number => Math.max(0, budgetMs - Math.max(0, elapsedMs));
