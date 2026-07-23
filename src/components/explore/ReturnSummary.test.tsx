import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FIREFLY_FLOWER_DISCOVERY_PAGE,
    MAKIMODON_DISCOVERY_PAGE,
    ROOT_TANGLE_OBSERVATION,
} from "../../domain/explore";
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
        expect(markup).toContain("はっけんを もちかえった！");
    });

    it("offers one honest replay action toward a different route", () => {
        const markup = renderToStaticMarkup(
            <ReturnSummary
                status="rescued"
                finds={[]}
                steps={8}
                energy={0}
                replayTeaser={{
                    nodeId: "node-4-1",
                    kind: "root",
                    title: "根っこの道",
                    hint: "ひかる花の かおり",
                    reason: "alternate-route",
                }}
                onRestart={() => undefined}
                onExit={() => undefined}
            />,
        );

        expect(markup).toContain("気球と ぶじに かえった！");
        expect(markup).toContain("根っこの道に 出会えるかも");
        expect(markup.match(/ちがう道へ しゅっぱつ/g)).toHaveLength(1);
        expect(markup).not.toContain("もういちど たんけん");
    });

    it("keeps the committed observation finding in the return story", () => {
        const markup = renderToStaticMarkup(
            <ReturnSummary
                status="returned"
                finds={[]}
                steps={8}
                energy={1}
                researchPage={{
                    definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                    discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
                    observation: ROOT_TANGLE_OBSERVATION,
                }}
                onRestart={() => undefined}
                onExit={() => undefined}
            />,
        );

        expect(markup).toContain(ROOT_TANGLE_OBSERVATION.copy.finding);
        expect(markup).not.toContain("花たちの光が ひとすじの道になった");
    });

    it("uses the neutral droplet finding when no root observation was committed", () => {
        const markup = renderToStaticMarkup(
            <ReturnSummary
                status="returned"
                finds={[]}
                steps={8}
                energy={3}
                researchPage={{
                    definition: FIREFLY_FLOWER_DISCOVERY_PAGE,
                    discoveredFeatureIds: FIREFLY_FLOWER_DISCOVERY_PAGE.chain.featureIds,
                }}
                onRestart={() => undefined}
                onExit={() => undefined}
            />,
        );

        expect(markup).toContain("四つのしずくが 一本の道を走り、花が ひらいた");
        expect(markup).not.toContain("ねっこが ほどけた先");
    });

    it("does not claim the final light path for an incomplete page", () => {
        const markup = renderToStaticMarkup(
            <ReturnSummary
                status="returned"
                finds={[{
                    id: "rare-1",
                    name: "にじの水晶",
                    kind: "crystal",
                    rarity: "rare",
                }]}
                steps={5}
                energy={7}
                researchPage={{
                    definition: MAKIMODON_DISCOVERY_PAGE,
                    discoveredFeatureIds: MAKIMODON_DISCOVERY_PAGE.chain.featureIds.slice(0, 2),
                }}
                onRestart={() => undefined}
                onExit={() => undefined}
            />,
        );

        expect(markup).toContain("にじの水晶を みつけて、ぶじに もちかえった。");
        expect(markup).not.toContain("にじの水晶の ひかりまで");
    });
});
