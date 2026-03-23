import { describe, expect, it, vi, afterEach } from "vitest";
import { selectAdditionPair } from "./additionProgress";

describe("additionProgress", () => {
    afterEach(() => {
        vi.restoreAllMocks();
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
