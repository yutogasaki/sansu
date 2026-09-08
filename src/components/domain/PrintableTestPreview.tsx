import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { PeriodicTestSet } from "../../domain/types";
import { Button } from "../ui/Button";
import { MathProblemPrompt } from "./MathProblemPrompt";
import { MathRenderer } from "./MathRenderer";
import "./PrintableTestPreview.css";

type PrintMode = "questions" | "answers" | "both";
type PrintProblem = PeriodicTestSet["problems"][number];

interface PrintableTestPreviewProps {
    testSet: PeriodicTestSet;
    paperId: string;
    profileName: string;
    onClose: () => void;
    returnFocusTo?: HTMLElement | null;
}

type SheetProps = Pick<PrintableTestPreviewProps, "testSet" | "paperId" | "profileName"> & { mode: PrintMode };

const choiceMark = (index: number) => String.fromCharCode(65 + index);

const answerText = (problem: PrintProblem): string => {
    const answers = Array.isArray(problem.correctAnswer) ? problem.correctAnswer : [problem.correctAnswer];
    if (problem.inputType === "choice") {
        return answers.map(answer => {
            const index = problem.inputConfig?.choices?.findIndex(choice => choice.value === answer) ?? -1;
            return index >= 0
                ? `${choiceMark(index)}. ${problem.inputConfig!.choices![index].label}`
                : problem.displayAnswer || answer;
        }).join("、");
    }
    if (problem.displayAnswer) return problem.displayAnswer;
    if (answers.length === 1) return answers[0];
    const fields = problem.inputConfig?.fields;
    if (fields?.map(field => field.label).join(",") === "分子,分母") return `${answers[0]}/${answers[1]}`;
    if (fields?.map(field => field.label).join(",") === "整数,分子,分母") return `${answers[0]} ${answers[1]}/${answers[2]}`;
    return answers.map((answer, index) => `${fields?.[index]?.label || `答え${index + 1}`}：${answer}`).join("　");
};

const AnswerSpace = ({ problem }: { problem: PrintProblem }) => {
    // The periodic generator stores explicit Hissan skills as number input;
    // the interactive learning adapter changes their input type later.
    const needsWorking = problem.inputType === "hissan" || problem.categoryId.includes("_hissan");
    const configuredFields = problem.inputConfig?.fields;
    const fields = configuredFields?.length ? configuredFields : Array.from({
        length: Array.isArray(problem.correctAnswer) ? problem.correctAnswer.length : 1,
    }, (_, index) => ({ label: index === 0 ? "こたえ" : `こたえ ${index + 1}` }));

    return (
        <div className="printable-test-answer-space" data-print-answer-space={problem.inputType}>
            {needsWorking && <div className="printable-test-working" aria-label="筆算を書く場所" />}
            <div className="printable-test-fields">
                {fields.map((field, index) => (
                    <div className="printable-test-field" key={index}>
                        <span>{field.label || `こたえ ${index + 1}`}</span>
                        <span className="printable-test-blank" aria-label={`${field.label || `こたえ ${index + 1}`}の記入欄`} />
                    </div>
                ))}
            </div>
        </div>
    );
};

const SheetHeader = ({ testSet, paperId, profileName, answers }: Omit<SheetProps, "mode"> & { answers: boolean }) => {
    const createdAt = new Date(testSet.createdAt);
    const createdDate = Number.isNaN(createdAt.getTime()) ? "記録なし" : createdAt.toLocaleDateString("ja-JP");
    return (
        <header className="printable-test-sheet-header">
            <div className="printable-test-sheet-heading">
                <div>
                    <p className="printable-test-brand">ぽこもこと不思議な島</p>
                    <h2>{testSet.subject === "math" ? "さんすう" : "えいご"} テスト{answers ? " — 解答" : ""}</h2>
                </div>
                <span className="printable-test-level">レベル {testSet.level} · {testSet.problems.length}問</span>
            </div>
            <p className="printable-test-metadata">作成日 {createdDate}{"　"}用紙ID {paperId.replace(/-/g, "").slice(-8).toUpperCase()}</p>
            {!answers && (
                <div className="printable-test-identity">
                    <span>なまえ <span className="printable-test-name">{profileName}</span></span>
                    <span>ひづけ <span className="printable-test-date">月{"　　 "}日</span></span>
                </div>
            )}
            <p className="printable-test-instruction">{answers ? "保護者の方へ：同じ用紙IDの問題と照らし合わせてください。" : "こたえを かこう。えらぶ もんだいは、A・B・C・D の きごうで かいてね。"}</p>
        </header>
    );
};

/** Shared paper content stays separate from the modal so its semantics can be verified. */
export const PrintableTestSheets = ({ testSet, paperId, profileName, mode }: SheetProps) => (
    <div className="printable-test-sheets" data-print-mode={mode}>
        {mode !== "answers" && (
            <section className="printable-test-sheet" data-print-section="questions" aria-label="問題用紙">
                <SheetHeader testSet={testSet} paperId={paperId} profileName={profileName} answers={false} />
                <ol className="printable-test-questions">
                    {testSet.problems.map((problem, index) => (
                        <li className="printable-test-question" data-print-question={index + 1} data-print-visual={problem.questionVisual?.kind} key={index}>
                            <span className="printable-test-number" aria-label={`第${index + 1}問`}>{index + 1}</span>
                            <div className="printable-test-question-body">
                                <div className="printable-test-prompt-host">
                                    <MathProblemPrompt problem={problem} className="printable-test-prompt" />
                                    {problem.questionImage && <img className="printable-test-image" src={problem.questionImage} alt="問題の図" />}
                                </div>
                                {problem.inputConfig?.choices?.length ? (
                                    <ul className="printable-test-choices" aria-label="選択肢">
                                        {problem.inputConfig.choices.map((choice, choiceIndex) => (
                                            <li key={choiceIndex} data-print-choice-value={choice.value}>
                                                <span className="printable-test-choice-mark">{choiceMark(choiceIndex)}.</span>
                                                <span>{choice.label}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                                <AnswerSpace problem={problem} />
                            </div>
                        </li>
                    ))}
                </ol>
                <p className="printable-test-sheet-footer">ここまでで {testSet.problems.length}もんです。</p>
            </section>
        )}
        {mode !== "questions" && (
            <section className="printable-test-sheet printable-test-answer-sheet" data-print-section="answers" aria-label="解答用紙">
                <SheetHeader testSet={testSet} paperId={paperId} profileName={profileName} answers />
                <ol className="printable-test-answers">
                    {testSet.problems.map((problem, index) => (
                        <li data-print-answer={index + 1} key={index}>
                            <span className="printable-test-number">{index + 1}</span>
                            <MathRenderer text={answerText(problem)} />
                        </li>
                    ))}
                </ol>
            </section>
        )}
    </div>
);

export const PrintableTestPreview = ({ testSet, paperId, profileName, onClose, returnFocusTo }: PrintableTestPreviewProps) => {
    const [mode, setMode] = useState<PrintMode>("questions");
    const [preparing, setPreparing] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const onCloseRef = useRef(onClose);
    const returnFocusRef = useRef(returnFocusTo);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        const dialog = dialogRef.current!;
        const previousFocus = returnFocusRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        const previousOverflow = document.body.style.overflow;
        const background = Array.from(document.body.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child !== dialog);
        const inertBefore = background.map(element => element.inert);
        background.forEach(element => { element.inert = true; });
        document.body.style.overflow = "hidden";
        document.body.classList.add("has-printable-test");
        titleRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current();
            }
            if (event.key !== "Tab") return;
            const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]'));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && (document.activeElement === first || document.activeElement === titleRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const containFocus = (event: FocusEvent) => {
            if (event.target instanceof Node && !dialog.contains(event.target)) titleRef.current?.focus();
        };
        document.addEventListener("keydown", handleKeyDown, true);
        document.addEventListener("focusin", containFocus);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("focusin", containFocus);
            document.body.classList.remove("has-printable-test");
            document.body.style.overflow = previousOverflow;
            background.forEach((element, index) => { element.inert = inertBefore[index]; });
            if (previousFocus?.isConnected) previousFocus.focus();
        };
    }, []);

    const print = async () => {
        setPreparing(true);
        try {
            await document.fonts?.ready;
            await Promise.allSettled(Array.from(dialogRef.current?.querySelectorAll("img") || []).map(img => img.decode()));
            if (dialogRef.current) window.print();
        } finally {
            setPreparing(false);
        }
    };

    return createPortal(
        <div className="printable-test-preview" data-testid="printable-test-preview" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
            <div className="printable-test-toolbar app-glass-strong">
                <div className="printable-test-toolbar-heading">
                    <h1 id={titleId} ref={titleRef} tabIndex={-1}>印刷プレビュー</h1>
                    <Button variant="ghost" onClick={onClose} aria-label="閉じる"><X size={18} aria-hidden="true" /> 閉じる</Button>
                </div>
                <div className="printable-test-toolbar-actions">
                    <fieldset className="printable-test-mode">
                        <legend className="sr-only">印刷する用紙</legend>
                        {([ ["questions", "問題のみ"], ["answers", "解答のみ"], ["both", "両方"] ] as const).map(([value, label]) => (
                            <label key={value}>
                                <input type="radio" name={`print-mode-${titleId}`} checked={mode === value} onChange={() => setMode(value)} />
                                <span>{label}</span>
                            </label>
                        ))}
                    </fieldset>
                    <Button onClick={() => { void print(); }} disabled={preparing}><Printer size={18} aria-hidden="true" /> {preparing ? "準備中…" : "印刷・PDF保存"}</Button>
                </div>
                <p id={descriptionId}>A4用紙向けです。PDFにする場合は、印刷画面で保存先を選んでください。</p>
            </div>
            <PrintableTestSheets testSet={testSet} paperId={paperId} profileName={profileName} mode={mode} />
        </div>,
        document.body,
    );
};
