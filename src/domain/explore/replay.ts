import type { ExploreNode, ExploreNodeKind, ExploreRunState } from "./types";

export type ExploreReplayReason = "missed-encounter" | "unseen-kind" | "alternate-route";

export interface ExploreReplayTeaser {
    nodeId: string;
    kind: Exclude<ExploreNodeKind, "start">;
    title: string;
    hint: string;
    reason: ExploreReplayReason;
}

const isReplayNode = (
    node: ExploreNode,
): node is ExploreNode & { kind: Exclude<ExploreNodeKind, "start"> } => node.kind !== "start";

/**
 * Turns a route the player did not take into a small, non-persistent goal for
 * the next run. Dedicated encounters win, then a terrain kind not seen on the
 * completed route, then any alternate path.
 */
export const getExploreReplayTeaser = (
    state: Pick<ExploreRunState, "nodes" | "openedNodeIds">,
): ExploreReplayTeaser | undefined => {
    const openedNodeIds = new Set(state.openedNodeIds);
    const openedKinds = new Set(
        state.nodes
            .filter((node) => openedNodeIds.has(node.id))
            .map((node) => node.kind),
    );
    const unopened = state.nodes.filter(
        (node): node is ExploreNode & { kind: Exclude<ExploreNodeKind, "start"> } => (
            isReplayNode(node) && !openedNodeIds.has(node.id)
        ),
    );
    const missedEncounter = unopened.find((node) => Boolean(node.encounterId));
    const unseenKind = unopened.find((node) => !openedKinds.has(node.kind));
    const candidate = missedEncounter ?? unseenKind ?? unopened[0];
    if (!candidate) return undefined;

    return {
        nodeId: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        hint: candidate.hint,
        reason: missedEncounter === candidate
            ? "missed-encounter"
            : unseenKind === candidate
                ? "unseen-kind"
                : "alternate-route",
    };
};
