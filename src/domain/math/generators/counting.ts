import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 1: 数を数える（1-10）
    "count_10": () => {
        const n = randomInt(1, 10);
        return createProblem(
            "count_10",
            `🍎`.repeat(n), // Placeholder graphic
            n.toString(),
            "number"
        );
    },
    // Level 2: 数を数える（1-50）
    "count_50": () => {
        const n = randomInt(1, 49);
        return createProblem("count_50", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 3: 数を数える（1-100）
    "count_100": () => {
        const n = randomInt(1, 99);
        return createProblem("count_100", `${n} のつぎは？`, (n + 1).toString(), "number");
    },
    // Level 3: 数の順番
    "count_fill": () => {
        const start = randomInt(1, 95);
        const pos = randomInt(1, 3); // 1,2,[?],4,5
        const seq = [0, 1, 2, 3, 4].map(i => start + i);
        const ans = seq[pos];
        const q = seq.map((v, i) => i === pos ? "□" : v).join(", ");
        return createProblem("count_fill", q, ans.toString(), "number");
    },
    // Level 3: 大小比較（1桁）
    "compare_1d": () => {
        let a, b;
        do { a = randomInt(1, 9); b = randomInt(1, 9); } while (a === b);
        return createProblem("compare_1d", `${a} □ ${b}`, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        });
    },
    // Level 3: 大小比較（2桁）
    "compare_2d": () => {
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(10, 99); } while (a === b);
        return createProblem("compare_2d", `${a} □ ${b}`, a > b ? ">" : "<", "choice", {
            choices: [{ label: ">", value: ">" }, { label: "=", value: "=" }, { label: "<", value: "<" }]
        });
    }
};
