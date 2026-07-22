import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAKIMODON_DISCOVERY_PAGE } from "../../domain/explore";
import { DiscoveryPageArt } from "./DiscoveryPageArt";

describe("DiscoveryPageArt registry", () => {
    it("renders legacy-stored opening discoveries with Makimodon artwork", () => {
        const markup = renderToStaticMarkup(
            <DiscoveryPageArt
                definition={MAKIMODON_DISCOVERY_PAGE}
                discoveredFeatureIds={MAKIMODON_DISCOVERY_PAGE.chain.featureIds}
            />,
        );

        expect(markup).toContain("makimodon-research-art");
        expect(markup).not.toContain("jabarapon-research-art");
    });
});
