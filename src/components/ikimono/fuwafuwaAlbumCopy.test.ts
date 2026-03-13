import { describe, expect, it } from "vitest";
import { getAlbumImageSuffix, getAlbumMemoryStage, getFuwafuwaAlbumMemory } from "./fuwafuwaAlbumCopy";

describe("fuwafuwa album copy", () => {
    it("maps duration to the same lifecycle boundaries", () => {
        expect(getAlbumMemoryStage(1)).toBe("egg");
        expect(getAlbumMemoryStage(2)).toBe("egg");
        expect(getAlbumMemoryStage(3)).toBe("hatching");
        expect(getAlbumMemoryStage(6)).toBe("hatching");
        expect(getAlbumMemoryStage(7)).toBe("small");
        expect(getAlbumMemoryStage(13)).toBe("small");
        expect(getAlbumMemoryStage(14)).toBe("medium");
        expect(getAlbumMemoryStage(21)).toBe("medium");
        expect(getAlbumMemoryStage(22)).toBe("adult");
        expect(getAlbumMemoryStage(27)).toBe("adult");
        expect(getAlbumMemoryStage(28)).toBe("fading");
        expect(getAlbumMemoryStage(40)).toBe("fading");
    });

    it("chooses image suffixes that match the remembered phase", () => {
        expect(getAlbumImageSuffix("egg")).toBe(1);
        expect(getAlbumImageSuffix("hatching")).toBe(1);
        expect(getAlbumImageSuffix("small")).toBe(2);
        expect(getAlbumImageSuffix("medium")).toBe(2);
        expect(getAlbumImageSuffix("adult")).toBe(3);
        expect(getAlbumImageSuffix("fading")).toBe(3);
    });

    it("returns stable copy for the same seed", () => {
        const memoryA = getFuwafuwaAlbumMemory(28, "moko:1:2026-01-01");
        const memoryB = getFuwafuwaAlbumMemory(28, "moko:1:2026-01-01");

        expect(memoryA).toEqual(memoryB);
        expect(memoryA.phase).toBe("fading");
        expect(memoryA.phaseLabel).toBe("たびだちの よいん");
        expect(memoryA.auraLabel).toContain("きおく");
        expect(memoryA.cardTone.length).toBeGreaterThan(0);
        expect(memoryA.headline.length).toBeGreaterThan(0);
        expect(memoryA.reflection.length).toBeGreaterThan(0);
        expect(memoryA.closing.length).toBeGreaterThan(0);
    });
});
