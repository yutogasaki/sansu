import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Lightbulb, BookOpen } from 'lucide-react';
import type { IslandLearningAction, IslandPlan } from '../../domain/island/types';
import type { Style } from '../../domain/islandLife/model';
import { EMPTY_LEARNING_PARTY, type IslandLearningParty } from '../../domain/island/learningParty';
import { ISLAND_LEARNING_CANDIDATE } from '../../domain/island/feature';
import { islandSupportStage } from '../../domain/island/learningSupport';
import { IslandAnswerForm } from './IslandAnswerForm';
import { IslandAnswerFeedback } from './IslandAnswerFeedback';
import { IslandSubjectChoice } from './IslandSubjectChoice';
import type { IslandLearningFeedback } from './learningFeedback';
import { islandObservationBinding } from '../../domain/island/learningObservation';
import { readIslandLearningDOM, type IslandLearningObserver } from './useIslandLearningObservation';
import './IslandLearningPanel.css';
import './PokomokoLearningFeedback.css';
import { usePokomokoFeedback } from './usePokomokoFeedback';
import { PokomokoFullscreenCelebration } from './PokomokoFullscreenCelebration';
import { PokomokoInputSpark } from './PokomokoLearningEffects';
import type { UserProfile } from '../../domain/types';
import { LearningProgressCue } from '../progress/LearningProgressCue';
import { useLearningMusic } from './useLearningMusic';

function LightSeed({ filled, current }: { filled: boolean; current: boolean }) {
    return <span className="island-light-seed" data-filled={filled} data-current={current} aria-hidden="true">
        <svg viewBox="0 0 28 28"><path d="M14 22C3 21 4 9 14 6c10 3 11 15 0 16Z" />
            <path d="M14 19V9m0 3C9 12 8 8 9 6c5 0 7 3 5 6Zm0-2c0-5 4-7 7-6 0 4-3 7-7 6Z" /></svg>
    </span>;
}

/** Help preserves the current draft; saved answers and new slots reset it. */
export function IslandLearningPanel({ plan, profile, active = true, intro = false, busy, hintPending = false, feedback, party = EMPTY_LEARNING_PARTY, onAction, observation, englishAutoRead = false, soundEnabled = false, subjectChoice, listeningEntry, heroStyle }: {
    plan: IslandPlan;
    profile?: UserProfile;
    active?: boolean;
    intro?: boolean;
    busy: boolean;
    hintPending?: boolean;
    feedback?: IslandLearningFeedback;
    party?: IslandLearningParty;
    onAction: (action: IslandLearningAction) => void;
    observation?: IslandLearningObserver;
    englishAutoRead?: boolean;
    soundEnabled?: boolean;
    heroStyle?: Style;
    listeningEntry?: ReactNode;
    subjectChoice?: { selected: boolean; onChange: (selected: boolean) => void };
}) {
    const slot = plan.slots[plan.cursor];
    const section = useRef<HTMLElement>(null);
    const problemId = slot?.problem.id;
    const [dismissedReceipt, setDismissedReceipt] = useState<string>();
    const celebration = usePokomokoFeedback(feedback, active, section, problemId);
    const music = useLearningMusic({ active: active && plan.subject === 'math', enabled: soundEnabled && plan.subject === 'math', level: celebration.level / 3, reach: party.streak % 5 === 4 && party.rideRemaining === 0, feedback });
    useLayoutEffect(() => {
        const binding = { profileId: plan.profileId, planId: plan.id, slotIndex: plan.cursor, problemId: problemId ?? '', revisionBefore: 0 };
        return () => observation?.leave(binding);
    }, [observation, plan.profileId, plan.id, plan.cursor, problemId]);
    useLayoutEffect(() => {
        if (slot) observation?.observe(islandObservationBinding(plan), readIslandLearningDOM(section.current));
    });
    if (!slot) return null;
    const stage = islandSupportStage(slot);
    const allowHintDraft = hintPending && slot.problem.inputType === 'hissan';
    const answerReceiptId = feedback && ['correct', 'retry', 'step'].includes(feedback.kind) ? feedback.id : undefined;
    return <section ref={section} hidden={!active} inert={!active || undefined} className="island-learning island-workbench" aria-label="しまへ ひかりを とどけよう"
        onPointerDownCapture={music.unlock} onKeyDownCapture={music.unlock}
        data-show-level={celebration.level} data-show-completed={celebration.completed}
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-intro={intro}
        data-island-plan-id={plan.id} data-island-plan-revision={plan.revision} data-input-ready={!busy}
        data-learning-feedback={feedback?.kind ?? 'ready'} data-learning-reaction-id={feedback?.id ?? ''}
        data-party-riding={party.rideRemaining > 0} data-party-peak={celebration.burst?.kind ?? ''}>
        <div className="island-learning-progress">
            <div className="island-learning-label">
                <img className="island-learning-patch" src="/icons/icon-192.png" width="28" height="28" alt="" aria-hidden="true" draggable="false" />
                {subjectChoice ? <IslandSubjectChoice subject={plan.subject} selected={subjectChoice.selected} disabled={busy} onChange={subjectChoice.onChange} />
                    : <span className="island-learning-subject">{plan.subject === 'math' ? 'さんすう' : 'えいたんご'}</span>}
            </div>
            <div className="island-light-trail" aria-label={`${plan.cursor + 1}もんめ、ぜんぶで${plan.slots.length}もん`}>
                {plan.slots.map((_, index) => <LightSeed key={index} filled={index < plan.cursor} current={index === plan.cursor} />)}
            </div>
            <span className="island-learning-count">{plan.cursor + 1}<small> / {plan.slots.length}</small></span>
        </div>
        {profile && <LearningProgressCue profile={profile} plan={plan} active={active} />}
        <IslandAnswerFeedback feedback={feedback?.id === dismissedReceipt ? undefined : feedback} party={party} burst={celebration.burst} inputCue={celebration.inputCue} active={active} level={celebration.level} pulse={music.pulse} onCue={music.cue} heroStyle={heroStyle} />
        <PokomokoFullscreenCelebration burst={celebration.burst} root={section} level={celebration.level} />
        <PokomokoInputSpark cue={celebration.inputCue} root={section} />
        <IslandAnswerForm key={`${plan.id}:${plan.cursor}`} slot={slot} disabled={busy && !allowHintDraft} deferSubmission={busy && allowHintDraft} answerReceiptId={answerReceiptId}
            retryAnswer={feedback?.kind === 'retry' ? feedback.retryAnswer : undefined}
            englishAutoRead={englishAutoRead} onInteraction={() => setDismissedReceipt(feedback?.id)}
            onDigitInput={value => { celebration.onDigitInput(value); music.onInput(value); }}
            onAnswer={answer => onAction({ type: 'answer', answer })} />
        <div className="island-learning-actions">
            {listeningEntry}
            {!stage ? <>
                <button className="island-text-button" disabled={busy} onClick={() => onAction({ type: 'support_opened' })}><Lightbulb size={16} aria-hidden="true" />ヒントを みる</button>
                <button className="island-text-button" disabled={busy} onClick={() => onAction({ type: 'skipped' })}>わからない</button>
            </> : stage === 'hint'
                ? <button className="island-text-button" disabled={busy} onClick={() => onAction({ type: 'model_opened' })}><BookOpen size={16} aria-hidden="true" />おてほんを みる</button>
                : <button className="island-primary" disabled={busy} onClick={() => onAction({ type: 'supported_completed' })}>つぎへ すすむ</button>}
        </div>
    </section>;
}
