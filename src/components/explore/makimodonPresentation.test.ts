import { describe, expect, it } from "vitest";
import {
    getMakimodonArtStage,
    getMakimodonKickerCopy,
    getMakimodonProgressMarks,
    getMakimodonStateLabel,
    getMakimodonStatusCopy,
    getMakimodonTitleCopy,
} from "./makimodonPresentation";

describe("Makimodon rapid-answer presentation", () => {
    it("turns three committed correct answers into rolled-trip-path-payoff", () => {
        expect(getMakimodonArtStage(0, "idle")).toBe("rolled");
        expect(getMakimodonArtStage(0, "correct")).toBe("trip");
        expect(getMakimodonArtStage(1, "correct")).toBe("path");
        expect(getMakimodonArtStage(2, "correct")).toBe("payoff");
    });

    it("holds the visible physical state after an incorrect answer", () => {
        expect(getMakimodonArtStage(1, "incorrect")).toBe("trip");
        expect(getMakimodonArtStage(2, "incorrect")).toBe("path");
        expect(getMakimodonStatusCopy("path", "incorrect")).toContain("そのまま");
    });

    it("reveals the visual cause and payoff without naming Makimodon early", () => {
        expect(getMakimodonTitleCopy("rolled")).toBe("この まきまき、いきもの？");
        expect(getMakimodonStatusCopy("rolled", "idle")).toBe(
            "はしっこが もぞもぞ。こたえてみよう",
        );
        expect(getMakimodonTitleCopy("trip")).toBe("ほどけて、ぺたん。");
        expect(getMakimodonTitleCopy("path")).toBe("みちに なった。");
        expect(getMakimodonStatusCopy("path", "correct")).toBe("のってみる？");
        expect(getMakimodonTitleCopy("payoff")).toBe("ぜんぶ まきもどった！");
        expect(getMakimodonStatusCopy("payoff", "correct")).toBe(
            "あいぼうが せなかへ どん。",
        );

        for (const stage of ["rolled", "trip", "path", "payoff"] as const) {
            expect(getMakimodonTitleCopy(stage)).not.toContain("マキモドン");
            expect(getMakimodonStatusCopy(stage, "correct")).not.toContain("マキモドン");
        }
    });

    it("exposes progress and state without relying on color or motion", () => {
        expect(getMakimodonProgressMarks("rolled")).toBe("○○○");
        expect(getMakimodonProgressMarks("trip")).toBe("●○○");
        expect(getMakimodonProgressMarks("path")).toBe("●●○");
        expect(getMakimodonProgressMarks("payoff")).toBe("●●●");
        expect(getMakimodonKickerCopy("rolled")).toBe("○○○ ？？？");
        expect(getMakimodonKickerCopy("path")).toBe("●●○ みちになった");
        expect(getMakimodonStateLabel("payoff")).toBe("どん");
    });
});
