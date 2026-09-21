import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PaperTestScoreModal } from "./PaperTestScoreModal";

describe("paper test score dialog semantics", () => {
    it("names the score dialog and associates its instructions", () => {
        const markup = renderToStaticMarkup(
            <PaperTestScoreModal
                isOpen
                subject="math"
                level={4}
                onSubmit={vi.fn()}
                onDismiss={vi.fn()}
            />,
        );
        const titleId = markup.match(/aria-labelledby="([^"]+)"/)?.[1];
        const descriptionId = markup.match(/aria-describedby="([^"]+)"/)?.[1];

        expect(titleId).toBeDefined();
        expect(descriptionId).toBeDefined();
        expect(markup).toContain(`id="${titleId}"`);
        expect(markup).toContain(`id="${descriptionId}"`);
        expect(markup).toContain("テストの てんすう おしえて");
        expect(markup).toContain(`role="group" aria-labelledby="${descriptionId}"`);
        expect(markup).toContain("focus-visible:ring-2");
        expect(markup).toContain("min-h-11");
    });
});
