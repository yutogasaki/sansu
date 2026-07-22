import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
} from "../../domain/explore";
import {
    DiscoveryReveal,
    isBlockingDiscoveryReveal,
    NON_BLOCKING_DISCOVERY_DURATION_MS,
} from "./DiscoveryReveal";

describe("discovery reveal interaction contract", () => {
    it("keeps ordinary finds and research clues non-blocking for 900ms", () => {
        expect(NON_BLOCKING_DISCOVERY_DURATION_MS).toBe(900);
        expect(isBlockingDiscoveryReveal({
            name: "ちいさな ひょうほん",
            kind: "crystal",
            rarity: "common",
        })).toBe(false);
        expect(isBlockingDiscoveryReveal({
            name: "ひかる しずく",
            kind: "flower",
            rarity: "rare",
            discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds[0],
        })).toBe(false);
    });

    it("blocks only rare finds and the final big discovery", () => {
        expect(isBlockingDiscoveryReveal({
            name: "めずらしい ひょうほん",
            kind: "fossil",
            rarity: "rare",
        })).toBe(true);
        expect(isBlockingDiscoveryReveal({
            name: "ほたる花の ひかり道",
            kind: "flower",
            rarity: "rare",
            discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
        })).toBe(true);
    });

    it("replaces only the Root Pull opening payoff display while keeping legacy IDs", () => {
        const currentFeatureId = MAKIMODON_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId;
        const sharedProps = {
            discovery: {
                name: "legacy internal discovery",
                kind: "flower" as const,
                rarity: "rare" as const,
                discoveryPageId: MAKIMODON_DISCOVERY_PAGE.id,
                discoveryFeatureId: currentFeatureId,
            },
            researchPage: {
                definition: MAKIMODON_DISCOVERY_PAGE,
                currentFeatureId,
                discoveredFeatureIds: MAKIMODON_DISCOVERY_PAGE.chain.featureIds,
            },
            onContinue: () => undefined,
        };

        const rootPullMarkup = renderToStaticMarkup(React.createElement(DiscoveryReveal, {
            ...sharedProps,
            openingPresentation: "root-pull",
        }));
        const classicMarkup = renderToStaticMarkup(React.createElement(
            DiscoveryReveal,
            sharedProps,
        ));

        expect(rootPullMarkup).toContain("土から スポンと ぬけた 根っこの子");
        expect(rootPullMarkup).toContain("/assets/explore/opening-root-pull-v1/payoff.jpg");
        expect(rootPullMarkup).not.toContain("ぜんぶ まきもどった");
        expect(classicMarkup).toContain("ぜんぶ まきもどった");
        expect(classicMarkup).toContain("マキモドン");
    });
});
