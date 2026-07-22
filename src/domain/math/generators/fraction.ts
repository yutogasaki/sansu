import { GeneratorFn, createProblem, randomInt } from "../core";
import type { RandomSource } from "../../../utils/random";

// Fraction: [numerator, denominator]
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

const reduce = (n: number, d: number): [number, number] => {
    const common = gcd(n, d);
    return [n / common, d / common];
};

const randomDifferentDenominator = (
    denominator: number,
    random: RandomSource = Math.random,
): number => {
    const denominatorCount = 5; // 2, 3, 4, 5, 6
    const offset = randomInt(1, denominatorCount - 1, random);
    return 2 + ((denominator - 2 + offset) % denominatorCount);
};

export const generators: Record<string, GeneratorFn> = {
    // Level 17: 同分母の足し算 a/n + b/n
    "frac_add_same": (context) => {
        const n = randomInt(2, 12, context?.random);
        const a = randomInt(1, n - 1, context?.random);
        const b = randomInt(1, n - a, context?.random); // a + b <= n (Simple case < 1) or allow > 1? Spec says a+b<=n.

        const sumN = a + b;
        const [ansN, ansD] = reduce(sumN, n);

        return createProblem(
            "frac_add_same",
            `${a}/${n} + ${b}/${n} =`,
            [ansN.toString(), ansD.toString()],
            "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] } // Needs proper Fraction UI
        );
    },
    // Level 17: 同分母の引き算
    "frac_sub_same": (context) => {
        // A denominator of 2 has only one positive proper numerator, so a > b
        // cannot be satisfied with two proper fractions.
        const n = randomInt(3, 12, context?.random);
        const a = randomInt(2, n - 1, context?.random);
        const b = randomInt(1, a - 1, context?.random);

        const diffN = a - b;
        const [ansN, ansD] = reduce(diffN, n);

        return createProblem(
            "frac_sub_same",
            `${a}/${n} - ${b}/${n} =`,
            [ansN.toString(), ansD.toString()],
            "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 18: 異分母の足し算
    "frac_add_diff": (context) => {
        // Simple denominators: 2,3,4,5,6
        const m = randomInt(2, 6, context?.random);
        const n = randomDifferentDenominator(m, context?.random);

        // a/m + b/n
        const a = randomInt(1, m - 1, context?.random);
        const b = randomInt(1, n - 1, context?.random);

        const num = a * n + b * m;
        const den = m * n;
        const [ansN, ansD] = reduce(num, den);

        return createProblem(
            "frac_add_diff",
            `${a}/${m} + ${b}/${n} =`,
            [ansN.toString(), ansD.toString()],
            "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 18: 異分母の引き算
    "frac_sub_diff": (context) => {
        const m = randomInt(2, 6, context?.random);
        const n = randomDifferentDenominator(m, context?.random);

        let a = randomInt(1, m - 1, context?.random);
        let b = randomInt(1, n - 1, context?.random);

        // Different denominators can still represent the same value (for
        // example 1/2 and 2/4). Move one numerator within its proper-fraction
        // range so subtraction always has a non-zero result.
        if (a * n === b * m) {
            if (b < n - 1) {
                b += 1;
            } else if (b > 1) {
                b -= 1;
            } else if (a < m - 1) {
                a += 1;
            } else {
                a -= 1;
            }
        }

        // Ensure result > 0
        const val1 = a * n;
        const val2 = b * m;

        if (val1 < val2) {
            // Swap
            return createProblem(
                "frac_sub_diff",
                `${b}/${n} - ${a}/${m} =`,
                reduce(val2 - val1, m * n).map(String),
                "multi-number",
                { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
            );
        }

        return createProblem(
            "frac_sub_diff",
            `${a}/${m} - ${b}/${n} =`,
            reduce(val1 - val2, m * n).map(String),
            "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 18: 帯分数の足し算 (Mixed fractions addition)
    // A b/n + B c/n
    "frac_mixed": (context) => {
        const n = randomInt(3, 12, context?.random); // denominator
        const A = randomInt(1, 3, context?.random);  // integer part 1
        const B = randomInt(1, 3, context?.random);  // integer part 2
        const b = randomInt(1, n - 1, context?.random); // numerator 1
        // Keep the result as a mixed fraction so this skill always honors its
        // multi-number input contract. Select from every proper numerator
        // except the one that would make b + c exactly one whole.
        const excludedNumerator = n - b;
        const cBeforeGap = randomInt(1, n - 2, context?.random);
        const c = cBeforeGap >= excludedNumerator ? cBeforeGap + 1 : cBeforeGap;

        // Calculate sum: (A + B) + (b + c)/n
        let sumInt = A + B;
        let sumNum = b + c;

        // Carry over if numerator >= denominator
        if (sumNum >= n) {
            sumInt += 1;
            sumNum -= n;
        }

        // Reduce fraction part if possible, but keeping it mixed? 
        // Specification says "Mixed Fraction" result. 
        // Usually, 3 2/4 should be 3 1/2.
        const ansInt = sumInt.toString();
        const [rNum, rDen] = reduce(sumNum, n);

        return createProblem(
            "frac_mixed",
            `${A} ${b}/${n} + ${B} ${c}/${n} =`,
            [ansInt, rNum.toString(), rDen.toString()],
            "multi-number",
            {
                fields: [
                    { label: "整数", length: 1 },
                    { label: "分子", length: 2 },
                    { label: "分母", length: 2 }
                ]
            }
        );
    },

    // Level 18: 帯分数の引き算 (Mixed fractions subtraction)
    // A b/n - B c/n
    "frac_mixed_sub": (context) => {
        const n = randomInt(3, 12, context?.random);

        // Ensure A > B or A=B with b > c to avoid negative
        const A = randomInt(2, 5, context?.random);
        const B = randomInt(1, A - 1, context?.random);

        // Numerators
        const b = randomInt(1, n - 1, context?.random);
        const numeratorOffset = randomInt(1, n - 2, context?.random);
        const c = 1 + ((b - 1 + numeratorOffset) % (n - 1));

        // Value check: A + b/n - (B + c/n)
        // If b < c, we need to borrow from A.

        let valInt = A - B;
        let valNum = b - c;

        if (valNum < 0) {
            valInt -= 1;
            valNum += n;
        }

        // If valInt became 0 (e.g. 1 1/3 - 2/3), it becomes proper fraction.
        // If valNum is 0, it becomes integer.

        const ansInt = valInt.toString();

        const [rNum, rDen] = reduce(valNum, n);

        if (valInt === 0) {
            // Proper fraction result: Just num/den
            // For "Mixed" category, maybe we allow this? 
            // Or format as "0 2/3"? No, usually just "2/3".
            // Let's return as multi-number with 2 fields (Num, Den)
            return createProblem(
                "frac_mixed_sub",
                `${A} ${b}/${n} - ${B} ${c}/${n} =`,
                [rNum.toString(), rDen.toString()],
                "multi-number",
                { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
            );
        }

        // Mixed result
        return createProblem(
            "frac_mixed_sub",
            `${A} ${b}/${n} - ${B} ${c}/${n} =`,
            [ansInt, rNum.toString(), rDen.toString()],
            "multi-number",
            {
                fields: [
                    { label: "整数", length: 1 },
                    { label: "分子", length: 2 },
                    { label: "分母", length: 2 }
                ]
            }
        );
    },

    // Level 19: 分数×整数
    "frac_mul_int": (context) => {
        const b = randomInt(2, 9, context?.random); // denominator
        const a = randomInt(1, b - 1, context?.random); // numerator
        const n = randomInt(2, 5, context?.random); // int

        const [ansN, ansD] = reduce(a * n, b);
        return createProblem("frac_mul_int", `${a}/${b} × ${n} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 1 }] }
        );
    },

    // Level 19: 分数×分数
    "frac_mul_frac": (context) => {
        const b = randomInt(2, 9, context?.random);
        const a = randomInt(1, b - 1, context?.random);
        const d = randomInt(2, 9, context?.random);
        const c = randomInt(1, d - 1, context?.random);

        const [ansN, ansD] = reduce(a * c, b * d);
        return createProblem("frac_mul_frac", `${a}/${b} × ${c}/${d} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 20: 分数÷整数
    "frac_div_int": (context) => {
        const b = randomInt(2, 9, context?.random);
        const a = randomInt(1, b - 1, context?.random);
        const n = randomInt(2, 5, context?.random);
        // (a/b) / n = a / (b*n)
        const [ansN, ansD] = reduce(a, b * n);
        return createProblem("frac_div_int", `${a}/${b} ÷ ${n} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 1 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 20: 分数÷分数
    "frac_div_frac": (context) => {
        const b = randomInt(2, 9, context?.random);
        const a = randomInt(1, b - 1, context?.random);
        const d = randomInt(2, 9, context?.random);
        const c = randomInt(1, d - 1, context?.random);

        // (a/b) / (c/d) = (a*d) / (b*c)
        const [ansN, ansD] = reduce(a * d, b * c);
        return createProblem("frac_div_frac", `${a}/${b} ÷ ${c}/${d} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    }
};
