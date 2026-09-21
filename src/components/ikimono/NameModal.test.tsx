import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NameModal } from "./NameModal";

describe("ikimono naming dialog semantics", () => {
    it("names the dialog and exposes its text field as a keyboard-submittable form", () => {
        const markup = renderToStaticMarkup(<NameModal onSubmit={vi.fn()} />);
        const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
        const descriptionId = markup.match(/aria-describedby="([^"]+)"/)?.[1];
        const inputId = markup.match(/<label for="([^"]+)"/)?.[1];

        expect(markup).toContain('role="dialog" aria-modal="true"');
        expect(titleId).toBeDefined();
        expect(descriptionId).toBeDefined();
        expect(inputId).toBeDefined();
        expect(markup).toContain(`id="${titleId}"`);
        expect(markup).toContain(`id="${descriptionId}"`);
        expect(markup).toContain(`id="${inputId}"`);
        expect(markup).toContain("<form");
        expect(markup).toContain('type="submit"');
    });
});
