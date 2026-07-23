import { describe, expect, it } from "vitest";
import type { Problem } from "../../types";
import {
    EXPLORE_RAPID_FALLBACK_CATEGORY_ID,
    evaluateRapidLoopEligibility,
    isRapidLoopEligibleProblem,
    RAPID_LOOP_MAX_COMPLETION_ACTIONS,
    RAPID_LOOP_MAX_INPUT_ACTIONS,
} from "../rapidLoopEligibility";

const createProblem = (
    overrides: Partial<Problem> = {},
): Problem => ({
    id: "rapid-policy-problem",
    subject: "math",
    categoryId: "add_1d_1",
    questionText: "1 + 1 =",
    inputType: "number",
    correctAnswer: "2",
    isReview: false,
    ...overrides,
});

describe("rapid-loop eligibility", () => {
    it.each([
        ["100", 3, 4],
        ["1.2", 3, 4],
        ["0", 1, 2],
    ])(
        "accepts canonical answer %s inside the action budget",
        (correctAnswer, inputActions, completionActions) => {
            const result = evaluateRapidLoopEligibility(createProblem({ correctAnswer }));

            expect(result).toEqual({
                eligible: true,
                reason: null,
                inputActions,
                completionActions,
            });
            expect(isRapidLoopEligibleProblem(createProblem({ correctAnswer }))).toBe(true);
        },
    );

    it("keeps the input and confirmation budgets explicit", () => {
        expect(RAPID_LOOP_MAX_INPUT_ACTIONS).toBe(3);
        expect(RAPID_LOOP_MAX_COMPLETION_ACTIONS).toBe(4);
    });

    it.each([
        "1000",
        "0.25",
    ])("rejects %s when the answer needs too many keypad actions", (correctAnswer) => {
        expect(evaluateRapidLoopEligibility(createProblem({ correctAnswer }))).toEqual({
            eligible: false,
            reason: "answer-over-action-budget",
            inputActions: 4,
            completionActions: 5,
        });
    });

    it.each([
        ["negative", "-1"],
        ["leading zero", "01"],
        ["trailing decimal zero", "1.0"],
        ["positive sign", "+1"],
        ["whitespace", " 1"],
        ["not numeric", "NaN"],
        ["multiple answers", ["1", "2"]],
    ])("rejects a non-normalized answer: %s", (_label, correctAnswer) => {
        expect(evaluateRapidLoopEligibility(createProblem({ correctAnswer }))).toMatchObject({
            eligible: false,
            reason: "answer-not-supported",
        });
    });

    it.each([
        ["multi-number", { fields: [{ length: 1 }] }],
        ["choice", { choices: [{ label: "1", value: "1" }] }],
    ] as const)("rejects the %s input surface", (inputType, inputConfig) => {
        expect(evaluateRapidLoopEligibility(createProblem({
            inputType,
            inputConfig,
        }))).toMatchObject({
            eligible: false,
            reason: "input-not-single-number",
        });
    });

    it("rejects number input that still carries a multi-field configuration", () => {
        expect(evaluateRapidLoopEligibility(createProblem({
            inputConfig: { fields: [{ length: 1 }] },
        }))).toMatchObject({
            eligible: false,
            reason: "input-not-single-number",
        });
    });

    it.each([
        createProblem({
            categoryId: "add_2d1d_hissan_nc",
            correctAnswer: "24",
        }),
        createProblem({
            inputType: "hissan",
            correctAnswer: "24",
        }),
        createProblem({
            hissanOperands: { a: 18, b: 6 },
            correctAnswer: "24",
        }),
    ])("rejects written-method and algorithm surfaces", (problem) => {
        expect(evaluateRapidLoopEligibility(problem)).toMatchObject({
            eligible: false,
            reason: "written-method-surface",
        });
    });

    it.each([
        ["number-advanced", "large_number_unit"],
        ["application", "percent_basic"],
    ])("rejects the %s curriculum family", (_family, categoryId) => {
        expect(evaluateRapidLoopEligibility(createProblem({
            categoryId,
            correctAnswer: "1",
        }))).toMatchObject({
            eligible: false,
            reason: "high-cognitive-load",
        });
    });

    it.each([
        "add_3d3d",
        "sub_3d3d",
        "add_4d",
        "sub_4d",
    ])("fails closed for legacy written-work skill %s", (categoryId) => {
        expect(evaluateRapidLoopEligibility(createProblem({
            categoryId,
            correctAnswer: "1",
        }))).toMatchObject({
            eligible: false,
            reason: "high-cognitive-load",
        });
    });

    it("fails closed for an unknown curriculum skill", () => {
        expect(evaluateRapidLoopEligibility(createProblem({
            categoryId: "future_unknown_skill",
        }))).toEqual({
            eligible: false,
            reason: "unknown-skill",
            inputActions: null,
            completionActions: null,
        });
    });

    it("allows only the named rapid-safe system fallback outside the curriculum", () => {
        expect(evaluateRapidLoopEligibility(createProblem({
            categoryId: EXPLORE_RAPID_FALLBACK_CATEGORY_ID,
            correctAnswer: "10",
        }))).toEqual({
            eligible: true,
            reason: null,
            inputActions: 2,
            completionActions: 3,
        });

        expect(evaluateRapidLoopEligibility(createProblem({
            categoryId: `${EXPLORE_RAPID_FALLBACK_CATEGORY_ID}-lookalike`,
            correctAnswer: "10",
        }))).toMatchObject({
            eligible: false,
            reason: "unknown-skill",
        });
    });
});
