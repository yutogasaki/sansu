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
        const selectedOption = markup.match(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?<\/button>/)?.[0];
        expect(selectedOption).toContain("標準");
        expect(selectedOption).toContain("border-[color:var(--pokomoko-blue)]");
        expect(selectedOption).toContain('aria-hidden="true"');
        const unselectedOption = markup.match(/<button[^>]*aria-pressed="false"[^>]*>/)?.[0];
        expect(unselectedOption).toContain("text-pokomoko-muted");
        expect(unselectedOption).not.toContain("border-[color:var(--pokomoko-blue)]");
    });
});
