import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MathProblemPrompt } from './MathProblemPrompt';
import { TenKey } from './TenKey';
import { HissanGrid } from './HissanGrid';
import { parkHissanGrid } from '../../domain/park/learning';
import type { LearningSlot } from '../../domain/park/types';
import type { ChoiceOption, Problem } from '../../domain/types';
import { canConfirmNumberFields, isSingleDigitMathInput, isWrittenStepComplete } from '../../domain/math/answerCompletion';
import { acknowledgeAnswerConfirmation } from './answerConfirmGuidance';
import { nextWrittenInput, writtenRetryValues } from '../../domain/math/writtenInput';

export interface LearningAnswerFormProps {
    slot: LearningSlot;
    disabled: boolean;
    onAnswer: (answer: string | string[]) => void;
    onInteraction?: () => void;
    renderPrompt?: (problem: Problem) => ReactNode;
    renderChoiceLabel?: (choice: ChoiceOption, problem: Problem) => ReactNode;
    renderSupportAnswer?: (answer: string, problem: Problem) => ReactNode;
    renderSupport?: (slot: LearningSlot) => ReactNode;
    resetCursorOnClear?: boolean;
    /** The saved incorrect attempt for this exact row; never an unsaved draft. */
    retryAnswer?: readonly string[];
    className?: string;
}

// Presentation may change; the frozen slot and its input/submit contract do not.
export function LearningAnswerForm({ slot, disabled, onAnswer, onInteraction, renderPrompt, renderChoiceLabel, renderSupportAnswer, renderSupport, resetCursorOnClear = false, retryAnswer, className }: LearningAnswerFormProps) {
    const problem = slot.problem;
    const grid = useMemo(() => parkHissanGrid(problem), [problem]);
    const step = grid?.steps[slot.hissanStep ?? 0];
    const singleDigit = isSingleDigitMathInput(problem);
    const automatic = Boolean(step) || singleDigit;
    const fieldCount = step ? step.correctValues.length : problem.inputType === 'multi-number' ? problem.inputConfig!.fields!.length : 1;
    const [inputState, setInputState] = useState(() => {
        const values = step && retryAnswer ? writtenRetryValues(retryAnswer, step.correctValues) : Array<string>(fieldCount).fill('');
        return { values, active: Math.max(0, values.findIndex(value => !value)), lastEdited: undefined as number | undefined };
    });
    const pendingInput = useRef(inputState);
    const submitting = useRef(false);
    const [submissionCount, setSubmissionCount] = useState(0);
    const hasSubmitted = submissionCount > 0;
    // A failed save re-enables this same draft; successful receipts remount it.
    useLayoutEffect(() => { submitting.current = disabled; }, [disabled, submissionCount]);
    const { values, active } = inputState;
    // Consecutive native events can arrive before React renders. Advance both the
    // value and cursor together so the next event never uses a stale field/value.
    const updateInput = (update: (current: typeof inputState) => typeof inputState) => {
        const next = update(pendingInput.current);
        if (next.active === pendingInput.current.active && next.values.every((value, index) => value === pendingInput.current.values[index])) return false;
        pendingInput.current = next;
        setInputState(next);
        onInteraction?.();
        return true;
    };
    const setActive = (index: number) => updateInput(current => ({ ...current, active: index, lastEdited: undefined }));
    const canSubmit = step ? isWrittenStepComplete(values) : canConfirmNumberFields(values);
    const submit = (auto = false) => {
        const current = pendingInput.current.values;
        if (disabled || submitting.current || (automatic && !auto && !hasSubmitted)) return;
        if (!(step ? isWrittenStepComplete(current) : canConfirmNumberFields(current))) return;
        submitting.current = true;
        setSubmissionCount(count => count + 1);
        if (!auto) acknowledgeAnswerConfirmation();
        onInteraction?.();
        onAnswer(step || problem.inputType === 'multi-number' ? current : current[0]);
    };
    const input = (value: number | string) => {
        if (disabled || submitting.current) return;
        const text = String(value);
        if (!/^[0-9.]$/.test(text)) return;
        if (singleDigit && text === '.') return;
        const changed = updateInput(current => {
            if (step && (step.correctValues[current.active] === '.' ? text !== '.' : !/^[0-9]$/.test(text))) return current;
            const limit = step || singleDigit ? 1 : problem.inputConfig?.fields?.[current.active]?.length ?? 8;
            const values = current.values.map((value, i) => i === current.active ? (step ? text : (value + text).slice(0, limit)) : value);
            return { values, active: step ? nextWrittenInput(values, current.active) : current.active, lastEdited: current.active };
        });
        if (changed && automatic && (step ? isWrittenStepComplete(pendingInput.current.values) : /^[0-9]$/.test(pendingInput.current.values[0]))) submit(true);
    };
    const remove = () => {
        if (!disabled && !submitting.current) updateInput(current => {
            const cursor = step && !current.values[current.active] ? current.lastEdited ?? Math.max(0, current.active - 1) : current.active;
            return { active: cursor, values: current.values.map((value, i) => i === cursor ? value.slice(0, -1) : value), lastEdited: undefined };
        });
    };
    const clear = () => {
        if (disabled || submitting.current) return;
        updateInput(current => ({ values: Array<string>(fieldCount).fill(''), active: resetCursorOnClear || grid?.writtenLayout ? 0 : current.active, lastEdited: undefined }));
    };
    const moveCursor = (direction: 'left' | 'right') => {
        if (disabled) return;
        updateInput(current => {
            const reversed = step && step.inputCellIndices[0] > step.inputCellIndices[step.inputCellIndices.length - 1];
            const delta = (direction === 'left' ? -1 : 1) * (reversed ? -1 : 1);
            return { ...current, active: Math.max(0, Math.min(fieldCount - 1, current.active + delta)), lastEdited: undefined };
        });
    };
    useLayoutEffect(() => {
        const handle = (event: KeyboardEvent) => {
            if (event.repeat && (/^[0-9.]$/.test(event.key) || event.key === 'Enter')) { event.preventDefault(); return; }
            if (disabled || submitting.current || problem.inputType === 'choice' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (/^[0-9.]$/.test(event.key)) { event.preventDefault(); input(event.key); }
            if (event.key === 'Backspace') { event.preventDefault(); remove(); }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); moveCursor(event.key === 'ArrowLeft' ? 'left' : 'right'); }
            if (event.key === 'Enter' && (target.tagName !== 'BUTTON' || target.closest('.park-keypad, .park-inputs, [data-written-input]'))) { event.preventDefault(); submit(); }
        };
        // Install the current problem's handler in the same commit that enables
        // its controls, before paint exposes those controls as ready.
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    });
    const userValues = new Map(Object.entries(slot.hissanValues ?? {}));
    if (step) step.inputCellIndices.forEach((col, i) => { userValues.set(`${step.rowIndex}-${col}`, values[i]); });
    const answerText = problem.displayAnswer ?? (Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join(' / ') : problem.correctAnswer);
    return <div className={["park-answer", className].filter(Boolean).join(" ")} data-input-type={grid ? 'hissan' : problem.inputType} data-answer-completion={automatic ? 'automatic' : 'manual'} data-problem-id={problem.id} data-assisted={slot.assisted}>
        <div className="park-question">
            {grid && step ? <HissanGrid gridData={grid} currentStepIndex={slot.hissanStep ?? 0}
                activeCellPos={[step.rowIndex, step.inputCellIndices[active]]} userValues={userValues} disabled={disabled}
                correcting={Boolean(retryAnswer)}
                onCellClick={(row, col) => { const i = step.inputCellIndices.indexOf(col); if (!disabled && row === step.rowIndex && i >= 0) setActive(i); }} />
                : renderPrompt ? renderPrompt(problem) : <MathProblemPrompt problem={problem} className="text-3xl font-bold" />}
        </div>
        {slot.assisted && <div className="park-support" role="note">
            {renderSupport ? renderSupport(slot) : <>
            <strong>いっしょに たしかめよう</strong>
            <p>{step ? `このだんは ${step.correctValues.join(' ')}。おなじように いれてみよう。`
                : <>こたえは {renderSupportAnswer ? renderSupportAnswer(answerText, problem) : answerText}。もんだいと くらべて、いれてみよう。</>}</p>
            </>}
        </div>}
        {problem.inputType === 'choice' ? <div className="park-choices">
            {problem.inputConfig?.choices?.map(choice => <button key={choice.value} className="park-button" disabled={disabled} data-choice-value={choice.value}
                aria-label={renderChoiceLabel ? choice.label : undefined}
                onClick={() => { if (!disabled) { onInteraction?.(); onAnswer(choice.value); } }}>{renderChoiceLabel ? renderChoiceLabel(choice, problem) : choice.label}</button>)}
        </div> : <>
            {!grid && <div className="park-inputs">
                {values.map((value, i) => <button key={i} className="park-input" aria-label={problem.inputConfig?.fields?.[i]?.label ?? 'こたえ'}
                    aria-pressed={active === i} disabled={disabled} onClick={() => setActive(i)}>
                    {problem.inputConfig?.fields?.[i]?.label && <small>{problem.inputConfig.fields[i].label}</small>}
                    <span>{value || '□'}</span>
                </button>)}
            </div>}
            <div className="park-keypad"><TenKey onInput={input} onDelete={remove} onClear={clear} onEnter={() => submit()}
                disabled={disabled} enterDisabled={!canSubmit || (automatic && !hasSubmitted)} showDecimal={!singleDigit && !grid?.writtenLayout} minRowHeight={44}
                confirmationMode={automatic && !hasSubmitted ? 'automatic' : 'manual'}
                writtenInput={Boolean(step)}
                enterLabel={grid?.writtenLayout && (slot.hissanStep ?? 0) < grid.steps.length - 1 ? 'このだんを たしかめる' : undefined}
                onCursorMove={fieldCount > 1 ? moveCursor : undefined} /></div>
        </>}
    </div>;
}
