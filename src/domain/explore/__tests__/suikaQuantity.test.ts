import { describe, expect, it } from "vitest";
import {
    addQuantity,
    compareQuantity,
    createQuantity,
    formatQuantity,
    quantitiesEqual,
    quantityRatio,
} from "../suikaQuantity";

describe("suikaQuantity", () => {
    it("約分して保持する", () => {
        expect(createQuantity(2, 6)).toEqual({ n: 1, d: 3 });
        expect(createQuantity(5, 10)).toEqual({ n: 1, d: 2 });
        expect(createQuantity(12, 12)).toEqual({ n: 1, d: 1 });
    });

    it("小数を浮動小数の誤差なしで足す", () => {
        // 0.1 + 0.2 === 0.30000000000000004 を持ち込まない。
        const sum = addQuantity(createQuantity(1, 10), createQuantity(2, 10));

        expect(sum).toEqual({ n: 3, d: 10 });
        expect(quantitiesEqual(sum, createQuantity(3, 10))).toBe(true);
        expect(formatQuantity(sum, "decimal")).toBe("0.3");
    });

    it("異分母を足して約分する", () => {
        expect(addQuantity(createQuantity(1, 3), createQuantity(1, 6)))
            .toEqual({ n: 1, d: 2 });
        expect(addQuantity(createQuantity(1, 3), createQuantity(1, 4)))
            .toEqual({ n: 7, d: 12 });
        expect(addQuantity(createQuantity(1, 2), createQuantity(1, 2)))
            .toEqual({ n: 1, d: 1 });
    });

    it("表記が違っても同じ量は等しいと判定する", () => {
        expect(quantitiesEqual(createQuantity(5, 10), createQuantity(1, 2)))
            .toBe(true);
        expect(compareQuantity(createQuantity(5, 10), createQuantity(1, 2)))
            .toBe(0);
    });

    it("目標量に対する割合を返す", () => {
        expect(quantityRatio(createQuantity(5), createQuantity(10))).toBe(0.5);
        expect(quantityRatio(createQuantity(5, 10), createQuantity(1))).toBe(0.5);
        expect(quantityRatio(createQuantity(1, 2), createQuantity(1))).toBe(0.5);
    });

    it("表示形式ごとに整形する", () => {
        expect(formatQuantity(createQuantity(7), "integer")).toBe("7");
        expect(formatQuantity(createQuantity(7, 10), "decimal")).toBe("0.7");
        expect(formatQuantity(createQuantity(1), "decimal")).toBe("1");
        expect(formatQuantity(createQuantity(2, 3), "fraction")).toBe("2/3");
        expect(formatQuantity(createQuantity(1), "fraction")).toBe("1");
    });

    it("分母0を受け付けない", () => {
        expect(() => createQuantity(1, 0)).toThrow();
    });
});
