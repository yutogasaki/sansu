import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    RootPullOpeningArt,
    type RootPullOpeningStage,
} from "./RootPullOpeningArt";

const renderStage = (stage: RootPullOpeningStage) => renderToStaticMarkup(
    <RootPullOpeningArt stage={stage} reducedMotion />,
);

describe("RootPullOpeningArt", () => {
    it.each([
        ["ready", "watching", "asking", "offered-leaves", "ready.jpg"],
        ["small-pull", "small-brace", "rising", "small-pull", "pull-one.jpg"],
        ["bigger-pull", "full-brace", "almost-free", "bigger-pull", "pull-two.jpg"],
        ["comic-release", "safe-seated", "free", "release", "payoff.jpg"],
    ] as const)(
        "renders the %s state with one stable camera contract",
        (stage, actorState, subjectState, actionState, filename) => {
            const markup = renderStage(stage);

            expect(markup).toContain(`data-stage="${stage}"`);
            expect(markup).toContain(`data-state-variant="${stage}"`);
            expect(markup).toContain(`data-actor-state="${actorState}"`);
            expect(markup).toContain(`data-subject-state="${subjectState}"`);
            expect(markup).toContain(`data-action-state="${actionState}"`);
            expect(markup).toContain('data-camera-key="opening-root-pull-side-v1"');
            expect(markup).toContain('data-view-box="0 0 390 500"');
            expect(markup).toContain(filename);
        },
    );

    it("describes actor, subject, and action independently of the image", () => {
        const markup = renderStage("bigger-pull");

        expect(markup).toContain('role="img"');
        expect(markup).toContain('data-semantic-role="actor"');
        expect(markup).toContain('data-semantic-role="subject"');
        expect(markup).toContain('data-semantic-role="action"');
        expect(markup).toContain("相棒が足を踏ん張り");
        expect(markup).toContain("生き物の体がさらに見え");
        expect(markup).toContain("生き物と土がいっしょに大きく持ち上がった");
        expect(markup).toContain('alt=""');
    });

    it("keeps a child-readable DOM fallback beside the requested asset", () => {
        const markup = renderStage("comic-release");

        expect(markup).toContain('data-fallback="image-error"');
        expect(markup).toContain("スポン！ ぬけた！");
        expect(markup).toContain("あいぼう");
        expect(markup).toContain("ねっこの子");
        expect(markup).toContain("いま");
        expect(markup).not.toContain("<button");
        expect(markup).not.toContain("4 + 1");
    });

    it("can be decorative when equivalent host copy already exists", () => {
        const markup = renderToStaticMarkup(
            <RootPullOpeningArt stage="small-pull" decorative />,
        );

        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain('role="img"');
        expect(markup).not.toContain('data-semantic-role="actor"');
        expect(markup).not.toContain("aria-labelledby");
    });

    it("marks explicit reduced motion without removing the physical state", () => {
        const markup = renderStage("comic-release");

        expect(markup).toContain("root-pull-opening-art--reduced-motion");
        expect(markup).toContain('data-reduced-motion="true"');
        expect(markup).toContain('data-subject-state="free"');
        expect(markup).toContain('data-actor-state="safe-seated"');
    });
});
