import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal hook lifecycle harness, following LearningAnswerForm.defer.test.tsx.
// Browser rendering/paint timing is deliberately left to the browser integration lane.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; effect?: () => (() => void) | void };
    let cells: Cell[] = [], cursor = 0;
    const effects: (() => void)[] = [];
    const equal = (left?: readonly unknown[], right?: readonly unknown[]) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
    return {
        reset() { cells = []; cursor = 0; effects.length = 0; },
        begin() { cursor = 0; },
        useState(initial: unknown) {
            const i = cursor++; cells[i] ??= { value: typeof initial === 'function' ? initial() : initial };
            return [cells[i].value, (next: unknown) => { cells[i].value = typeof next === 'function' ? next(cells[i].value) : next; }];
        },
        useRef(initial: unknown) { const i = cursor++; cells[i] ??= { value: { current: initial } }; return cells[i].value; },
        useCallback(callback: unknown, deps: readonly unknown[]) {
            const i = cursor++;
            if (!equal(cells[i]?.deps, deps)) cells[i] = { value: callback, deps };
            return cells[i].value;
        },
        effect(callback: () => (() => void) | void, deps?: readonly unknown[]) {
            const i = cursor++, previous = cells[i]; cells[i] ??= {};
            if (!equal(previous?.deps, deps)) {
                cells[i].deps = deps; cells[i].effect = callback;
                effects.push(() => { cells[i].cleanup?.(); cells[i].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        strictReplay() {
            for (const cell of cells) cell.cleanup?.();
            for (const cell of cells) if (cell.effect) cell.cleanup = cell.effect() || undefined;
        },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
const repository = vi.hoisted(() => ({ ChallengeProfileDeletedError: class extends Error {}, startChallenge: vi.fn(), markShown: vi.fn(), appendChallengeAnswer: vi.fn(), finishChallenge: vi.fn(), interruptChallenge: vi.fn(), recoverChallenge: vi.fn() }));
const pwa = vi.hoisted(() => ({ hold: vi.fn(), release: vi.fn() }));
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect, useLayoutEffect: hooks.effect }));
vi.mock('../../domain/challenge/repository', () => repository);
vi.mock('../../pwa', () => ({ holdPwaUpdateForCriticalPersistence: pwa.hold }));
import { useChallengeSession } from './useChallengeSession';
import { generateChallengeQuestions } from '../../domain/challenge/engine';

const record = () => ({ id: 'run-1', profileId: 'child', questions: generateChallengeQuestions('hook') });
const official = { correct: 0, incorrect: 0, skipped: 0, official: true, newAwards: ['certificate'], best: 0, improved: false, finishedAt: '2026-09-09T00:00:00.000Z' };
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function RenderHarness(initialStart = true) { hooks.begin(); const view = useChallengeSession('child', initialStart); hooks.commit(); return view; }
function render(initialStart = true) { RenderHarness(initialStart); RenderHarness(initialStart); return RenderHarness(initialStart); }

beforeEach(() => {
    hooks.reset(); vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.stubGlobal('navigator', { locks: { request: vi.fn(async (_name: string, _options: unknown, callback: (lock: object) => Promise<void>) => callback({})) } });
    vi.stubGlobal('document', Object.assign(new EventTarget(), { hidden: false }));
    vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval, clearInterval, setTimeout, clearTimeout, requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16), cancelAnimationFrame: clearTimeout }));
    repository.startChallenge.mockResolvedValue(record());
    repository.markShown.mockResolvedValue(undefined);
    repository.appendChallengeAnswer.mockResolvedValue(undefined);
    repository.finishChallenge.mockResolvedValue(official);
    repository.interruptChallenge.mockResolvedValue({ ...official, official: false, newAwards: [] });
    repository.recoverChallenge.mockResolvedValue(null);
    pwa.hold.mockReturnValue(pwa.release);
});
afterEach(async () => { hooks.unmount(); await flush(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('challenge controller lifecycle', () => {
    it('reserves once across StrictMode effect cleanup and replay', async () => {
        render(); hooks.strictReplay(); await flush();
        expect(repository.startChallenge).toHaveBeenCalledTimes(1);
        expect(repository.interruptChallenge).not.toHaveBeenCalled();
        expect(render().phase).toBe('countdown');
        expect(pwa.hold).toHaveBeenCalledTimes(1);
    });

    it('keeps a pending preparation held until cancellation saves and blocks racing restart', async () => {
        let resolveStart!: (value: ReturnType<typeof record>) => void;
        repository.startChallenge.mockReturnValue(new Promise(resolve => { resolveStart = resolve; }));
        render(); await flush();
        Object.assign(document, { hidden: true }); document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(pwa.release).not.toHaveBeenCalled();
        render().restart();
        expect(repository.startChallenge).toHaveBeenCalledTimes(1);
        resolveStart(record()); await flush();
        expect(repository.interruptChallenge).toHaveBeenCalledWith('run-1', 'background');
        expect(pwa.release).toHaveBeenCalledTimes(1);
        expect(render().phase).toBe('result');
    });

    it('keeps finalization held after unmount until its write settles', async () => {
        let resolveFinish!: (value: typeof official) => void;
        repository.finishChallenge.mockReturnValue(new Promise(resolve => { resolveFinish = resolve; }));
        render(); await flush(); await vi.advanceTimersByTimeAsync(3100);
        const run = render().run!;
        await vi.advanceTimersByTimeAsync(run.startedAt! + 60_000 - performance.now()); await flush();
        expect(repository.finishChallenge).toHaveBeenCalledTimes(1);
        hooks.unmount(); await flush();
        expect(pwa.release).not.toHaveBeenCalled();
        expect(repository.interruptChallenge).not.toHaveBeenCalled();
        resolveFinish(official); await flush();
        expect(pwa.release).toHaveBeenCalledTimes(1);
    });

    it('releases the update hold for definitive owner deletion without inventing a result', async () => {
        repository.interruptChallenge.mockRejectedValue(new repository.ChallengeProfileDeletedError('deleted'));
        render(); await flush();
        await render().stop('profile-switch'); await flush();
        expect(pwa.release).toHaveBeenCalledTimes(1);
        expect(render().result).toBeUndefined();
        expect(render().error).toBeUndefined();
        expect(render().phase).toBe('result');
    });

    it('interrupts once on background and cannot accept more answers', async () => {
        render(); await flush();
        await vi.advanceTimersByTimeAsync(3100);
        Object.assign(document, { hidden: true }); document.dispatchEvent(new Event('visibilitychange'));
        document.dispatchEvent(new Event('visibilitychange')); await flush();
        render().answer('5'); await flush();
        expect(repository.interruptChallenge).toHaveBeenCalledTimes(1);
        expect(repository.finishChallenge).not.toHaveBeenCalled();
        expect(repository.appendChallengeAnswer).not.toHaveBeenCalled();
        expect(pwa.release).toHaveBeenCalledTimes(1);
        expect(render().phase).toBe('result');
    });

    it('drains accepted answers before interrupting after a write error', async () => {
        render(); await flush(); await vi.advanceTimersByTimeAsync(3100);
        repository.appendChallengeAnswer.mockRejectedValueOnce(new Error('disk full'));
        const view = render(); view.answer(String(view.run!.questions[0].answer)); await flush();
        expect(repository.appendChallengeAnswer).toHaveBeenCalledTimes(1);
        expect(repository.interruptChallenge).toHaveBeenCalledWith('run-1', 'save-failed');
        expect(repository.finishChallenge).not.toHaveBeenCalled();
        expect(render().phase).toBe('result');
        expect(pwa.release).toHaveBeenCalledTimes(1);
    });

    it('keeps the update hold when both finalization and same-id recovery fail', async () => {
        repository.finishChallenge.mockRejectedValue(new Error('unknown commit'));
        repository.interruptChallenge.mockRejectedValue(new Error('storage unavailable'));
        render(); await flush(); await vi.advanceTimersByTimeAsync(3100);
        const run = render().run!;
        await vi.advanceTimersByTimeAsync(run.startedAt! + 60_000 - performance.now()); await flush();
        expect(repository.interruptChallenge).toHaveBeenCalledWith('run-1', 'save-failed');
        expect(repository.recoverChallenge).not.toHaveBeenCalled();
        expect(pwa.release).not.toHaveBeenCalled();
        expect(render().error).toBeTruthy();
        render().restart(); await flush();
        expect(repository.startChallenge).toHaveBeenCalledTimes(1);
        repository.interruptChallenge.mockResolvedValue(official);
        await render().retryRecovery(); await flush();
        expect(render().result?.official).toBe(true);
        expect(render().error).toBeUndefined();
        expect(pwa.release).toHaveBeenCalledTimes(1);
        expect(repository.startChallenge).toHaveBeenCalledTimes(1);
    });

    it('recovers an abandoned stopped run by id and releases its original hold after remount', async () => {
        repository.interruptChallenge.mockRejectedValue(new Error('disk unavailable'));
        render(); await flush();
        await render().stop('closed'); await flush();
        expect(pwa.release).not.toHaveBeenCalled();
        hooks.unmount(); await flush(); hooks.reset();
        repository.interruptChallenge.mockResolvedValue(official);
        render(false); await flush();
        expect(repository.interruptChallenge).toHaveBeenLastCalledWith('run-1', 'save-failed');
        expect(repository.recoverChallenge).not.toHaveBeenCalled();
        expect(render(false).result?.official).toBe(true);
        expect(pwa.release).toHaveBeenCalledTimes(2);
    });

    it('finalizes once at the monotonic deadline and leaves unanswered problems uncounted', async () => {
        render(); await flush(); await vi.advanceTimersByTimeAsync(3100);
        const run = render().run!;
        expect(run.startedAt).not.toBeNull();
        await vi.advanceTimersByTimeAsync(run.startedAt! + 60_000 - performance.now());
        await flush();
        expect(repository.finishChallenge).toHaveBeenCalledTimes(1);
        expect(repository.finishChallenge).toHaveBeenCalledWith('run-1', [], 60_000);
        await vi.advanceTimersByTimeAsync(5000);
        expect(repository.finishChallenge).toHaveBeenCalledTimes(1);
        expect(render().result?.official).toBe(true);
    });
});
