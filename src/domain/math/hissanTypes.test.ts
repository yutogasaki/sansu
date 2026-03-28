import { describe, expect, it } from "vitest";
import { isHissanEligible } from "./hissanTypes";

describe("isHissanEligible", () => {
    it("treats 2-digit addition and subtraction as hissan-eligible", () => {
        expect(isHissanEligible("add_2d1d_nc")).toBe(true);
        expect(isHissanEligible("add_2d2d_c")).toBe(true);
        expect(isHissanEligible("sub_2d1d_c")).toBe(true);
        expect(isHissanEligible("sub_2d2d")).toBe(true);
    });

    it("keeps 1-digit drills as non-hissan skills", () => {
        expect(isHissanEligible("add_1d_2")).toBe(false);
        expect(isHissanEligible("sub_1d1d_c")).toBe(false);
    });
});
