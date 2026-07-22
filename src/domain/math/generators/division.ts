import { GeneratorFn, createProblem, randomInt } from "../core";

export const generators: Record<string, GeneratorFn> = {
    // Level 12: 割り切れる（九九逆）
    "div_99_rev": (context) => {
        const b = randomInt(1, 9, context?.random);
        const q = randomInt(1, 9, context?.random);
        const a = b * q;
        return createProblem("div_99_rev", `${a} ÷ ${b} =`, q.toString(), "number");
    },
    // Level 12: 2桁÷1桁（割切）
    "div_2d1d_exact": (context) => {
        const b = randomInt(2, 9, context?.random);
        const minQ = Math.max(2, Math.ceil(10 / b));
        const maxQ = Math.min(11, Math.floor(99 / b));
        const q = randomInt(minQ, maxQ, context?.random);
        const a = b * q;
        return createProblem("div_2d1d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    },

    // Level 13: 余りあり（商1桁）
    "div_rem_q1": (context) => {
        const b = randomInt(2, 9, context?.random);
        const q = randomInt(1, 9, context?.random);
        const r = randomInt(1, b - 1, context?.random);
        const a = b * q + r;
        return createProblem("div_rem_q1", `${a} ÷ ${b} =`, [q.toString(), r.toString()], "multi-number", {
            fields: [
                { label: "しょう", length: 1 },
                { label: "あまり", length: 1 }
            ]
        });
    },
    // Level 13: 余りあり（商2桁）
    "div_rem_q2": (context) => {
        const b = randomInt(2, 9, context?.random);
        const q = randomInt(10, 99, context?.random);
        const r = randomInt(1, b - 1, context?.random);
        const a = b * q + r;
        return createProblem("div_rem_q2", `${a} ÷ ${b} =`, [q.toString(), r.toString()], "multi-number", {
            fields: [
                { label: "しょう", length: 2 },
                { label: "あまり", length: 1 }
            ]
        });
    },

    // Level 14: 2桁÷2桁（割切）
    "div_2d2d_exact": (context) => {
        const b = randomInt(10, 99, context?.random);

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
        const safeQ = randomInt(1, maxQ, context?.random);
        const a = b * safeQ;
        return createProblem("div_2d2d_exact", `${a} ÷ ${b} =`, safeQ.toString(), "number");
    },
    // Level 14: 3桁÷1桁（割切）
    "div_3d1d_exact": (context) => {
        const b = randomInt(2, 9, context?.random);
        const minQ = Math.max(12, Math.ceil(100 / b));
        const maxQ = Math.min(111, Math.floor(999 / b));
        const q = randomInt(minQ, maxQ, context?.random);
        const a = b * q;
        return createProblem("div_3d1d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    },
    // Level 14: 3桁÷2桁（割切）
    "div_3d2d_exact": (context) => {
        // 10 and 11 cannot produce a three-digit dividend with a quotient of 2-9.
        const b = randomInt(12, 99, context?.random);
        const minQ = Math.max(2, Math.ceil(100 / b));
        const maxQ = Math.min(9, Math.floor(999 / b));
        const q = randomInt(minQ, maxQ, context?.random);
        const a = b * q;
        return createProblem("div_3d2d_exact", `${a} ÷ ${b} =`, q.toString(), "number");
    }
};
