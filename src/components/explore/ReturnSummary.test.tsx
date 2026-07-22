import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAKIMODON_DISCOVERY_PAGE } from "../../domain/explore";
import { ReturnSummary } from "./ReturnSummary";

describe("ReturnSummary", () => {
    it("describes a completed page with its own big-discovery finding", () => {
        const markup = renderToStaticMarkup(
            <ReturnSummary
                status="returned"
                finds={[]}
                steps={3}
                energy={8}
                researchPage={{
                    definition: MAKIMODON_DISCOVERY_PAGE,
                    discoveredFeatureIds: MAKIMODON_DISCOVERY_PAGE.chain.featureIds,
                }}
                onRestart={() => undefined}
                onExit={() => undefined}
            />,
        );

        const finalFeature = MAKIMODON_DISCOVERY_PAGE.features.find((feature) => (
            feature.id === MAKIMODON_DISCOVERY_PAGE.chain.bigDiscoveryFeatureId
        ));

        expect(markup).toContain(finalFeature?.finding);
        expect(markup).toContain("マキモドン");
    });
});
