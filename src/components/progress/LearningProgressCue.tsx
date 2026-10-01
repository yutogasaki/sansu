import { readLearningProgress } from '../../domain/learning/progressRepository';
import { getAppData } from '../../domain/user/repository';
import { useIslandNavigation } from '../island/useIslandNavigation';
import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../domain/types';
import type { IslandPlan } from '../../domain/island/types';
import { learningLevelTitle, learningProgressNotice } from '../../domain/learning/progressView';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';
import { getLevelForSkill } from '../../domain/math/curriculum';
import { getWordLevel } from '../../domain/english/words';
import './LearningProgressCue.css';

/** No DB reads or write on the answer path; only committed profile changes. */
export function LearningProgressCue({ profile, plan, active, busy = false }: { profile: UserProfile; plan: IslandPlan; active: boolean; busy?: boolean }) {
    const navigation = useIslandNavigation();
    const [coverage, setCoverage] = useState<{ owner: string; revision: UserProfile; subject: string; ready: boolean }>();
    const previous = useRef({ profile, active, ready: false, subject: plan.subject });
    const [notice, setNotice] = useState<{ text: string; owner: string; subject: string }>();
    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        void Promise.all([readLearningProgress(profile), getAppData()]).then(([progress, appData]) => {
            if (cancelled || appData.activeProfileId !== profile.id) return;
            const ready = progress.finish[plan.subject].status === 'ready';
            setCoverage({ owner: profile.id, revision: profile, subject: plan.subject, ready });
            const before = previous.current;
            previous.current = { profile, active, ready, subject: plan.subject };
            const earned = before.active && before.subject === plan.subject
                ? learningProgressNotice(before.profile, profile, plan.subject, { beforeReady: before.ready, afterReady: ready }) : null;
            if (earned) setNotice({ text: `${plan.subject === 'math' ? 'さんすう' : 'えいたんご'}：${earned}`,
                owner: profile.id, subject: plan.subject });
        }).catch(() => { if (!cancelled) setCoverage(undefined); });
        return () => { cancelled = true; };
    }, [active, plan.subject, profile]);
    const ready = coverage?.owner === profile.id && coverage.revision === profile
        && coverage.subject === plan.subject && coverage.ready === true;
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(undefined), active ? 5000 : 0);
        return () => clearTimeout(timer);
    }, [notice, active]);
    const slot = plan.slots[plan.cursor];
    if (!slot) return null;
    const main = plan.subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;
    const problem = slot.problem;
    const level = plan.subject === 'math' ? getLevelForSkill(problem.categoryId) : getWordLevel(problem.categoryId);
    const title = plan.subject === 'math' ? MATH_SKILL_LABELS[problem.categoryId] ?? learningLevelTitle('math', main) : learningLevelTitle('vocab', level ?? main);
    const status = slot.assisted ? 'ヒントと いっしょに れんしゅう中' : problem.isReview ? 'まえの はんいを ふくしゅう中' : level != null && level > main ? 'つぎの はんいを れんしゅう中' : 'ひとりで 解けるか たしかめ中';
    const message = notice?.owner === profile.id && notice.subject === plan.subject && active ? notice.text : undefined;
    return <div className="learning-progress-cue" data-learning-progress="true">
        {ready && plan.cursor === 0 && <button type="button" className="learning-progress-finish-link" disabled={busy} onClick={() => {
            if (navigation) navigation.open('/learn'); else window.location.hash = '/learn';
        }}>しあげに ちょうせんできるよ！ <span aria-hidden="true">→</span></button>}
        <span className="learning-progress-cue-label" title={`${title} · ${status}`}>{title} · {status}</span>
        <span className="learning-progress-cue-notice" role="status" aria-live="polite">{message}</span>
    </div>;
}
