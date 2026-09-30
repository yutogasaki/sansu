import { useEffect, useState } from 'react';
import { db } from '../db';
import { getActiveProfile } from '../domain/user/repository';
import { islandEnabled } from '../domain/island/feature';

export type FinishContinuation = 'checking' | 'pending' | 'fresh' | 'unknown';

export function useFinishContinuation(ownerId?: string) {
    const [state, setState] = useState<{ ownerId?: string; continuation: FinishContinuation }>({ continuation: 'checking' });
    useEffect(() => {
        let live = true;
        async function read() {
            const profile = await getActiveProfile();
            if (!profile || !ownerId || profile.id !== ownerId) return 'unknown' as const;
            if (!islandEnabled()) return 'fresh' as const;
            const island = await db.islands.get(profile.id);
            const pending = island?.pendingPlanId ? await db.islandPlans.get(island.pendingPlanId) : undefined;
            const currentOwner = await getActiveProfile();
            if (currentOwner?.id !== profile.id || island && island.profileId !== profile.id) return 'unknown' as const;
            if (island?.pendingPlanId) {
                if (pending?.profileId !== profile.id || pending.status !== 'active') return 'unknown' as const;
                return 'pending' as const;
            }
            return 'fresh' as const;
        }
        void read().then(continuation => { if (live) setState({ ownerId, continuation }); })
            .catch(() => { if (live) setState({ ownerId, continuation: 'unknown' }); });
        return () => { live = false; };
    }, [ownerId]);
    return state.ownerId === ownerId ? state.continuation : 'checking';
}
