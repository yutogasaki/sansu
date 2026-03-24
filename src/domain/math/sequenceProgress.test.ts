import { afterEach, describe, expect, it, vi } from "vitest";
import { selectCount50Target, selectCount100Target, selectCountBackTarget, selectCountFillPattern, selectCountNext10Target, selectCountNext20Target } from "./sequenceProgress";

describe("sequenceProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts count_fill with easy fixed patterns", () => {
        expect(selectCountFillPattern(0)).toEqual({ start: 1, missingIndex: 2 });
        expect(selectCountFillPattern(1)).toEqual({ start: 2, missingIndex: 1 });
    });

    it("starts next/back targets with easy fixed values", () => {
        expect(selectCountNext10Target(0)).toBe(1);
        expect(selectCountBackTarget(0)).toBe(2);
        expect(selectCountNext20Target(0)).toBe(10);
        expect(selectCount50Target(0)).toBe(20);
        expect(selectCount100Target(0)).toBe(50);
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

    it("keeps later targets within supported ranges", () => {
        vi.spyOn(Math, "random").mockReturnValue(0.99);
        expect(selectCountNext10Target(99)).toBe(9);
        expect(selectCountBackTarget(99)).toBe(10);
        expect(selectCountNext20Target(99)).toBe(19);
        expect(selectCount50Target(99)).toBe(49);
        expect(selectCount100Target(99)).toBe(99);
    });
});
