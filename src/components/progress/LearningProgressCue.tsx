import { useEffect, useState } from 'react';
import { readLearningProgress } from '../../domain/learning/progressRepository';
import { getAppData } from '../../domain/user/repository';
import { useIslandNavigation } from '../island/useIslandNavigation';
import type { UserProfile } from '../../domain/types';
import type { IslandPlan } from '../../domain/island/types';
import { finishEntryPath } from '../finish/finishNavigation';
import './LearningProgressCue.css';

/** Read the existing qualification only at an untouched section boundary. */
export function LearningProgressCue({ profile, plan, active, busy = false, onOpen }: {
    profile: UserProfile; plan: IslandPlan; active: boolean; busy?: boolean; onOpen: () => void;
}) {
    const navigation = useIslandNavigation();
    const [coverage, setCoverage] = useState<{ profile: UserProfile; planId: string; subject: string; ready: boolean }>();
    const boundary = plan.cursor === 0 && plan.profileId === profile.id;
    useEffect(() => {
        if (!active || !boundary) return;
        let cancelled = false;
        void Promise.all([readLearningProgress(profile), getAppData()]).then(([progress, appData]) => {
            if (cancelled || appData.activeProfileId !== profile.id) return;
            setCoverage({ profile, planId: plan.id, subject: plan.subject, ready: progress.finish[plan.subject].status === 'ready' });
        }).catch(() => { if (!cancelled) setCoverage(undefined); });
        return () => { cancelled = true; };
    }, [active, boundary, plan.id, plan.subject, profile]);
    if (!active || !boundary || coverage?.profile !== profile || coverage.planId !== plan.id
        || coverage.subject !== plan.subject || !coverage.ready) return null;
    const main = plan.subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    return <div className="learning-progress-cue" data-learning-progress="true">
        <button type="button" className="learning-progress-finish-link" disabled={busy}
            aria-label={`${plan.subject === 'math' ? 'さんすう' : 'えいご'}の Lv${main + 1}へ ちょうせん`}
            onClick={() => {
                onOpen();
                const path = finishEntryPath(plan.subject);
                if (navigation) navigation.open(path); else window.location.hash = path;
            }}>Lv{main + 1}へ ちょうせん <span aria-hidden="true">→</span></button>
    </div>;
}
