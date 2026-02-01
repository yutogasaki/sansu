import { GeneratorFn, createProblem, randomInt } from "../core";

// Helper to format decimal nicely
const fmt = (n: number) => {
    return Math.round(n * 10) / 10;
};
const fmtStr = (n: number) => fmt(n).toString();

export const generators: Record<string, GeneratorFn> = {
    // Level 15: 小数の足し算
    "dec_add": () => {
        const a = randomInt(1, 99) / 10; // 0.1 - 9.9
        const b = randomInt(1, 99) / 10;
        return createProblem("dec_add", `${fmtStr(a)} + ${fmtStr(b)} =`, fmtStr(a + b), "number"); // InputType might need "decimal" support? "number" usually allows "."
    },
    // Level 15: 小数の引き算
    "dec_sub": () => {
        const a = randomInt(1, 99) / 10;
        const b = randomInt(1, Math.round(a * 10)) / 10;
        return createProblem("dec_sub", `${fmtStr(a)} - ${fmtStr(b)} =`, fmtStr(a - b), "number");
    },

    // Level 16: 小数×整数
    "dec_mul_int": () => {
        const a = randomInt(1, 99) / 10;
        const b = randomInt(2, 9);
        return createProblem("dec_mul_int", `${fmtStr(a)} × ${b} =`, fmtStr(a * b), "number");
    },
    // Level 16: 小数÷整数
    "dec_div_int": () => {
        const b = randomInt(2, 9);
        // a should be divisible.
        // Result q = random with 1 decimal place?
        // q = 0.1 ~ 9.9
        const q = randomInt(1, 99) / 10;
        const a = q * b;
        return createProblem("dec_div_int", `${fmtStr(a)} ÷ ${b} =`, fmtStr(q), "number");
    },
    // Level 16: 小数×小数
    "dec_mul_dec": () => {
        const a = randomInt(1, 99) / 10;
        const b = randomInt(1, 99) / 10;
        return createProblem("dec_mul_dec", `${fmtStr(a)} × ${fmtStr(b)} =`, (Math.round(a * b * 100) / 100).toString(), "number");
    },
    // Level 16: 小数÷小数
    "dec_div_dec": () => {
        // a / b = q
        // q should be simple? 1 decimal place?
        // b = 0.1 ~ 9.9
        const b = randomInt(1, 99) / 10;
        const q = randomInt(1, 99) / 10;
        const a = Math.round(b * q * 100) / 100;
        return createProblem("dec_div_dec", `${a} ÷ ${b} =`, fmtStr(q), "number");
    }
};
