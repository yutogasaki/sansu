import { describe, expect, it } from "vitest";
import { createExploreMap, getAvailableNodeIds } from "../generator";

const reachableFromStart = (edges: ReturnType<typeof createExploreMap>["edges"]) => {
    const visited = new Set(["start"]);
    const queue = ["start"];

    while (queue.length > 0) {
        const current = queue.shift();
        for (const edge of edges.filter((candidate) => candidate.from === current)) {
            if (visited.has(edge.to)) continue;
            visited.add(edge.to);
            queue.push(edge.to);
        }
    }

    return visited;
};

describe("createExploreMap", () => {
    it("creates a deterministic 15-node route with one bridge and one three-way choice", () => {
        const first = createExploreMap("map-seed");
        const second = createExploreMap("map-seed");

        expect(first).toEqual(second);
        expect(first.nodes).toHaveLength(15);
        expect(first.nodes.filter((node) => node.kind === "bridge")).toHaveLength(1);
        const rootTangles = first.nodes.filter((node) => node.encounterId === "root-tangle");
        expect(rootTangles).toHaveLength(1);
        expect(rootTangles[0]).toEqual(expect.objectContaining({
            kind: "root",
            title: "根っこの からまり",
            hint: "根の むこうに 花のひかり",
        }));
        expect(rootTangles[0].depth).toBe(7);
        expect(first.nodes[0].id).toBe("start");
        expect(first.nodes.filter((node) => node.depth === 1)).toHaveLength(2);
        expect(first.nodes.filter((node) => node.depth === 1))
            .not.toEqual(expect.arrayContaining([expect.objectContaining({ kind: "bridge" })]));
        expect(first.nodes.filter((node) => node.depth === 5)).toEqual([
            expect.objectContaining({ kind: "bridge" }),
        ]);
        expect(first.edges.filter((edge) => edge.to === "node-1-0")).toHaveLength(1);

        const branchingLayers = [2, 3, 4, 5, 6].map((depth) => (
            first.nodes.filter((node) => node.depth === depth)
        ));
        expect(branchingLayers.filter((nodes) => nodes.length === 3)).toHaveLength(1);
        for (const nodes of branchingLayers) {
            expect(new Set(nodes.map((node) => node.kind)).size).toBe(nodes.length);
        }
        expect(first.nodes.filter((node) => node.depth === 7)).toHaveLength(1);
        expect(first.nodes.filter((node) => node.depth === 8)).toHaveLength(1);
    });

    it("keeps every generated node reachable across multiple seeds", () => {
        for (const seed of Array.from({ length: 1_000 }, (_, index) => `route-${index}`)) {
            const map = createExploreMap(seed);
            expect(reachableFromStart(map.edges).size).toBe(map.nodes.length);
            expect(map.nodes.filter((node) => node.encounterId === "root-tangle")).toHaveLength(1);

            for (const depth of [1, 2, 3, 4, 6]) {
                const layer = map.nodes.filter((node) => node.depth === depth);
                expect(new Set(layer.map((node) => node.kind)).size).toBe(layer.length);
            }

            for (const node of map.nodes.filter((candidate) => candidate.depth < 8)) {
                const choices = getAvailableNodeIds(node.id, map.edges, [node.id]);
                expect(choices.length).toBeGreaterThan(0);
                expect(choices.length).toBeLessThanOrEqual(3);
            }
        }
    });
});
