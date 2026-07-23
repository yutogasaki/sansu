import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
} from "../../domain/explore";
import { ResearchBookStage } from "./ResearchBookStage";

describe("ResearchBookStage", () => {
    it("archives the completed Firefly Flower page with the painterly Pokko scene", () => {
        const markup = renderToStaticMarkup(
            <ResearchBookStage
                researchPage={{
                    definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                    discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
                }}
                storyLine="花たちの光が、地底の道になった。"
            />,
        );

        expect(markup).toContain('data-visual-candidate-id="firefly-field-book-painted-v2"');
        expect(markup).toContain('data-visual-mode="field-book"');
        expect(markup).toContain('data-character-id="pokko"');
        expect(markup).toContain("/assets/explore/root-tangle/scene-crossed-light-path-pokko-v5.jpg");
        expect(markup).not.toContain("firefly-research-pokko-v1");
    });

    it("keeps non-Firefly legacy pages on their registered archive renderer", () => {
        const markup = renderToStaticMarkup(
            <ResearchBookStage
                researchPage={{
                    definition: MAKIMODON_DISCOVERY_PAGE,
                    discoveredFeatureIds: MAKIMODON_DISCOVERY_PAGE.chain.featureIds,
                }}
                storyLine="見つけたものを ぶじに もちかえった。"
            />,
        );

        expect(markup).not.toContain('data-visual-candidate-id="firefly-field-book-painted-v2"');
        expect(markup).toContain("makimodon-research-art");
        expect(markup).toContain("マキモドン");
    });
});
