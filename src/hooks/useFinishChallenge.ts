import { useEffect, useState } from 'react';
import { getActiveProfile } from '../domain/user/repository';
import { readLearningProgress } from '../domain/learning/progressRepository';
import type { SubjectKey } from '../domain/types';

export async function readReadyFinishChallenges() {
    const profile = await getActiveProfile();
    if (!profile) return [];
    const progress = await readLearningProgress(profile);
    const currentProfile = await getActiveProfile();
    if (currentProfile?.id !== profile.id) throw new Error('Finish challenge owner changed');
    const subjects: SubjectKey[] = profile.subjectMode === 'mix' ? ['math', 'vocab'] : [profile.subjectMode];
    return subjects.flatMap(subject => {
        const eligibility = progress.finish[subject];
        return eligibility.status === 'ready' ? [{ subject, ...eligibility }] : [];
    });
}

export function useFinishChallenge() {
    const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; challenges: Awaited<ReturnType<typeof readReadyFinishChallenges>> }>({ status: 'loading', challenges: [] });
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let live = true;
        void readReadyFinishChallenges().then(challenges => { if (live) setState({ status: 'ready', challenges }); })
            .catch(() => { if (live) setState({ status: 'error', challenges: [] }); });
        return () => { live = false; };
    }, [retry]);
    return { ...state, retry: () => { setState({ status: 'loading', challenges: [] }); setRetry(value => value + 1); } };
}
