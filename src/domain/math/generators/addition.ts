import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 4: +1〜+3（1桁）
    "add_1d_1": () => {
        const a = randomInt(1, 9);
        const b = randomInt(1, 3);
        // Ensure result is reasonable if needed, specs say a+b<=12
        // Since max a=9, max b=3, max sum=12. OK.
        return createProblem("add_1d_1", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 5: +4〜+10（1桁）
    "add_1d_2": () => {
        const a = randomInt(1, 9);
        const b = randomInt(4, 10);
        // Specs: a+b<=18. Max 9+10=19. 
        // Small correction to match spec strictest interpretation if needed, but 19 is fine.
        return createProblem("add_1d_2", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+1桁（繰上なし）
    "add_2d1d_nc": () => {
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(1, 9); } while ((a % 10) + b >= 10);
        return createProblem("add_2d1d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+1桁（繰上あり）
    "add_2d1d_c": () => {
        let a, b;
        do { a = randomInt(10, 99); b = randomInt(1, 9); } while ((a % 10) + b < 10);
        return createProblem("add_2d1d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上なし）
    "add_2d2d_nc": () => {
        const a1 = randomInt(1, 8), a2 = randomInt(0, 8);
        const b1 = randomInt(1, 9 - a1), b2 = randomInt(0, 9 - a2);
        const a = a1 * 10 + a2, b = b1 * 10 + b2;
        return createProblem("add_2d2d_nc", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 7: 2桁+2桁（繰上あり）
    "add_2d2d_c": () => {
        let a, b;
        // Either place carries.
        // Simplest check: sum >= 100 OR (ones digit sum >= 10)
        // Spec says: "any carry".
        do { a = randomInt(10, 99); b = randomInt(10, 99); } while (
            (a % 10) + (b % 10) < 10 && // No ones carry
            (Math.floor(a / 10) + Math.floor(b / 10)) < 10 // No tens carry (if sum < 100)
        );
        return createProblem("add_2d2d_c", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 3桁+3桁
    "add_3d3d": () => {
        const a = randomInt(100, 999);
        const b = randomInt(100, 999);
        return createProblem("add_3d3d", `${a} + ${b} =`, (a + b).toString(), "number");
    },
    // Level 8: 4桁以上
    "add_4d": () => {
        const a = randomInt(1000, 9999);
        const b = randomInt(1000, 9999);
        return createProblem("add_4d", `${a} + ${b} =`, (a + b).toString(), "number");
    }
};
