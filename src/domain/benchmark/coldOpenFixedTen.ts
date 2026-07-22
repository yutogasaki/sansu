import type { Problem } from "../types";

export const COLD_OPEN_FIXED_TEN_ID = "cold-open-fixed-ten-v1";

export interface ColdOpenFixedTenItem {
    readonly left: number;
    readonly right: number;
    readonly answer: number;
}

/**
 * A comparison fixture, not a learning plan. Both lanes render these exact
 * values so presentation throughput can be compared without pretending that
 * ten repeated `add_1d_1` assignments came from the production planner.
 */
export const COLD_OPEN_FIXED_TEN: readonly ColdOpenFixedTenItem[] = [
    { left: 1, right: 1, answer: 2 },
    { left: 2, right: 3, answer: 5 },
    { left: 4, right: 2, answer: 6 },
    { left: 5, right: 3, answer: 8 },
    { left: 7, right: 1, answer: 8 },
    { left: 8, right: 2, answer: 10 },
    { left: 9, right: 3, answer: 12 },
    { left: 6, right: 2, answer: 8 },
    { left: 3, right: 3, answer: 6 },
    { left: 9, right: 1, answer: 10 },
] as const;

export const getColdOpenFixedTenItem = (
    index: number,
): ColdOpenFixedTenItem | undefined => (
    Number.isSafeInteger(index) && index >= 0
        ? COLD_OPEN_FIXED_TEN[index]
        : undefined
);

export const createColdOpenFixedTenProblem = (
    index: number,
    id = `${COLD_OPEN_FIXED_TEN_ID}:${index}`,
): Problem | undefined => {
    const item = getColdOpenFixedTenItem(index);
    if (!item) return undefined;

    return {
        id,
        subject: "math",
        categoryId: "add_1d_1",
        questionText: `${item.left} + ${item.right} =`,
        inputType: "number",
        correctAnswer: String(item.answer),
        isReview: false,
        isMaintenanceCheck: false,
    };
};

export const createColdOpenFixedTenBlock = (
    idPrefix = COLD_OPEN_FIXED_TEN_ID,
): Problem[] => COLD_OPEN_FIXED_TEN.flatMap((_, index) => {
    const problem = createColdOpenFixedTenProblem(index, `${idPrefix}:${index}`);
    return problem ? [problem] : [];
});
