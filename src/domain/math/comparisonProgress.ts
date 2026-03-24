export type ComparisonPair = readonly [number, number];

const buildPairs = (
    min: number,
    max: number,
    predicate: (a: number, b: number) => boolean
): ComparisonPair[] => {
    const pairs: ComparisonPair[] = [];

    for (let a = min; a <= max; a += 1) {
        for (let b = min; b <= max; b += 1) {
            if (a !== b && predicate(a, b)) {
                pairs.push([a, b]);
            }
        }
    }

    return pairs;
};

const pickRandom = (pairs: ComparisonPair[]): ComparisonPair => {
    const index = Math.floor(Math.random() * pairs.length);
    return pairs[index] || pairs[0];
};

const COMPARE_1D_SEQUENCE: ComparisonPair[] = [
    [1, 5],
    [5, 1],
    [2, 6],
    [6, 2],
    [1, 4],
    [4, 1],
    [3, 7],
    [7, 3],
];

const COMPARE_1D_PHASE_1 = buildPairs(1, 9, (a, b) => Math.abs(a - b) >= 4);
const COMPARE_1D_PHASE_2 = buildPairs(1, 9, (a, b) => Math.abs(a - b) >= 2 && Math.abs(a - b) <= 3);
const COMPARE_1D_PHASE_3 = buildPairs(1, 9, (a, b) => Math.abs(a - b) === 1);
const COMPARE_1D_POOL = [...COMPARE_1D_PHASE_1, ...COMPARE_1D_PHASE_2, ...COMPARE_1D_PHASE_3];

const COMPARE_2D_PHASE_1 = buildPairs(10, 99, (a, b) => Math.abs(a - b) >= 30);
const COMPARE_2D_PHASE_2 = buildPairs(10, 99, (a, b) => Math.abs(a - b) >= 10 && Math.abs(a - b) <= 29);
const COMPARE_2D_PHASE_3 = buildPairs(10, 99, (a, b) => Math.floor(a / 10) === Math.floor(b / 10));
const COMPARE_2D_POOL = [...COMPARE_2D_PHASE_1, ...COMPARE_2D_PHASE_2, ...COMPARE_2D_PHASE_3];

export const selectComparisonPair = (skillId: string, totalAnswers?: number): ComparisonPair => {
    if (skillId === "compare_1d") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < COMPARE_1D_SEQUENCE.length) {
                return COMPARE_1D_SEQUENCE[totalAnswers];
            }

            if (totalAnswers < COMPARE_1D_SEQUENCE.length + 8) {
                return pickRandom(COMPARE_1D_PHASE_1);
            }

            if (totalAnswers < COMPARE_1D_SEQUENCE.length + 16) {
                return pickRandom(COMPARE_1D_PHASE_2);
            }
        }

        return pickRandom(COMPARE_1D_POOL);
    }

    if (skillId === "compare_2d") {
        if (typeof totalAnswers === "number") {
            if (totalAnswers < 8) {
                return pickRandom(COMPARE_2D_PHASE_1);
            }

            if (totalAnswers < 16) {
                return pickRandom(COMPARE_2D_PHASE_2);
            }

            if (totalAnswers < 24) {
                return pickRandom(COMPARE_2D_PHASE_3);
            }
        }

        return pickRandom(COMPARE_2D_POOL);
    }

    return [1, 2];
};
