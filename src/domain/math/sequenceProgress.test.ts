import { afterEach, describe, expect, it, vi } from "vitest";
import { selectCountFillPattern } from "./sequenceProgress";

describe("sequenceProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts count_fill with easy fixed patterns", () => {
        expect(selectCountFillPattern(0)).toEqual({ start: 1, missingIndex: 2 });
        expect(selectCountFillPattern(1)).toEqual({ start: 2, missingIndex: 1 });
    });

    it("keeps early random patterns in a small range", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        expect(selectCountFillPattern(6)).toEqual({ start: 1, missingIndex: 1 });
    });

    it("falls back to the full range later", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        const pattern = selectCountFillPattern(30);
        expect(pattern.start).toBeGreaterThan(90);
        expect(pattern.missingIndex).toBe(3);
    });
});
