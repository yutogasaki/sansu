import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IslandScreen } from '../../domain/island/navigation';
import { db } from '../../db';
import type { UserProfile } from '../../domain/types';
import { assertIslandPlan, openIsland, startIslandPlan } from '../../domain/island/repository';
import type { IslandPlan, IslandRecord } from '../../domain/island/types';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';

export function useIslandSessionState(profile: UserProfile, hasShell: boolean) {
    const location = useLocation();
    const navigate = useNavigate();
    const [localScreen, setLocalScreen] = useState<IslandScreen>('home');
    const [loadError, setLoadError] = useState(false);
    const [entry] = useState(() => {
        const query = new URLSearchParams(location.search);
        const requested = query.get('start') === 'learn';
        const target = query.get('profile');
        query.delete('start'); query.delete('profile');
        return { requested, start: requested && (!target || target === profile.id),
            cleanUrl: `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}` };
    });
    const entryCleared = useRef(false);
    const [opening, setOpening] = useState(true);
    const [nextPlanError, setNextPlanError] = useState(false);
    const [snapshot, setSnapshot] = useState<IslandRecord>();
    const live = useLiveQuery(() => db.islands.get(profile.id), [profile.id]);
    const island = live && (!snapshot || live.revision >= snapshot.revision) ? live : snapshot;
    const [plan, setPlan] = useState<IslandPlan>();
    useEffect(() => {
        let mounted = true;
        const release = holdPwaUpdateForCriticalPersistence();
        void (async () => {
            const opened = await openIsland(profile.id);
            const pending = opened.pendingPlanId ? await db.islandPlans.get(opened.pendingPlanId) : undefined;
            if (!mounted) return;
            if (opened.pendingPlanId && (!pending || pending.profileId !== profile.id || pending.status !== 'active')) throw new Error('Pending learning unavailable');
            if (pending) assertIslandPlan(pending, profile.id);
            let reserved = pending;
            if (!hasShell && entry.start && !reserved) {
                try { reserved = await startIslandPlan(profile.id); }
                catch { if (mounted) setNextPlanError(true); }
            }
            if (!mounted) return;
            setSnapshot(opened);
            setPlan(reserved);
            if (!hasShell && entry.start) setLocalScreen('learning');
            if (!hasShell && entry.requested && (reserved || !entry.start)) {
                entryCleared.current = true;
                navigate(entry.cleanUrl, { replace: true });
            }
        })().catch(() => { if (mounted) setLoadError(true); }).finally(() => {
            release();
            if (mounted) setOpening(false);
        });
        return () => { mounted = false; };
    }, [profile.id, entry, navigate, hasShell]);

    const clearEntry = () => {
        if (hasShell || !entry.requested || entryCleared.current) return;
        entryCleared.current = true;
        navigate(entry.cleanUrl, { replace: true });
    };

    return { opening, nextPlanError, setNextPlanError, snapshot, setSnapshot, island, plan, setPlan,
        localScreen, setLocalScreen, loadError, clearEntry };
}
