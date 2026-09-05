import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
    G0_PROTOTYPE_IDS,
    createInitialG0LabState,
    getG0Targets,
    reduceG0LabState,
    type G0LabState,
    type G0PrototypeId,
} from "../../../domain/explore/g0Whitebox";
import { G0WhiteboxStage } from "./G0WhiteboxStage";

const renderStage = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    reducedMotion = false,
): string => {
    const prototype = state.prototypes[prototypeId];
    return renderToStaticMarkup(
        <G0WhiteboxStage
            prototypeId={prototypeId}
            phase={prototype.phase}
            turn={prototype.turn}
            history={prototype.history}
            targets={getG0Targets(state, prototypeId)}
            outcome={prototype.outcome}
            queuedTargetId={prototype.queuedAction?.targetId ?? null}
            activeReactionId={prototype.activeReactionId}
            reducedMotion={reducedMotion}
            onTargetTap={() => undefined}
        />,
    );
};

const tapTarget = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    targetIndex: 0 | 1,
    actionId: string,
    atMs: number,
): G0LabState => reduceG0LabState(state, {
    type: "WORLD_TARGET_TAPPED",
    prototypeId,
    targetId: getG0Targets(state, prototypeId)[targetIndex].id,
    clientActionId: actionId,
    atMs,
});

const finishReaction = (
    state: G0LabState,
    prototypeId: G0PrototypeId,
    atMs: number,
): G0LabState => reduceG0LabState(state, {
    type: "REACTION_FINISHED",
    prototypeId,
    reactionId: state.prototypes[prototypeId].activeReactionId ?? "missing",
    atMs,
});

describe("G0WhiteboxStage", () => {
    it.each(G0_PROTOTYPE_IDS)(
        "%s exposes two native world targets without finished-art assets",
        (prototypeId) => {
            const state = createInitialG0LabState(prototypeId, "markup-seed");
            const markup = renderStage(state, prototypeId);

            expect(markup).toContain(`data-prototype-id="${prototypeId}"`);
            expect(markup.match(/<button/g)).toHaveLength(2);
            expect(markup).toContain("data-target-id=");
            expect(markup).toContain("data-target-class=");
            expect(markup).toContain('role="status"');
            expect(markup).toContain('aria-live="polite"');
            expect(markup).not.toContain("<img");
            expect(markup).not.toContain("<svg");
        },
    );

    it("keeps the selected path and payoff legible when motion is reduced", () => {
        const prototypeId = "underground-craft";
        let state = createInitialG0LabState(prototypeId, "reduced-seed");

        for (let turnIndex = 0; turnIndex < 3; turnIndex += 1) {
            state = tapTarget(
                state,
                prototypeId,
                turnIndex === 1 ? 1 : 0,
                `tap-${turnIndex + 1}`,
                100 + turnIndex * 100,
            );
            state = finishReaction(state, prototypeId, 150 + turnIndex * 100);
        }

        const markup = renderStage(state, prototypeId, true);
        expect(markup).toContain('data-phase="payoff"');
        expect(markup).toContain('data-turn="3"');
        expect(markup).toContain('data-history="part-beam|part-spring|part-beam"');
        expect(markup).toContain('data-outcome-id="single-vault"');
        expect(markup).toContain('data-reduced-motion="true"');
        expect(markup).toContain("g0-lab-stage--reduced-motion");
        expect(markup).not.toContain("<button");
    });

    it("marks a buffered next target and prevents another tap until it is consumed", () => {
        const prototypeId = "creature-experiment";
        let state = createInitialG0LabState(prototypeId, "queue-markup-seed");
        state = tapTarget(state, prototypeId, 0, "tap-1", 100);
        state = tapTarget(state, prototypeId, 1, "tap-2", 110);

        const markup = renderStage(state, prototypeId);
        expect(markup).toContain('data-phase="reacting"');
        expect(markup).toContain('data-queued-target-id="tool-press"');
        expect(markup).toContain('data-queued="true"');
        expect(markup.match(/ disabled=""/g)).toHaveLength(2);
    });
});
