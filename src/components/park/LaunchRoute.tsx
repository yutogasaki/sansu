import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { db } from '../../db';
import { getActiveProfile } from '../../domain/user/repository';
import { BUILD_PLAY_ENABLED } from '../../domain/park/feature';
import { islandEnabled } from '../../domain/island/feature';
import { Spinner } from '../ui/Spinner';

export function LaunchRoute() {
    const [destination, setDestination] = useState<string>();
    const islandOn = islandEnabled();
    useEffect(() => {
        if (!islandOn && !BUILD_PLAY_ENABLED) return;
        let active = true;
        void getActiveProfile().then(async profile => {
            if (!profile) return '/onboarding';
            if (islandOn) return '/island';
            const oldRun = await db.exploreRuns.where('[profileId+status]').equals([profile.id, 'active']).first();
            return oldRun ? '/explore' : '/park';
        }).then(path => { if (active) setDestination(path); }).catch(() => { if (active) setDestination(islandOn ? '/island' : '/explore'); });
        return () => { active = false; };
    }, [islandOn]);
    if (!islandOn && !BUILD_PLAY_ENABLED) return <Navigate to="/explore" replace />;
    return destination ? <Navigate to={destination} replace /> : <Spinner fullScreen message="じゅんびちゅう…" />;
}
