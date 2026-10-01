import { GeneratorFn, createProblem, getMathSkillProgress, randomChoice, randomInt } from "../core";
import { shuffleArray } from "../../../utils/shuffle";
import { mathContentVariants } from "../contentVariants";
import type { MathGeneratorContext } from "../core";

const modeFor = (id: string, context?: MathGeneratorContext): number => {
    const variants = mathContentVariants(id);
    const preferred = variants.indexOf(context?.preferredLearningVariant ?? "");
    return preferred >= 0 ? preferred : randomInt(0, variants.length - 1, context?.random);
};

const unlikeFractions: [number, number, number, number][] = [];
for (let b = 2; b <= 12; b++) for (let d = 2; d <= 12; d++) {
    if (b === d) continue;
    for (let a = 1; a < b; a++) for (let c = 1; c < d; c++) {
        if (a !== c && a * d !== b * c) unlikeFractions.push([a, b, c, d]);
    }
}

const comparisonChoices = [
    { label: ">", value: ">" },
    { label: "=", value: "=" },
    { label: "<", value: "<" },
];

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

const fmtTenths = (value: number): string => (Math.round(value * 10) / 10).toString();

const formatInt = (value: number): string => value.toLocaleString("ja-JP");

export const generators: Record<string, GeneratorFn> = {
    // Level 20: 10倍、100倍、1/10
    "scale_10x": (context) => {
        const type = modeFor("scale_10x", context);
        const a = randomInt(1, 999, context?.random);

        if (type === 0) {
            return createProblem("scale_10x", `${a} × 10 =`, (a * 10).toString(), "number");
        }

        if (type === 1) {
            return createProblem("scale_10x", `${a} × 100 =`, (a * 100).toString(), "number");
        }

        return createProblem("scale_10x", `${a} ÷ 10 =`, (a / 10).toString(), "number");
    },
    "large_number_unit": (context) => {
        const usesOku = modeFor("large_number_unit", context) === 1;
        if (usesOku) {
            const oku = randomInt(1, 99, context?.random);
            const value = oku * 100000000;
            return createProblem("large_number_unit", `${formatInt(value)} は なんおく？`, oku.toString(), "number");
        }

        const man = randomInt(2, 9999, context?.random);
        const value = man * 10000;
        return createProblem("large_number_unit", `${formatInt(value)} は なんまん？`, man.toString(), "number");
    },
    "dec_compare": (context) => {
        const allowEqual = randomInt(0, 4, context?.random) === 0;
        const aTenths = randomInt(1, 99, context?.random);
        const otherTenths = randomInt(1, 98, context?.random);
        const bTenths = allowEqual
            ? aTenths
            : otherTenths >= aTenths
                ? otherTenths + 1
                : otherTenths;
        const a = aTenths / 10;
        const b = bTenths / 10;

        const answer = a === b ? "=" : a > b ? ">" : "<";
        return createProblem("dec_compare", `${fmtTenths(a)} □ ${fmtTenths(b)}`, answer, "choice", {
            choices: comparisonChoices,
        });
    },
    "frac_compare": (context) => {
        const mode = modeFor("frac_compare", context);
        let a: number;
        let b: number;
        let c: number;
        let d: number;

        if (mode === 0) {
            b = randomInt(3, 12, context?.random);
            a = randomInt(1, b - 1, context?.random);
            c = randomInt(1, b - 2, context?.random);
            if (c >= a) c += 1;
            d = b;
        } else if (mode === 1) {
            a = randomInt(1, 8, context?.random);
            b = randomInt(a + 1, 12, context?.random);
            d = randomInt(a + 1, 11, context?.random);
            if (d >= b) d += 1;
            c = a;
        } else if (mode === 2) {
            const baseDenominator = randomInt(2, 9, context?.random);
            const baseNumerator = randomInt(1, baseDenominator - 1, context?.random);
            const multiplier = randomInt(2, 4, context?.random);
            a = baseNumerator;
            b = baseDenominator;
            c = baseNumerator * multiplier;
            d = baseDenominator * multiplier;
        } else {
            [a, b, c, d] = randomChoice(unlikeFractions, context?.random);
        }

        const left = a / b;
        const right = c / d;
        const answer = Math.abs(left - right) < 1e-9 ? "=" : left > right ? ">" : "<";
        return createProblem("frac_compare", `${a}/${b} □ ${c}/${d}`, answer, "choice", {
            choices: comparisonChoices,
        });
    },
    "percent_basic": (context) => {
        const whole = randomChoice([20, 40, 50, 80, 100, 200, 400], context?.random);
        const percent = randomChoice([10, 20, 25, 50, 75], context?.random);
        const part = (whole * percent) / 100;

        if (modeFor("percent_basic", context) === 0) {
            return createProblem("percent_basic", `${part} は ${whole} の なん%？`, percent.toString(), "number");
        }

        return createProblem("percent_basic", `${whole} の ${percent}% は？`, part.toString(), "number");
    },
    "average_basic": (context) => {
        const progress = getMathSkillProgress("average_basic", context);
        if (!context?.preferredLearningVariant && progress !== undefined && progress < 3) {
            const average = randomInt(3, 15, context?.random);
            const distance = randomInt(1, average - 1, context?.random);
            const numbers = [average - distance, average, average + distance];
            return createProblem("average_basic", `${numbers.join("、")} の へいきんは？`, String(average), "number");
        }
        const decimal = modeFor("average_basic", context) === 1;
        const count = decimal ? randomChoice([4, 5], context?.random) : randomInt(3, 5, context?.random);
        const average = randomInt(5, 20, context?.random) + (decimal ? count === 4 ? 0.5 : 0.2 : 0);
        const total = Math.round(average * count);
        // Asymmetric positive partitions, then shuffle. No rejection loops or hidden midpoint pattern.
        const numbers = [1, randomInt(2, 4, context?.random)];
        for (let i = 2; i < count - 1; i++) numbers.push(randomInt(1, 4, context?.random));
        numbers.push(total - numbers.reduce((a, b) => a + b, 0));
        // Redistribute the partition without changing its sum. Keep the range
        // positive and reject midpoint-only lists with a bounded number of steps.
        for (let i = 0; i < count * 3; i++) {
            const from = randomInt(0, count - 1, context?.random);
            const to = randomInt(0, count - 1, context?.random);
            if (from === to || numbers[from] <= 1) continue;
            const amount = randomInt(1, numbers[from] - 1, context?.random);
            const candidate = [...numbers];
            candidate[from] -= amount;
            candidate[to] += amount;
            if ((Math.min(...candidate) + Math.max(...candidate)) / 2 !== average) numbers.splice(0, count, ...candidate);
        }
        return createProblem("average_basic", `${shuffleArray(numbers, context?.random).join("、")} の へいきんは？`, String(average), "number");
    },
    "ratio_basic": (context) => {
        const a = randomInt(1, 9, context?.random);
        const b = randomInt(1, 9, context?.random);
        const common = gcd(a, b);
        const leftA = a / common;
        const leftB = b / common;
        const scale = randomInt(2, 9, context?.random);

        if (randomInt(0, 1, context?.random) === 0) {
            return createProblem(
                "ratio_basic",
                `${leftA} : ${leftB} = ${leftA * scale} : □`,
                (leftB * scale).toString(),
                "number"
            );
        }

        return createProblem(
            "ratio_basic",
            `${leftA} : ${leftB} = □ : ${leftB * scale}`,
            (leftA * scale).toString(),
            "number"
        );
    },
    "speed_basic": (context) => {
        const speed = randomChoice([30, 40, 50, 60, 70, 80, 90], context?.random);
        const hours = randomInt(2, 8, context?.random);
        const distance = speed * hours;
        const mode = modeFor("speed_basic", context);

        if (mode === 0) {
            return createProblem("speed_basic", `はやさ ${speed} km/h で ${hours} じかん。きょりは？`, distance.toString(), "number");
        }

        if (mode === 1) {
            return createProblem("speed_basic", `きょり ${distance} km を ${hours} じかん。はやさは？`, speed.toString(), "number");
        }

        return createProblem("speed_basic", `きょり ${distance} km を はやさ ${speed} km/h。じかんは？`, hours.toString(), "number");
    },
};
