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

    it("blocks only the final semantic big discovery", () => {
        expect(isBlockingDiscoveryReveal({
            name: "めずらしい ひょうほん",
            kind: "fossil",
            rarity: "rare",
        })).toBe(false);
        expect(isBlockingDiscoveryReveal({
            name: "ほたる花の ひかり道",
            kind: "flower",
            rarity: "rare",
            discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
            discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
        })).toBe(true);
    });

    it("keeps a standalone rare specimen ambient and focus-neutral", () => {
        const markup = renderToStaticMarkup(
            React.createElement(DiscoveryReveal, {
                discovery: {
                    name: "星もようの化石",
                    kind: "fossil",
                    rarity: "rare",
                },
                onContinue: () => undefined,
            }),
        );

        expect(markup).toContain('role="status"');
        expect(markup).toContain("めずらしい ひょうほん");
        expect(markup).not.toContain('role="dialog"');
        expect(markup).not.toContain("ひょうほんを バッグへ");
    });

    it("keeps legacy stored opening pages readable without using them for new rewards", () => {
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

        const markup = renderToStaticMarkup(React.createElement(
            DiscoveryReveal,
            sharedProps,
        ));

        expect(markup).toContain("ぜんぶ まきもどった");
        expect(markup).toContain("マキモドン");
    });
});
