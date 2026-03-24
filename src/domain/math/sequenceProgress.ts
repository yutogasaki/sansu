export interface CountFillPattern {
    start: number;
    missingIndex: number;
}

const COUNT_NEXT_10_SEQUENCE = [1, 2, 3, 4, 5];
const COUNT_BACK_SEQUENCE = [2, 3, 4, 5, 6];
const COUNT_NEXT_20_SEQUENCE = [10, 11, 12, 13, 14, 15];
const COUNT_50_SEQUENCE = [20, 21, 22, 29, 30, 31];
const COUNT_100_SEQUENCE = [50, 51, 52, 59, 60, 61];

const EASY_PATTERNS: CountFillPattern[] = [
    { start: 1, missingIndex: 2 },
    { start: 2, missingIndex: 1 },
    { start: 3, missingIndex: 3 },
    { start: 4, missingIndex: 2 },
    { start: 5, missingIndex: 1 },
];

const pickRandom = (maxStart: number): CountFillPattern => ({
    start: Math.floor(Math.random() * maxStart) + 1,
    missingIndex: Math.floor(Math.random() * 3) + 1,
});

const pickFromRange = (min: number, max: number): number =>
    Math.floor(Math.random() * (max - min + 1)) + min;

export const selectCountFillPattern = (totalAnswers?: number): CountFillPattern => {
    if (typeof totalAnswers === "number") {
        if (totalAnswers < EASY_PATTERNS.length) {
            return EASY_PATTERNS[totalAnswers];
        }

        if (totalAnswers < 12) {
            return pickRandom(6);
        }

        if (totalAnswers < 20) {
            return pickRandom(16);
        }
    }

    return pickRandom(95);
};

export const selectCountNext10Target = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < COUNT_NEXT_10_SEQUENCE.length) {
        return COUNT_NEXT_10_SEQUENCE[totalAnswers] || 1;
    }

    return pickFromRange(1, 9);
};

export const selectCountBackTarget = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < COUNT_BACK_SEQUENCE.length) {
        return COUNT_BACK_SEQUENCE[totalAnswers] || 2;
    }

    return pickFromRange(2, 10);
};

export const selectCountNext20Target = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < COUNT_NEXT_20_SEQUENCE.length) {
        return COUNT_NEXT_20_SEQUENCE[totalAnswers] || 10;
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickFromRange(10, 19);
    }

    return pickFromRange(1, 19);
};

export const selectCount50Target = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < COUNT_50_SEQUENCE.length) {
        return COUNT_50_SEQUENCE[totalAnswers] || 20;
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickFromRange(10, 39);
    }

    return pickFromRange(1, 49);
};

export const selectCount100Target = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < COUNT_100_SEQUENCE.length) {
        return COUNT_100_SEQUENCE[totalAnswers] || 50;
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickFromRange(40, 79);
    }

    return pickFromRange(1, 99);
};
