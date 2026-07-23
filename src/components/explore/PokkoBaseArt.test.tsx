import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokkoBaseArt } from "./PokkoBaseArt";

describe("PokkoBaseArt", () => {
    it("keeps the canonical Pokko lineage in the simplified base mode", () => {
        const markup = renderToStaticMarkup(<PokkoBaseArt />);

        expect(markup).toContain('data-visual-lineage-id="pokko-field-v1"');
        expect(markup).toContain('data-visual-candidate-id="pokko-base-map-v1"');
        expect(markup).toContain('data-visual-mode="base-map"');
        expect(markup).toContain('data-character-id="pokko"');
        expect(markup).not.toContain("マキモドン");
    });
});
