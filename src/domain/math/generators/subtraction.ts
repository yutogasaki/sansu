import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 6: 1桁-1桁（繰下なし）
    "sub_1d1d_nc": () => {
        const a = randomInt(1, 9);
        const b = randomInt(1, a); // b <= a
        return createProblem("sub_1d1d_nc", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 6: 1桁-1桁（繰下あり）
    "sub_1d1d_c": () => {
        const a = randomInt(11, 18);
        const b = randomInt(a - 10 + 1, 9); // e.g. 13 -> b in [4, 9] (13-9=4, 13-4=9)
        return createProblem("sub_1d1d_c", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 7: 2桁-1桁（繰下なし）
    "sub_2d1d_nc": () => {
        // a: 10-99, b <= a's ones digit
        const a = randomInt(10, 99);
        const ones = a % 10;
        if (ones === 0) {
            // Need a new 'a' that doesn't end in 0 if we want non-zero b?
            // Or just allow b=0?
            // Let's force a to not end in 0 for better drills
            return createProblem("sub_2d1d_nc", `${a} - 0 =`, a.toString(), "number"); // Fallback
        }
        const safeB = randomInt(1, ones);
        return createProblem("sub_2d1d_nc", `${a} - ${safeB} =`, (a - safeB).toString(), "number");
    },
    // Level 7: 2桁-1桁（繰下あり）
    "sub_2d1d_c": () => {
        // a: 10-99, b > a's ones digit
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(1, 9); } while (b <= (a % 10));
        return createProblem("sub_2d1d_c", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 7: 2桁-2桁
    "sub_2d2d": () => {
        const a = randomInt(10, 99);
        const b = randomInt(10, a);
        return createProblem("sub_2d2d", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 8: 3桁-3桁
    "sub_3d3d": () => {
        const a = randomInt(100, 999);
        const b = randomInt(100, a);
        return createProblem("sub_3d3d", `${a} - ${b} =`, (a - b).toString(), "number");
    },
    // Level 8: 4桁以上
    "sub_4d": () => {
        const a = randomInt(1000, 9999);
        const b = randomInt(1000, a);
        return createProblem("sub_4d", `${a} - ${b} =`, (a - b).toString(), "number");
    }
};
