import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../domain/types';
import type { IslandPlan } from '../../domain/island/types';
import { learningLevelTitle, learningProgressNotice } from '../../domain/learning/progressView';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';
import { getLevelForSkill } from '../../domain/math/curriculum';
import { getWordLevel } from '../../domain/english/words';
import './LearningProgressCue.css';

/** No DB reads or write on the answer path; only committed profile changes. */
export function LearningProgressCue({ profile, plan, active }: { profile: UserProfile; plan: IslandPlan; active: boolean }) {
    const previous = useRef({ profile, active });
    const [notice, setNotice] = useState<{ text: string; owner: string; subject: string }>();
    useEffect(() => {
        const before = previous.current;
        previous.current = { profile, active };
        const subject = profile.recentAttempts?.slice(-1)[0]?.subject ?? plan.subject;
        const earned = active && before.active ? learningProgressNotice(before.profile, profile, subject) : null;
        const text = earned ? `${subject === 'math' ? 'さんすう' : 'えいたんご'}：${earned}` : null;
        if (!text) return;
        const show = setTimeout(() => setNotice({ text, owner: profile.id, subject: plan.subject }), 0);
        return () => clearTimeout(show);
    }, [profile, active, plan.subject]);
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
    const message = notice?.owner === profile.id && active ? notice.text : undefined;
    return <div className="learning-progress-cue" data-learning-progress="true">
        <span className="learning-progress-cue-label" title={`${title} · ${status}`}>{title} · {status}</span>
        <span className="learning-progress-cue-notice" role="status" aria-live="polite">{message}</span>
    </div>;
}
