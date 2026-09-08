import { useCallback, useEffect, useState } from 'react';
import { recordIslandDiscovery } from '../../domain/island/growthRepository';
import type { IslandRecord } from '../../domain/island/types';

interface ObservedDiscovery { id: string; itemId: string; failures: number; retryAt: number }

/** One displayed event is one queue entry, including after a failed write.
 * Retry twice during this visit, then wait for a new visit/foreground event. */
export function createIslandDiscoveryQueue(save: (id: string, itemId: string) => Promise<IslandRecord | undefined>, onSaved: (island: IslandRecord) => void) {
    const pending = new Map<string, ObservedDiscovery>();
    const saved = new Set<string>();
    let paused = true, saving = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    const pump = () => {
        cancel();
        if (paused || saving) return;
        const next = [...pending.values()].filter(entry => entry.failures < 3).sort((left, right) => left.retryAt - right.retryAt)[0];
        if (!next) return;
        const delay = next.retryAt - Date.now();
        if (delay > 0) { timer = setTimeout(pump, delay); return; }
        saving = true;
        const failed = () => { next.failures += 1; next.retryAt = Date.now() + (next.failures === 1 ? 1500 : 5000); };
        void save(next.id, next.itemId).then(updated => {
            if (updated) { pending.delete(next.id); saved.add(next.id); onSaved(updated); }
            else failed();
        }).catch(failed).finally(() => { saving = false; pump(); });
    };
    return {
        observe(id: string, itemId: string) {
            if (saved.has(id) || pending.has(id)) return;
            pending.set(id, { id, itemId, failures: 0, retryAt: Date.now() }); pump();
        },
        resume() { paused = false; pump(); },
        pause() { paused = true; cancel(); },
        revisit() { for (const entry of pending.values()) { entry.failures = 0; entry.retryAt = Date.now(); } pump(); },
    };
}

/** Capture displayed facts while visiting, then serialize them with all other
 * island writes/PWA holds. Retries pause throughout learning and backgrounding; neither
 * observing nor saving opens a panel or changes the learning reservation. */
export function useIslandDiscoveries({ profileId, island, enabled, busy, run, onSaved }: {
    profileId: string; island?: IslandRecord; enabled: boolean; busy: boolean;
    run: <T>(action: () => Promise<T>, minimumMs?: number) => Promise<T | undefined>;
    onSaved: (island: IslandRecord) => void;
}) {
    const [queue] = useState(() => createIslandDiscoveryQueue((id, itemId) => run(() => recordIslandDiscovery(profileId, id, itemId)), onSaved));
    const capture = useCallback((id: string, itemId: string) => {
        if (!enabled || island?.growth?.discoveries.some(entry => entry.id === id)) return;
        queue.observe(id, itemId);
    }, [enabled, island?.growth?.discoveries, queue]);

    useEffect(() => {
        const resume = () => { if (enabled && !busy && !document.hidden) queue.resume(); else queue.pause(); };
        const visibility = () => { if (!document.hidden) queue.revisit(); resume(); };
        resume(); document.addEventListener('visibilitychange', visibility);
        return () => { queue.pause(); document.removeEventListener('visibilitychange', visibility); };
    }, [enabled, busy, queue]);
    return { capture, revisit: queue.revisit };
}
