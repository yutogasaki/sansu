import { useLayoutEffect, useState } from 'react';

/** Shared with challenge persistence: an origin-wide lease lasts until the learning screen leaves. */
export async function acquireLearningSessionLease(profileId: string, signal?: AbortSignal): Promise<() => void> {
    if (typeof navigator === 'undefined' || !navigator.locks) return () => undefined;
    // StrictMode may clean up and remount before the native request task runs.
    // Do not let that already-aborted mount briefly take the next mount's lock.
    await Promise.resolve();
    if (signal?.aborted) throw new Error('learning-session-cancelled');
    return new Promise((resolve, reject) => {
        // Web Locks forbids combining signal with ifAvailable. The abort listener
        // below still releases a granted lease and rejects an already-ended mount.
        void navigator.locks.request(`sansu-learning-session:${profileId}`, { ifAvailable: true }, async lock => {
            if (!lock) { reject(new Error('learning-session-active-elsewhere')); return; }
            await new Promise<void>(release => {
                const finish = () => { signal?.removeEventListener('abort', finish); release(); };
                if (signal?.aborted) { finish(); reject(new Error('learning-session-cancelled')); return; }
                signal?.addEventListener('abort', finish, { once: true });
                resolve(finish);
            });
        }).catch(reject);
    });
}
export function useLearningSessionLease(profileId: string | null | undefined, enabled = true) {
    const [state, setState] = useState<{ profileId: string; status: 'ready' | 'blocked' } | null>(null);
    useLayoutEffect(() => {
        setState(null);
        if (!enabled || !profileId) return;
        const abort = new AbortController();
        let disposed = false;
        let release: (() => void) | undefined;
        void acquireLearningSessionLease(profileId, abort.signal).then(lease => {
            if (disposed) { lease(); return; }
            release = lease;
            setState({ profileId, status: 'ready' });
        }).catch(() => { if (!disposed) setState({ profileId, status: 'blocked' }); });
        return () => { disposed = true; abort.abort(); release?.(); };
    }, [enabled, profileId]);
    return !enabled ? 'ready' : state && state.profileId === profileId ? state.status : 'loading';
}
