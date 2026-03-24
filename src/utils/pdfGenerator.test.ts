import { describe, expect, it } from "vitest";
import type { Problem } from "../domain/types";
import { estimateMathProblemHeight, getChoiceAnswerLayout, paginateMathProblems, wrapPdfLines } from "./pdfGenerator";

const createMeasurer = (unitWidth = 10) => ({
    widthOfTextAtSize: (text: string, fontSize: number) => text.length * unitWidth * (fontSize / 10),
});

const createProblem = (overrides: Partial<Problem>): Problem => ({
    id: "p1",
    subject: "math",
    categoryId: "count_5",
    questionText: "いくつ ある？",
    inputType: "number",
    correctAnswer: "1",
    isReview: false,
    ...overrides,
});

describe("wrapPdfLines", () => {
    it("wraps long printable text by width", () => {
        const lines = wrapPdfLines("りんご 12こ りんご 12こ", createMeasurer(), 10, 60);

        expect(lines.length).toBeGreaterThan(1);
        expect(lines.join("")).toBe("りんご 12こ りんご 12こ");
    });

    it("preserves explicit line breaks before wrapping", () => {
        const lines = wrapPdfLines("おてほん: まる\nせんたく: あか まる / さんかく", createMeasurer(), 10, 90);

        expect(lines[0]).toBe("おてほん: まる");
        expect(lines.slice(1).join("")).toBe("せんたく: あか まる / さんかく");
    });
});

describe("getChoiceAnswerLayout", () => {
    it("fits four-choice answer boxes inside the default answer width", () => {
        const layout = getChoiceAnswerLayout(4, 60);

        expect(layout.totalWidth).toBeLessThanOrEqual(60);
        expect(layout.boxSize).toBeLessThanOrEqual(12);
    });
});

describe("estimateMathProblemHeight", () => {
    it("gives longer printable prompts more height", () => {
        const shortProblem = createProblem({
            questionText: "1 + 1 =",
        });
        const longProblem = createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "なか", value: "なか" },
                    { label: "そと", value: "そと" },
                ],
            },
            questionVisual: {
                kind: "position-scene",
                prompt: "りんご は なか？ そと？",
                scene: "inside-outside",
                target: { emoji: "🍎", label: "りんご" },
                reference: { emoji: "🧺", label: "かご" },
                relation: "なか",
            },
        });

        expect(estimateMathProblemHeight(longProblem, createMeasurer(), 140)).toBeGreaterThan(
            estimateMathProblemHeight(shortProblem, createMeasurer(), 140)
        );
    });
});

describe("paginateMathProblems", () => {
    it("spills long preschool prompts onto additional pages", () => {
        const longProblem = createProblem({
            id: "long",
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "なか", value: "なか" },
                    { label: "そと", value: "そと" },
                ],
            },
            questionVisual: {
                kind: "position-scene",
                prompt: "りんご は なか？ そと？",
                scene: "inside-outside",
                target: { emoji: "🍎", label: "りんご" },
                reference: { emoji: "🧺", label: "かご" },
                relation: "なか",
            },
        });
        const problems = Array.from({ length: 18 }, (_, index) => createProblem({
            ...longProblem,
            id: `long-${index + 1}`,
        }));

        const layouts = paginateMathProblems(problems, createMeasurer(), 842);

        expect(layouts.length).toBeGreaterThan(1);
        expect(layouts.flatMap(layout => layout.problems).length).toBe(18);
    });
});
