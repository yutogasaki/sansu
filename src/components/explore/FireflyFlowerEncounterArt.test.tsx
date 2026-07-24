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
        ["light-path", 3],
    ] as const)("renders the %s clue state in one stable camera", (stage, clueCount) => {
        const markup = renderStage(stage);

        expect(markup).toContain('data-camera-key="firefly-flower-side-v5"');
        expect(markup).toContain('data-visual-candidate-id="firefly-stumble-bloom-painted-v5"');
        expect(markup).toContain('data-visual-mode="world-painted"');
        expect(markup).toContain(`data-stage="${stage}"`);
        expect(markup).toContain(`data-clue-count="${clueCount}"`);
    });

    it("preloads all same-camera painted states and activates only the requested plate", () => {
        const dewMarkup = renderStage("dew-trail");
        const warmMarkup = renderStage("warm-bud");
        const ringingMarkup = renderStage("ringing-petals");
        const lightPathMarkup = renderStage("light-path");

        expect(dewMarkup).toContain("scene-waiting-stumble-bloom-pokko-v5.jpg");
        expect(dewMarkup).toContain("scene-dew-trail-stumble-bloom-pokko-v5.jpg");
        expect(dewMarkup).toContain("scene-light-path-stumble-bloom-pokko-v5.jpg");
        expect(dewMarkup).toContain('data-painted-stage="dew-trail" data-active="true"');
        expect(warmMarkup).toContain('data-painted-stage="warm-bud" data-active="true"');
        expect(ringingMarkup).toContain('data-painted-stage="ringing-petals" data-active="true"');
        expect(ringingMarkup).toContain('data-light-path="setup"');
        expect(lightPathMarkup).toContain('data-painted-stage="light-path" data-active="true"');
        expect(lightPathMarkup).toContain('data-light-path="complete"');
    });

    it("provides physical stage meaning with sound and motion removed", () => {
        const markup = renderToStaticMarkup(
            <FireflyFlowerEncounterArt stage="light-path" reducedMotion />,
        );

        expect(markup).toContain('role="img"');
        expect(markup).toContain("四つのしずくが開いた花の中心へおさまり");
        expect(markup).toContain("帽子のふちが片目へかぶさった");
        expect(markup).toContain("安全に座っている");
        expect(markup).toContain('data-reduced-motion="true"');
        expect(markup).toContain('data-character-id="pokko"');
    });

    it("becomes silent inside an already labelled host", () => {
        const markup = renderToStaticMarkup(
            <FireflyFlowerEncounterArt stage="dew-trail" decorative />,
        );

        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain('role="img"');
        expect(markup).not.toContain("aria-label");
    });
});
