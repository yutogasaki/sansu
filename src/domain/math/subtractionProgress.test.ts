import { afterEach, describe, expect, it, vi } from "vitest";
import { selectSubtractionPair } from "./subtractionProgress";

describe("subtractionProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts sub_tiny with easy take-away problems", () => {
        expect(selectSubtractionPair("sub_tiny", 0)).toEqual([2, 1]);
        expect(selectSubtractionPair("sub_tiny", 1)).toEqual([3, 1]);
        expect(selectSubtractionPair("sub_tiny", 2)).toEqual([3, 2]);
    });

    it("starts sub_1d1d_nc by subtracting 1 and 2 first", () => {
        expect(selectSubtractionPair("sub_1d1d_nc", 0)).toEqual([2, 1]);
        expect(selectSubtractionPair("sub_1d1d_nc", 3)).toEqual([5, 1]);
        expect(selectSubtractionPair("sub_1d1d_nc", 4)).toEqual([3, 2]);
    });

    it("introduces sub_1d1d_c with the smallest cross-ten step first", () => {
        const [a, b] = selectSubtractionPair("sub_1d1d_c", 0);
        expect(a).toBeGreaterThanOrEqual(11);
        expect(b - (a % 10)).toBe(1);
    });

    it("keeps late carry problems in the cross-ten pool", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectSubtractionPair("sub_1d1d_c", 99);
        expect(a).toBeGreaterThanOrEqual(11);
        expect(b).toBeGreaterThan(a % 10);
    });
});
