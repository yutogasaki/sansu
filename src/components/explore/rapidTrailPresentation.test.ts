import { describe, expect, it } from "vitest";
import {
    getRapidTrailArtStage,
    getRapidTrailProgressMarks,
    getRapidTrailStateLabel,
    getRapidTrailStatusCopy,
} from "./rapidTrailPresentation";

describe("Firefly Flower rapid-trail presentation", () => {
    it("turns steps three through five into three persistent physical clues", () => {
        expect(getRapidTrailArtStage(3, "idle")).toBe("waiting");
        expect(getRapidTrailArtStage(3, "correct")).toBe("dew-trail");
        expect(getRapidTrailArtStage(4, "idle")).toBe("dew-trail");
        expect(getRapidTrailArtStage(4, "correct")).toBe("warm-bud");
        expect(getRapidTrailArtStage(5, "idle")).toBe("warm-bud");
        expect(getRapidTrailArtStage(5, "correct")).toBe("ringing-petals");
        expect(getRapidTrailArtStage(6, "idle")).toBe("ringing-petals");
    });

    it("shows the physical Q7 payoff and keeps it settled through Q8", () => {
        expect(getRapidTrailArtStage(6, "correct")).toBe("light-path");
        expect(getRapidTrailArtStage(7, "idle")).toBe("light-path");
        expect(getRapidTrailArtStage(7, "incorrect")).toBe("light-path");
        expect(getRapidTrailArtStage(7, "correct")).toBe("light-path");
        expect(getRapidTrailStateLabel("light-path")).toBe("はっぱに ぽとん");
        expect(getRapidTrailStatusCopy("light-path", "correct")).toContain("ぽとん");
    });

    it("keeps the current clue after an incorrect answer", () => {
        expect(getRapidTrailArtStage(3, "incorrect")).toBe("waiting");
        expect(getRapidTrailArtStage(4, "incorrect")).toBe("dew-trail");
        expect(getRapidTrailArtStage(5, "incorrect")).toBe("warm-bud");
        expect(getRapidTrailArtStage(6, "incorrect")).toBe("ringing-petals");
        expect(getRapidTrailStatusCopy("warm-bud", "incorrect")).toContain("そのまま");
        expect(getRapidTrailStatusCopy("light-path", "incorrect")).toContain("そのまま");
    });

    it("exposes progress without relying on color", () => {
        expect(getRapidTrailProgressMarks("waiting")).toBe("○○○");
        expect(getRapidTrailProgressMarks("dew-trail")).toBe("●○○");
        expect(getRapidTrailProgressMarks("warm-bud")).toBe("●●○");
        expect(getRapidTrailProgressMarks("ringing-petals")).toBe("●●●");
        expect(getRapidTrailProgressMarks("light-path")).toBe("●●●");
    });
});
