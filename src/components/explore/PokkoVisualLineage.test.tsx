import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FireflyFlowerResearchArt } from "./FireflyFlowerResearchArt";
import { ResearchLibraryScene } from "./ResearchLibraryScene";
import { RibbonAntennaCompanion } from "./RibbonAntennaCompanion";

describe("Pokko visual lineage", () => {
    it.each(["ready", "trace", "listen"] as const)(
        "keeps Pokko's leaf-hat model in the %s pose",
        (pose) => {
            const markup = renderToStaticMarkup(
                <svg>
                    <RibbonAntennaCompanion pose={pose} />
                </svg>,
            );

            expect(markup).toContain('data-character-id="pokko"');
            expect(markup).toContain('data-visual-lineage-id="pokko-field-v1"');
            expect(markup).toContain(`data-companion-pose="${pose}"`);
            expect(markup).toContain("ribbon-antenna-companion__hat");
            expect(markup).toContain("ribbon-antenna-companion__body-texture");
            expect(markup).not.toContain("ribbon-antenna-companion__antennae");
        },
    );

    it("uses the same Pokko model in the research illustration", () => {
        const markup = renderToStaticMarkup(
            <FireflyFlowerResearchArt discoveredFeatureIds={[]} />,
        );

        expect(markup).toContain('data-visual-candidate-id="firefly-field-book-painted-v5"');
        expect(markup).toContain('data-visual-mode="field-book"');
        expect(markup).toContain("/assets/explore/firefly-flower/scene-waiting-stumble-bloom-pokko-v5.jpg");
        expect(markup).toContain('data-character-id="pokko"');
        expect(markup).not.toContain("firefly-research-pokko-v1");
    });

    it("uses the same Pokko model after returning to the library", () => {
        const markup = renderToStaticMarkup(
            <ResearchLibraryScene
                status="returned"
                storyLine="はっけんを もちかえった"
                onRestart={vi.fn()}
            />,
        );

        expect(markup).toContain('data-testid="research-library-scene"');
        expect(markup).toContain('data-visual-candidate-id="research-library-pokko-v1"');
        expect(markup).toContain('data-visual-mode="archive"');
        expect(markup).toContain('data-character-id="pokko"');
    });
});
