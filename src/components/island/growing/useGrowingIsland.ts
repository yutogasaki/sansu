import { useCallback, useEffect, useRef, useState } from 'react';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { lifeDb, terminalFacts } from '../../../domain/islandLife/repository';
import { getProfile } from '../../../domain/user/repository';
import { commandGrowingIsland, growingDb, syncGrowingIsland, type GrowingRecord } from '../../../domain/growingIsland/repository';
import type { Command, NatureEvent, TownEvent } from '../../../domain/growingIsland';

export interface Reveal { id: number; town: TownEvent[]; nature: NatureEvent[] }

const message = (error: unknown) => error instanceof Error && /[ぁ-ん]/.test(error.message)
    ? error.message : 'しまを ほぞん できなかったよ。もういちど ためしてね。';

/**
 * Keeps the growing island in step with learning: every sync adds new completions, grows
 * nature and opens banked town time in one save. Commands wait for a running sync.
 */
export function useGrowingIsland(profileId: string, active: boolean) {
    const [record, setRecord] = useState<GrowingRecord>();
    const [reveal, setReveal] = useState<Reveal>();
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const running = useRef<Promise<void> | undefined>(undefined), revealId = useRef(0);

    const sync = useCallback(() => {
        if (running.current) return running.current;
        const release = holdPwaUpdateForCriticalPersistence();
        running.current = (async () => {
            try {
                const profile = await getProfile(profileId);
                const levels = profile ? { math: profile.mathMainLevel, vocab: profile.vocabMainLevel } : undefined;
                const result = await syncGrowingIsland(profileId, await terminalFacts(profileId), Date.now(), growingDb, lifeDb, levels);
                setRecord(result.record); setError(undefined);
                const shown = result.town.some(e => e.type !== 'quiet') || result.nature.some(e => e.type === 'big-tree' || e.type === 'lord-tree' || e.type === 'spread');
                if (result.town.length || shown) setReveal({ id: ++revealId.current, town: result.town, nature: result.nature });
            } catch (e) { setError(message(e)); }
            finally { release(); running.current = undefined; }
        })();
        return running.current;
    }, [profileId]);

    const dispatch = useCallback(async (command: Command) => {
        if (running.current) await running.current;
        setBusy(true);
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            const result = await commandGrowingIsland(profileId, { id: crypto.randomUUID(), command });
            setRecord(result.record); setError(undefined);
            if (result.town.length) setReveal({ id: ++revealId.current, town: result.town, nature: [] });
            return true;
        } catch (e) { setError(message(e)); return false; }
        finally { release(); setBusy(false); }
    }, [profileId]);

    useEffect(() => { setRecord(undefined); setReveal(undefined); }, [profileId]);
    useEffect(() => {
        if (!active) return;
        void sync();
        const refresh = () => { if (document.visibilityState === 'visible') void sync(); };
        const id = window.setInterval(refresh, 15_000);
        document.addEventListener('visibilitychange', refresh);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
    }, [active, sync]);

    return { record: record?.profileId === profileId ? record : undefined, reveal, error, busy, dispatch, sync,
        clearError: () => setError(undefined) };
}
