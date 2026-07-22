import { describe, expect, it } from "vitest";
import { selectExploreEncounterPhase } from "../encounterPhase";
import type { ExploreEncounterPhaseSnapshot } from "../encounterPhase";

const createSnapshot = (
    overrides: Partial<ExploreEncounterPhaseSnapshot> = {},
): ExploreEncounterPhaseSnapshot => ({
    encounterId: "light-bridge",
    hasProblem: false,
    feedback: "idle",
    hasWorldReaction: false,
    ...overrides,
});

describe("selectExploreEncounterPhase", () => {
    it("does not create an encounter phase for a generic action", () => {
        expect(selectExploreEncounterPhase(createSnapshot({ encounterId: undefined })))
            .toBeUndefined();
    });

    it("uses loading while an encounter problem is being prepared", () => {
        expect(selectExploreEncounterPhase(createSnapshot())).toBe("loading");
    });

    it.each([
        ["idle", "ready"],
        ["incorrect", "incorrect"],
        ["correct", "correct"],
    ] as const)("maps %s problem feedback to %s", (feedback, expectedPhase) => {
        expect(selectExploreEncounterPhase(createSnapshot({
            hasProblem: true,
            feedback,
        }))).toBe(expectedPhase);
    });

    it("keeps the correct frame during the world-reaction hold", () => {
        expect(selectExploreEncounterPhase(createSnapshot({
            hasProblem: true,
            feedback: "correct",
            hasWorldReaction: true,
        }))).toBe("correct");
    });

    it("moves to resolved only after the problem is released", () => {
        expect(selectExploreEncounterPhase(createSnapshot({
            feedback: "correct",
            hasWorldReaction: true,
        }))).toBe("resolved");
    });
});
