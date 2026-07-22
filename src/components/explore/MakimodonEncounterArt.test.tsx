import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    MakimodonEncounterArt,
    type MakimodonArtStage,
} from "./MakimodonEncounterArt";

const renderStage = (stage: MakimodonArtStage) => renderToStaticMarkup(
    <MakimodonEncounterArt stage={stage} reducedMotion />,
);

describe("MakimodonEncounterArt", () => {
    it.each([
        ["rolled", "tucked", "watching"],
        ["trip", "self-step", "startled"],
        ["path", "companion-step", "one-step"],
        ["payoff", "rewound-seat", "seated"],
    ] as const)("renders the %s ecology beat", (stage, bandReach, companionState) => {
        const markup = renderStage(stage);

        expect(markup).toContain(`data-stage="${stage}"`);
        expect(markup).toContain(`data-band-reach="${bandReach}"`);
        expect(markup).toContain(`data-companion-state="${companionState}"`);
        expect(markup).toContain('data-camera-key="makimodon-side-v1"');
        expect(markup).toContain('data-band-to-body-ratio="3.2"');
    });

    it("keeps the angular silhouette hook and exactly two needle legs in every stage", () => {
        for (const stage of ["rolled", "trip", "path", "payoff"] as const) {
            const markup = renderStage(stage);

            expect(markup).toContain('data-head-shape="wedge"');
            expect(markup).toContain('data-needle-legs="2"');
            expect(markup.match(/data-needle-leg="/g)).toHaveLength(2);
            expect(markup).not.toContain("linearGradient");
            expect(markup).not.toContain("radialGradient");
        }
    });

    it("makes trip, path, and payoff readable without color or motion", () => {
        const tripMarkup = renderStage("trip");
        const pathMarkup = renderStage("path");
        const payoffMarkup = renderStage("payoff");

        expect(tripMarkup).toContain("自分の帯を踏んで、ぺたんと伏せた");
        expect(pathMarkup).toContain("相棒が片足を乗せている");
        expect(payoffMarkup).toContain("背中のくぼみへ運んで安全に座らせた");
        expect(payoffMarkup).toContain('data-layer="seat-rim"');
        expect(payoffMarkup).toContain('data-reduced-motion="true"');
    });

    it("can hide the companion and become decorative for a labelled host scene", () => {
        const markup = renderToStaticMarkup(
            <MakimodonEncounterArt stage="path" companion={false} decorative />,
        );

        expect(markup).toContain('aria-hidden="true"');
        expect(markup).not.toContain('role="img"');
        expect(markup).not.toContain('data-layer="companion"');
        expect(markup).not.toContain("<title");
        expect(markup).not.toContain("<desc");
    });

    it("uses a descriptive first-contact title instead of revealing the catalog name", () => {
        const markup = renderStage("rolled");

        expect(markup).toContain("角ばった帯を巻いた赤い生き物");
        expect(markup).not.toContain("マキモドン");
    });
});
