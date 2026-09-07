import { Leaf, Sprout } from 'lucide-react';
import type { IslandLearningAction, IslandPlan } from '../../domain/island/types';
import { ISLAND_LEARNING_CANDIDATE } from '../../domain/island/feature';
import { IslandAnswerForm } from './IslandAnswerForm';
import type { IslandLearningFeedback } from './learningFeedback';
import './IslandLearningPanel.css';

function LightSeed({ filled, current }: { filled: boolean; current: boolean }) {
    return <span className="island-light-seed" data-filled={filled} data-current={current} aria-hidden="true">
        <svg viewBox="0 0 28 28"><path d="M14 22C3 21 4 9 14 6c10 3 11 15 0 16Z" />
            <path d="M14 19V9m0 3C9 12 8 8 9 6c5 0 7 3 5 6Zm0-2c0-5 4-7 7-6 0 4-3 7-7 6Z" /></svg>
    </span>;
}

/** The workbench stays mounted while its answer form resets only at a saved revision. */
export function IslandLearningPanel({ plan, busy, feedback, onAction }: {
    plan: IslandPlan;
    busy: boolean;
    feedback?: IslandLearningFeedback;
    onAction: (action: IslandLearningAction) => void;
}) {
    const slot = plan.slots[plan.cursor];
    if (!slot) return null;
    return <section className="island-learning island-workbench" aria-label="しまへ ひかりを とどけよう"
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-island-plan-id={plan.id} data-island-plan-revision={plan.revision} data-input-ready={!busy}
        data-learning-feedback={feedback?.kind ?? 'ready'} data-learning-reaction-id={feedback?.id ?? ''}>
        <div className="island-learning-progress">
            <span className="island-learning-subject"><Leaf size={15} aria-hidden="true" />{plan.subject === 'math' ? 'さんすう' : 'えいたんご'}</span>
            <div className="island-light-trail" aria-label={`${plan.cursor + 1}もんめ、ぜんぶで${plan.slots.length}もん`}>
                {plan.slots.map((_, index) => <LightSeed key={index} filled={index < plan.cursor} current={index === plan.cursor} />)}
            </div>
            <span className="island-learning-count">{plan.cursor + 1}<small> / {plan.slots.length}</small></span>
        </div>
        <div className="island-workbench-message" role="status" aria-live="polite" aria-atomic="true">
            <Sprout size={16} aria-hidden="true" />
            <p>{feedback?.text ?? (slot.assisted ? 'いっしょに たしかめよう' : 'ひとつ とくと、しまに ひかり。')}</p>
        </div>
        <IslandAnswerForm key={`${plan.id}:${plan.revision}`} slot={slot} disabled={busy}
            onAnswer={answer => onAction({ type: 'answer', answer })} />
        <div className="island-learning-actions">
            {!slot.assisted ? <>
                <button className="island-text-button" disabled={busy} onClick={() => onAction({ type: 'support_opened' })}>いっしょに みる</button>
                <button className="island-text-button" disabled={busy} onClick={() => onAction({ type: 'skipped' })}>わからない</button>
            </> : <span className="island-note">あわてず、いっしょに たしかめよう</span>}
        </div>
    </section>;
}
