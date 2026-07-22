import { describe, expect, it } from "vitest";
import {
    getSnapRootAccessibleDescription,
    getSnapRootKickerCopy,
    getSnapRootOpeningStage,
    getSnapRootProgressMarks,
    getSnapRootStateLabel,
    getSnapRootStatusCopy,
    getSnapRootTitleCopy,
} from "./snapRootPresentation";

describe("snapRootPresentation dig-pop contract", () => {
    it("maps committed correct answers to the four canonical stages", () => {
        expect(getSnapRootOpeningStage(0, "idle")).toBe("ready");
        expect(getSnapRootOpeningStage(0, "correct")).toBe("dig-one");
        expect(getSnapRootOpeningStage(1, "idle")).toBe("dig-one");
        expect(getSnapRootOpeningStage(1, "correct")).toBe("dig-two");
        expect(getSnapRootOpeningStage(2, "idle")).toBe("dig-two");
        expect(getSnapRootOpeningStage(2, "correct")).toBe("popped");
        expect(getSnapRootOpeningStage(3, "idle")).toBe("popped");
        expect(getSnapRootOpeningStage(99, "idle")).toBe("popped");
    });

    it("does not advance the body stage after an incorrect answer", () => {
        expect(getSnapRootOpeningStage(0, "incorrect")).toBe("ready");
        expect(getSnapRootOpeningStage(1, "incorrect")).toBe("dig-one");
        expect(getSnapRootOpeningStage(2, "incorrect")).toBe("dig-two");
        expect(getSnapRootOpeningStage(3, "incorrect")).toBe("popped");
    });

    it("states the goal before the first answer and counts down without extra taps", () => {
        expect(getSnapRootTitleCopy("ready")).toBe("3もんで おおきな ねっこを ほりだそう！");
        expect(getSnapRootKickerCopy("ready")).toContain("あと3もん");
        expect(getSnapRootKickerCopy("dig-one")).toContain("あと2もん");
        expect(getSnapRootKickerCopy("dig-two")).toContain("あと1もん");
        expect(getSnapRootKickerCopy("popped")).toContain("できた！");
        expect(getSnapRootTitleCopy("dig-one")).toBe("ざくっ！ あと 2もん！");
        expect(getSnapRootTitleCopy("dig-two")).toBe("あしが みえた！ あと 1もん！");
        expect(getSnapRootStatusCopy("dig-one", "incorrect")).toBe("だいじょうぶ。もういちど！");
    });

    it("describes the final payoff as one safe pop without bodily contact", () => {
        const finalCopy = [
            getSnapRootProgressMarks("popped"),
            getSnapRootStateLabel("popped"),
            getSnapRootTitleCopy("popped"),
            getSnapRootStatusCopy("popped", "correct"),
            getSnapRootAccessibleDescription("popped"),
        ].join(" ");

        expect(finalCopy).toContain("●●●");
        expect(finalCopy).toContain("すっぽん");
        expect(finalCopy).toContain("安全に尻もち");
        expect(finalCopy).toContain("土のかたまりが小さな相棒の葉へ");
        expect(finalCopy).not.toContain("根の生き物の葉へ帽子");
        expect(finalCopy).not.toMatch(/編み根|拘束|切断|巣|nest/);
    });

    it("describes digging the soil without touching or pulling the subject", () => {
        const diggingCopy = [
            getSnapRootAccessibleDescription("ready"),
            getSnapRootAccessibleDescription("dig-one"),
            getSnapRootAccessibleDescription("dig-two"),
        ].join(" ");

        expect(diggingCopy).toContain("スコップ");
        expect(diggingCopy).toContain("同じ土");
        expect(diggingCopy).toContain("触れず");
        expect(diggingCopy).not.toMatch(/ひっぱ|一本葉|じょうろ|水を注|tug|tumble/);
    });
});
