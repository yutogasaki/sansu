import { GeneratorFn, createProblem, randomInt } from "../core";

// Fraction: [numerator, denominator]
const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

const reduce = (n: number, d: number): [number, number] => {
    const common = gcd(n, d);
    return [n / common, d / common];
};

export const generators: Record<string, GeneratorFn> = {
    // Level 17: 同分母の足し算 a/n + b/n
    "frac_add_same": () => {
        const n = randomInt(2, 12);
        const a = randomInt(1, n - 1);
        const b = randomInt(1, n - a); // a + b <= n (Simple case < 1) or allow > 1? Spec says a+b<=n.

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
    "frac_sub_same": () => {
        const n = randomInt(2, 12);
        const a = randomInt(2, n - 1);
        const b = randomInt(1, a - 1);

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
    "frac_add_diff": () => {
        // Simple denominators: 2,3,4,5,6
        const m = randomInt(2, 6);
        let n;
        do { n = randomInt(2, 6); } while (n === m);

        // a/m + b/n
        const a = randomInt(1, m - 1);
        const b = randomInt(1, n - 1);

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
    "frac_sub_diff": () => {
        const m = randomInt(2, 6);
        let n;
        do { n = randomInt(2, 6); } while (n === m);

        const a = randomInt(1, m - 1);
        const b = randomInt(1, n - 1);

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

    // Level 18: 帯分数の計算 (Mixed fractions)
    "frac_mixed": () => {
        // Simplified: 1 1/3 + 1/3 = 1 2/3
        // Spec is vague on exact format. 
        // "Integer part 1-3, fraction part proper fraction".
        // Let's defer strict implementation or just do simple addition.
        // For MVP, create a simple non-mixed addition that results in mixed?
        // Or specific mixed format.
        // Let's implement simple Addition that crosses 1.

        // Placeholder for now.
        return createProblem("frac_mixed", "1 1/2 + 1/2 =", ["2", "1"], "multi-number",
            { fields: [{ label: "整数", length: 1 }, { label: "分子", length: 2 }] }
        );
    },

    // Level 19: 分数×整数
    "frac_mul_int": () => {
        const b = randomInt(2, 9); // denominator
        const a = randomInt(1, b - 1); // numerator
        const n = randomInt(2, 5); // int

        const [ansN, ansD] = reduce(a * n, b);
        return createProblem("frac_mul_int", `${a}/${b} × ${n} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 1 }] }
        );
    },

    // Level 19: 分数×分数
    "frac_mul_frac": () => {
        const b = randomInt(2, 9);
        const a = randomInt(1, b - 1);
        const d = randomInt(2, 9);
        const c = randomInt(1, d - 1);

        const [ansN, ansD] = reduce(a * c, b * d);
        return createProblem("frac_mul_frac", `${a}/${b} × ${c}/${d} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 20: 分数÷整数
    "frac_div_int": () => {
        const b = randomInt(2, 9);
        const a = randomInt(1, b - 1);
        const n = randomInt(2, 5);
        // (a/b) / n = a / (b*n)
        const [ansN, ansD] = reduce(a, b * n);
        return createProblem("frac_div_int", `${a}/${b} ÷ ${n} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 1 }, { label: "分母", length: 2 }] }
        );
    },

    // Level 20: 分数÷分数
    "frac_div_frac": () => {
        const b = randomInt(2, 9);
        const a = randomInt(1, b - 1);
        const d = randomInt(2, 9);
        const c = randomInt(1, d - 1);

        // (a/b) / (c/d) = (a*d) / (b*c)
        const [ansN, ansD] = reduce(a * d, b * c);
        return createProblem("frac_div_frac", `${a}/${b} ÷ ${c}/${d} =`, [ansN.toString(), ansD.toString()], "multi-number",
            { fields: [{ label: "分子", length: 2 }, { label: "分母", length: 2 }] }
        );
    }
};
