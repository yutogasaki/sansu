/* eslint-disable react-refresh/only-export-components -- Browser-only harness for the actual hook; never imported by the app. */
import { useEffect, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { useHissanSession } from '../src/hooks/useHissanSession';
import type { Problem } from '../src/domain/types';

type Session = ReturnType<typeof useHissanSession>;
type EnterResult = ReturnType<Session['handleHissanEnter']>;
type Case = { name: string; pass: boolean; actual: unknown; expected: unknown };

const multiplication: Problem = {
    id: 'written-hook-multiplication', subject: 'math', categoryId: 'mul_2d2d',
    questionText: '23 × 14 =', correctAnswer: '322', inputType: 'number', isReview: false,
};
const division: Problem = {
    ...multiplication, id: 'written-hook-division', categoryId: 'div_3d1d_exact',
    questionText: '816 ÷ 8 =', correctAnswer: '102',
};

let latest: Session;
let root: Root | undefined;
let enterResults: EnterResult[] = [];
let saveOutcomes: boolean[] = [];
let configuredSaveOutcomes: boolean[] = [];

function HookProbe({ problem, enabled }: { problem: Problem; enabled: boolean }) {
    const session = useHissanSession();
    const { resetHissan } = session;
    useLayoutEffect(() => { latest = session; }, [session]);
    useLayoutEffect(() => { resetHissan(problem, enabled); }, [problem, enabled, resetHissan]);
    useEffect(() => {
        // An actual native listener deliberately dispatches several events before
        // React commits. This exercises the hook's pending-input ownership.
        const onKey = (event: KeyboardEvent) => {
            if (/^[0-9.]$/.test(event.key)) latest.handleHissanInput(event.key);
            else if (event.key === 'Enter') {
                const result = latest.handleHissanEnter();
                enterResults.push(result);
                if (result === 'all-correct') {
                    saveOutcomes.push(configuredSaveOutcomes[saveOutcomes.length] ?? true);
                }
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                latest.handleHissanCursorMove(event.key === 'ArrowLeft' ? 'left' : 'right');
            } else if (event.key === 'Backspace') latest.handleHissanBackspace();
            else if (event.key.toLowerCase() === 'c') latest.handleHissanClear();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    return <div data-written-hook-probe data-active={String(session.isHissanActive)}>
        <p>{problem.questionText}</p>
        <p data-current-step>{session.currentStepIndex}</p>
        <p data-feedback>{session.stepFeedback}</p>
        <pre data-values>{JSON.stringify([...session.userValues])}</pre>
    </div>;
}

const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const settle = async () => { await frame(); await frame(); };
const key = (value: string) => window.dispatchEvent(new KeyboardEvent('keydown', {
    key: value, bubbles: true, cancelable: true,
}));
const batch = async (...keys: string[]) => {
    flushSync(() => keys.forEach(key));
    await settle();
};
const values = () => [...latest.userValues].sort(([a], [b]) => a.localeCompare(b));
const rowNumber = (rowIndex: number) => [...latest.userValues]
    .filter(([key]) => Number(key.split('-')[0]) === rowIndex)
    .sort(([a], [b]) => Number(a.split('-')[1]) - Number(b.split('-')[1]))
    .map(([, value]) => value).join('');
const state = () => ({
    active: latest.isHissanActive, step: latest.currentStepIndex, cell: latest.activeCellPos,
    feedback: latest.stepFeedback, values: values(),
});

async function unmount() {
    flushSync(() => root?.unmount());
    root = undefined;
}
async function mount(problem = multiplication, enabled = true) {
    await unmount();
    enterResults = []; saveOutcomes = []; configuredSaveOutcomes = [];
    root = createRoot(document.getElementById('probe')!);
    flushSync(() => root!.render(<HookProbe problem={problem} enabled={enabled} />));
    await settle();
}

export async function runWrittenHissanHookProbes(): Promise<Case[]> {
    const cases: Case[] = [];
    const check = (name: string, actual: unknown, expected: unknown) => cases.push({
        name, pass: JSON.stringify(actual) === JSON.stringify(expected),
        actual: structuredClone(actual), expected: structuredClone(expected),
    });
    try {
        await mount();
        await batch('Enter', 'Enter');
        check('empty Enter and duplicate Enter are silent, incomplete, and do not submit', {
            results: enterResults, step: latest.currentStepIndex, feedback: latest.stepFeedback,
            values: values(), cell: latest.activeCellPos, saves: saveOutcomes,
        }, { results: ['incomplete', 'incomplete'], step: 0, feedback: 'none', values: [], cell: [2, 3], saves: [] });
        await batch('2', 'Enter');
        check('partly filled Enter retains input and focuses the first empty digit', {
            result: enterResults.at(-1), step: latest.currentStepIndex,
            feedback: latest.stepFeedback, row: rowNumber(2), cell: latest.activeCellPos,
        }, { result: 'incomplete', step: 0, feedback: 'none', row: '2', cell: [2, 2] });

        await mount();
        await batch('2', '9', 'Enter', 'Enter');
        check('batched native digits then same-turn Enter read the whole row exactly once', {
            results: enterResults, firstRow: rowNumber(2), step: latest.currentStepIndex,
            cell: latest.activeCellPos, saves: saveOutcomes,
        }, { results: ['step-correct', 'incomplete'], firstRow: '92', step: 1, cell: [3, 2], saves: [] });
        await batch('3', '2');
        check('second partial product accepts right-to-left input', {
            first: rowNumber(2), second: rowNumber(3), cell: latest.activeCellPos,
        }, { first: '92', second: '23', cell: null });
        await batch('Backspace');
        check('Backspace from a full row reopens its last entered cell', {
            first: rowNumber(2), second: rowNumber(3), cell: latest.activeCellPos,
        }, { first: '92', second: '3', cell: [3, 1] });
        await batch('Backspace');
        check('Backspace from an empty cell moves back in input order within the current row', {
            first: rowNumber(2), second: rowNumber(3), cell: latest.activeCellPos,
        }, { first: '92', second: '', cell: [3, 2] });
        await batch('3', '2', 'C');
        check('C clears only the current row and restores its starting cell', {
            first: rowNumber(2), second: rowNumber(3), cell: latest.activeCellPos, step: latest.currentStepIndex,
        }, { first: '92', second: '', cell: [3, 2], step: 1 });
        const beforePastTap = state();
        flushSync(() => latest.handleCellClick(2, 3)); await settle();
        check('a completed row cannot accidentally become editable', state(), beforePastTap);
        await batch('3', '2');
        flushSync(() => latest.handleCellClick(3, 2)); await settle();
        await batch('9');
        check('tapping a current-row cell permits targeted correction', {
            first: rowNumber(2), second: rowNumber(3), cell: latest.activeCellPos,
        }, { first: '92', second: '29', cell: [3, 1] });

        await mount({ ...multiplication, id: 'written-hook-cursor', questionText: '999 × 99 =', correctAnswer: '98901' });
        check('multiplication starts at the visible rightmost answer cell', latest.activeCellPos, [2, 5]);
        await batch('ArrowLeft');
        check('Left moves one visible column left despite right-to-left entry order', latest.activeCellPos, [2, 4]);
        await batch('ArrowRight', 'ArrowRight');
        check('Right moves right and stops at the visible row edge', latest.activeCellPos, [2, 5]);
        await batch('ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft');
        check('Left stops at the first answer digit rather than entering empty alignment cells', latest.activeCellPos, [2, 2]);
        await batch('ArrowRight');
        check('Right moves back toward the units position', latest.activeCellPos, [2, 3]);
        await batch('C');
        check('C restores the multiplication units cell after arrow navigation', latest.activeCellPos, [2, 5]);

        await mount();
        await batch('2', '9', 'Enter', '9', '9', 'Enter');
        check('an incorrect later row leaves the accepted partial product intact', {
            results: enterResults, step: latest.currentStepIndex, feedback: latest.stepFeedback,
            first: rowNumber(2), second: rowNumber(3), saves: saveOutcomes,
        }, { results: ['step-correct', 'incorrect'], step: 1, feedback: 'incorrect', first: '92', second: '99', saves: [] });
        const whileIncorrect = state();
        await batch('C', 'Backspace', '3', 'Enter');
        check('incorrect feedback locks edits and duplicate submissions until recovery', {
            state: state(), result: enterResults.at(-1),
        }, { state: whileIncorrect, result: 'incomplete' });
        await new Promise(resolve => setTimeout(resolve, 850)); await settle();
        check('the actual retry timer clears only the failed row', {
            step: latest.currentStepIndex, feedback: latest.stepFeedback, first: rowNumber(2),
            second: rowNumber(3), cell: latest.activeCellPos,
        }, { step: 1, feedback: 'none', first: '92', second: '', cell: [3, 2] });
        await batch('3', '2', 'Enter');
        check('retrying the later row advances without resubmitting prior work', {
            first: rowNumber(2), second: rowNumber(3), step: latest.currentStepIndex, saves: saveOutcomes,
        }, { first: '92', second: '23', step: 2, saves: [] });

        configuredSaveOutcomes = [false, true];
        await batch('2', '2', '3', 'Enter', 'Enter');
        check('only the final row calls the save boundary, and duplicate Enter stays locked', {
            results: enterResults.slice(-2), final: rowNumber(4), feedback: latest.stepFeedback,
            step: latest.currentStepIndex, saves: saveOutcomes,
        }, { results: ['all-correct', 'incomplete'], final: '322', feedback: 'correct', step: 2, saves: [false] });
        const completedValues = values();
        flushSync(() => latest.retryHissanSave()); await settle();
        check('failed-save recovery preserves all rows and reopens the final submission', {
            values: values(), feedback: latest.stepFeedback, step: latest.currentStepIndex,
        }, { values: completedValues, feedback: 'none', step: 2 });
        await batch('Enter', 'Enter');
        check('save retry resubmits the completed final row once without retyping or reset', {
            results: enterResults.slice(-2), values: values(), saves: saveOutcomes, feedback: latest.stepFeedback,
        }, { results: ['all-correct', 'incomplete'], values: completedValues, saves: [false, true], feedback: 'correct' });

        await mount({
            ...multiplication, id: 'written-hook-decimal', categoryId: 'dec_add',
            questionText: '0.1 + 0.2 =', correctAnswer: '0.3',
        });
        check('legacy decimal mode retains the normalized answer and decimal input capability', {
            answer: latest.gridData?.finalAnswer, decimal: latest.canInputDecimal,
            writtenLayout: latest.gridData?.writtenLayout ?? null,
        }, { answer: '0.3', decimal: true, writtenLayout: null });
        await batch('.', '3', '9');
        check('decimal input rejects a misplaced dot or a digit in the decimal-point cell', {
            row: rowNumber(3), cell: latest.activeCellPos,
        }, { row: '3', cell: [3, 2] });
        await batch('.', '0', 'Enter', 'Enter');
        check('the legacy decimal point is entered explicitly and graded once', {
            row: rowNumber(3), results: enterResults, feedback: latest.stepFeedback, saves: saveOutcomes,
        }, { row: '0.3', results: ['all-correct', 'incomplete'], feedback: 'correct', saves: [true] });

        await mount(multiplication, false);
        check('initial mental mode keeps a ready grid available for the mode toggle', {
            active: latest.isHissanActive, eligible: latest.isHissanEligibleSkill,
            toggle: latest.canToggleHissanMode, layout: latest.gridData?.writtenLayout?.kind,
        }, { active: false, eligible: true, toggle: true, layout: 'multiplication' });
        await batch('2', '9', 'Enter');
        check('disabled Hissan does not collect hidden input', {
            values: values(), results: enterResults, saves: saveOutcomes,
        }, { values: [], results: ['incomplete'], saves: [] });
        flushSync(() => latest.toggleHissanMode()); await settle();
        await batch('2', '9', 'Enter', '3');
        const beforeToggle = state();
        flushSync(() => latest.toggleHissanMode()); await settle();
        check('toggling off retains accepted work and the current partial row', state(), { ...beforeToggle, active: false });
        flushSync(() => latest.toggleHissanMode()); await settle();
        check('toggling back on resumes the same input cell and values', state(), beforeToggle);

        await mount(division);
        await batch('1', 'Enter', '8', 'Enter', '0', 'Enter',
            '0', 'Enter', '0', 'Enter', '1', 'Enter',
            '2', 'Enter', '6', '1', 'Enter', '0', 'Enter', 'Enter');
        check('one native-event batch can traverse all 816÷8 steps including quotient zero', {
            results: enterResults, quotient: rowNumber(0), product16: rowNumber(8),
            remainder: rowNumber(9), step: latest.currentStepIndex, saves: saveOutcomes,
        }, { results: [...Array(8).fill('step-correct'), 'all-correct', 'incomplete'],
            quotient: '102', product16: '16', remainder: '0', step: 8, saves: [true] });

        await mount({
            ...division, id: 'written-hook-remainder', categoryId: 'div_rem_q1',
            questionText: '7 ÷ 2 =', correctAnswer: ['3', '1'], inputType: 'multi-number',
        });
        await batch('3', 'Enter', '6', 'Enter');
        check('quotient and product completion do not submit a remainder problem', {
            answer: latest.gridData?.finalAnswer, step: latest.currentStepIndex, saves: saveOutcomes,
        }, { answer: '3 あまり 1', step: 2, saves: [] });
        await batch('1', 'Enter');
        check('the remainder is required before final submission', {
            results: enterResults, quotient: rowNumber(0), remainder: rowNumber(3), saves: saveOutcomes,
        }, { results: ['step-correct', 'step-correct', 'all-correct'], quotient: '3', remainder: '1', saves: [true] });

        await mount();
        await batch('9', '9', 'Enter');
        flushSync(() => latest.resetHissan(division, true)); await settle();
        await batch('1');
        const afterNewInput = state();
        await new Promise(resolve => setTimeout(resolve, 850)); await settle();
        check('a new problem reset cancels the old error timer and keeps new input', state(), afterNewInput);
    } finally {
        await unmount();
    }
    return cases;
}
