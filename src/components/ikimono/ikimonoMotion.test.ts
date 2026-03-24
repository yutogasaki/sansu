import { describe, expect, it, vi } from "vitest";
import {
    getDefaultReactionStyleForStage,
    pickWeightedIndex,
    shouldShowBonusTapHitokoto,
    shouldShowTapHitokoto,
} from "./ikimonoMotion";

describe("ikimono motion", () => {
    it("penalizes immediately repeating the last weighted variant", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.4);

        expect(pickWeightedIndex([10, 10], 0)).toBe(1);
    });

    it("maps stages to keep-going style reaction moods", () => {
        expect(getDefaultReactionStyleForStage("egg")).toBe("sharing");
        expect(getDefaultReactionStyleForStage("small")).toBe("growing");
        expect(getDefaultReactionStyleForStage("adult")).toBe("cozy");
    });

    it("keeps tap hitokoto thresholds stage-aware", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.23);
        expect(shouldShowTapHitokoto("egg")).toBe(false);
        expect(shouldShowTapHitokoto("hatching")).toBe(true);

        vi.spyOn(Math, "random").mockReturnValue(0.27);
        expect(shouldShowBonusTapHitokoto("adult")).toBe(true);
        expect(shouldShowBonusTapHitokoto("egg")).toBe(false);
    });
});
