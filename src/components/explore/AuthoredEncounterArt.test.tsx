import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthoredEncounterArt } from "./AuthoredEncounterArt";

describe("AuthoredEncounterArt", () => {
    it.each([
        ["light-bridge", "idle", "左右から伸びた二本"],
        ["light-bridge", "resolved", "向こう岸へ渡っている"],
        ["root-tangle", "idle", "道をふさいでいる"],
        ["root-tangle", "correct", "道を空けた"],
    ] as const)("exposes %s %s without relying on color", (kind, stage, description) => {
        const markup = renderToStaticMarkup(
            <AuthoredEncounterArt kind={kind} stage={stage} />,
        );

        expect(markup).toContain(`data-testid="authored-${kind}-art"`);
        expect(markup).toContain(`data-stage="${stage}"`);
        expect(markup).toContain(description);
    });

    it("can become decorative when equivalent scene copy is already present", () => {
        const markup = renderToStaticMarkup(
            <AuthoredEncounterArt kind="root-tangle" stage="resolved" decorative />,
        );
        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain("<title");
    });

    it("marks explicit reduced-motion rendering", () => {
        const markup = renderToStaticMarkup(
            <AuthoredEncounterArt kind="light-bridge" stage="correct" reducedMotion />,
        );
        expect(markup).toContain('data-reduced-motion="true"');
    });
});
