import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { islandEnabled, ISLAND_DELIVERY_ID } from '../../domain/island/feature';
import { completeOnboardingProfile, OnboardingAlreadyCompleted, type OnboardingSelection } from '../../domain/user/onboarding';
import { enterFirstPlay, readFirstPlay, saveFirstPlaySetup, saveFirstPlayName, type FirstPlaySession, type FirstPlayStep } from '../../domain/user/firstPlay';
import { profileStorage } from '../../utils/storage';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
import IslandWelcome from './IslandWelcome';
import { IslandFirstSetup } from './IslandFirstSetup';
import { GrowingLoading } from './growing/GrowingLoading';
import './Island.css';
import './IslandOnboarding.css';

const GrowingIsland = lazy(() => import('./growing/GrowingIsland'));
const failureMessage = 'うまく ほぞんできなかったよ。もういちど ためしてね。';

/** Play and learn keep the same owner identity; no provisional learning profile. */
export default function IslandOnboarding() {
    const navigate = useNavigate();
    const [session, setSession] = useState<FirstPlaySession | null>();
    const [busy, setBusy] = useState(false), [error, setError] = useState<string>();
    const [readAttempt, setReadAttempt] = useState(0);
    const saving = useRef(false), mounted = useRef(true), handingOff = useRef(false);
    const app = useLiveQuery(() => db.appData.get('app'), []);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        let live = true;
        void readFirstPlay().then(value => { if (live) { setSession(value && !value.completed ? value : null); setError(undefined); } })
            .catch(() => { if (live) setError('しまを よみこめなかったよ。もういちど ためしてね。'); });
        return () => { live = false; };
    }, [readAttempt]);
    useEffect(() => {
        if (app && Object.keys(app.profiles).length && !saving.current && !handingOff.current) navigate('/', { replace: true });
    }, [app, busy, navigate]);
    const save = async (action: () => Promise<void>) => {
        if (saving.current) return;
        saving.current = true; setBusy(true); setError(undefined);
        const release = holdPwaUpdateForCriticalPersistence();
        try { await action(); }
        catch (failure) {
            if (mounted.current) {
                if (failure instanceof OnboardingAlreadyCompleted) navigate('/', { replace: true });
                else setError(failureMessage);
            }
        } finally { release(); saving.current = false; if (mounted.current) setBusy(false); }
    };
    const move = (step: FirstPlayStep, selection: OnboardingSelection) => {
        if (!session) return;
        void save(async () => {
            const next = await saveFirstPlaySetup(session.ownerId, step, selection);
            if (mounted.current) setSession(next);
        });
    };
    const finish = (chosen: OnboardingSelection) => {
        if (!session) return;
        void save(async () => {
            // Persist the final choice before completion, retaining it on failure/reload.
            const next = await saveFirstPlaySetup(session.ownerId, session.step, chosen);
            if (mounted.current) setSession(next);
            const receipt = await completeOnboardingProfile(chosen, session.ownerId, 'first');
            handingOff.current = true;
            profileStorage.setActiveId(receipt.activeProfileId);
            if (mounted.current) navigate(chosen.kokugoCourse ? '/kokugo' : `/island?start=learn&profile=${encodeURIComponent(receipt.profile.id)}`, { replace: true });
        });
    };
    if (session === undefined) return <main className="island-page first-play-read" aria-busy={!error}>
        {error ? <div role="alert"><p>{error}</p><button className="island-primary" onClick={() => { setError(undefined); setReadAttempt(n => n + 1); }}>もういちど</button></div> : <GrowingLoading step="page" />}
    </main>;
    if (!session) return <IslandWelcome busy={busy} error={error} onStart={() => void save(async () => {
        const next = await enterFirstPlay();
        if (mounted.current) setSession(next);
    })} />;
    if (session.step !== 'island') return <IslandFirstSetup session={session} busy={busy} error={error} onMove={move} onFinish={finish}
        onName={name => { void saveFirstPlayName(session.ownerId, name).catch(() => { if (mounted.current) setError(failureMessage); }); }} />;
    return <main className="island-page first-play-world" data-mode="first-play" data-onboarding-step="island" data-profile-created="false"
        data-onboarding-candidate="island-first-play-v2" data-visual-candidate-id="island-first-play-v2" data-delivery-id={ISLAND_DELIVERY_ID}
        data-island-feature-enabled={String(islandEnabled())} data-build-revision={__BUILD_REVISION__} data-build-version={__APP_VERSION__}>
        <Suspense fallback={<GrowingLoading step="world" />}><GrowingIsland profileId={session.ownerId} active sound={false} firstPlay
            onHome={() => move('island', session.selection)} onLearn={() => move('grade', session.selection)} /></Suspense>
        {error && <div className="first-play-save-error" role="alert"><p>{error}</p><button onClick={() => setError(undefined)}>とじる</button></div>}
    </main>;
}
