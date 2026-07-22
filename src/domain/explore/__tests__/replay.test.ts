import { describe, expect, it } from "vitest";
import { createInitialExploreState } from "../reducer";
import { getExploreReplayTeaser } from "../replay";

describe("getExploreReplayTeaser", () => {
    it("turns a missed dedicated encounter into the next-run goal", () => {
        const state = createInitialExploreState({ seed: "replay-root", now: 100 });
        const rootTangle = state.nodes.find((node) => node.encounterId === "root-tangle");

        expect(rootTangle).toBeDefined();
        expect(getExploreReplayTeaser(state)).toEqual(expect.objectContaining({
            nodeId: rootTangle?.id,
            kind: "root",
            reason: "missed-encounter",
        }));
    });

    it("moves to another unopened route after the dedicated encounter was visited", () => {
        const state = createInitialExploreState({ seed: "replay-alternate", now: 100 });
        const rootTangle = state.nodes.find((node) => node.encounterId === "root-tangle");
        if (!rootTangle) throw new Error("Expected root-tangle node");

        const teaser = getExploreReplayTeaser({
            nodes: state.nodes,
            openedNodeIds: [...state.openedNodeIds, rootTangle.id],
        });

        expect(teaser?.nodeId).not.toBe(rootTangle.id);
        expect(state.openedNodeIds).not.toContain(teaser?.nodeId);
    });

    it("returns no artificial promise when every route is already open", () => {
        const state = createInitialExploreState({ seed: "replay-complete", now: 100 });

        expect(getExploreReplayTeaser({
            nodes: state.nodes,
            openedNodeIds: state.nodes.map((node) => node.id),
        })).toBeUndefined();
    });
});
