import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { useCallback, useEffect, useRef, useState } from 'react';
import { lifeEnabled, type LifeRecord } from '../../../domain/islandLife/model';
import { terminalFacts, updateLife, type LifeIntent } from '../../../domain/islandLife/repository';

export function useIslandLife(profileId: string, active: boolean) {
    const [record, setRecord] = useState<LifeRecord>();
    const [error, setError] = useState<string>();
    // Background reads must not disable a button between pointerdown and click.
    const [busy, setBusy] = useState(false);
    const generation = useRef(0), screenGeneration = useRef(0), visible = useRef(active), requested = useRef(false);
    const running = useRef<Promise<boolean> | undefined>(undefined);
    const latest = useRef<LifeRecord | undefined>(undefined);
    const ownRefresh = useRef<{ from: number; to: number } | undefined>(undefined);
    const retryIntent = useRef<LifeIntent | undefined>(undefined);
    useEffect(() => { visible.current = active; if (!active) screenGeneration.current++; }, [active]);
    const refresh = useCallback(async (intent?: LifeIntent) => {
        if (!lifeEnabled() || requested.current || (!intent && (running.current || retryIntent.current))) return false;
        if (intent && !visible.current) return false;
        const token = generation.current, screenToken = screenGeneration.current, preceding = running.current;
        const request = intent ? structuredClone(intent) : undefined;
        let operation: Promise<boolean> | undefined;
        if (request) { requested.current = true; setBusy(true); }
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            if (preceding && !await preceding) {
                if (token === generation.current && request && visible.current && screenToken === screenGeneration.current) retryIntent.current = request;
                return false;
            }
            if (token !== generation.current || request && (!visible.current || screenToken !== screenGeneration.current)) return false;
            const range = ownRefresh.current;
            if (request) {
                if (range && request.revision >= range.from && request.revision <= range.to) request.revision = range.to;
                ownRefresh.current = undefined;
            }
            operation = (async () => {
                try {
                    const facts = await terminalFacts(profileId);
                    if (token !== generation.current || request && (!visible.current || screenToken !== screenGeneration.current)) return false;
                    const updated = await updateLife(profileId, facts, request);
                    if (token !== generation.current) return false;
                    const previous = latest.current;
                    if (!request) {
                        // Exactly one revision is our own refresh. A larger jump includes
                        // another writer, so a stale purchase must still fail its CAS.
                        ownRefresh.current = previous && updated.revision === previous.revision + 1
                            ? { from: ownRefresh.current?.to === previous.revision ? ownRefresh.current.from : previous.revision, to: updated.revision }
                            : undefined;
                    }
                    latest.current = updated; setRecord(updated); setError(undefined); retryIntent.current = undefined;
                    return !request || visible.current && screenToken === screenGeneration.current;
                } catch (e) {
                    if (token === generation.current) {
                        ownRefresh.current = undefined;
                        setError(e instanceof Error ? e.message : 'しまを ほぞんできなかったよ。'); retryIntent.current = request;
                    }
                    return false;
                }
            })();
            running.current = operation;
            return await operation;
        } finally {
            release();
            if (token === generation.current) {
                if (operation && running.current === operation) running.current = undefined;
                if (request) { requested.current = false; setBusy(false); }
            }
        }
    }, [profileId]);
    useEffect(() => {
        const epoch = ++generation.current;
        running.current = undefined; requested.current = false; latest.current = undefined;
        ownRefresh.current = undefined; retryIntent.current = undefined;
        setRecord(undefined); setError(undefined); setBusy(false);
        void refresh();
        return () => { generation.current = epoch + 1; };
    }, [refresh]);
    useEffect(() => {
        if (!active || !lifeEnabled()) return;
        void refresh();
        const refreshVisible = () => { if (document.visibilityState === 'visible' && !retryIntent.current) void refresh(); };
        const id = window.setInterval(refreshVisible, 15_000);
        document.addEventListener('visibilitychange', refreshVisible);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', refreshVisible); };
    }, [active, refresh]);
    return { record: record?.profileId === profileId ? record : undefined, busy, error, refresh,
        retry: () => refresh(retryIntent.current), clearError: () => { retryIntent.current = undefined; void refresh(); } };
}
