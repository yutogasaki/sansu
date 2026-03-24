export interface SameCountMatchPattern {
    target: number;
    options: number[];
}

export interface ShareEqualPattern {
    total: number;
    groups: number;
}

export interface OrdinalPattern {
    length: number;
    targetIndex: number;
    prompt: string;
}

export interface PatternCopyPattern {
    visible: number[];
    answerIndex: number;
}

export interface LengthComparePattern {
    left: number;
    right: number;
}

export interface HeightComparePattern {
    left: number;
    right: number;
}

export interface SortByAttributePattern {
    setIndex: number;
    targetBucket: 0 | 1;
}

export interface BigSmallPattern {
    leftScale: number;
    rightScale: number;
    largerIndex: 0 | 1;
}

export interface SameOrDifferentPattern {
    isSame: boolean;
}

export interface SpatialWordsPattern {
    orientation: "row" | "column";
    targetIndex: 0 | 1;
    answer: "うえ" | "した" | "ひだり" | "みぎ";
    choices: ["うえ", "した"] | ["ひだり", "みぎ"];
}

export interface WeightComparePattern {
    left: number;
    right: number;
}

const ZERO_CONCEPT_SEQUENCE = [1, 2, 3, 4, 5];
const ONE_TO_ONE_SEQUENCE = [1, 2, 3, 4, 5];
const WHICH_IS_EMPTY_SEQUENCE = [0, 1, 0, 2, 0, 3];

const SAME_COUNT_MATCH_SEQUENCE: SameCountMatchPattern[] = [
    { target: 1, options: [1, 3, 5] },
    { target: 2, options: [4, 2, 5] },
    { target: 3, options: [1, 5, 3] },
    { target: 4, options: [2, 4, 1] },
    { target: 5, options: [5, 2, 3] },
];

const SHARE_EQUAL_SEQUENCE: ShareEqualPattern[] = [
    { total: 2, groups: 2 },
    { total: 4, groups: 2 },
    { total: 6, groups: 2 },
    { total: 3, groups: 3 },
    { total: 6, groups: 3 },
    { total: 8, groups: 2 },
];

const ORDINAL_SEQUENCE: OrdinalPattern[] = [
    { length: 3, targetIndex: 0, prompt: "ひだりから 1ばんめは どれ？" },
    { length: 3, targetIndex: 2, prompt: "ひだりから さいごは どれ？" },
    { length: 3, targetIndex: 1, prompt: "ひだりから 2ばんめは どれ？" },
    { length: 4, targetIndex: 0, prompt: "ひだりから 1ばんめは どれ？" },
    { length: 4, targetIndex: 3, prompt: "ひだりから さいごは どれ？" },
    { length: 4, targetIndex: 2, prompt: "ひだりから 3ばんめは どれ？" },
];

const PATTERN_COPY_SEQUENCE: PatternCopyPattern[] = [
    { visible: [0, 1, 0, 1], answerIndex: 0 },
    { visible: [1, 0, 1, 0], answerIndex: 1 },
    { visible: [0, 0, 1, 1], answerIndex: 0 },
    { visible: [1, 1, 0, 0], answerIndex: 1 },
    { visible: [0, 1, 2, 0], answerIndex: 1 },
    { visible: [2, 0, 1, 2], answerIndex: 0 },
];

const LENGTH_COMPARE_SEQUENCE: LengthComparePattern[] = [
    { left: 7, right: 3 },
    { left: 3, right: 7 },
    { left: 8, right: 4 },
    { left: 4, right: 8 },
    { left: 6, right: 2 },
    { left: 2, right: 6 },
];

const HEIGHT_COMPARE_SEQUENCE: HeightComparePattern[] = [
    { left: 7, right: 3 },
    { left: 3, right: 7 },
    { left: 8, right: 5 },
    { left: 5, right: 8 },
    { left: 6, right: 2 },
    { left: 2, right: 6 },
];

const SORT_BY_ATTRIBUTE_SEQUENCE: SortByAttributePattern[] = [
    { setIndex: 0, targetBucket: 0 },
    { setIndex: 0, targetBucket: 1 },
    { setIndex: 1, targetBucket: 0 },
    { setIndex: 1, targetBucket: 1 },
    { setIndex: 2, targetBucket: 0 },
    { setIndex: 2, targetBucket: 1 },
    { setIndex: 3, targetBucket: 0 },
    { setIndex: 3, targetBucket: 1 },
];

const BIG_SMALL_SEQUENCE: BigSmallPattern[] = [
    { leftScale: 1.8, rightScale: 1.0, largerIndex: 0 },
    { leftScale: 1.0, rightScale: 1.8, largerIndex: 1 },
    { leftScale: 1.7, rightScale: 1.1, largerIndex: 0 },
    { leftScale: 1.1, rightScale: 1.7, largerIndex: 1 },
    { leftScale: 1.6, rightScale: 1.2, largerIndex: 0 },
    { leftScale: 1.2, rightScale: 1.6, largerIndex: 1 },
];

const SAME_OR_DIFFERENT_SEQUENCE: SameOrDifferentPattern[] = [
    { isSame: true },
    { isSame: false },
    { isSame: true },
    { isSame: false },
    { isSame: true },
    { isSame: false },
];

const SPATIAL_WORDS_SEQUENCE: SpatialWordsPattern[] = [
    { orientation: "column", targetIndex: 0, answer: "うえ", choices: ["うえ", "した"] },
    { orientation: "column", targetIndex: 1, answer: "した", choices: ["うえ", "した"] },
    { orientation: "row", targetIndex: 0, answer: "ひだり", choices: ["ひだり", "みぎ"] },
    { orientation: "row", targetIndex: 1, answer: "みぎ", choices: ["ひだり", "みぎ"] },
    { orientation: "column", targetIndex: 0, answer: "うえ", choices: ["うえ", "した"] },
    { orientation: "row", targetIndex: 1, answer: "みぎ", choices: ["ひだり", "みぎ"] },
];

const WEIGHT_COMPARE_SEQUENCE: WeightComparePattern[] = [
    { left: 8, right: 3 },
    { left: 3, right: 8 },
    { left: 7, right: 4 },
    { left: 4, right: 7 },
    { left: 6, right: 2 },
    { left: 2, right: 6 },
];

const COMPOSE_5_SEQUENCE = [4, 3, 2, 1, 3, 2];
const COMPOSE_10_SEQUENCE = [9, 8, 7, 6, 5, 4, 8, 7];

const pickRandom = <T,>(items: T[]): T => {
    const index = Math.floor(Math.random() * items.length);
    return items[index] || items[0];
};

const shuffle = <T,>(items: T[]): T[] => {
    const next = [...items];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
};

const buildCountRange = (max: number): number[] =>
    Array.from({ length: max }, (_, index) => index + 1);

const buildDistinctPairPool = (minimumGap: number, min = 2, max = 8): { left: number; right: number }[] => {
    const pairs: { left: number; right: number }[] = [];

    for (let left = min; left <= max; left += 1) {
        for (let right = min; right <= max; right += 1) {
            if (left !== right && Math.abs(left - right) >= minimumGap) {
                pairs.push({ left, right });
            }
        }
    }

    return pairs;
};

const pickDistractors = (
    target: number,
    max: number,
    minimumGap: number
): number[] => {
    const far = buildCountRange(max).filter(value => value !== target && Math.abs(value - target) >= minimumGap);
    const fallback = buildCountRange(max).filter(value => value !== target);
    const pool = far.length >= 2 ? far : fallback;

    return shuffle(pool).slice(0, 2);
};

export const selectSameCountMatchPattern = (totalAnswers?: number): SameCountMatchPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < SAME_COUNT_MATCH_SEQUENCE.length) {
        return SAME_COUNT_MATCH_SEQUENCE[totalAnswers];
    }

    const max = typeof totalAnswers === "number" && totalAnswers < 16 ? 4 : 5;
    const minimumGap = typeof totalAnswers === "number" && totalAnswers < 16 ? 2 : 1;
    const target = pickRandom(buildCountRange(max));
    const distractors = pickDistractors(target, max, minimumGap);

    return {
        target,
        options: shuffle([target, ...distractors]),
    };
};

export const selectShareEqualPattern = (totalAnswers?: number): ShareEqualPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < SHARE_EQUAL_SEQUENCE.length) {
        return SHARE_EQUAL_SEQUENCE[totalAnswers];
    }

    const easyPool: ShareEqualPattern[] = [
        { total: 2, groups: 2 },
        { total: 4, groups: 2 },
        { total: 6, groups: 2 },
        { total: 8, groups: 2 },
        { total: 10, groups: 2 },
    ];
    const fullPool: ShareEqualPattern[] = [
        ...easyPool,
        { total: 3, groups: 3 },
        { total: 6, groups: 3 },
        { total: 9, groups: 3 },
    ];

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(easyPool);
    }

    return pickRandom(fullPool);
};

export const selectOrdinalPattern = (totalAnswers?: number): OrdinalPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < ORDINAL_SEQUENCE.length) {
        return ORDINAL_SEQUENCE[totalAnswers];
    }

    const easyPool: OrdinalPattern[] = [
        { length: 3, targetIndex: 0, prompt: "ひだりから 1ばんめは どれ？" },
        { length: 3, targetIndex: 1, prompt: "ひだりから 2ばんめは どれ？" },
        { length: 3, targetIndex: 2, prompt: "ひだりから さいごは どれ？" },
    ];
    const fullPool: OrdinalPattern[] = [
        ...easyPool,
        { length: 4, targetIndex: 0, prompt: "ひだりから 1ばんめは どれ？" },
        { length: 4, targetIndex: 1, prompt: "ひだりから 2ばんめは どれ？" },
        { length: 4, targetIndex: 2, prompt: "ひだりから 3ばんめは どれ？" },
        { length: 4, targetIndex: 3, prompt: "ひだりから さいごは どれ？" },
    ];

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(easyPool);
    }

    return pickRandom(fullPool);
};

export const selectPatternCopyPattern = (totalAnswers?: number): PatternCopyPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < PATTERN_COPY_SEQUENCE.length) {
        return PATTERN_COPY_SEQUENCE[totalAnswers];
    }

    const easyPool: PatternCopyPattern[] = [
        { visible: [0, 1, 0, 1], answerIndex: 0 },
        { visible: [1, 0, 1, 0], answerIndex: 1 },
        { visible: [0, 0, 1, 1], answerIndex: 0 },
        { visible: [1, 1, 0, 0], answerIndex: 1 },
    ];
    const fullPool: PatternCopyPattern[] = [
        ...easyPool,
        { visible: [0, 1, 2, 0], answerIndex: 1 },
        { visible: [1, 2, 0, 1], answerIndex: 2 },
        { visible: [2, 0, 1, 2], answerIndex: 0 },
    ];

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(easyPool);
    }

    return pickRandom(fullPool);
};

export const selectLengthComparePattern = (totalAnswers?: number): LengthComparePattern => {
    if (typeof totalAnswers === "number" && totalAnswers < LENGTH_COMPARE_SEQUENCE.length) {
        return LENGTH_COMPARE_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(buildDistinctPairPool(3));
    }

    return pickRandom(buildDistinctPairPool(1));
};

export const selectHeightComparePattern = (totalAnswers?: number): HeightComparePattern => {
    if (typeof totalAnswers === "number" && totalAnswers < HEIGHT_COMPARE_SEQUENCE.length) {
        return HEIGHT_COMPARE_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(buildDistinctPairPool(3));
    }

    return pickRandom(buildDistinctPairPool(1));
};

export const selectSortByAttributePattern = (totalAnswers?: number): SortByAttributePattern => {
    if (typeof totalAnswers === "number" && totalAnswers < SORT_BY_ATTRIBUTE_SEQUENCE.length) {
        return SORT_BY_ATTRIBUTE_SEQUENCE[totalAnswers];
    }

    const easyPool: SortByAttributePattern[] = [
        { setIndex: 0, targetBucket: 0 },
        { setIndex: 0, targetBucket: 1 },
        { setIndex: 1, targetBucket: 0 },
        { setIndex: 1, targetBucket: 1 },
    ];
    const fullPool: SortByAttributePattern[] = [
        ...easyPool,
        { setIndex: 2, targetBucket: 0 },
        { setIndex: 2, targetBucket: 1 },
        { setIndex: 3, targetBucket: 0 },
        { setIndex: 3, targetBucket: 1 },
    ];

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(easyPool);
    }

    return pickRandom(fullPool);
};

export const selectBigSmallPattern = (totalAnswers?: number): BigSmallPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < BIG_SMALL_SEQUENCE.length) {
        return BIG_SMALL_SEQUENCE[totalAnswers];
    }

    const easyPool = BIG_SMALL_SEQUENCE.slice(0, 4);
    const fullPool = [
        ...BIG_SMALL_SEQUENCE,
        { leftScale: 1.5, rightScale: 1.25, largerIndex: 0 as const },
        { leftScale: 1.25, rightScale: 1.5, largerIndex: 1 as const },
    ];

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(easyPool);
    }

    return pickRandom(fullPool);
};

export const selectSameOrDifferentPattern = (totalAnswers?: number): SameOrDifferentPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < SAME_OR_DIFFERENT_SEQUENCE.length) {
        return SAME_OR_DIFFERENT_SEQUENCE[totalAnswers];
    }

    return { isSame: Math.random() < 0.5 };
};

export const selectSpatialWordsPattern = (totalAnswers?: number): SpatialWordsPattern => {
    if (typeof totalAnswers === "number" && totalAnswers < SPATIAL_WORDS_SEQUENCE.length) {
        return SPATIAL_WORDS_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(SPATIAL_WORDS_SEQUENCE.slice(0, 4));
    }

    return pickRandom(SPATIAL_WORDS_SEQUENCE);
};

export const selectWeightComparePattern = (totalAnswers?: number): WeightComparePattern => {
    if (typeof totalAnswers === "number" && totalAnswers < WEIGHT_COMPARE_SEQUENCE.length) {
        return WEIGHT_COMPARE_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return pickRandom(buildDistinctPairPool(3));
    }

    return pickRandom(buildDistinctPairPool(1));
};

export const selectZeroConceptCount = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < ZERO_CONCEPT_SEQUENCE.length) {
        return ZERO_CONCEPT_SEQUENCE[totalAnswers];
    }

    return Math.floor(Math.random() * 5) + 1;
};

export const selectWhichIsEmptyCount = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < WHICH_IS_EMPTY_SEQUENCE.length) {
        return WHICH_IS_EMPTY_SEQUENCE[totalAnswers] || 0;
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 3) + 1;
    }

    return Math.random() < 0.4 ? 0 : Math.floor(Math.random() * 5) + 1;
};

export const selectOneToOneCount = (totalAnswers?: number): number => {
    if (typeof totalAnswers === "number" && totalAnswers < ONE_TO_ONE_SEQUENCE.length) {
        return ONE_TO_ONE_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return Math.floor(Math.random() * 3) + 1;
    }

    return Math.floor(Math.random() * 5) + 1;
};

export const selectComposeFilledCount = (
    skillId: "compose_5" | "compose_10",
    totalAnswers?: number
): number => {
    if (skillId === "compose_5") {
        if (typeof totalAnswers === "number" && totalAnswers < COMPOSE_5_SEQUENCE.length) {
            return COMPOSE_5_SEQUENCE[totalAnswers];
        }

        return Math.floor(Math.random() * 4) + 1;
    }

    if (typeof totalAnswers === "number" && totalAnswers < COMPOSE_10_SEQUENCE.length) {
        return COMPOSE_10_SEQUENCE[totalAnswers];
    }

    if (typeof totalAnswers === "number" && totalAnswers < 16) {
        return Math.floor(Math.random() * 6) + 4;
    }

    return Math.floor(Math.random() * 9) + 1;
};
