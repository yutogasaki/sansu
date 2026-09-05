import { useCallback, useEffect, useRef, useState } from 'react';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import { ParkConflict } from '../../domain/park/repository';

export function useParkActions() {
    const lock = useRef(false);
    const mounted = useRef(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string>();
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError(undefined);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const value = await action();
            return mounted.current ? value : undefined;
        } catch (cause) {
            if (mounted.current) setError(cause instanceof ParkConflict
                ? 'べつの がめんで かわったよ。よみなおして つづけよう。'
                : 'まだ ほぞんできなかったよ。もういちど ためしてね。');
        } finally {
            release();
            lock.current = false;
            if (mounted.current) setBusy(false);
        }
    }, []);
    return { run, busy, error };
}
