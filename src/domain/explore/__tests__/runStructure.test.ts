import { describe, expect, it } from "vitest";
import {
    EXPLORE_BIG_DISCOVERY_ANSWER_COUNT,
    EXPLORE_OPENING_ANSWER_COUNT,
    EXPLORE_RUN_ANSWER_COUNT,
    getExploreRewardPhase,
    isExploreOpeningCompletion,
    isExploreOpeningStep,
    selectExplorePathChoiceMode,
    willCompleteExploreOpeningStep,
} from "../runStructure";

describe("explore run structure", () => {
    it("keeps the three-answer opening independent from presentation candidates", () => {
        expect(EXPLORE_OPENING_ANSWER_COUNT).toBe(3);
        expect([0, 1, 2].map(getExploreRewardPhase)).toEqual([
            "opening",
            "opening",
            "opening",
        ]);
        expect([3, 4, 5].map(getExploreRewardPhase)).toEqual([
            "clue",
            "clue",
            "clue",
        ]);
        expect(isExploreOpeningStep(2)).toBe(true);
        expect(isExploreOpeningStep(3)).toBe(false);
        expect(willCompleteExploreOpeningStep(1)).toBe(false);
        expect(willCompleteExploreOpeningStep(2)).toBe(true);
        expect(isExploreOpeningCompletion(3)).toBe(true);
        expect(isExploreOpeningCompletion(4)).toBe(false);
    });

    it("pins the single discovery peak before the terminal answer", () => {
        expect(EXPLORE_BIG_DISCOVERY_ANSWER_COUNT).toBe(7);
        expect(EXPLORE_RUN_ANSWER_COUNT).toBe(8);
        expect(getExploreRewardPhase(6)).toBe("finale");
        expect(getExploreRewardPhase(7)).toBe("terminal");
        expect(getExploreRewardPhase(8)).toBe("terminal");
    });

    it("does not mistake an early missing edge for a successful return beat", () => {
        expect(selectExplorePathChoiceMode(3, 2)).toBe("routes");
        expect(selectExplorePathChoiceMode(7, 0)).toBe("invalid-dead-end");
        expect(selectExplorePathChoiceMode(8, 0)).toBe("return-ready");
        expect(selectExplorePathChoiceMode(8, 1)).toBe("return-ready");
    });
});
