import type { ExploreEdge, ExploreNode, ExploreNodeKind } from "./types";

const MAP_DEPTH = 8;
// Keep the opening three-answer ecology beat on ordinary dig nodes. The bridge
// remains an honest, visible encounter in the following Firefly Flower section
// instead of charging a hidden bridge cost behind Makimodon presentation art.
const BRIDGE_DEPTH = 5;
// The opening three-answer Makimodon ecology beat is followed by the three
// Firefly Flower clues. The semantic root observation therefore belongs at
// depth seven, after both chains have had room to read in order.
const ROOT_TANGLE_DEPTHS = [7] as const;
const THREE_CHOICE_DEPTHS = [4, 6] as const;
const NODE_KINDS: ExploreNodeKind[] = ["soil", "crystal", "fossil", "root", "mystery"];

const NODE_COPY: Record<ExploreNodeKind, { title: string; hint: string }> = {
    start: { title: "ひかりの入口", hint: "ここから たんけんが はじまる" },
    soil: { title: "やわらかい土", hint: "ちいさな おたからの けはい" },
    crystal: { title: "きらきら岩", hint: "水晶が ありそう" },
    fossil: { title: "しまもよう岩", hint: "むかしの かけらが ありそう" },
    root: { title: "根っこの道", hint: "ひかる花の かおり" },
    mystery: { title: "なぞの壁", hint: "なにが でるかは おたのしみ" },
    bridge: { title: "ちいさな水路", hint: "橋の しかけを うごかそう" },
};

const ROOT_TANGLE_COPY = {
    title: "根っこの からまり",
    hint: "根の むこうに 花のひかり",
};

export const hashExploreSeed = (value: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const createSeededRandom = (seed: number) => {
    let value = seed >>> 0;
    return () => {
        value += 0x6d2b79f5;
        let mixed = value;
        mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
        mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
};

const nodeId = (depth: number, lane: number) => `node-${depth}-${lane}`;

const getLaneX = (lane: number, laneCount: number) => {
    if (laneCount === 1) return 50;
    if (laneCount === 2) return lane === 0 ? 28 : 72;
    return [18, 50, 82][lane] ?? 50;
};

export const createExploreMap = (seed: string): { nodes: ExploreNode[]; edges: ExploreEdge[] } => {
    const random = createSeededRandom(hashExploreSeed(seed));
    const threeChoiceDepth = THREE_CHOICE_DEPTHS[
        hashExploreSeed(`${seed}:three-choice`) % THREE_CHOICE_DEPTHS.length
    ];
    const rootTangleDepth = ROOT_TANGLE_DEPTHS[
        hashExploreSeed(`${seed}:root-tangle-depth`) % ROOT_TANGLE_DEPTHS.length
    ];
    const getLaneCount = (depth: number) => {
        if (depth === BRIDGE_DEPTH) return 1;
        if (depth >= 7) return 1;
        if (depth === threeChoiceDepth) return 3;
        return 2;
    };
    const nodes: ExploreNode[] = [
        {
            id: "start",
            depth: 0,
            lane: 0,
            x: 50,
            y: 88,
            kind: "start",
            ...NODE_COPY.start,
        },
    ];
    const rootTangleLane = hashExploreSeed(`${seed}:root-tangle-lane`)
        % getLaneCount(rootTangleDepth);

    for (let depth = 1; depth <= MAP_DEPTH; depth += 1) {
        const laneCount = getLaneCount(depth);
        const usedKinds = new Set<ExploreNodeKind>();
        for (let lane = 0; lane < laneCount; lane += 1) {
            const isRootTangle = depth === rootTangleDepth && lane === rootTangleLane;
            let candidates: ExploreNodeKind[] = NODE_KINDS.filter(
                (candidate) => !usedKinds.has(candidate),
            );
            if (depth === rootTangleDepth && !isRootTangle) {
                candidates = candidates.filter((candidate) => candidate !== "root");
            }
            const kind: ExploreNodeKind = depth === BRIDGE_DEPTH
                ? "bridge"
                : isRootTangle
                    ? "root"
                    : candidates[Math.floor(random() * candidates.length)];
            usedKinds.add(kind);
            nodes.push({
                id: nodeId(depth, lane),
                depth,
                lane,
                x: getLaneX(lane, laneCount),
                y: 88 - depth * 9.3,
                kind,
                encounterId: isRootTangle ? "root-tangle" : undefined,
                ...(isRootTangle ? ROOT_TANGLE_COPY : NODE_COPY[kind]),
            });
        }
    }

    const edges: ExploreEdge[] = Array.from({ length: getLaneCount(1) }, (_, lane) => ({
        id: `edge-start-${lane}`,
        from: "start",
        to: nodeId(1, lane),
    }));

    for (let depth = 1; depth < MAP_DEPTH; depth += 1) {
        const fromLaneCount = getLaneCount(depth);
        const toLaneCount = getLaneCount(depth + 1);
        for (let fromLane = 0; fromLane < fromLaneCount; fromLane += 1) {
            for (let toLane = 0; toLane < toLaneCount; toLane += 1) {
                edges.push({
                    id: `edge-${depth}-${fromLane}-${toLane}`,
                    from: nodeId(depth, fromLane),
                    to: nodeId(depth + 1, toLane),
                });
            }
        }
    }

    return { nodes, edges };
};

export const getAvailableNodeIds = (
    currentNodeId: string,
    edges: ExploreEdge[],
    openedNodeIds: string[],
): string[] => edges
    .filter((edge) => edge.from === currentNodeId && !openedNodeIds.includes(edge.to))
    .map((edge) => edge.to);
