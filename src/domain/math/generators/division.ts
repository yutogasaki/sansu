import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 12: 割り切れる（九九逆）
    "div_99_rev": () => {
        const b = randomInt(1, 9);
        const q = randomInt(1, 9);
        const a = b * q;
        return createProblem("div_99_rev", `${a} ÷ ${b} =`, q.toString(), "number");
    },
    // Level 12: 2桁÷1桁（割切）
    "div_2d1d_exact": () => {
        const b = randomInt(2, 9);
        // a = b * q, result 2 digits => q in 2-digit range? 
        // Spec: "a is 2 digits" ? No, "a: b*(2~11) and a is 2 digits"
        // Let's generate q such that a is 2 digits.
        const maxQ = Math.floor(99 / b);
        const q = randomInt(2, maxQ);
        const a = b * q;
        return createProblem("div_2d1d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    },

    // Level 13: 余りあり（商1桁）
    "div_rem_q1": () => {
        const b = randomInt(2, 9);
        const q = randomInt(1, 9);
        const r = randomInt(1, b - 1);
        const a = b * q + r;
        return createProblem("div_rem_q1", `${a} ÷ ${b} =`, [q.toString(), r.toString()], "multi-number", {
            fields: [
                { label: "しょう", length: 1 },
                { label: "あまり", length: 1 }
            ]
        });
    },
    // Level 13: 余りあり（商2桁）
    "div_rem_q2": () => {
        const b = randomInt(2, 9);
        const q = randomInt(10, 99);
        const r = randomInt(1, b - 1);
        const a = b * q + r;
        return createProblem("div_rem_q2", `${a} ÷ ${b} =`, [q.toString(), r.toString()], "multi-number", {
            fields: [
                { label: "しょう", length: 2 },
                { label: "あまり", length: 1 }
            ]
        });
    },

    // Level 14: 2桁÷2桁（割切）
    "div_2d2d_exact": () => {
        const b = randomInt(10, 99);

        // Ensure a is 2 digits?
        // If b=10, q=9, a=90. OK.
        // If b=50, q=2, a=100. NG.
        // So b * q <= 99.
        // Max q = 99 / b.
        const maxQ = Math.floor(99 / b);
        if (maxQ < 1) {
            // b > 99 impossible
            return createProblem("div_2d2d_exact", `10 ÷ 10 =`, "1", "number"); // Fallback
        }
        const safeQ = randomInt(1, maxQ);
        const a = b * safeQ;
        return createProblem("div_2d2d_exact", `${a} ÷ ${b} =`, safeQ.toString(), "number");
    },
    // Level 14: 3桁÷1桁（割切）
    "div_3d1d_exact": () => {
        const b = randomInt(2, 9);
        // a = 3 digits. 100 <= b * q <= 999
        const minQ = Math.ceil(100 / b);
        const maxQ = Math.floor(999 / b);
        const q = randomInt(minQ, maxQ);
        const a = b * q;
        return createProblem("div_3d1d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    },
    // Level 14: 3桁÷2桁（割切）
    "div_3d2d_exact": () => {
        const b = randomInt(10, 99);
        // a = 3 digits.
        const minQ = Math.ceil(100 / b);
        const maxQ = Math.floor(999 / b);
        // q in 2-9 range implied? Specs say "b: 10-99, a: b*(2-9)" -> q is 2-9.
        const q = randomInt(Math.max(2, minQ), Math.min(9, maxQ));
        const a = b * q;
        return createProblem("div_3d2d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    }
};
