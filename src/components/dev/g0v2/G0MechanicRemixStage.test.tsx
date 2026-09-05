import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    createG0ChainShotState,
    reduceG0ChainShotState,
} from "../../../domain/explore/g0ChainShot";
import {
    createG0NumberVesselState,
    reduceG0NumberVesselState,
} from "../../../domain/explore/g0NumberVessel";
import { G0MechanicRemixStage } from "./G0MechanicRemixStage";

const renderStage = ({
    prototypeId = "chain-shot",
    chainState = createG0ChainShotState("stage-seed"),
    numberState = createG0NumberVesselState("stage-seed"),
    reducedMotion = false,
}: {
    prototypeId?: "chain-shot" | "number-vessel";
    chainState?: ReturnType<typeof createG0ChainShotState>;
    numberState?: ReturnType<typeof createG0NumberVesselState>;
    reducedMotion?: boolean;
} = {}): string => renderToStaticMarkup(
    <G0MechanicRemixStage
        prototypeId={prototypeId}
        chainState={chainState}
        numberState={numberState}
        reducedMotion={reducedMotion}
        onChainTargetTap={() => undefined}
        onNumberTokenTap={() => undefined}
        onNumberSplitSelected={() => undefined}
    />,
);

describe("G0MechanicRemixStage", () => {
    it("renders chain shot as three direct world targets with visible non-color cues", () => {
        const markup = renderStage();

        expect(markup).toContain('data-testid="g0v2-chain-stage"');
        expect(markup.match(/<button/g)).toHaveLength(3);
        expect(markup).toContain('data-target-class="safe"');
        expect(markup).toContain('data-target-class="wild"');
        expect(markup).toContain('data-target-class="recovery"');
        expect(markup).toContain("しずかな ひび");
        expect(markup).toContain("コトコトする 土");
        expect(markup).toContain('role="status"');
        expect(markup).not.toContain("<img");
        expect(markup).not.toContain("<svg");
    });

    it("locks chain input during the reaction and preserves reduced-motion meaning", () => {
        let chainState = createG0ChainShotState("chain-lock");
        chainState = reduceG0ChainShotState(chainState, {
            type: "WORLD_TARGET_TAPPED",
            targetId: "wild-pocket",
            clientActionId: "wild-1",
            atMs: 100,
        });

        const markup = renderStage({ chainState, reducedMotion: true });
        expect(markup).toContain('data-phase="reacting"');
        expect(markup).toContain('data-last-target="wild-pocket"');
        expect(markup).toContain('data-reduced-motion="true"');
        expect(markup.match(/ disabled=""/g)).toHaveLength(3);
        expect(markup).toContain("g0v2-stage--reduced-motion");
    });

    it("renders number vessel as source-to-destination token manipulation", () => {
        const markup = renderStage({ prototypeId: "number-vessel" });

        expect(markup).toContain('data-testid="g0v2-number-stage"');
        expect(markup).toContain('data-token-count="4"');
        expect(markup).toContain("1+4=5");
        expect(markup).toContain("あわせた後");
        expect(markup.match(/class="g0v2-number-token"/g)).toHaveLength(4);
        expect(markup.match(/<button/g)).toHaveLength(5);
        expect(markup).not.toContain("<img");
        expect(markup).not.toContain("<svg");
    });

    it("marks the selected number, then locks the changed board while composing", () => {
        let numberState = createG0NumberVesselState("number-stage");
        const [source, target] = numberState.tokens;
        numberState = reduceG0NumberVesselState(numberState, {
            type: "TOKEN_TAPPED",
            tokenId: source.id,
            clientActionId: "select-source",
            atMs: 100,
        });

        const selectedMarkup = renderStage({
            prototypeId: "number-vessel",
            numberState,
        });
        expect(selectedMarkup).toContain('aria-pressed="true"');
        expect(selectedMarkup).toContain("2 と あわせる相手をえらぶ");

        numberState = reduceG0NumberVesselState(numberState, {
            type: "TOKEN_TAPPED",
            tokenId: target.id,
            clientActionId: "compose-target",
            atMs: 120,
        });
        const reactingMarkup = renderStage({
            prototypeId: "number-vessel",
            numberState,
        });
        expect(reactingMarkup).toContain('data-phase="reacting"');
        expect(reactingMarkup).toContain('data-token-count="3"');
        expect(reactingMarkup).toContain("2と2を合わせて、4になった");
        expect(reactingMarkup.match(/ disabled=""/g)).toHaveLength(4);
    });
});
