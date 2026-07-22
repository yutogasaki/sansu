import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RootPullDiscoveryReveal } from "./RootPullDiscoveryReveal";

describe("RootPullDiscoveryReveal", () => {
    it("uses the payoff scene and Root Pull physical discovery copy", () => {
        const markup = renderToStaticMarkup(
            <RootPullDiscoveryReveal onContinue={() => undefined} />,
        );

        expect(markup).toContain('role="dialog"');
        expect(markup).toContain('data-opening-discovery="root-pull"');
        expect(markup).toContain('data-stage="comic-release"');
        expect(markup).toContain("/assets/explore/opening-root-pull-v1/payoff.jpg");
        expect(markup).toContain("土から スポンと ぬけた 根っこの子");
        expect(markup).toContain("あいぼうは いきおいで しりもち");
        expect(markup).not.toContain("ぜんぶ まきもどった");
        expect(markup).not.toContain("マキモドン");
    });
});
