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

    // Level 18: 帯分数の足し算 (Mixed fractions addition)
    // A b/n + B c/n
    "frac_mixed": () => {
        const n = randomInt(3, 12); // denominator
        const A = randomInt(1, 3);  // integer part 1
        const B = randomInt(1, 3);  // integer part 2
        const b = randomInt(1, n - 1); // numerator 1
        const c = randomInt(1, n - 1); // numerator 2

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
        // If sumNum is 0 (e.g. 1 1/2 + 1 1/2 = 3), result is just integer.

        const ansInt = sumInt.toString();
        let ansN = "";
        let ansD = "";
        let fields = [{ label: "整数", length: 1 }];

        if (sumNum > 0) {
            const [rNum, rDen] = reduce(sumNum, n);
            ansN = rNum.toString();
            ansD = rDen.toString();
            fields = [
                { label: "整数", length: 1 },
                { label: "分子", length: 2 },
                { label: "分母", length: 2 }
            ];
            return createProblem(
                "frac_mixed",
                `${A} ${b}/${n} + ${B} ${c}/${n} =`,
                [ansInt, ansN, ansD],
                "multi-number",
                { fields }
            );
        } else {
            // Integer result
            return createProblem(
                "frac_mixed",
                `${A} ${b}/${n} + ${B} ${c}/${n} =`,
                [ansInt],
                "number", // Input type changes to single number if result is integer? 
                // Or keep multi-input but expect empty fraction? 
                // To keep it simple for MVP, let's FORCE a non-integer result or handle multi-input robustly.
                // Actually, 'multi-number' UI expects specific fields. 
                // If the answer is just integer, we should probably output "3" and maybe "0/1" or just hide fraction fields?
                // Let's retry generating if result is integer to avoid UI complexity for now, 
                // OR use a specific problem type for integer results.
                // Ideally, we want the USER to input "3". 
                // Let's stick to "multi-number" but maybe 1 field?
                // No, easier to just Regenerate if sumNum == 0 for this specific level to ensure consistency.
            );
        }

        // Fallback: Recurse if simple integer (to ensure mixed practice)
        return generators["frac_mixed"]();
    },

    // Level 18: 帯分数の引き算 (Mixed fractions subtraction)
    // A b/n - B c/n
    "frac_mixed_sub": () => {
        const n = randomInt(3, 12);

        // Ensure A > B or A=B with b > c to avoid negative
        const A = randomInt(2, 5);
        const B = randomInt(1, A - 1);

        // Numerators
        const b = randomInt(1, n - 1);
        const c = randomInt(1, n - 1);

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

        if (valNum === 0) {
            // Integer result, recreate to force mixed/fraction result for practice
            return generators["frac_mixed_sub"]();
        }

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
