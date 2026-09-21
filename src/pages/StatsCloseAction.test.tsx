import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatsCloseAction } from "./Stats";

describe("StatsCloseAction", () => {
    it.each(["閉じる", "とじる"])("names the icon-only action in Japanese: %s", label => {
        const markup = renderToStaticMarkup(<StatsCloseAction label={label} onClose={() => undefined} />);

        expect(markup).toContain(`aria-label="${label}"`);
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).toContain("min-h-11");
    });
});
