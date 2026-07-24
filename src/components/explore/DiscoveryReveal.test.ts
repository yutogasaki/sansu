import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
    ROOT_TANGLE_OBSERVATION,
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
            name: "葉帽子の しずく",
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
            name: "花のまんなかに 四滴",
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

    it("keeps an ordinary clue from covering the next rapid problem", () => {
        const ordinary = renderToStaticMarkup(React.createElement(DiscoveryReveal, {
            discovery: {
                name: "葉帽子の しずく",
                kind: "flower" as const,
                rarity: "rare" as const,
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds[0],
            },
            suppressNonBlocking: true,
            onContinue: () => undefined,
        }));
        const blocking = renderToStaticMarkup(React.createElement(DiscoveryReveal, {
            discovery: {
                name: "花のまんなかに 四滴",
                kind: "flower" as const,
                rarity: "rare" as const,
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId,
            },
            suppressNonBlocking: true,
            onContinue: () => undefined,
        }));

        expect(ordinary).toContain('class="sr-only"');
        expect(ordinary).toContain('role="status"');
        expect(ordinary).toContain("葉帽子の しずくを バッグに しまったよ");
        expect(ordinary).not.toContain("explore-specimen-card");
        expect(blocking).toContain('role="dialog"');
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
        expect(markup).toContain('data-visual-lineage-id="legacy-mixed-v0"');
        expect(markup).toContain('data-visual-candidate-id="legacy-discovery-page-v0"');
        expect(markup).not.toContain('data-visual-candidate-id="firefly-field-book-painted-v5"');
    });

    it("shows the committed root observation in the same camera before the field book", () => {
        const currentFeatureId = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId;
        const markup = renderToStaticMarkup(React.createElement(DiscoveryReveal, {
            discovery: {
                name: "花のまんなかに 四滴",
                kind: "flower" as const,
                rarity: "rare" as const,
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: currentFeatureId,
            },
            researchPage: {
                definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                currentFeatureId,
                discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
                observation: ROOT_TANGLE_OBSERVATION,
            },
            onContinue: () => undefined,
        }));

        expect(markup).toContain('data-testid="explore-observation-scene"');
        expect(markup).toContain('data-camera-key="root-tangle-side-v4"');
        expect(markup).toContain('data-visual-mode="observation"');
        expect(markup).toContain('data-visual-candidate-id="firefly-field-book-painted-v5"');
        expect(markup).toContain('data-visual-mode="field-book"');
        expect(markup).toContain("/assets/explore/root-tangle/scene-crossed-carry-bloom-pokko-v7.jpg");
        expect(markup).toContain("object-contain");
        expect(markup).toContain(ROOT_TANGLE_OBSERVATION.copy.action);
        expect(markup).toContain(ROOT_TANGLE_OBSERVATION.copy.reaction);
    });

    it("keeps a generic Q7 finale in the painted Pokko world without inventing a root encounter", () => {
        const currentFeatureId = FIREFLY_FLOWER_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId;
        const markup = renderToStaticMarkup(React.createElement(DiscoveryReveal, {
            discovery: {
                name: "花のまんなかに 四滴",
                kind: "flower" as const,
                rarity: "rare" as const,
                discoveryPageId: FIREFLY_FLOWER_DISCOVERY_PAGE.id,
                discoveryFeatureId: currentFeatureId,
            },
            researchPage: {
                definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                currentFeatureId,
                discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
            },
            onContinue: () => undefined,
        }));

        expect(markup).toContain('data-visual-lineage-id="pokko-field-v1"');
        expect(markup).toContain('data-visual-candidate-id="firefly-q7-stumble-bloom-v5"');
        expect(markup).toContain('data-painted-stage="light-path"');
        expect(markup).toContain('data-light-path="complete"');
        expect(markup).toContain('data-discovery-complete="true"');
        expect(markup).toContain("/assets/explore/firefly-flower/scene-light-path-stumble-bloom-pokko-v5.jpg");
        expect(markup).toContain("花のまんなかに 四滴！");
        expect(markup).toContain("葉帽子が片目へずれた");
        expect(markup).toContain("尻もちのまま にっこり");
        expect(markup).not.toContain("跳ね返り");
        expect(markup).not.toContain("葉帽子へ戻った");
        expect(markup).not.toContain("firefly-research-pokko-v1");
        expect(markup).not.toContain("RibbonAntennaCompanion");
        expect(markup).not.toContain("/assets/explore/root-tangle/");
        expect(markup).not.toContain('data-visual-lineage-id="legacy-mixed-v0"');
    });
});
