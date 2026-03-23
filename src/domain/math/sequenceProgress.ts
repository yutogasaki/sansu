export interface CountFillPattern {
    start: number;
    missingIndex: number;
}

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
