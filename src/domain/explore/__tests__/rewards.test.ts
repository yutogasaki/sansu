import { describe, expect, it } from "vitest";
import { FIREFLY_FLOWER_DISCOVERY_PAGE } from "../discoveryPageCatalog";
import { createDiscoveryForNode } from "../rewards";
import type { DiscoveryInstance, ExploreNode } from "../types";

const OPENING_NODE: ExploreNode = {
    id: "node-1-0",
    depth: 1,
    lane: 0,
    x: 50,
    y: 80,
    kind: "soil",
    title: "やわらかい土",
    hint: "なにか ありそう",
};

describe("explore rewards", () => {
    it.each(["opening-a", "opening-b", "opening-c", "opening-d"])(
        "keeps opening reward %s common and outside every research page",
        (seed) => {
            const discovery = createDiscoveryForNode({
                node: OPENING_NODE,
                seed,
                ordinal: 0,
                priorDiscoveries: [],
                rewardPhase: "opening",
            });

            expect(discovery.rarity).toBe("common");
            expect(discovery.discoveryPageId).toBeUndefined();
            expect(discovery.discoveryFeatureId).toBeUndefined();
            expect(discovery.observationId).toBeUndefined();
        },
    );

    it("keeps the Q7 page payoff when the learning problem has no authored encounter", () => {
        const priorDiscoveries: DiscoveryInstance[] = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds
            .slice(0, -1)
            .map((featureId, index) => ({
                id: `clue-${index}`,
                kind: "flower",
                name: "ほたる花",
                rarity: "common",
                nodeId: `node-${index}`,
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: featureId,
            }));

        const discovery = createDiscoveryForNode({
            node: { ...OPENING_NODE, id: "node-7-0", depth: 7 },
            seed: "generic-q7-payoff",
            ordinal: 6,
            priorDiscoveries,
            rewardPhase: "finale",
        });

        expect(discovery).toEqual(expect.objectContaining({
            rarity: "rare",
            discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
        }));
        expect(discovery.observationId).toBeUndefined();
    });
});
