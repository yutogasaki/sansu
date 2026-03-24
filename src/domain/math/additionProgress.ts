export type AdditionPair = readonly [number, number];

const ADD_TINY_SEQUENCE: AdditionPair[] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [1, 3],
    [3, 1],
    [2, 2],
];

const ADD_FINGER_SEQUENCE: AdditionPair[] = [
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
];

const ADD_5_SEQUENCE: AdditionPair[] = [
    [1, 5],
    [5, 1],
    [2, 4],
    [4, 2],
    [3, 3],
    [2, 5],
    [5, 2],
    [3, 4],
    [4, 3],
    [3, 5],
    [5, 3],
    [4, 4],
    [4, 5],
    [5, 4],
    [5, 5],
];

const LEVEL4_SEQUENCE: AdditionPair[] = [
    [1, 1],
    [1, 2],
    [2, 1],
    [1, 3],
    [3, 1],
    [2, 2],
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
    [1, 5],
    [5, 1],
    [2, 4],
    [4, 2],
    [3, 3],
];

const LEVEL5_NO_CARRY_SEQUENCE: AdditionPair[] = [
    [1, 5],
    [2, 4],
    [3, 3],
    [4, 4],
    [2, 5],
    [3, 4],
    [1, 6],
    [2, 6],
    [3, 5],
    [4, 5],
    [1, 7],
    [2, 7],
];

const LEVEL5_MAKE_TEN_SEQUENCE: AdditionPair[] = [
    [1, 9],
    [2, 8],
    [3, 7],
    [4, 6],
    [5, 5],
    [6, 4],
    [7, 3],
    [8, 2],
    [9, 1],
];

const LEVEL5_CARRY_SEQUENCE: AdditionPair[] = [
    [2, 9],
    [3, 8],
    [4, 7],
    [5, 6],
    [2, 8],
    [3, 9],
    [4, 8],
    [5, 7],
    [6, 6],
];

const buildPairs = (predicate: (a: number, b: number) => boolean): AdditionPair[] => {
    const pairs: AdditionPair[] = [];

    for (let a = 1; a <= 9; a += 1) {
        for (let b = 1; b <= 9; b += 1) {
            if (predicate(a, b)) {
                pairs.push([a, b]);
            }
        }
    }

    return pairs;
};

const LEVEL4_POOL = buildPairs((a, b) => a + b <= 5);
const ADD_TINY_POOL = buildPairs((a, b) => a <= 3 && b <= 3);
const ADD_FINGER_SUM5_POOL = buildPairs((a, b) => a <= 4 && b <= 4 && a + b === 5);
const ADD_FINGER_POOL = buildPairs((a, b) => a <= 4 && b <= 4 && a + b <= 5);
const ADD_5_PHASE_1_POOL = buildPairs((a, b) => a <= 5 && b <= 5 && a + b <= 8);
const ADD_5_PHASE_2_POOL = buildPairs((a, b) => a <= 5 && b <= 5 && a + b >= 9);
const ADD_5_POOL = buildPairs((a, b) => a <= 5 && b <= 5);
const LEVEL5_FALLBACK_POOL = buildPairs((a, b) => a + b >= 6);
const LEVEL5_CARRY_POOL = buildPairs((a, b) => a + b >= 10);

const pickRandom = (pairs: AdditionPair[]): AdditionPair => {
    const index = Math.floor(Math.random() * pairs.length);
    return pairs[index] || pairs[0];
};

export const selectAdditionPair = (skillId: string, totalAnswers?: number): AdditionPair => {
    if (skillId === "add_tiny") {
        if (typeof totalAnswers === "number" && totalAnswers < ADD_TINY_SEQUENCE.length) {
            return ADD_TINY_SEQUENCE[totalAnswers];
        }
        return pickRandom(ADD_TINY_POOL);
    }

    if (skillId === "add_finger") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < ADD_FINGER_SEQUENCE.length) {
                return ADD_FINGER_SEQUENCE[totalAnswers];
            }

            if (totalAnswers < ADD_FINGER_SEQUENCE.length + 8) {
                return pickRandom(ADD_FINGER_SUM5_POOL);
            }
        }

        return pickRandom(ADD_FINGER_POOL);
    }

    if (skillId === "add_5") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < ADD_5_SEQUENCE.length) {
                return ADD_5_SEQUENCE[totalAnswers];
            }

            if (totalAnswers < ADD_5_SEQUENCE.length + 10) {
                return pickRandom(ADD_5_PHASE_1_POOL);
            }

            if (totalAnswers < ADD_5_SEQUENCE.length + 20) {
                return pickRandom(ADD_5_PHASE_2_POOL);
            }
        }

        return pickRandom(ADD_5_POOL);
    }

    if (skillId === "add_1d_1") {
        if (typeof totalAnswers === "number" && totalAnswers < LEVEL4_SEQUENCE.length) {
            return LEVEL4_SEQUENCE[totalAnswers];
        }
        return pickRandom(LEVEL4_POOL);
    }

    if (skillId === "add_1d_2") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < LEVEL5_NO_CARRY_SEQUENCE.length) {
                return LEVEL5_NO_CARRY_SEQUENCE[totalAnswers];
            }

            const afterNoCarry = totalAnswers - LEVEL5_NO_CARRY_SEQUENCE.length;
            if (afterNoCarry < LEVEL5_MAKE_TEN_SEQUENCE.length) {
                return LEVEL5_MAKE_TEN_SEQUENCE[afterNoCarry];
            }

            const afterMakeTen = afterNoCarry - LEVEL5_MAKE_TEN_SEQUENCE.length;
            if (afterMakeTen < LEVEL5_CARRY_SEQUENCE.length) {
                return LEVEL5_CARRY_SEQUENCE[afterMakeTen];
            }

            return pickRandom(LEVEL5_CARRY_POOL);
        }

        return pickRandom(LEVEL5_FALLBACK_POOL);
    }

    return [1, 1];
};
