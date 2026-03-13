import { describe, expect, it } from "vitest";
import { getMilestoneKind, getNextTransitionState } from "./fuwafuwaMilestones";

describe("fuwafuwa milestones", () => {
    it("maps visible stages to milestone kinds", () => {
        expect(getMilestoneKind("egg")).toBeNull();
        expect(getMilestoneKind("small")).toBe("birth");
        expect(getMilestoneKind("medium")).toBe("growth");
        expect(getMilestoneKind("adult")).toBe("adult");
        expect(getMilestoneKind("fading")).toBe("farewell_soon");
    });

    it("does not backfill milestones for a fresh generation snapshot", () => {
        const result = getNextTransitionState(null, "p1", 2, "adult");

        expect(result.milestone).toBeNull();
        expect(result.nextState.lastSeenStage).toBe("adult");
    });

    it("emits a milestone when the visible stage advances in the same generation", () => {
        const result = getNextTransitionState(
            { profileId: "p1", generation: 3, lastSeenStage: "hatching" },
            "p1",
            3,
            "small",
        );

        expect(result.milestone).toBe("birth");
        expect(result.nextState.lastSeenStage).toBe("small");
    });

    it("stays quiet when stage does not advance", () => {
        const result = getNextTransitionState(
            { profileId: "p1", generation: 3, lastSeenStage: "adult" },
            "p1",
            3,
            "adult",
        );

        expect(result.milestone).toBeNull();
    });
});
