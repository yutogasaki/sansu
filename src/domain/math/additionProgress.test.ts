import { describe, expect, it, vi, afterEach } from "vitest";
import { selectAdditionPair } from "./additionProgress";

describe("additionProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("starts add_tiny with 1+1 then 1+2", () => {
        expect(selectAdditionPair("add_tiny", 0)).toEqual([1, 1]);
        expect(selectAdditionPair("add_tiny", 1)).toEqual([1, 2]);
        expect(selectAdditionPair("add_tiny", 2)).toEqual([2, 1]);
    });

    it("starts add_finger with make-5 combinations", () => {
        expect(selectAdditionPair("add_finger", 0)).toEqual([1, 4]);
        expect(selectAdditionPair("add_finger", 1)).toEqual([4, 1]);
        expect(selectAdditionPair("add_finger", 2)).toEqual([2, 3]);
    });

    it("starts add_5 from easier pairs before larger totals", () => {
        expect(selectAdditionPair("add_5", 0)).toEqual([1, 5]);
        expect(selectAdditionPair("add_5", 4)).toEqual([3, 3]);
        expect(selectAdditionPair("add_5", 14)).toEqual([5, 5]);
    });

    it("starts add_1d_1 with 1+1 then 1+2", () => {
        expect(selectAdditionPair("add_1d_1", 0)).toEqual([1, 1]);
        expect(selectAdditionPair("add_1d_1", 1)).toEqual([1, 2]);
        expect(selectAdditionPair("add_1d_1", 2)).toEqual([2, 1]);
    });

    it("keeps late add_1d_1 problems within sums of 5", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectAdditionPair("add_1d_1", 30);
        expect(a + b).toBeLessThanOrEqual(5);
    });

    it("keeps late add_tiny, add_finger, and add_5 inside supported ranges", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [tinyA, tinyB] = selectAdditionPair("add_tiny", 30);
        const [fingerA, fingerB] = selectAdditionPair("add_finger", 30);
        const [fiveA, fiveB] = selectAdditionPair("add_5", 40);

        expect(tinyA).toBeLessThanOrEqual(3);
        expect(tinyB).toBeLessThanOrEqual(3);
        expect(fingerA + fingerB).toBeLessThanOrEqual(5);
        expect(fiveA).toBeLessThanOrEqual(5);
        expect(fiveB).toBeLessThanOrEqual(5);
    });

    it("keeps early add_1d_2 in the no-carry band", () => {
        const [a, b] = selectAdditionPair("add_1d_2", 0);
        expect(a + b).toBeLessThan(10);
    });

    it("moves add_1d_2 into make-10 before harder carry problems", () => {
        expect(selectAdditionPair("add_1d_2", 12)).toEqual([1, 9]);
        expect(selectAdditionPair("add_1d_2", 20)).toEqual([9, 1]);
        expect(selectAdditionPair("add_1d_2", 21)).toEqual([2, 9]);
    });

    it("falls back to a broad random pool without profile progress", () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const [a, b] = selectAdditionPair("add_1d_2");
        expect(a + b).toBeGreaterThanOrEqual(6);
    });
});
