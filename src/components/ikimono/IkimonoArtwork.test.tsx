import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IkimonoArtwork } from "./IkimonoArtwork";

describe("IkimonoArtwork", () => {
    it("ships a code-native fallback alongside the runtime WebP", () => {
        const markup = renderToStaticMarkup(
            <IkimonoArtwork species={2} imageSuffix={3} alt="ふわふわ" />,
        );

        expect(markup).toContain("<svg");
        expect(markup).toContain('/ikimono/2-3.webp');
        expect(markup).not.toContain(".png");
        expect(markup).toContain('role="img"');
        expect(markup).toContain('aria-label="ふわふわ"');
    });

    it("normalizes an out-of-range species to an available runtime asset", () => {
        const markup = renderToStaticMarkup(
            <IkimonoArtwork species={-13} imageSuffix={1} />,
        );

        expect(markup).toContain('/ikimono/3-1.webp');
    });
});
