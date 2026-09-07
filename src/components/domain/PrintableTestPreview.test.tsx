import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PeriodicTestSet } from "../../domain/types";
import { PrintableTestSheets } from "./PrintableTestPreview";

type PaperProblem = PeriodicTestSet["problems"][number];
const base: PaperProblem = { categoryId: "add_1d", questionText: "7 + 8 =", inputType: "number", correctAnswer: "15" };
const sheet = (problems: PaperProblem[], mode: "questions" | "answers" | "both" = "questions", subject: PeriodicTestSet["subject"] = "math") => renderToStaticMarkup(
    <PrintableTestSheets testSet={{ subject, level: 13, createdAt: "2026-09-07T00:00:00.000Z", problems }} paperId="paper-1234-5678" profileName="はる" mode={mode} />,
);

describe("printable test paper content", () => {
    it("retains all 20 saved questions, numbers and paper identity without including answers by default", () => {
        const html = sheet(Array.from({ length: 20 }, (_, index) => ({ ...base, questionText: `${index} + 8 =`, correctAnswer: "ANSWER_MUST_NOT_APPEAR" })));
        expect([...html.matchAll(/data-print-question="(\d+)"/g)].map(match => Number(match[1]))).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
        expect(html).toContain("用紙ID 12345678");
        expect(html).toContain("はる");
        expect(html).toContain("ひづけ");
        expect(html).toContain("レベル 13");
        expect(html).not.toContain("ANSWER_MUST_NOT_APPEAR");
        expect(html).not.toContain('data-print-section="answers"');
    });

    it("keeps actual counting diagrams and empty slots without a text conversion that reveals the count", () => {
        const problem: PaperProblem = { ...base, questionText: "いくつ？", correctAnswer: "3", questionVisual: { kind: "single-items", group: { emoji: "🍎", label: "りんご", count: 3 }, frameSize: 5, columns: 5, style: "frame" } };
        const html = sheet([problem]);
        expect([...html.matchAll(/data-count-slot="filled"/g)]).toHaveLength(3);
        expect([...html.matchAll(/data-count-slot="empty"/g)]).toHaveLength(2);
        expect(html).not.toContain("りんご3こ");
        expect(html).not.toContain("こたえ：3");
    });

    it("retains number-line hidden targets and operand semantics", () => {
        const html = sheet([{ ...base, questionVisual: { kind: "number-line", line: { min: 1, max: 5, start: 5, end: 2, step: -3, hiddenTarget: true } } }]);
        expect(html).toMatch(/data-visual-value="2" data-visual-hidden="true"[^>]*>\?<\/div>/);
        expect(html).toContain("<span>←</span><span>3</span>");
    });

    it("prints saved English labels and order, then maps the correct value to the same choice on a separate sheet", () => {
        const problem: PaperProblem = { categoryId: "apple", questionText: "apple", inputType: "choice", correctAnswer: "apple", displayAnswer: "りんご", inputConfig: { choices: [{ label: "犬", value: "dog" }, { label: "林檎", value: "apple" }, { label: "鳥", value: "bird" }, { label: "猫", value: "cat" }] } };
        const questions = sheet([problem], "questions", "vocab");
        expect([...questions.matchAll(/data-print-choice-value="([^"]+)"/g)].map(match => match[1])).toEqual(["dog", "apple", "bird", "cat"]);
        expect(questions).toContain("林檎");
        expect(questions).not.toContain("りんご");
        const answers = sheet([problem], "answers", "vocab");
        expect(answers).toContain("B. 林檎");
        expect(answers).not.toContain('data-print-section="questions"');
        expect(sheet([problem], "both", "vocab")).toMatch(/data-print-section="questions"[\s\S]*data-print-section="answers"/);
    });

    it("provides every multi-number blank and readable quotient/remainder answers", () => {
        const division: PaperProblem = { ...base, questionText: "23 ÷ 5 =", inputType: "multi-number", correctAnswer: ["4", "3"], inputConfig: { fields: [{ label: "しょう", length: 1 }, { label: "あまり", length: 1 }] } };
        const questions = sheet([division]);
        expect(questions).toContain('aria-label="しょうの記入欄"');
        expect(questions).toContain('aria-label="あまりの記入欄"');
        expect(questions).not.toContain("しょう：4");
        expect(sheet([division], "answers")).toContain("しょう：4　あまり：3");
    });

    it("prints fraction fields, including mixed fractions, and space for long multiplication", () => {
        const fraction: PaperProblem = { ...base, categoryId: "frac_mixed", questionText: "2 1/3 + 1 1/3 =", inputType: "multi-number", correctAnswer: ["3", "2", "3"], inputConfig: { fields: [{ label: "整数", length: 1 }, { label: "分子", length: 2 }, { label: "分母", length: 2 }] } };
        const questions = sheet([fraction, { ...base, inputType: "hissan", hissanOperands: { a: 23, b: 12 }, questionText: "23 × 12 =", correctAnswer: "276" }]);
        for (const label of ["整数", "分子", "分母"]) expect(questions).toContain(`aria-label="${label}の記入欄"`);
        expect(questions).toContain('aria-label="筆算を書く場所"');
        expect(questions).not.toContain("276");
        const answers = sheet([fraction], "answers");
        expect(answers).not.toContain("整数：");
        expect(answers).toContain(">2</span>");
        expect(answers).toContain(">3</span>");
        expect(sheet([{ ...base, categoryId: "add_2d1d_hissan_c", inputType: "number" }])).toContain('aria-label="筆算を書く場所"');
    });
});
