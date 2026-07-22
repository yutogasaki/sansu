import { describe, expect, it } from "vitest";
import {
    getDiscoveryPageClueFeatureIds,
    getDiscoveryPageProgress,
    getNextDiscoveryPageClue,
    isDiscoveryPageBigDiscovery,
    isDiscoveryPageBigDiscoveryReady,
    isDiscoveryPageComplete,
    recordDiscoveryPageFeature,
    type DiscoveryPageFeatureId,
} from "../discoveryPage";
import {
    DISCOVERY_PAGE_CATALOG,
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    JABARAPON_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
    getDiscoveryPageDefinition,
} from "../discoveryPageCatalog";

const PAGE = FIREFLY_FLOWER_DISCOVERY_PAGE;

describe("discovery page catalog", () => {
    it("uses stable, unique IDs and ends its chain with the big discovery", () => {
        const featureIds = PAGE.features.map((feature) => feature.id);

        expect(PAGE.id).toMatch(/^discovery-page:/);
        expect(PAGE.chain.id).toMatch(/^discovery-chain:/);
        expect(new Set(featureIds).size).toBe(featureIds.length);
        expect(PAGE.chain.featureIds).toEqual(featureIds);
        expect(PAGE.chain.featureIds.at(-1)).toBe(PAGE.chain.bigDiscoveryFeatureId);
        expect(DISCOVERY_PAGE_CATALOG).toHaveLength(2);
        expect(getDiscoveryPageDefinition(PAGE.id)).toBe(PAGE);
        expect(getDiscoveryPageDefinition(MAKIMODON_DISCOVERY_PAGE.id)).toBe(
            MAKIMODON_DISCOVERY_PAGE,
        );
    });
});

describe("Makimodon rapid-loop discovery progression", () => {
    it("uses two setup findings and the third finding as its big physical payoff", () => {
        const clueFeatureIds = getDiscoveryPageClueFeatureIds(MAKIMODON_DISCOVERY_PAGE);

        expect(clueFeatureIds).toEqual(
            MAKIMODON_DISCOVERY_PAGE.chain.featureIds.slice(0, 2),
        );
        expect(getDiscoveryPageProgress(MAKIMODON_DISCOVERY_PAGE, clueFeatureIds)).toEqual({
            discoveredClueCount: 2,
            clueTarget: 2,
            isComplete: false,
        });
        expect(getDiscoveryPageProgress(
            MAKIMODON_DISCOVERY_PAGE,
            MAKIMODON_DISCOVERY_PAGE.chain.featureIds,
        )).toEqual({
            discoveredClueCount: 2,
            clueTarget: 2,
            isComplete: true,
        });
    });

    it("names the creature only on the archived reveal and records its physical joke", () => {
        const [trip, path, payoff] = MAKIMODON_DISCOVERY_PAGE.features;

        expect(MAKIMODON_DISCOVERY_PAGE.title).toBe(
            "くるくる もどって、どん。マキモドン！",
        );
        expect(trip.finding).toBe("まきまきが ほどけて、ぺたん。");
        expect(path.finding).toBe("ながく ほどけて、みちに なった。");
        expect(payoff.title).toBe("ぜんぶ まきもどった！");
        expect(payoff.finding).toBe("あいぼうが せなかへ どん。");
    });

    it("keeps legacy-stable storage IDs while the visible subject changes", () => {
        expect(MAKIMODON_DISCOVERY_PAGE.id).toBe("discovery-page:jabarapon");
        expect(MAKIMODON_DISCOVERY_PAGE.chain.featureIds).toEqual([
            "discovery-feature:jabarapon-two-legs",
            "discovery-feature:jabarapon-four-legs",
            "discovery-feature:jabarapon-six-legs",
        ]);
        expect(JABARAPON_DISCOVERY_PAGE).toBe(MAKIMODON_DISCOVERY_PAGE);
    });
});

describe("golden discovery page progression", () => {
    it("reports clue progress separately from the final big discovery", () => {
        const clueFeatureIds = getDiscoveryPageClueFeatureIds(PAGE);

        expect(clueFeatureIds).toEqual(PAGE.chain.featureIds.slice(0, -1));
        expect(getDiscoveryPageProgress(PAGE, clueFeatureIds.slice(0, 2))).toEqual({
            discoveredClueCount: 2,
            clueTarget: 3,
            isComplete: false,
        });
        expect(getDiscoveryPageProgress(PAGE, PAGE.chain.featureIds)).toEqual({
            discoveredClueCount: 3,
            clueTarget: 3,
            isComplete: true,
        });
    });

    it("offers exactly one next clue and advances it in chain order", () => {
        let discovered: readonly DiscoveryPageFeatureId[] = [];

        for (const expectedFeatureId of PAGE.chain.featureIds) {
            expect(getNextDiscoveryPageClue(PAGE, discovered)).toEqual(expect.objectContaining({
                pageId: PAGE.id,
                chainId: PAGE.chain.id,
                targetFeatureId: expectedFeatureId,
            }));
            discovered = recordDiscoveryPageFeature(PAGE, discovered, expectedFeatureId);
        }

        expect(getNextDiscoveryPageClue(PAGE, discovered)).toBeUndefined();
    });

    it("does not add the same feature twice", () => {
        const firstFeatureId = PAGE.chain.featureIds[0];
        const once = recordDiscoveryPageFeature(PAGE, [], firstFeatureId);
        const twice = recordDiscoveryPageFeature(PAGE, once, firstFeatureId);

        expect(twice).toBe(once);
        expect(twice).toEqual([firstFeatureId]);
    });

    it("rejects an out-of-order or unknown feature", () => {
        expect(() => recordDiscoveryPageFeature(PAGE, [], PAGE.chain.featureIds[1])).toThrow(
            "is not the next discovery",
        );
        expect(() => recordDiscoveryPageFeature(
            PAGE,
            [],
            "discovery-feature:unknown" as DiscoveryPageFeatureId,
        )).toThrow("does not contain feature");
    });

    it("marks the final feature as ready and complete only at the big discovery", () => {
        const discoveriesBeforeBig = PAGE.chain.featureIds.slice(0, -1);
        const bigDiscoveryFeatureId = PAGE.chain.bigDiscoveryFeatureId;

        expect(isDiscoveryPageBigDiscovery(PAGE, discoveriesBeforeBig[0])).toBe(false);
        expect(isDiscoveryPageBigDiscovery(PAGE, bigDiscoveryFeatureId)).toBe(true);
        expect(isDiscoveryPageBigDiscoveryReady(PAGE, discoveriesBeforeBig)).toBe(true);
        expect(isDiscoveryPageComplete(PAGE, discoveriesBeforeBig)).toBe(false);

        const completed = recordDiscoveryPageFeature(PAGE, discoveriesBeforeBig, bigDiscoveryFeatureId);
        expect(isDiscoveryPageBigDiscoveryReady(PAGE, completed)).toBe(false);
        expect(isDiscoveryPageComplete(PAGE, completed)).toBe(true);
    });
});
