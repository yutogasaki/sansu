import { useEffect, useMemo, useState } from 'react';
import { MathProblemPrompt } from '../domain/MathProblemPrompt';
import { TenKey } from '../domain/TenKey';
import { HissanGrid } from '../domain/HissanGrid';
import { parkHissanGrid } from '../../domain/park/learning';
import type { LearningSlot } from '../../domain/park/types';

export function ParkAnswerForm({ slot, disabled, onAnswer }: {
    slot: LearningSlot; disabled: boolean; onAnswer: (answer: string | string[]) => void;
}) {
    const problem = slot.problem;
    const grid = useMemo(() => parkHissanGrid(problem), [problem]);
    const step = grid?.steps[slot.hissanStep ?? 0];
    const fieldCount = step ? step.correctValues.length : problem.inputType === 'multi-number' ? problem.inputConfig!.fields!.length : 1;
    const [values, setValues] = useState<string[]>(() => Array(fieldCount).fill(''));
    const [active, setActive] = useState(0);
    const canSubmit = values.every(v => v.length > 0);
    const submit = () => {
        if (disabled || !canSubmit) return;
        onAnswer(step || problem.inputType === 'multi-number' ? values : values[0]);
    };
    const input = (value: number | string) => {
        if (disabled) return;
        const text = String(value);
        if (!/^[0-9.]$/.test(text)) return;
        const limit = step ? 1 : problem.inputConfig?.fields?.[active]?.length ?? 8;
        setValues(previous => previous.map((v, i) => i === active ? (step ? text : (v + text).slice(0, limit)) : v));
        if (step && active < fieldCount - 1) setActive(active + 1);
    };
    const remove = () => { if (!disabled) setValues(v => v.map((value, i) => i === active ? value.slice(0, -1) : value)); };
    const clear = () => { if (!disabled) setValues(Array(fieldCount).fill('')); };
    useEffect(() => {
        const handle = (event: KeyboardEvent) => {
            if (disabled || problem.inputType === 'choice' || event.altKey || event.ctrlKey || event.metaKey) return;
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            if (/^[0-9.]$/.test(event.key)) { event.preventDefault(); input(event.key); }
            if (event.key === 'Backspace') { event.preventDefault(); remove(); }
            if (event.key === 'Enter' && (target.tagName !== 'BUTTON' || target.closest('.park-keypad, .park-inputs'))) { event.preventDefault(); submit(); }
        };
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    });
    const userValues = new Map(Object.entries(slot.hissanValues ?? {}));
    if (step) step.inputCellIndices.forEach((col, i) => { userValues.set(`${step.rowIndex}-${col}`, values[i]); });
    const answerText = problem.displayAnswer ?? (Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join(' / ') : problem.correctAnswer);
    return <div className="park-answer" data-input-type={grid ? 'hissan' : problem.inputType} data-problem-id={problem.id}>
        <div className="park-question">
            {grid && step ? <HissanGrid gridData={grid} currentStepIndex={slot.hissanStep ?? 0}
                activeCellPos={[step.rowIndex, step.inputCellIndices[active]]} userValues={userValues}
                onCellClick={(row, col) => { const i = step.inputCellIndices.indexOf(col); if (!disabled && row === step.rowIndex && i >= 0) setActive(i); }} />
                : <MathProblemPrompt problem={problem} className="text-3xl font-bold" />}
        </div>
        {slot.assisted && <div className="park-support" role="note">
            <strong>いっしょに たしかめよう</strong>
            <p>{step ? `このだんは ${step.correctValues.join(' ')}。おなじように いれてみよう。` : `こたえは ${answerText}。もんだいと くらべて、いれてみよう。`}</p>
        </div>}
        {problem.inputType === 'choice' ? <div className="park-choices">
            {problem.inputConfig?.choices?.map(choice => <button key={choice.value} className="park-button" disabled={disabled}
                onClick={() => onAnswer(choice.value)}>{choice.label}</button>)}
        </div> : <>
            {!grid && <div className="park-inputs">
                {values.map((value, i) => <button key={i} className="park-input" aria-label={problem.inputConfig?.fields?.[i]?.label ?? 'こたえ'}
                    aria-pressed={active === i} disabled={disabled} onClick={() => setActive(i)}>
                    {problem.inputConfig?.fields?.[i]?.label && <small>{problem.inputConfig.fields[i].label}</small>}
                    <span>{value || '□'}</span>
                </button>)}
            </div>}
            <div className="park-keypad"><TenKey onInput={input} onDelete={remove} onClear={clear} onEnter={submit}
                disabled={disabled} enterDisabled={!canSubmit} showDecimal minRowHeight={44}
                onCursorMove={fieldCount > 1 ? direction => setActive(i => Math.max(0, Math.min(fieldCount - 1, i + (direction === 'left' ? -1 : 1)))) : undefined} /></div>
        </>}
    </div>;
}
