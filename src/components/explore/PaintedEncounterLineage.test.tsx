import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Problem } from "../../domain/types";
import {
    LightBridgeCompletion,
    LightBridgeEncounter,
    LightBridgeLoading,
} from "./LightBridgeEncounter";
import {
    RootTangleCompletion,
    RootTangleEncounter,
} from "./RootTangleEncounter";

const problem: Problem = {
    id: "painted-encounter-problem",
    subject: "math",
    categoryId: "add_1d1d_nc",
    questionText: "1 + 3",
    inputType: "number",
    correctAnswer: "4",
    isReview: false,
};

const encounterProps = {
    problem,
    answer: "",
    attemptCount: 0,
    combo: 1,
    incorrectEnergyCost: 0,
    onAnswerChange: () => undefined,
    onSubmit: () => undefined,
};

const expectIdentityOnRootAndArt = (
    markup: string,
    surfaceId: string,
    sceneId: string,
    cameraKey: string,
) => {
    expect(markup.match(/data-visual-lineage-id="pokko-field-v1"/g)).toHaveLength(2);
    expect(markup.match(/data-visual-candidate-id="pokko-painted-encounters-v4"/g))
        .toHaveLength(2);
    expect(markup.match(/data-visual-mode="world-painted"/g)).toHaveLength(2);
    expect(markup.match(new RegExp(`data-visual-surface-id="${surfaceId}"`, "g")))
        .toHaveLength(2);
    expect(markup.match(new RegExp(`data-visual-scene-id="${sceneId}"`, "g")))
        .toHaveLength(2);
    expect(markup.match(new RegExp(`data-camera-key="${cameraKey}"`, "g")))
        .toHaveLength(2);
};

describe("painted encounter visual lineage", () => {
    it("uses the three Pokko light-bridge plates and exposes the idle identity", () => {
        const markup = renderToStaticMarkup(
            <LightBridgeEncounter
                {...encounterProps}
                phase="ready"
            />,
        );

        expectIdentityOnRootAndArt(
            markup,
            "explore-encounter-light-bridge",
            "light-bridge-idle",
            "light-bridge-camera-v1",
        );
        expect(markup).toContain("/assets/explore/light-bridge/scene-idle-pokko-v4.jpg");
        expect(markup).toContain("/assets/explore/light-bridge/scene-complete-pokko-v4.jpg");
        expect(markup).toContain("/assets/explore/light-bridge/scene-crossed-pokko-v4.jpg");
        expect(markup).not.toContain("explore-immersive-art--layered");
    });

    it("switches the light bridge to its complete plate after a correct answer", () => {
        const markup = renderToStaticMarkup(
            <LightBridgeEncounter
                {...encounterProps}
                phase="correct"
                answer="4"
            />,
        );

        expectIdentityOnRootAndArt(
            markup,
            "explore-encounter-light-bridge",
            "light-bridge-complete",
            "light-bridge-camera-v1",
        );
        expect(markup).toContain(
            "explore-immersive-scene explore-immersive-scene-complete is-visible",
        );
    });

    it("keeps an incorrect root answer on the tangled plate", () => {
        const markup = renderToStaticMarkup(
            <RootTangleEncounter
                {...encounterProps}
                phase="incorrect"
                attemptCount={1}
            />,
        );

        expectIdentityOnRootAndArt(
            markup,
            "explore-encounter-root-tangle",
            "root-tangle-tangled",
            "root-tangle-camera-v1",
        );
        expect(markup).toContain("/assets/explore/root-tangle/scene-tangled-pokko-v4.jpg");
        expect(markup).toContain("/assets/explore/root-tangle/scene-open-pokko-v4.jpg");
        expect(markup).toContain("/assets/explore/root-tangle/scene-crossed-pokko-v4.jpg");
        expect(markup).not.toContain("explore-immersive-art--layered");
    });

    it("shows the crossed root plate on the completion beat", () => {
        const markup = renderToStaticMarkup(
            <RootTangleCompletion combo={2} />,
        );

        expectIdentityOnRootAndArt(
            markup,
            "explore-encounter-root-tangle",
            "root-tangle-crossed",
            "root-tangle-camera-v1",
        );
        expect(markup).toContain(
            "explore-immersive-scene explore-immersive-scene-crossed is-visible",
        );
    });

    it("keeps loading and completion surfaces inside the same lineage", () => {
        const loadingMarkup = renderToStaticMarkup(<LightBridgeLoading />);
        const completionMarkup = renderToStaticMarkup(
            <LightBridgeCompletion combo={1} />,
        );

        expectIdentityOnRootAndArt(
            loadingMarkup,
            "explore-encounter-light-bridge",
            "light-bridge-idle",
            "light-bridge-camera-v1",
        );
        expectIdentityOnRootAndArt(
            completionMarkup,
            "explore-encounter-light-bridge",
            "light-bridge-crossed",
            "light-bridge-camera-v1",
        );
    });
});
