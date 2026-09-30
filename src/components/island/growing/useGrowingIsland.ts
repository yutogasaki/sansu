import { useCallback, useEffect, useRef, useState } from 'react';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';
import { lifeDb, terminalFacts } from '../../../domain/islandLife/repository';
import { getProfile } from '../../../domain/user/repository';
import { commandGrowingIsland, growingDb, readGrowingIsland, syncGrowingIsland, type GrowingRecord } from '../../../domain/growingIsland/repository';
import type { Command, NatureEvent, TownEvent } from '../../../domain/growingIsland';
import type { LoadingStep } from './GrowingLoading';

export interface Reveal { id: number; town: TownEvent[]; nature: NatureEvent[] }

/** Another tab saved this island: reload the saved state instead of showing a stale one. */
const channelName = 'sansu-growing-island';
const announce = (profileId: string) => { try { const c = new BroadcastChannel(channelName); c.postMessage(profileId); c.close(); } catch { /* Old browsers refresh on focus. */ } };

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
    const [step, setStep] = useState<LoadingStep>('learning');
    const running = useRef<Promise<void> | undefined>(undefined), revealId = useRef(0);

    /**
     * `full` reads every learning completion and the learning levels; the periodic refresh only
     * grows nature, since learning happens on another screen and returning runs a full sync.
     */
    const sync = useCallback((full = true) => {
        if (running.current) return running.current;
        const release = holdPwaUpdateForCriticalPersistence();
        running.current = (async () => {
            try {
                const [profile, facts] = full ? await Promise.all([getProfile(profileId), terminalFacts(profileId)]) : [undefined, []];
                const levels = profile ? { math: profile.mathMainLevel, vocab: profile.vocabMainLevel } : undefined;
                setStep('saving');
                const result = await syncGrowingIsland(profileId, facts, Date.now(), growingDb, lifeDb, levels);
                setRecord(result.record); setError(undefined);
                // Only meaningful changes are announced, so two open tabs never ping-pong refreshes.
                if (result.learned > 0 || result.town.length) announce(profileId);
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
            setRecord(result.record); setError(undefined); announce(profileId);
            if (result.town.length) setReveal({ id: ++revealId.current, town: result.town, nature: [] });
            return true;
        } catch (e) { setError(message(e)); return false; }
        finally { release(); setBusy(false); }
    }, [profileId]);

    useEffect(() => { setRecord(undefined); setReveal(undefined); }, [profileId]);
    useEffect(() => {
        if (!active || typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel(channelName);
        channel.onmessage = event => { if (event.data === profileId) void sync(); };
        return () => channel.close();
    }, [active, profileId, sync]);
    useEffect(() => {
        if (!active) return;
        let live = true;
        // A saved island appears at once; the full sync then adds learning and opens town time.
        void readGrowingIsland(profileId).then(saved => { if (live && saved) setRecord(current => current ?? saved); }).catch(() => undefined);
        void sync();
        const visible = () => { if (document.visibilityState === 'visible') void sync(); };
        const id = window.setInterval(() => { if (document.visibilityState === 'visible') void sync(false); }, 15_000);
        document.addEventListener('visibilitychange', visible);
        return () => { live = false; clearInterval(id); document.removeEventListener('visibilitychange', visible); };
    }, [active, sync]);

    return { record: record?.profileId === profileId ? record : undefined, reveal, error, busy, dispatch, sync, step,
        clearError: () => setError(undefined) };
}
