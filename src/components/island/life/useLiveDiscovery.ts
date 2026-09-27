import { useEffect, useRef, useState } from 'react';
import type { DiscoveryScene, PresentationEvidence } from '../../../domain/islandLife/discoveryJournal';
import { recordPresentedScene } from '../../../domain/islandLife/discoveryRepository';
import { holdPwaUpdateForCriticalPersistence } from '../../../pwa';

/** Each witnessed event is saved to its original owner. Failed writes retain the
 * evidence for explicit retry; viewing never triggers an economic refresh. */
export function useLiveDiscovery(profileId?: string) {
    const alive = useRef(false), owner = useRef(profileId);
    const pending = useRef(new Map<string, { event: DiscoveryScene; evidence: PresentationEvidence }>());
    const working = useRef(false);
    const [error, setError] = useState('');
    const [latest, setLatest] = useState<DiscoveryScene>();
    useEffect(() => {
        alive.current = true; owner.current = profileId; pending.current = new Map(); setError(''); setLatest(undefined);
        return () => { alive.current = false; };
    }, [profileId]);
    const retry = async () => {
        if (working.current || !pending.current.size) return;
        const requests = pending.current, originalOwner = owner.current;
        working.current = true; setError('');
        const release = holdPwaUpdateForCriticalPersistence();
        try {
            for (const [id, request] of requests) {
                const journal = await recordPresentedScene(request.event.profileId, request.event, request.evidence);
                requests.delete(id);
                if (alive.current && owner.current === originalOwner && journal?.firstPresented.some(first => first.eventId === id)) setLatest(request.event);
            }
        } catch { if (alive.current && owner.current === originalOwner) setError('みた きろくを のこせなかったよ。'); }
        finally { release(); working.current = false; if (alive.current && pending.current !== requests && pending.current.size) void retry(); }
    };
    return { error, retry, latest, presented: (event: DiscoveryScene, evidence: PresentationEvidence) => {
        if (!alive.current || event.profileId !== owner.current) return;
        pending.current.set(event.eventId, { event, evidence }); void retry();
    } };
}
