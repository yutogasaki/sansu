import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokkoBaseArt } from "./PokkoBaseArt";

describe("PokkoBaseArt", () => {
    it("keeps the canonical Pokko lineage in the painterly base mode", () => {
        const markup = renderToStaticMarkup(<PokkoBaseArt />);

        expect(markup).toContain('data-visual-lineage-id="pokko-field-v1"');
        expect(markup).toContain('data-visual-candidate-id="pokko-base-painted-v1"');
        expect(markup).toContain('data-visual-mode="base-map"');
        expect(markup).toContain('data-character-id="pokko"');
        expect(markup).toContain("/assets/explore/route-choice/scene-fork-two-dew-path-pokko-v2.jpg");
        expect(markup).not.toContain("マキモドン");
    });
});
