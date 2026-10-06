import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { getActiveProfile } from '../domain/user/repository';
import type { UserProfile } from '../domain/types';
import { GrowingLoading } from '../components/island/growing/GrowingLoading';
import { IslandLoadingError, IslandSession } from '../components/island/IslandSession';

export default function Island() {
    const [initial, setInitial] = useState<UserProfile | null>();
    const [error, setError] = useState(false);
    const app = useLiveQuery(() => db.appData.get('app'), []);
    const navigate = useNavigate();
    useEffect(() => {
        let mounted = true;
        void getActiveProfile().then(profile => {
            if (!mounted) return;
            if (!profile) navigate('/onboarding', { replace: true });
            setInitial(profile);
        }).catch(() => { if (mounted) setError(true); });
        return () => { mounted = false; };
    }, [navigate]);
    const profile = app ? app.profiles[app.activeProfileId ?? ''] : initial;
    useEffect(() => {
        if (app && !profile) navigate('/onboarding', { replace: true });
    }, [app, profile, navigate]);
    if (error) return <IslandLoadingError />;
    return profile ? <IslandSession key={profile.id} profile={profile} /> : <GrowingLoading step="page" />;
}
