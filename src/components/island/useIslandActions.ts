import { useCallback, useEffect, useRef, useState } from 'react';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';

/** Synchronous lock prevents double taps before React commits disabled controls. */
export function useIslandActions() {
    const lock = useRef(false);
    const mounted = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const run = useCallback(async <T,>(action: () => Promise<T>, minimumMs = 0): Promise<T | undefined> => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError(undefined);
        const release = holdPwaUpdateForCriticalPersistence();
        const start = performance.now();
        try {
            const result = await action();
            // The brief input guard prevents a held key or double tap leaking into the next question.
            const remaining = minimumMs - (performance.now() - start);
            if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining));
            return mounted.current ? result : undefined;
        } catch {
            if (mounted.current) setError('まだ ほぞんできなかったよ。もういちど ためすか、よみなおして つづけよう。');
        } finally {
            release();
            lock.current = false;
            if (mounted.current) setBusy(false);
        }
    }, []);
    return { run, busy, error };
}
