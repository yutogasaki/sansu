import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 20: 10倍、100倍、1/10
    "scale_10x": () => {
        const type = randomInt(0, 2); // 0: x10, 1: x100, 2: /10
        const a = randomInt(1, 999);

        if (type === 0) {
            return createProblem("scale_10x", `${a} × 10 =`, (a * 10).toString(), "number");
        } else if (type === 1) {
            return createProblem("scale_10x", `${a} × 100 =`, (a * 100).toString(), "number");
        } else {
            // Division. Need number divisible by 10 or decimal result?
            // "1/10" usually implies shifting decimal.
            // Let's use clean multiples of 10 if simple, or decimals if advanced.
            // Spec is loose. Let's do a * 10 then divide back for simple integer drilling?
            // No, getting decimal sense is goal.
            // If a = 123, /10 = 12.3
            return createProblem("scale_10x", `${a} ÷ 10 =`, (a / 10).toString(), "number");
        }
    }
};
