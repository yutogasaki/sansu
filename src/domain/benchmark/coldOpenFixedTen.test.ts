import { describe, expect, it } from "vitest";
import {
    COLD_OPEN_FIXED_TEN,
    COLD_OPEN_FIXED_TEN_ID,
    createColdOpenFixedTenBlock,
    createColdOpenFixedTenProblem,
    getColdOpenFixedTenItem,
} from "./coldOpenFixedTen";

describe("cold-open fixed-ten benchmark fixture", () => {
    it("keeps one versioned, exact ten-problem contract", () => {
        const block = createColdOpenFixedTenBlock();

        expect(COLD_OPEN_FIXED_TEN_ID).toBe("cold-open-fixed-ten-v1");
        expect(block).toHaveLength(10);
        expect(block.map((problem) => problem.questionText)).toEqual([
            "1 + 1 =",
            "2 + 3 =",
            "4 + 2 =",
            "5 + 3 =",
            "7 + 1 =",
            "8 + 2 =",
            "9 + 3 =",
            "6 + 2 =",
            "3 + 3 =",
            "9 + 1 =",
        ]);
        expect(block.map((problem) => problem.correctAnswer)).toEqual([
            "2", "5", "6", "8", "8", "10", "12", "8", "6", "10",
        ]);
        expect(new Set(block.map((problem) => problem.id)).size).toBe(10);
        expect(block.every((problem) => (
            problem.categoryId === "add_1d_1"
            && problem.inputType === "number"
            && problem.isReview === false
            && problem.isMaintenanceCheck === false
        ))).toBe(true);
    });

    it("rejects indices outside the comparison contract", () => {
        expect(getColdOpenFixedTenItem(-1)).toBeUndefined();
        expect(getColdOpenFixedTenItem(COLD_OPEN_FIXED_TEN.length)).toBeUndefined();
        expect(createColdOpenFixedTenProblem(1.5)).toBeUndefined();
    });
});
