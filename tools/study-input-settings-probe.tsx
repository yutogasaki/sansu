/* eslint-disable react-refresh/only-export-components -- Test-only real Study runner and controlled dependencies, never imported by the app. */
import { useEffect, useLayoutEffect, useState, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import { Study } from '../src/pages/Study';
import type { StudyLayout as ActualLayout } from '../src/pages/StudyLayout';
import type { Problem, UserProfile } from '../src/domain/types';
import { createInitialProfile } from '../src/domain/user/profile';

// The browser runner redirects only Study's session, settings repository, and
// layout imports here. Its actual state, effects, handlers, Hissan hook, and
// timeout scheduler execute unchanged against controlled asynchronous settings.
type LayoutProps = ComponentProps<typeof ActualLayout>;
const number: Problem = { id: 'settings-number', subject: 'math', categoryId: 'add_1d_1', questionText: '5 + 6 =',
    inputType: 'number', correctAnswer: '11', isReview: false };
let problems: Problem[] = [];
let latest: LayoutProps;
let profilePromise: Promise<UserProfile | null>;
let resolveProfile: (profile: UserProfile | null) => void;
let rejectProfile: (error: Error) => void;
let releaseSaves: (() => void)[] = [];
let firstReadyFrameKey: string | undefined;
let saveCalls = 0;
const nextBlock = () => {};
const completeSession = async () => true;
const handleResult = async () => {
    saveCalls += 1;
    await new Promise<void>(resolve => { releaseSaves.push(resolve); });
    return false; // Prevent an unrelated automatic transition in the save-lock probe.
};
export function useStudySession() {
    const [queue, setQueue] = useState<Problem[]>([]);
    // The real hook obtains its queue asynchronously, after mount/session reset.
    useEffect(() => { setQueue(problems); }, []);
    return { queue, nextBlock, completeSession, handleResult, loading: queue.length === 0, blockSize: 10 };
}
export const getActiveProfile = () => profilePromise;
export const updateProfileAtomically = async () => undefined;
export function StudyLayout(props: LayoutProps) {
    useLayoutEffect(() => { latest = props; }, [props]);
    useLayoutEffect(() => {
        if (props.loading || !props.currentProblem || !firstReadyFrameKey) return;
        const value = firstReadyFrameKey;
        firstReadyFrameKey = undefined;
        // Runs in the first frame that can display enabled controls, after all
        // commit/layout work; later passive effects must not clear this input.
        requestAnimationFrame(() => key(value));
    }, [props.loading, props.currentProblem]);
    if (props.loading) return <div data-settings-probe="loading">Loading</div>;
    return <div data-settings-probe="ready" data-problem-id={props.currentProblem?.id}>
        <span data-input>{props.userInput}</span><span data-feedback>{props.feedback}</span>
        <button onClick={() => props.onTenKeyInput('7')}>7</button>
        <button onClick={props.onNext}>Next</button><button onClick={props.onSkip}>Skip</button>
        <button onClick={props.onHissanToggle}>Toggle</button>
    </div>;
}
const frame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const settle = async () => { await frame(); await frame(); };
const key = (value: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
const snapshot = () => ({ id: latest.currentProblem?.id, loading: latest.loading, input: latest.userInput,
    inputs: [...latest.userInputs], active: latest.activeFieldIndex, feedback: latest.feedback,
    correction: latest.showCorrection, hissan: latest.hissanActive, hissanValues: [...(latest.hissanUserValues ?? new Map())] });
let root: Root | undefined;
async function mount(problem: Problem, frameKey?: string) {
    problems = [problem, { ...problem, id: `${problem.id}-next` }];
    firstReadyFrameKey = frameKey;
    saveCalls = 0; releaseSaves = [];
    profilePromise = new Promise((resolve, reject) => { resolveProfile = resolve; rejectProfile = reject; });
    root = createRoot(document.getElementById('probe')!);
    flushSync(() => root!.render(<MemoryRouter><Study /></MemoryRouter>));
    await settle();
}
async function settings(enabled = true) {
    resolveProfile({ ...createInitialProfile('probe', 2, 11, 1, 'math'), soundEnabled: false, hissanModeEnabled: enabled });
    await settle();
}
async function unmount() {
    releaseSaves.forEach(resolve => resolve()); await Promise.resolve();
    flushSync(() => root?.unmount()); root = undefined;
}

export async function runSettingsProbes() {
    const cases: { name: string; pass: boolean; actual: unknown; expected: unknown }[] = [];
    const check = (name: string, actual: unknown, expected: unknown) => cases.push({ name,
        pass: JSON.stringify(actual) === JSON.stringify(expected), actual: structuredClone(actual), expected: structuredClone(expected) });
    try {
        await mount(number);
        check('queued problem stays non-operable until initial settings resolve', latest.loading, true);
        flushSync(() => key('7')); await settle();
        check('physical input while initial settings are pending is not accepted', latest.userInput, '');
        await unmount();

        const fraction: Problem = { ...number, id: 'settings-fraction', categoryId: 'frac_add_same', inputType: 'multi-number',
            questionText: '1/3 + 1/3 =', correctAnswer: ['2', '3'],
            inputConfig: { fields: [{ label: '分子', length: 2 }, { label: '分母', length: 2 }] } };
        const forced: Problem = { ...number, id: 'settings-forced', categoryId: 'add_2d1d_hissan_nc', questionText: '23 + 4 =', correctAnswer: '27' };
        for (const problem of [number, fraction, forced]) {
            await mount(problem);
            const blockedUntilSettings = latest.loading;
            if (blockedUntilSettings) await settings();
            flushSync(() => key('7')); await settle();
            const entered = snapshot();
            if (!blockedUntilSettings) await settings();
            check(`${problem.id}: accepted input survives the settings boundary`, snapshot(), entered);
            check(`${problem.id}: input was actually accepted`, problem === number ? entered.input === '7'
                : problem === fraction ? entered.inputs[0] === '7' : entered.hissanValues.some(([, value]) => value === '7'), true);
            flushSync(() => latest.onNext()); await settle();
            check(`${problem.id}: a new problem still resets input`, { id: latest.currentProblem?.id, input: latest.userInput,
                inputs: latest.userInputs, hissanValues: [...(latest.hissanUserValues ?? new Map())] }, {
                id: `${problem.id}-next`, input: '', inputs: problem === fraction ? ['', ''] : [], hissanValues: [],
            });
            await unmount();
        }

        await mount(number, '7'); await settings(); await settle();
        check('first operable-frame key survives all subsequent passive effects', latest.userInput, '7');
        await unmount();

        await mount(number);
        const blockedUntilSettings = latest.loading;
        if (blockedUntilSettings) await settings();
        flushSync(() => key('1')); await settle();
        flushSync(() => key('1')); await settle();
        flushSync(() => key('Enter')); await settle();
        check('correct submission enters the existing pending-save feedback', latest.feedback, 'correct');
        if (!blockedUntilSettings) await settings();
        flushSync(() => key('Enter')); await settle();
        check('settings cannot clear correct feedback or unlock a pending save', { feedback: latest.feedback, saveCalls }, { feedback: 'correct', saveCalls: 1 });
        await unmount();

        const optional: Problem = { ...number, id: 'settings-optional', categoryId: 'add_2d1d_nc', questionText: '23 + 4 =', correctAnswer: '27' };
        await mount(optional); await settings();
        check('first ready optional Hissan problem follows the saved setting', latest.hissanActive, true);
        flushSync(() => latest.onHissanToggle?.()); await settle();
        check('explicit user mode change remains available', latest.hissanActive, false);
        await unmount();

        await mount(number); await settings(false);
        flushSync(() => key('7')); await settle();
        flushSync(() => latest.onSkip()); await settle();
        check('explicit skip still enters skipped feedback and records once', { feedback: latest.feedback, saveCalls }, { feedback: 'skipped', saveCalls: 1 });
        await unmount();

        for (const failure of ['rejection', 'missing profile']) {
            await mount(number);
            if (failure === 'rejection') rejectProfile(new Error('controlled settings read failure'));
            else resolveProfile(null);
            await settle();
            flushSync(() => { key('7'); key('Enter'); key('Escape'); }); await settle();
            check(`${failure}: leaves loading through the existing empty-state route and accepts no hidden answer`,
                { loading: latest.loading, problem: latest.currentProblem?.id ?? null, input: latest.userInput, saveCalls },
                { loading: false, problem: null, input: '', saveCalls: 0 });
            await unmount();
        }
    } finally { await unmount(); }
    return cases;
}
