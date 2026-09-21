import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExploreHud } from "./ExploreHud";

describe("ExploreHud", () => {
    it("keeps the encounter return control at least 44px square", () => {
        const markup = renderToStaticMarkup(
            <ExploreHud
                energy={8}
                maxEnergy={8}
                researchClueCount={0}
                researchClueTarget={3}
                researchComplete={false}
                showResearch={false}
                steps={0}
                variant="encounter"
                onBack={() => undefined}
            />,
        );

        const backButton = markup.match(/<button[^>]*aria-label="[^"]+"[^>]*>/)?.[0];
        expect(backButton).toContain("h-11 w-11");
        expect(backButton).not.toContain("h-10 w-10");
        expect(backButton).toContain("あそびメニューへ もどる");
        expect(markup).toContain('data-variant="encounter"');
    });
});
