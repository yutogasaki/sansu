import { describe, expect, it } from "vitest";
import { FIREFLY_FLOWER_DISCOVERY_PAGE } from "../discoveryPageCatalog";
import { selectExploreDiscoveryPresentation } from "../rewardPresentation";
import type { DiscoveryInstance } from "../types";

const discovery = (
    overrides: Partial<DiscoveryInstance> = {},
): DiscoveryInstance => ({
    id: "find-1",
    kind: "fossil",
    name: "星もようの化石",
    rarity: "common",
    nodeId: "node-1-0",
    ...overrides,
});

describe("explore discovery presentation arbiter", () => {
    it.each([1, 2, 3])("absorbs opening reward after Q%s", (completedSteps) => {
        expect(selectExploreDiscoveryPresentation({
            discovery: discovery({ rarity: "rare" }),
            completedSteps,
            hasAvailableNodes: true,
            rescuePending: false,
        })).toBe("absorbed-opening");
    });

    it("keeps ordinary and rare specimens ambient during research", () => {
        for (const rarity of ["common", "rare"] as const) {
            expect(selectExploreDiscoveryPresentation({
                discovery: discovery({ rarity }),
                completedSteps: 5,
                hasAvailableNodes: true,
                rescuePending: false,
            })).toBe("ambient");
        }
    });

    it("defers a terminal specimen to the return summary", () => {
        expect(selectExploreDiscoveryPresentation({
            discovery: discovery({ rarity: "rare" }),
            completedSteps: 8,
            hasAvailableNodes: false,
            rescuePending: false,
        })).toBe("deferred-return");
    });

    it("does not promote an unexpected early dead-end into the terminal beat", () => {
        expect(selectExploreDiscoveryPresentation({
            discovery: discovery(),
            completedSteps: 6,
            hasAvailableNodes: false,
            rescuePending: false,
        })).toBe("ambient");
    });

    it("lets a semantic big discovery block even at a terminal boundary", () => {
        expect(selectExploreDiscoveryPresentation({
            discovery: discovery({
                rarity: "rare",
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
            }),
            completedSteps: 8,
            hasAvailableNodes: false,
            rescuePending: true,
        })).toBe("blocking");
    });
});
