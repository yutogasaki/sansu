import { describe, expect, it } from "vitest";
import {
    ATTEMPT_SAVING_NOTICE_DELAY_MS,
    INITIAL_EXPLORE_PHASE,
    RAPID_LOOP_CORRECT_HOLD_MS,
    getRapidLoopIncorrectRetryDelayMs,
    RAPID_LOOP_INCORRECT_HOLD_MS,
    RAPID_LOOP_INCORRECT_HARD_LIMIT_MS,
    RAPID_LOOP_INCORRECT_RETRY_TARGET_MS,
    RAPID_LOOP_CORRECT_OPERABLE_TARGET_MS,
    RAPID_LOOP_PAYOFF_HOLD_MS,
    RAPID_LOOP_REVEAL_DELAY_MS,
    selectConfirmedResearchPage,
} from "./Explore";
import { selectOpeningProblemPresentation } from "../components/explore/rootPullPresentation";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
    RAPID_LOOP_AUTO_BRIDGE_PLAN,
    type DiscoveryInstance,
    type DiscoveryPageFeatureId,
    type DiscoveryPageId,
    selectDeterministicRapidLoopNodeId,
    shouldAutoRouteExplorePath,
} from "../domain/explore";

const researchDiscovery = (
    id: string,
    pageId: DiscoveryPageId,
    featureId: DiscoveryPageFeatureId,
): DiscoveryInstance => ({
    id,
    kind: "flower",
    name: id,
    rarity: "common",
    nodeId: `node-${id}`,
    discoveryPageId: pageId,
    discoveryFeatureId: featureId,
});

describe("explore rapid-loop policy", () => {
    it("starts directly in the run and keeps feedback under the tempo budget", () => {
        expect(INITIAL_EXPLORE_PHASE).toBe("run");
        expect(RAPID_LOOP_CORRECT_HOLD_MS).toBeLessThanOrEqual(180);
        expect(RAPID_LOOP_PAYOFF_HOLD_MS).toBeGreaterThan(RAPID_LOOP_CORRECT_HOLD_MS);
        expect(RAPID_LOOP_PAYOFF_HOLD_MS).toBeLessThanOrEqual(900);
        expect(RAPID_LOOP_REVEAL_DELAY_MS).toBeLessThanOrEqual(120);
        expect(RAPID_LOOP_INCORRECT_HOLD_MS).toBeLessThanOrEqual(550);
        expect(RAPID_LOOP_INCORRECT_HARD_LIMIT_MS).toBe(520);
        expect(RAPID_LOOP_INCORRECT_RETRY_TARGET_MS).toBe(420);
        expect(RAPID_LOOP_CORRECT_OPERABLE_TARGET_MS).toBeLessThanOrEqual(650);
        expect(ATTEMPT_SAVING_NOTICE_DELAY_MS).toBe(250);
        expect(RAPID_LOOP_AUTO_BRIDGE_PLAN).toBe("stones");
    });

    it("spends the incorrect retry budget from submit time instead of after save", () => {
        expect(getRapidLoopIncorrectRetryDelayMs(0)).toBe(420);
        expect(getRapidLoopIncorrectRetryDelayMs(100)).toBe(320);
        expect(getRapidLoopIncorrectRetryDelayMs(420)).toBe(0);
        expect(getRapidLoopIncorrectRetryDelayMs(900)).toBe(0);
        expect(getRapidLoopIncorrectRetryDelayMs(-10)).toBe(420);
    });

    it("changes only the opening art selected by presentationKey", () => {
        expect(selectOpeningProblemPresentation("classic")).toBe("makimodon");
        expect(selectOpeningProblemPresentation("root-pull")).toBe("root-pull");
        expect(selectOpeningProblemPresentation("snap-root")).toBe("snap-root");
    });

    it("starts the opening immediately, then shows a real choice every three answers", () => {
        expect(shouldAutoRouteExplorePath(0, 0)).toBe(false);
        expect(shouldAutoRouteExplorePath(0, 2)).toBe(true);
        expect(shouldAutoRouteExplorePath(0, 1)).toBe(true);
        expect(shouldAutoRouteExplorePath(1, 2)).toBe(true);
        expect(shouldAutoRouteExplorePath(2, 2)).toBe(true);
        expect(shouldAutoRouteExplorePath(3, 2)).toBe(false);
        expect(shouldAutoRouteExplorePath(3, 1)).toBe(true);
        expect(shouldAutoRouteExplorePath(4, 0)).toBe(false);
        expect(shouldAutoRouteExplorePath(8, 1)).toBe(false);
    });

    it("selects the nearest route deterministically without mutating candidates", () => {
        const candidates = [
            { id: "node-right", x: 80 },
            { id: "node-left", x: 20 },
            { id: "node-far", x: 95 },
        ] as const;

        expect(selectDeterministicRapidLoopNodeId(candidates, 50)).toBe("node-left");
        expect(candidates.map((node) => node.id)).toEqual([
            "node-right",
            "node-left",
            "node-far",
        ]);
        expect(selectDeterministicRapidLoopNodeId([
            { id: "node-b", x: 50 },
            { id: "node-a", x: 50 },
        ], 50)).toBe("node-a");
    });
});

describe("confirmed research page selection", () => {
    it("uses the latest completed page instead of the first completed page", () => {
        const finds = [
            ...MAKIMODON_DISCOVERY_PAGE.chain.featureIds.map((featureId, index) => (
                researchDiscovery(`makimodon-${index}`, MAKIMODON_DISCOVERY_PAGE.id, featureId)
            )),
            ...FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds.map((featureId, index) => (
                researchDiscovery(`firefly-${index}`, FIREFLY_FLOWER_DISCOVERY_PAGE.id, featureId)
            )),
        ];

        const selected = selectConfirmedResearchPage(finds);

        expect(selected?.definition).toBe(FIREFLY_FLOWER_DISCOVERY_PAGE);
        expect(selected?.discoveredFeatureIds).toEqual(
            FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
        );
    });

    it("shows the latest progressed main page even when an older page is complete", () => {
        const finds = [
            ...MAKIMODON_DISCOVERY_PAGE.chain.featureIds.map((featureId, index) => (
                researchDiscovery(`makimodon-${index}`, MAKIMODON_DISCOVERY_PAGE.id, featureId)
            )),
            researchDiscovery(
                "firefly-0",
                FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds[0],
            ),
        ];

        expect(selectConfirmedResearchPage(finds)?.definition).toBe(FIREFLY_FLOWER_DISCOVERY_PAGE);
    });
});
