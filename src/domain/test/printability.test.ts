import { describe, expect, it } from "vitest";
import { generateMathProblem } from "../math";
import { getSkillsForLevel } from "../math/curriculum";
import type { Problem } from "../types";
import { buildPrintableMathAnswer, buildPrintableMathPrompt, toPrintablePaperText } from "./printability";

const createProblem = (problem: Partial<Problem>): Pick<Problem, "questionText" | "questionVisual" | "inputType" | "inputConfig"> => ({
    questionText: problem.questionText,
    questionVisual: problem.questionVisual,
    inputType: problem.inputType || "number",
    inputConfig: problem.inputConfig,
});

describe("toPrintablePaperText", () => {
    it("replaces emoji and placeholders with paper-safe text", () => {
        expect(toPrintablePaperText("🍎 □")).toBe("りんご [   ]");
    });

    it("keeps repeated counted items intact", () => {
        expect(toPrintablePaperText("⭐ ⭐ ⭐")).toBe("ほし ほし ほし");
    });
});

describe("buildPrintableMathPrompt", () => {
    it("builds count prompts from visual groups", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "single-items",
                prompt: "いくつ ある？",
                group: { emoji: "🍎", label: "りんご", count: 3 },
                columns: 5,
                style: "frame",
                frameSize: 5,
            },
        }));

        expect(prompt).toBe("いくつ ある？\nりんご 3こ");
    });

    it("adds reference and printable choices for recognition prompts", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "🔴 まる", value: "まる" },
                    { label: "🔺 さんかく", value: "さんかく" },
                ],
            },
            questionVisual: {
                kind: "reference-choice-grid",
                prompt: "これは なに？",
                grid: {
                    reference: { emoji: "🔴", label: "まる" },
                    choices: [
                        { emoji: "🔴", label: "まる" },
                        { emoji: "🔺", label: "さんかく" },
                    ],
                    columns: 2,
                },
            },
        }));

        expect(prompt).toBe("これは なに？\nおてほん: まる\nえらぶ: まる / さんかく\nえらぶ ばんごう:\n1. あか まる\n2. さんかく");
    });

    it("renders paper-friendly number lines with blanks", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "number-line",
                prompt: "□に はいる かずは？",
                line: {
                    min: 4,
                    max: 8,
                    start: 4,
                    end: 8,
                    step: 1,
                    hiddenTarget: false,
                    hiddenValues: [6],
                },
            },
        }));

        expect(prompt).toBe("[   ]に はいる かずは？\nかずせん: 4 5 [   ] 7 8");
    });

    it("renders highlighted number-line targets for comparison prompts", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "number-line",
                prompt: "どちらが おおきい？",
                line: {
                    min: 2,
                    max: 7,
                    start: 2,
                    end: 7,
                    hiddenTarget: false,
                    highlightValues: [3, 6],
                },
            },
            questionText: "3 [   ] 6",
        }));

        expect(prompt).toBe("3 [   ] 6\nかずせん: 2 3 4 5 6 7\nみる かず: 3 / 6");
    });

    it("describes category sorting and choice labels without emoji dependency", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "くだもの", value: "くだもの" },
                    { label: "どうぶつ", value: "どうぶつ" },
                ],
            },
            questionVisual: {
                kind: "category-sort",
                prompt: "どちらの なかま？",
                target: { emoji: "🍎", label: "りんご" },
                buckets: [
                    { label: "くだもの", tone: "rose", items: [{ emoji: "🍎", label: "りんご" }] },
                    { label: "どうぶつ", tone: "emerald", items: [{ emoji: "🐶", label: "いぬ" }] },
                ],
            },
        }));

        expect(prompt).toBe("どちらの なかま？\nりんご -> くだもの / どうぶつ\nえらぶ ばんごう:\n1. くだもの\n2. どうぶつ");
    });

    it("summarizes repeated emoji choices as counts", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "⭐ ⭐", value: "2" },
                    { label: "🍎 🍎 🍎", value: "3" },
                ],
            },
            questionVisual: {
                kind: "single-items",
                prompt: "おなじ かずを えらぼう",
                group: { emoji: "🐟", label: "おてほん", count: 3 },
                columns: 5,
                style: "grid",
            },
        }));

        expect(prompt).toBe("おなじ かずを えらぼう\nおてほん 3こ\nえらぶ ばんごう:\n1. ほし 2こ\n2. りんご 3こ");
    });

    it("collapses duplicate emoji-plus-label choices", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "🪨 いし", value: "🪨" },
                    { label: "🍎 りんご", value: "🍎" },
                ],
            },
            questionText: "おもい のは どっち？",
        }));

        expect(prompt).toBe("おもい のは どっち？\nえらぶ ばんごう:\n1. いし\n2. りんご");
    });

    it("adds meaning hints for comparison symbols", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: ">", value: ">" },
                    { label: "=", value: "=" },
                    { label: "<", value: "<" },
                ],
            },
            questionText: "3 [   ] 5",
        }));

        expect(prompt).toBe("3 [   ] 5\nえらぶ ばんごう:\n1. おおきい (>)\n2. おなじ (=)\n3. ちいさい (<)");
    });

    it("renders position scenes as solvable paper text", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
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
        }));

        expect(prompt).toBe("りんご は なか？ そと？\nりんご は かご の なか\nえらぶ ばんごう:\n1. なか\n2. そと");
    });

    it("renders pair visuals with side labels", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "item-pair",
                prompt: "ねこ は ひだり？ みぎ？",
                items: [
                    { emoji: "🐱", label: "ねこ" },
                    { emoji: "🐶", label: "いぬ" },
                ],
                orientation: "row",
            },
        }));

        expect(prompt).toBe("ねこ は ひだり？ みぎ？\nひだり: ねこ / みぎ: いぬ");
    });

    it("renders balance visuals with tilt clues", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "balance-compare",
                prompt: "おもい のは どっち？",
                items: [
                    { emoji: "🪨", label: "いし", weight: 5 },
                    { emoji: "🍎", label: "りんご", weight: 2 },
                ],
            },
        }));

        expect(prompt).toBe("おもい のは どっち？\nてんびん: いし が さがる / りんご が あがる");
    });

    it("renders length visuals as printable bars", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "length-compare",
                prompt: "ながい のは どっち？",
                direction: "horizontal",
                bars: [
                    { emoji: "🔴", label: "あか", length: 5, tone: "rose" },
                    { emoji: "🔵", label: "あお", length: 3, tone: "sky" },
                ],
            },
        }));

        expect(prompt).toBe("ながい のは どっち？\nあか: -----\nあお: ---");
    });

    it("renders sharing visuals as paper-friendly actions", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "sharing-items",
                prompt: "1にんぶんは いくつ？",
                actionLabel: "おなじに わける",
                source: { emoji: "🍎", label: "りんご", count: 6 },
                recipients: { emoji: "🙂", label: "ともだち", count: 2 },
            },
        }));

        expect(prompt).toBe("1にんぶんは いくつ？\nりんご 6こ を 2にんに おなじに わける");
    });

    it("renders one-to-one visuals as distribution actions", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "sharing-items",
                prompt: "にんじんは なんこ いる？",
                actionLabel: "1こずつ",
                source: { emoji: "🐰", label: "うさぎ", count: 3 },
                recipients: { emoji: "🥕", label: "にんじん", count: 3 },
            },
        }));

        expect(prompt).toBe("にんじんは なんこ いる？\nうさぎ 3こ に にんじん を 1こずつ");
    });

    it("renders base-10 comparison visuals with tens and ones", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "comparison-base10",
                prompt: "どちらが おおきい？",
                groups: [
                    { label: "ひだり", value: 23 },
                    { label: "みぎ", value: 18 },
                ],
            },
        }));

        expect(prompt).toBe("どちらが おおきい？\nひだり: 23 (10が2こ と 1が3こ) / みぎ: 18 (10が1こ と 1が8こ)");
    });

    it("renders ordinal rows with left-to-right guidance", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "ordinal-row",
                prompt: "2ばんめ は どれ？",
                items: [
                    { emoji: "🐶", label: "いぬ" },
                    { emoji: "🐱", label: "ねこ" },
                    { emoji: "🐰", label: "うさぎ" },
                ],
            },
        }));

        expect(prompt).toBe("2ばんめ は どれ？\nひだりから: いぬ -> ねこ -> うさぎ");
    });

    it("renders grid visuals with an explicit lineup label", () => {
        const prompt = buildPrintableMathPrompt(createProblem({
            questionVisual: {
                kind: "item-grid",
                prompt: "なかまはずれ は？",
                items: [
                    { emoji: "🐶", label: "いぬ" },
                    { emoji: "🐱", label: "ねこ" },
                    { emoji: "🐶", label: "いぬ" },
                    { emoji: "🐶", label: "いぬ" },
                ],
                columns: 4,
            },
        }));

        expect(prompt).toBe("なかまはずれ は？\nならび: いぬ / ねこ / いぬ / いぬ");
    });
});

describe("buildPrintableMathAnswer", () => {
    it("returns choice numbers for paper-friendly answer keys", () => {
        const answer = buildPrintableMathAnswer({
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "くだもの", value: "fruit" },
                    { label: "どうぶつ", value: "animal" },
                ],
            },
            correctAnswer: "animal",
        });

        expect(answer).toBe("2");
    });

    it("keeps regular numeric answers unchanged", () => {
        const answer = buildPrintableMathAnswer({
            inputType: "number",
            inputConfig: undefined,
            correctAnswer: "7",
        });

        expect(answer).toBe("7");
    });
});

describe("preschool printable coverage", () => {
    it("builds printable prompts and answers for all level 0-3 math skills", () => {
        const skills = [0, 1, 2, 3].flatMap(level => getSkillsForLevel(level));

        skills.forEach(skillId => {
            const problem = generateMathProblem(skillId);
            const prompt = buildPrintableMathPrompt(problem);
            const answer = buildPrintableMathAnswer(problem);

            expect(prompt.length, `${skillId} prompt`).toBeGreaterThan(0);
            expect(answer.length, `${skillId} answer`).toBeGreaterThan(0);
        });
    });
});
