import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SegmentedControl } from "./SurfacePanel";

describe("SegmentedControl accessibility", () => {
    it("names its group and exposes the selected option as pressed", () => {
        const markup = renderToStaticMarkup(
            <SegmentedControl
                aria-label="表示形式"
                value="standard"
                onChange={() => undefined}
                options={[
                    { value: "standard", label: "標準" },
                    { value: "easy", label: "やさしい" },
                ]}
            />,
        );

        expect(markup).toContain('role="group" aria-label="表示形式"');
        expect(markup).toContain("min-h-11");
        expect(markup).toMatch(/<button[^>]*aria-pressed="true"[^>]*>標準<\/button>/);
        expect(markup).toMatch(/<button[^>]*aria-pressed="false"[^>]*>やさしい<\/button>/);
        const unselectedOption = markup.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0];
        expect(unselectedOption).toContain("text-pokomoko-muted");
    });
});
