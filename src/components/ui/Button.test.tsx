import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";

describe("shared small buttons", () => {
    it("keeps compact text actions at the shared 44px minimum height", () => {
        const markup = renderToStaticMarkup(<Button size="sm">追加</Button>);

        expect(markup).toContain("min-h-11");
        expect(markup).not.toContain("h-10");
    });

    it("keeps compact icon actions at least 44px in both dimensions", () => {
        const markup = renderToStaticMarkup(<Button size="sm" variant="icon" aria-label="閉じる" />);

        expect(markup).toContain("h-11 w-11 min-h-11 min-w-11");
        expect(markup).not.toContain("h-10 w-10");
    });
});
