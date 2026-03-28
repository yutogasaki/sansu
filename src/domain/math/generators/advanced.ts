import { GeneratorFn, createProblem, randomChoice, randomInt } from "../core";

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
    "scale_10x": () => {
        const type = randomInt(0, 2); // 0: x10, 1: x100, 2: /10
        const a = randomInt(1, 999);

        if (type === 0) {
            return createProblem("scale_10x", `${a} × 10 =`, (a * 10).toString(), "number");
        }

        if (type === 1) {
            return createProblem("scale_10x", `${a} × 100 =`, (a * 100).toString(), "number");
        }

        return createProblem("scale_10x", `${a} ÷ 10 =`, (a / 10).toString(), "number");
    },
    "large_number_unit": () => {
        const usesOku = randomInt(0, 1) === 1;
        if (usesOku) {
            const oku = randomInt(1, 99);
            const value = oku * 100000000;
            return createProblem("large_number_unit", `${formatInt(value)} は なんおく？`, oku.toString(), "number");
        }

        const man = randomInt(2, 9999);
        const value = man * 10000;
        return createProblem("large_number_unit", `${formatInt(value)} は なんまん？`, man.toString(), "number");
    },
    "dec_compare": () => {
        const allowEqual = randomInt(0, 4) === 0;
        const a = randomInt(1, 99) / 10;
        let b = allowEqual ? a : randomInt(1, 99) / 10;

        while (!allowEqual && a === b) {
            b = randomInt(1, 99) / 10;
        }

        const answer = a === b ? "=" : a > b ? ">" : "<";
        return createProblem("dec_compare", `${fmtTenths(a)} □ ${fmtTenths(b)}`, answer, "choice", {
            choices: comparisonChoices,
        });
    },
    "frac_compare": () => {
        const mode = randomInt(0, 2);
        let a: number;
        let b: number;
        let c: number;
        let d: number;

        if (mode === 0) {
            b = randomInt(2, 12);
            a = randomInt(1, b - 1);
            c = randomInt(1, b - 1);
            while (a === c) {
                c = randomInt(1, b - 1);
            }
            d = b;
        } else if (mode === 1) {
            a = randomInt(1, 8);
            b = randomInt(a + 1, 12);
            d = randomInt(a + 1, 12);
            while (b === d) {
                d = randomInt(a + 1, 12);
            }
            c = a;
        } else {
            const baseDenominator = randomInt(2, 9);
            const baseNumerator = randomInt(1, baseDenominator - 1);
            const multiplier = randomInt(2, 4);
            a = baseNumerator;
            b = baseDenominator;
            c = baseNumerator * multiplier;
            d = baseDenominator * multiplier;
        }

        const left = a / b;
        const right = c / d;
        const answer = Math.abs(left - right) < 1e-9 ? "=" : left > right ? ">" : "<";
        return createProblem("frac_compare", `${a}/${b} □ ${c}/${d}`, answer, "choice", {
            choices: comparisonChoices,
        });
    },
    "percent_basic": () => {
        const whole = randomChoice([20, 40, 50, 80, 100, 200, 400]);
        const percent = randomChoice([10, 20, 25, 50, 75]);
        const part = (whole * percent) / 100;

        if (randomInt(0, 1) === 0) {
            return createProblem("percent_basic", `${part} は ${whole} の なん%？`, percent.toString(), "number");
        }

        return createProblem("percent_basic", `${whole} の ${percent}% は？`, part.toString(), "number");
    },
    "average_basic": () => {
        const average = randomInt(3, 30);

        if (randomInt(0, 1) === 0) {
            const distance = randomInt(1, Math.min(8, average - 1));
            const numbers = [average - distance, average, average + distance];
            return createProblem("average_basic", `${numbers.join("、")} の へいきんは？`, average.toString(), "number");
        }

        const outer = randomInt(2, Math.min(9, average - 1));
        const inner = randomInt(1, outer);
        const numbers = [average - outer, average - inner, average + inner, average + outer];
        return createProblem("average_basic", `${numbers.join("、")} の へいきんは？`, average.toString(), "number");
    },
    "ratio_basic": () => {
        const a = randomInt(1, 9);
        const b = randomInt(1, 9);
        const common = gcd(a, b);
        const leftA = a / common;
        const leftB = b / common;
        const scale = randomInt(2, 9);

        if (randomInt(0, 1) === 0) {
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
    "speed_basic": () => {
        const speed = randomChoice([30, 40, 50, 60, 70, 80, 90]);
        const hours = randomInt(2, 8);
        const distance = speed * hours;
        const mode = randomInt(0, 2);

        if (mode === 0) {
            return createProblem("speed_basic", `はやさ ${speed} km/h で ${hours} じかん。きょりは？`, distance.toString(), "number");
        }

        if (mode === 1) {
            return createProblem("speed_basic", `きょり ${distance} km を ${hours} じかん。はやさは？`, speed.toString(), "number");
        }

        return createProblem("speed_basic", `きょり ${distance} km を はやさ ${speed} km/h。じかんは？`, hours.toString(), "number");
    },
};
