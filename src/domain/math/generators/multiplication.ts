import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 9: 九九 (1-5の段)
    "mul_99_1": () => { const b = randomInt(1, 9); return createProblem("mul_99_1", `1 × ${b} =`, (1 * b).toString(), "number"); },
    "mul_99_2": () => { const b = randomInt(1, 9); return createProblem("mul_99_2", `2 × ${b} =`, (2 * b).toString(), "number"); },
    "mul_99_3": () => { const b = randomInt(1, 9); return createProblem("mul_99_3", `3 × ${b} =`, (3 * b).toString(), "number"); },
    "mul_99_4": () => { const b = randomInt(1, 9); return createProblem("mul_99_4", `4 × ${b} =`, (4 * b).toString(), "number"); },
    "mul_99_5": () => { const b = randomInt(1, 9); return createProblem("mul_99_5", `5 × ${b} =`, (5 * b).toString(), "number"); },

    // Level 10: 九九 (6-9の段)
    "mul_99_6": () => { const b = randomInt(1, 9); return createProblem("mul_99_6", `6 × ${b} =`, (6 * b).toString(), "number"); },
    "mul_99_7": () => { const b = randomInt(1, 9); return createProblem("mul_99_7", `7 × ${b} =`, (7 * b).toString(), "number"); },
    "mul_99_8": () => { const b = randomInt(1, 9); return createProblem("mul_99_8", `8 × ${b} =`, (8 * b).toString(), "number"); },
    "mul_99_9": () => { const b = randomInt(1, 9); return createProblem("mul_99_9", `9 × ${b} =`, (9 * b).toString(), "number"); },

    // Level 10: 九九ランダム
    "mul_99_rand": () => {
        const a = randomInt(1, 9);
        const b = randomInt(1, 9);
        return createProblem("mul_99_rand", `${a} × ${b} =`, (a * b).toString(), "number");
    },

    // Level 11: 2桁×1桁
    "mul_2d1d": () => {
        const a = randomInt(10, 99);
        const b = randomInt(2, 9);
        return createProblem("mul_2d1d", `${a} × ${b} =`, (a * b).toString(), "number");
    },
    // Level 11: 3桁×1桁
    "mul_3d1d": () => {
        const a = randomInt(100, 999);
        const b = randomInt(2, 9);
        return createProblem("mul_3d1d", `${a} × ${b} =`, (a * b).toString(), "number");
    },

    // Level 14: 2桁×2桁
    "mul_2d2d": () => {
        const a = randomInt(10, 99);
        const b = randomInt(10, 99);
        return createProblem("mul_2d2d", `${a} × ${b} =`, (a * b).toString(), "number");
    },
    // Level 14: 3桁×2桁
    "mul_3d2d": () => {
        const a = randomInt(100, 999);
        const b = randomInt(10, 99);
        return createProblem("mul_3d2d", `${a} × ${b} =`, (a * b).toString(), "number");
    }
};
