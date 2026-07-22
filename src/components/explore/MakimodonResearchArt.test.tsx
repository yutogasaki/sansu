import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MAKIMODON_DISCOVERY_PAGE } from "../../domain/explore";
import { MakimodonResearchArt } from "./MakimodonResearchArt";

describe("MakimodonResearchArt", () => {
    it("keeps the rolled creature unnamed while only a setup clue is known", () => {
        const markup = renderToStaticMarkup(
            <MakimodonResearchArt
                discoveredFeatureIds={[MAKIMODON_DISCOVERY_PAGE.chain.featureIds[0]]}
            />,
        );

        expect(markup).toContain("まだ名前のわからない巻かれた生き物");
        expect(markup).not.toContain("マキモドン");
    });

    it("archives two small causes around one large named payoff", () => {
        const markup = renderToStaticMarkup(
            <MakimodonResearchArt
                discoveredFeatureIds={MAKIMODON_DISCOVERY_PAGE.chain.featureIds}
            />,
        );

        expect(markup).toContain('data-composition="large-payoff-two-causes"');
        expect(markup.match(/data-role="cause"/g)).toHaveLength(2);
        expect(markup.match(/data-role="payoff"/g)).toHaveLength(1);
        expect(markup).toContain("くるくる もどって、どん。");
        expect(markup).toContain("マキモドン！");
        expect(markup).toContain("ぜんぶ まきもどった！");
        expect(markup).toContain("あいぼうが せなかへ どん。");
    });
});
