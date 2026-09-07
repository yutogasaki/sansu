/* eslint-disable react-refresh/only-export-components -- Test-only browser module exposes a runner, never a product hot-refresh boundary. */
import { useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { LearningAnswerForm } from '../src/components/domain/LearningAnswerForm';
import { parkHissanGrid } from '../src/domain/park/learning';
import type { Problem } from '../src/domain/types';
import type { LearningSlot } from '../src/domain/park/types';
import { useIslandActions } from '../src/components/island/useIslandActions';

// Test-only DEV module. No app route, profile, saved plan, or answer receipt is created.
const number: Problem = { id: 'probe-number', subject: 'math', categoryId: 'add_1d_1', questionText: '5 + 6 =',
    inputType: 'number', correctAnswer: '11', isReview: false };
const slot = (problem: Problem): LearningSlot => ({ problem, completed: false, assisted: false, source: 'main', countsTowardReviewCap: false });
type Answer = string | string[];
interface HarnessProps { problem: Problem; revision: number; disabled?: boolean; commitKeys?: string[]; answers: Answer[] }
const key = (value: string, repeat = false) => document.body.dispatchEvent(new KeyboardEvent('keydown', {
    key: value, repeat, bubbles: true, cancelable: true,
}));

function Harness({ problem, revision, disabled = false, commitKeys, answers }: HarnessProps) {
    // Child layout effects have run, but child passive effects have not. This is
    // the precise boundary at which the visible, enabled form promises input.
    useLayoutEffect(() => { commitKeys?.forEach(value => key(value)); }, [revision, commitKeys]);
    return <div data-probe-ready={!disabled}><LearningAnswerForm key={revision} slot={slot(problem)} disabled={disabled}
        resetCursorOnClear onAnswer={answer => answers.push(answer)} /></div>;
}

const renderedValues = () => [...document.querySelectorAll('.park-input span')].map(node => node.textContent);
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
function LockedHarness({ answers }: { answers: Answer[] }) {
    const { busy, run } = useIslandActions();
    return <LearningAnswerForm slot={slot(number)} disabled={busy} onAnswer={answer => {
        void run(async () => { answers.push(answer); }, 180);
    }} />;
}
let nativeRoot: Root | undefined;
const nativeAnswers: Answer[] = [];
export function mountNativeProbe() {
    nativeAnswers.length = 0;
    nativeRoot = createRoot(document.getElementById('probe')!);
    flushSync(() => nativeRoot!.render(<Harness problem={number} revision={0} answers={nativeAnswers} />));
}
export const readNativeProbe = () => ({ values: renderedValues(), answers: [...nativeAnswers] });
export function unmountNativeProbe() { flushSync(() => nativeRoot?.unmount()); nativeRoot = undefined; }

export async function runCommitProbes() {
    const cases: { name: string; pass: boolean; actual: unknown; expected: unknown }[] = [];
    const check = (name: string, actual: unknown, expected: unknown) => {
        cases.push({ name, pass: JSON.stringify(actual) === JSON.stringify(expected), actual: structuredClone(actual), expected: structuredClone(expected) });
    };
    async function mounted(problem: Problem, run: (root: Root, answers: Answer[]) => Promise<void> | void) {
        const root = createRoot(document.getElementById('probe')!), answers: Answer[] = [];
        try { await run(root, answers); } finally { flushSync(() => root.unmount()); }
    }
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={number} revision={0} commitKeys={['1']} answers={answers} />));
        await frame();
        check('first enabled commit accepts a physical-key event before passive effects', renderedValues(), ['1']);
    });
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={number} revision={0} disabled answers={answers} />));
        await frame();
        flushSync(() => root.render(<Harness problem={{ ...number, id: 'probe-next' }} revision={1} commitKeys={['7']} answers={answers} />));
        await frame();
        check('new saved revision accepts its first key at the enabled commit', renderedValues(), ['7']);
    });
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={number} revision={0} answers={answers} />));
        await frame();
        flushSync(() => { key('1'); key('1'); key('Enter'); });
        check('separate rapid number events and immediate Enter preserve intentional 11', answers, ['11']);
    });
    const hiss: Problem = { ...number, id: 'probe-hissan', categoryId: 'add_2d1d_hissan_nc', questionText: '23 + 4 =', correctAnswer: '27' };
    await mounted(hiss, async (root, answers) => {
        const expected = parkHissanGrid(hiss)!.steps[0].correctValues;
        flushSync(() => root.render(<Harness problem={hiss} revision={0} answers={answers} />));
        await frame();
        flushSync(() => { expected.forEach(value => key(value)); key('Enter'); });
        check('rapid Hissan events advance each digit before the next event', answers, [expected]);
    });
    await mounted(hiss, async (root, answers) => {
        const expected = parkHissanGrid(hiss)!.steps[0].correctValues;
        flushSync(() => root.render(<Harness problem={hiss} revision={0} answers={answers} />));
        await frame();
        flushSync(() => {
            key('9');
            (document.querySelector('[aria-label="こたえを けす"]') as HTMLButtonElement).click();
            expected.forEach(value => key(value)); key('Enter');
        });
        check('Hissan partial entry then C starts again at its first digit', answers, [expected]);
    });
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<LockedHarness answers={answers} />));
        await frame();
        flushSync(() => { key('1'); key('1'); key('Enter'); key('Enter'); });
        check('actual Island action lock admits one save for rapid double Enter', answers, ['11']);
        check('existing 180ms guard still disables the visible keys', (document.querySelector('[aria-label="1"]') as HTMLButtonElement).disabled, true);
        await new Promise(resolve => setTimeout(resolve, 200));
        check('save guard returns the visible keys to ready', (document.querySelector('[aria-label="1"]') as HTMLButtonElement).disabled, false);
    });
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={number} revision={0} answers={answers} />));
        await frame();
        flushSync(() => { key('1'); key('1', true); key('Enter', true); });
        check('held digit repeat stays one digit and held Enter does not submit', { values: renderedValues(), answers }, { values: ['1'], answers: [] });
        flushSync(() => { key('Enter'); });
        check('fresh Enter after the hold submits the current value', answers, ['1']);
    });
    await mounted(number, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={number} revision={0} answers={answers} />));
        await frame();
        flushSync(() => { key('1'); key('.'); key('2'); key('Enter'); });
        check('decimal input keeps its literal value through rapid events', answers, ['1.2']);
    });
    const fraction: Problem = { ...number, id: 'probe-multi', inputType: 'multi-number', correctAnswer: ['11', '2'],
        inputConfig: { fields: [{ label: '分子', length: 2 }, { label: '分母', length: 1 }] } };
    await mounted(fraction, async (root, answers) => {
        flushSync(() => root.render(<Harness problem={fraction} revision={0} answers={answers} />));
        await frame();
        flushSync(() => {
            key('9');
            (document.querySelector('[aria-label="カーソルを みぎへ"]') as HTMLButtonElement).click();
            key('3');
            (document.querySelector('[aria-label="こたえを けす"]') as HTMLButtonElement).click();
            key('1'); key('1');
            (document.querySelector('[aria-label="カーソルを みぎへ"]') as HTMLButtonElement).click();
            key('2'); key('Enter');
        });
        check('multi-field cursor and C use the latest input state within rapid events', answers, [['11', '2']]);
    });
    return cases;
}
