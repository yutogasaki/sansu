import { describe, expect, it } from "vitest";
import {
    getRapidTrailArtStage,
    getRapidTrailProgressMarks,
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

    it("keeps the current clue after an incorrect answer", () => {
        expect(getRapidTrailArtStage(3, "incorrect")).toBe("waiting");
        expect(getRapidTrailArtStage(4, "incorrect")).toBe("dew-trail");
        expect(getRapidTrailArtStage(5, "incorrect")).toBe("warm-bud");
        expect(getRapidTrailStatusCopy("warm-bud", "incorrect")).toContain("そのまま");
    });

    it("exposes progress without relying on color", () => {
        expect(getRapidTrailProgressMarks("waiting")).toBe("○○○");
        expect(getRapidTrailProgressMarks("dew-trail")).toBe("●○○");
        expect(getRapidTrailProgressMarks("warm-bud")).toBe("●●○");
        expect(getRapidTrailProgressMarks("ringing-petals")).toBe("●●●");
    });
});
