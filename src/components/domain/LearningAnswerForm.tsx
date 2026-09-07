import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MathProblemPrompt } from './MathProblemPrompt';
import { TenKey } from './TenKey';
import { HissanGrid } from './HissanGrid';
import { parkHissanGrid } from '../../domain/park/learning';
import type { LearningSlot } from '../../domain/park/types';
import type { ChoiceOption, Problem } from '../../domain/types';

export interface LearningAnswerFormProps {
    slot: LearningSlot;
    disabled: boolean;
    onAnswer: (answer: string | string[]) => void;
    renderPrompt?: (problem: Problem) => ReactNode;
    renderChoiceLabel?: (choice: ChoiceOption, problem: Problem) => ReactNode;
    renderSupportAnswer?: (answer: string, problem: Problem) => ReactNode;
    renderSupport?: (slot: LearningSlot) => ReactNode;
    resetCursorOnClear?: boolean;
    className?: string;
}

// Presentation may change; the frozen slot and its input/submit contract do not.
export function LearningAnswerForm({ slot, disabled, onAnswer, renderPrompt, renderChoiceLabel, renderSupportAnswer, renderSupport, resetCursorOnClear = false, className }: LearningAnswerFormProps) {
    const problem = slot.problem;
    const grid = useMemo(() => parkHissanGrid(problem), [problem]);
    const step = grid?.steps[slot.hissanStep ?? 0];
    const fieldCount = step ? step.correctValues.length : problem.inputType === 'multi-number' ? problem.inputConfig!.fields!.length : 1;
    const [inputState, setInputState] = useState(() => ({ values: Array<string>(fieldCount).fill(''), active: 0 }));
    const pendingInput = useRef(inputState);
    const { values, active } = inputState;
    // Consecutive native events can arrive before React renders. Advance both the
    // value and cursor together so the next event never uses a stale field/value.
    const updateInput = (update: (current: typeof inputState) => typeof inputState) => {
        const next = update(pendingInput.current);
        pendingInput.current = next;
        setInputState(next);
    };
    const setActive = (index: number) => updateInput(current => ({ ...current, active: index }));
    const canSubmit = values.every(v => v.length > 0);
    const submit = () => {
        const current = pendingInput.current.values;
        if (disabled || !current.every(value => value.length > 0)) return;
        onAnswer(step || problem.inputType === 'multi-number' ? current : current[0]);
    };
    const input = (value: number | string) => {
        if (disabled) return;
        const text = String(value);
        if (!/^[0-9.]$/.test(text)) return;
        updateInput(current => {
            if (step && (step.correctValues[current.active] === '.' ? text !== '.' : !/^[0-9]$/.test(text))) return current;
            const limit = step ? 1 : problem.inputConfig?.fields?.[current.active]?.length ?? 8;
            return {
                values: current.values.map((value, i) => i === current.active ? (step ? text : (value + text).slice(0, limit)) : value),
                active: step ? Math.min(current.active + 1, fieldCount - 1) : current.active,
            };
        });
    };
    const remove = () => {
        if (!disabled) updateInput(current => {
            const cursor = step && !current.values[current.active] ? Math.max(0, current.active - 1) : current.active;
            return { active: cursor, values: current.values.map((value, i) => i === cursor ? value.slice(0, -1) : value) };
        });
    };
    const clear = () => {
        if (disabled) return;
        updateInput(current => ({ values: Array<string>(fieldCount).fill(''), active: resetCursorOnClear || grid?.writtenLayout ? 0 : current.active }));
    };
    const moveCursor = (direction: 'left' | 'right') => {
        if (disabled) return;
        updateInput(current => {
            const reversed = step && step.inputCellIndices[0] > step.inputCellIndices[step.inputCellIndices.length - 1];
            const delta = (direction === 'left' ? -1 : 1) * (reversed ? -1 : 1);
            return { ...current, active: Math.max(0, Math.min(fieldCount - 1, current.active + delta)) };
        });
    };
    useLayoutEffect(() => {
        const handle = (event: KeyboardEvent) => {
            if (event.repeat && (/^[0-9.]$/.test(event.key) || event.key === 'Enter')) { event.preventDefault(); return; }
            if (disabled || problem.inputType === 'choice' || event.altKey || event.ctrlKey || event.metaKey) return;
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
    return <div className={["park-answer", className].filter(Boolean).join(" ")} data-input-type={grid ? 'hissan' : problem.inputType} data-problem-id={problem.id} data-assisted={slot.assisted}>
        <div className="park-question">
            {grid && step ? <HissanGrid gridData={grid} currentStepIndex={slot.hissanStep ?? 0}
                activeCellPos={[step.rowIndex, step.inputCellIndices[active]]} userValues={userValues} disabled={disabled}
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
                onClick={() => onAnswer(choice.value)}>{renderChoiceLabel ? renderChoiceLabel(choice, problem) : choice.label}</button>)}
        </div> : <>
            {!grid && <div className="park-inputs">
                {values.map((value, i) => <button key={i} className="park-input" aria-label={problem.inputConfig?.fields?.[i]?.label ?? 'こたえ'}
                    aria-pressed={active === i} disabled={disabled} onClick={() => setActive(i)}>
                    {problem.inputConfig?.fields?.[i]?.label && <small>{problem.inputConfig.fields[i].label}</small>}
                    <span>{value || '□'}</span>
                </button>)}
            </div>}
            <div className="park-keypad"><TenKey onInput={input} onDelete={remove} onClear={clear} onEnter={submit}
                disabled={disabled} enterDisabled={!canSubmit} showDecimal={!grid?.writtenLayout} minRowHeight={44}
                enterLabel={grid?.writtenLayout && (slot.hissanStep ?? 0) < grid.steps.length - 1 ? 'このだんを たしかめる' : undefined}
                onCursorMove={fieldCount > 1 ? moveCursor : undefined} /></div>
        </>}
    </div>;
}
