import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { advanceChallengeRun, challengeCounts, createChallengeRun, DURATION_MS, interruptChallengeRun, startChallengeRun, submitChallengeAnswer, type ChallengeRun as EngineRun } from '../../domain/challenge/engine';
import { ChallengeProfileDeletedError, appendChallengeAnswer, finishChallenge, interruptChallenge, markShown, recoverChallenge, startChallenge } from '../../domain/challenge/repository';
import type { ChallengeResult, ChallengeRun } from '../../domain/challenge/types';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';

// Only stopped runs with a failed persistence checkpoint enter this registry. A new
// mounted controller can retry their exact id without acquiring its own live lease.
const pendingRecovery = new Map<string, { record: ChallengeRun; release: () => void }>();
async function recoverStoppedChallenge(profileId: string) {
    const pending = pendingRecovery.get(profileId);
    if (!pending) return recoverChallenge(profileId);
    try {
        const result = await interruptChallenge(pending.record.id, 'save-failed');
        pendingRecovery.delete(profileId); pending.release();
        return { ...pending.record, result };
    } catch (error) {
        if (!(error instanceof ChallengeProfileDeletedError)) throw error;
        pendingRecovery.delete(profileId); pending.release();
        return null;
    }
}

/** One controller owns the clock and ordered writes, independent of React render timing. */
export function useChallengeSession(profileId: string, initialStart: boolean) {
    const [view, setView] = useState<{ phase: 'loading' | 'countdown' | 'running' | 'saving' | 'result'; countdown: number; remaining: number; run?: EngineRun; result?: ChallengeResult; error?: string }>({ phase: 'loading', countdown: 3, remaining: 60 });
    const control = useRef<{ mounted: boolean; started: boolean; record?: ChallengeRun; run?: EngineRun; queue: Promise<unknown>; preparation?: Promise<ChallengeRun>; countdownAt: number; finishing: boolean; recovering?: boolean; release?: () => void; error?: string }>({ mounted: false, started: false, queue: Promise.resolve(), countdownAt: 0, finishing: false });
    const publish = useCallback((update: Partial<typeof view>) => {
        if (control.current.mounted) setView(previous => ({ ...previous, ...update }));
    }, []);
    const keepPendingRecovery = useCallback(() => {
        const c = control.current;
        if (!c.record || !c.release) return;
        const release = c.release;
        pendingRecovery.set(c.record.profileId, { record: c.record, release: () => { release(); c.release = undefined; } });
    }, []);
    const releaseCheckpoint = useCallback(() => {
        const c = control.current;
        if (c.record && pendingRecovery.get(c.record.profileId)?.record.id === c.record.id) pendingRecovery.delete(c.record.profileId);
        c.release?.(); c.release = undefined;
    }, []);
    const stop = useCallback(async (reason: string) => {
        const c = control.current;
        if (c.finishing) return;
        c.finishing = true;
        if (c.run) c.run = interruptChallengeRun(c.run, reason);
        publish({ phase: 'saving', error: undefined });
        let checkpoint = false;
        try {
            // A pending reservation still owns the PWA hold and must be retired before retry.
            await c.preparation?.catch(() => undefined);
            await c.queue.catch(() => undefined);
            const record = c.record;
            if (record) {
                const recovered = await interruptChallenge(record.id, reason);
                publish({ phase: 'result', result: recovered, run: c.run });
            } else publish({ phase: 'result' });
            checkpoint = true;
        } catch (error) {
            if (error instanceof ChallengeProfileDeletedError) { checkpoint = true; publish({ phase: 'result', result: undefined, error: undefined }); }
            else publish({ phase: 'result', error: 'きろくを たしかめられなかったよ。いえに もどって たしかめよう。' });
        }
        finally { if (checkpoint) releaseCheckpoint(); else keepPendingRecovery(); }
    }, [publish, releaseCheckpoint, keepPendingRecovery]);
    const enqueue = useCallback((write: () => Promise<unknown>) => {
        const c = control.current;
        c.queue = c.queue.then(write);
        void c.queue.catch(() => { c.error = '保存できなかったため参考記録'; void stop('save-failed'); });
    }, [stop]);
    const start = useCallback(async () => {
        const c = control.current;
        if (c.release) return;
        c.finishing = false; c.error = undefined; c.queue = Promise.resolve(); c.run = undefined; c.record = undefined;
        c.release = holdPwaUpdateForCriticalPersistence();
        publish({ phase: 'loading', result: undefined, error: undefined, run: undefined, remaining: 60 });
        try {
            c.preparation = startChallenge(profileId).then(record => { c.record = record; return record; });
            const record = await c.preparation;
            c.preparation = undefined;
            // stop() is already waiting for this reservation and owns its interruption/release.
            if (c.finishing) return;
            if (!c.mounted || document.hidden) { await stop('background'); return; }
            c.run = createChallengeRun(record.questions); c.countdownAt = performance.now();
            publish({ phase: 'countdown', countdown: 3 });
        } catch {
            c.preparation = undefined;
            if (c.finishing) return;
            publish({ phase: 'result', error: 'いまは はじめられなかったよ。いえで たしかめよう。' });
            c.release?.(); c.release = undefined;
        }
    }, [profileId, publish, stop]);
    const finish = useCallback(async () => {
        const c = control.current;
        if (c.finishing || !c.record || !c.run) return;
        c.finishing = true; publish({ phase: 'saving', run: c.run, remaining: 0 });
        let checkpoint = false;
        try {
            await c.queue;
            const result = await finishChallenge(c.record.id, c.run.events, DURATION_MS);
            publish({ phase: 'result', result });
            checkpoint = true;
        } catch {
            // An unknown outcome is recovered by id, never credited as a new run.
            try {
                const recovered = await interruptChallenge(c.record.id, 'save-failed');
                publish({ phase: 'result', result: recovered });
                checkpoint = true;
            } catch (error) {
                if (error instanceof ChallengeProfileDeletedError) { checkpoint = true; publish({ phase: 'result', result: undefined, error: undefined }); }
                else publish({ phase: 'result', error: 'きろくを たしかめられなかったよ。いえで たしかめよう。' });
            }
        } finally { if (checkpoint) releaseCheckpoint(); else keepPendingRecovery(); }
    }, [publish, releaseCheckpoint, keepPendingRecovery]);
    const answer = useCallback((input: string | null) => {
        const now = performance.now();
        const c = control.current;
        if (!c.run || c.finishing || !c.record || document.hidden) return;
        const current = c.run, question = current.questions[current.index];
        if (!question) return;
        const next = submitChallengeAnswer(current, { questionId: question.id, input, now });
        c.run = next;
        if (next.events.length > current.events.length) {
            const id = c.record.id, event = next.events[next.events.length - 1];
            enqueue(() => appendChallengeAnswer(id, event));
        }
        publish({ run: next });
        if (next.phase === 'finalizing') void finish();
    }, [enqueue, finish, publish]);
    useLayoutEffect(() => {
        const c = control.current;
        if (view.phase !== 'running' || c.run?.phase !== 'countdown' || !c.record) return;
        c.run = startChallengeRun(c.run, performance.now());
        if (c.run.phase === 'interrupted') { void stop(c.run.interruptionReason ?? 'source-exhausted'); return; }
        const id = c.record.id; enqueue(() => markShown(id, 0));
        publish({ run: c.run });
    }, [view.phase, enqueue, publish, stop]);
    useEffect(() => {
        const c = control.current; c.mounted = true;
        if (!c.started) {
            c.started = true;
            if (initialStart) void start();
            else {
                const releaseRecovery = holdPwaUpdateForCriticalPersistence();
                void recoverStoppedChallenge(profileId).then(record => { c.record = record ?? undefined; publish({ phase: 'result', result: record?.result }); })
                    .catch(() => publish({ phase: 'result', error: 'きろくを ひらけなかったよ。' }))
                    .finally(releaseRecovery);
            }
        }
        const hidden = () => { if (document.hidden) void stop('background'); };
        const pagehide = () => { void stop('pagehide'); };
        document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', pagehide);
        const tick = window.setInterval(() => {
            if (c.finishing || !c.run || !c.record) return;
            const now = performance.now();
            if (c.run.phase === 'countdown') {
                const remaining = 3 - Math.floor((now - c.countdownAt) / 1000);
                if (remaining > 0) { publish({ countdown: remaining }); return; }
                publish({ phase: 'running', run: c.run });
                return;
            }
            const oldIndex = c.run.index;
            c.run = advanceChallengeRun(c.run, now);
            if (c.run.index !== oldIndex && c.run.phase === 'running') {
                const id = c.record.id, index = c.run.index; enqueue(() => markShown(id, index));
            }
            publish({ run: c.run, remaining: Math.max(0, Math.ceil((DURATION_MS - (now - (c.run.startedAt ?? now))) / 1000)) });
            if (c.run.phase === 'finalizing') void finish();
            else if (c.run.phase === 'interrupted') void stop(c.run.interruptionReason ?? 'source-exhausted');
        }, 25);
        return () => {
            c.mounted = false; clearInterval(tick);
            document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', pagehide);
            // React StrictMode immediately remounts effects; a genuine departure does not.
            queueMicrotask(() => { if (!c.mounted) void stop('closed'); });
        };
    }, [initialStart, profileId, start, stop, finish, enqueue, publish]);
    const retryRecovery = useCallback(async () => {
        const c = control.current;
        if (!view.error || view.result || c.recovering) return;
        c.recovering = true;
        try {
            if (c.record) {
                c.finishing = false;
                await stop('save-failed');
            } else {
                publish({ phase: 'saving', error: undefined });
                const release = holdPwaUpdateForCriticalPersistence();
                try {
                    const recovered = await recoverStoppedChallenge(profileId);
                    c.record = recovered ?? undefined;
                    publish({ phase: 'result', result: recovered?.result });
                } catch { publish({ phase: 'result', error: 'きろくを ひらけなかったよ。もういちど ためしてね。' }); }
                finally { release(); }
            }
        } finally { c.recovering = false; }
    }, [view.error, view.result, profileId, publish, stop]);
    return { ...view, counts: view.run ? challengeCounts(view.run) : { correct: 0, incorrect: 0, skipped: 0 }, answer, restart: start, stop, retryRecovery };
}
