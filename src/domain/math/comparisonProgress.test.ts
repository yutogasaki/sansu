import { afterEach, describe, expect, it, vi } from "vitest";
import { selectComparisonPair } from "./comparisonProgress";

describe("comparisonProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts compare_1d with large visual gaps", () => {
        expect(selectComparisonPair("compare_1d", 0)).toEqual([1, 5]);
        expect(selectComparisonPair("compare_1d", 1)).toEqual([5, 1]);
    });

    it("keeps early compare_1d pairs far apart", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectComparisonPair("compare_1d", 10);
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(4);
    });

    it("keeps early compare_2d pairs far apart by tens", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectComparisonPair("compare_2d", 0);
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(30);
    });

    it("moves compare_2d toward closer tens before same-tens comparisons", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectComparisonPair("compare_2d", 10);
        expect(Math.abs(a - b)).toBeGreaterThanOrEqual(10);
        expect(Math.abs(a - b)).toBeLessThanOrEqual(29);
    });

    it("introduces same-tens compare_2d pairs before full randomization", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectComparisonPair("compare_2d", 20);
        expect(Math.floor(a / 10)).toBe(Math.floor(b / 10));
    });
});
