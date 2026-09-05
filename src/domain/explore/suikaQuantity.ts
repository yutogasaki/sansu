/**
 * かずのスイカが扱う「量」。
 *
 * 整数・小数・分数を同じ規則で合体させるため、量は必ず有理数として持つ。
 * 0.1 + 0.2 が 0.30000000000000004 になる浮動小数の比較を、この層で禁じる。
 */
export interface SuikaQuantity {
    n: number;
    d: number;
}

export type SuikaDisplay = "integer" | "decimal" | "fraction";

const greatestCommonDivisor = (a: number, b: number): number => (
    b === 0 ? a : greatestCommonDivisor(b, a % b)
);

export const createQuantity = (n: number, d = 1): SuikaQuantity => {
    if (d === 0) throw new Error("suika quantity denominator must not be 0");
    const sign = d < 0 ? -1 : 1;
    const numerator = n * sign;
    const denominator = d * sign;
    const divisor = greatestCommonDivisor(Math.abs(numerator), denominator) || 1;
    return { n: numerator / divisor, d: denominator / divisor };
};

export const addQuantity = (
    a: SuikaQuantity,
    b: SuikaQuantity,
): SuikaQuantity => createQuantity(a.n * b.d + b.n * a.d, a.d * b.d);

/** a < b なら負、a === b なら0、a > b なら正。 */
export const compareQuantity = (
    a: SuikaQuantity,
    b: SuikaQuantity,
): number => a.n * b.d - b.n * a.d;

export const quantitiesEqual = (
    a: SuikaQuantity,
    b: SuikaQuantity,
): boolean => a.n === b.n && a.d === b.d;

/** 目標量に対する割合。玉の大きさと得点の基準にする。 */
export const quantityRatio = (
    quantity: SuikaQuantity,
    target: SuikaQuantity,
): number => (quantity.n * target.d) / (quantity.d * target.n);

export const quantityKey = (quantity: SuikaQuantity): string => (
    `${quantity.n}/${quantity.d}`
);

export const formatQuantity = (
    quantity: SuikaQuantity,
    display: SuikaDisplay,
): string => {
    if (display === "fraction" && quantity.d !== 1) {
        return `${quantity.n}/${quantity.d}`;
    }
    if (display === "decimal") {
        // 出現する量は必ず10分の1刻みなので、丸め誤差を表示へ出さない。
        return String(Number((quantity.n / quantity.d).toFixed(2)));
    }
    return String(quantity.n / quantity.d);
};
