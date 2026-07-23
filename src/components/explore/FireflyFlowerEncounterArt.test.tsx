import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    FireflyFlowerEncounterArt,
    type FireflyFlowerArtStage,
} from "./FireflyFlowerEncounterArt";

const renderStage = (stage: FireflyFlowerArtStage) => renderToStaticMarkup(
    <FireflyFlowerEncounterArt stage={stage} />,
);

describe("FireflyFlowerEncounterArt", () => {
    it.each([
        ["waiting", 0],
        ["dew-trail", 1],
        ["warm-bud", 2],
        ["ringing-petals", 3],
    ] as const)("renders the %s clue state in one stable camera", (stage, clueCount) => {
        const markup = renderStage(stage);

        expect(markup).toContain('data-camera-key="firefly-flower-side-v1"');
        expect(markup).toContain(`data-stage="${stage}"`);
        expect(markup).toContain(`data-clue-count="${clueCount}"`);
    });

    it("builds dew, warmth, and ringing petals without a raster backdrop", () => {
        const dewMarkup = renderStage("dew-trail");
        const warmMarkup = renderStage("warm-bud");
        const ringingMarkup = renderStage("ringing-petals");

        expect(dewMarkup.match(/data-dew-drop=/g)).toHaveLength(4);
        expect(warmMarkup).toContain('data-bud-temperature="warm"');
        expect(ringingMarkup.match(/data-petal-state="open"/g)).toHaveLength(5);
        expect(ringingMarkup).toContain('data-light-path="setup"');
        expect(ringingMarkup).not.toContain("<image");
    });

    it("provides physical stage meaning with sound and motion removed", () => {
        const markup = renderToStaticMarkup(
            <FireflyFlowerEncounterArt stage="ringing-petals" reducedMotion />,
        );

        expect(markup).toContain('role="img"');
        expect(markup).toContain("五枚の長い花びらが鈴のように開き");
        expect(markup).toContain("葉帽子のポッコは足を広げ");
        expect(markup).not.toContain("リボン触角");
        expect(markup).toContain('data-reduced-motion="true"');
        expect(markup).toContain('data-companion-pose="listen"');
    });

    it("can omit the companion and become silent inside an already labelled host", () => {
        const markup = renderToStaticMarkup(
            <FireflyFlowerEncounterArt stage="dew-trail" companion={false} decorative />,
        );

        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain('role="img"');
        expect(markup).not.toContain('data-layer="companion"');
        expect(markup).not.toContain("<title");
    });
});
