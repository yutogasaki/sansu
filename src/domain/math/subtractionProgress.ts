export type SubtractionPair = readonly [number, number];

const SUB_TINY_SEQUENCE: SubtractionPair[] = [
    [2, 1],
    [3, 1],
    [3, 2],
    [4, 1],
    [4, 2],
    [5, 1],
    [4, 3],
    [5, 2],
    [5, 3],
    [5, 4],
];

const SUB_1D_NO_CARRY_SEQUENCE: SubtractionPair[] = [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [3, 2],
    [4, 2],
    [5, 2],
    [6, 2],
    [4, 3],
    [5, 3],
    [6, 3],
    [7, 3],
];

const buildPairs = (predicate: (a: number, b: number) => boolean): SubtractionPair[] => {
    const pairs: SubtractionPair[] = [];

    for (let a = 1; a <= 18; a += 1) {
        for (let b = 1; b <= 9; b += 1) {
            if (predicate(a, b)) {
                pairs.push([a, b]);
            }
        }
    }

    return pairs;
};

const pickRandom = (pairs: SubtractionPair[]): SubtractionPair => {
    const index = Math.floor(Math.random() * pairs.length);
    return pairs[index] || pairs[0];
};

const SUB_TINY_POOL = buildPairs((a, b) => a >= 2 && a <= 5 && b < a);
const SUB_1D_NO_CARRY_POOL = buildPairs((a, b) => a >= 1 && a <= 9 && b <= a);
const SUB_1D_CARRY_PHASE_1 = buildPairs((a, b) => a >= 11 && a <= 18 && b > (a % 10) && b - (a % 10) === 1);
const SUB_1D_CARRY_PHASE_2 = buildPairs((a, b) => a >= 11 && a <= 18 && b > (a % 10) && b - (a % 10) === 2);
const SUB_1D_CARRY_PHASE_3 = buildPairs((a, b) => a >= 11 && a <= 18 && b > (a % 10) && b - (a % 10) >= 3);
const SUB_1D_CARRY_POOL = [...SUB_1D_CARRY_PHASE_1, ...SUB_1D_CARRY_PHASE_2, ...SUB_1D_CARRY_PHASE_3];

export const selectSubtractionPair = (skillId: string, totalAnswers?: number): SubtractionPair => {
    if (skillId === "sub_tiny") {
        if (typeof totalAnswers === "number" && totalAnswers < SUB_TINY_SEQUENCE.length) {
            return SUB_TINY_SEQUENCE[totalAnswers];
        }

        return pickRandom(SUB_TINY_POOL);
    }

    if (skillId === "sub_1d1d_nc") {
        if (typeof totalAnswers === "number" && totalAnswers < SUB_1D_NO_CARRY_SEQUENCE.length) {
            return SUB_1D_NO_CARRY_SEQUENCE[totalAnswers];
        }

        return pickRandom(SUB_1D_NO_CARRY_POOL);
    }

    if (skillId === "sub_1d1d_c") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < SUB_1D_CARRY_PHASE_1.length) {
                return SUB_1D_CARRY_PHASE_1[totalAnswers];
            }

            const afterPhase1 = totalAnswers - SUB_1D_CARRY_PHASE_1.length;
            if (afterPhase1 < SUB_1D_CARRY_PHASE_2.length) {
                return SUB_1D_CARRY_PHASE_2[afterPhase1];
            }

            const afterPhase2 = afterPhase1 - SUB_1D_CARRY_PHASE_2.length;
            if (afterPhase2 < SUB_1D_CARRY_PHASE_3.length) {
                return SUB_1D_CARRY_PHASE_3[afterPhase2];
            }
        }

        return pickRandom(SUB_1D_CARRY_POOL);
    }

    return [2, 1];
};
