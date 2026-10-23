import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LearningGuidanceHost, LearningSupportHost } from '../domain/learningGuidanceHost';
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
import './IslandLearningHeader.css';
import { usePokomokoFeedback } from './usePokomokoFeedback';
import { PokomokoFullscreenCelebration } from './PokomokoFullscreenCelebration';
import { PokomokoInputSpark } from './PokomokoLearningEffects';
import type { UserProfile } from '../../domain/types';
import { useLearningMusic } from './useLearningMusic';

/** Help preserves the current draft; saved answers and new slots reset it. */
export function IslandLearningPanel({ plan, active = true, intro = false, busy, hintPending = false, feedback, party = EMPTY_LEARNING_PARTY, onAction, observation, englishAutoRead = false, soundEnabled = false, subjectChoice, listeningEntry, heroStyle, companionHost }: {
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
    companionHost?: HTMLElement | null;
    listeningEntry?: ReactNode;
    subjectChoice?: { selected: boolean; onChange: (selected: boolean) => void };
}) {
    const [guidanceHost, setGuidanceHost] = useState<HTMLDivElement | null>(null);
    const headerHost = active ? companionHost?.parentElement : null;
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
    const progressView = <>
        <div className="island-learning-progress">
            <span className="island-learning-count" aria-label={`${plan.cursor + 1}もんめ、ぜんぶで${plan.slots.length}もん`}>{plan.cursor + 1}<small> / {plan.slots.length}</small></span>
        </div>
        {subjectChoice && <div className="island-learning-preference"><IslandSubjectChoice subject={plan.subject} selected={subjectChoice.selected} disabled={busy} onChange={subjectChoice.onChange} /></div>}
    </>;
    const feedbackView = <IslandAnswerFeedback feedback={feedback?.id === dismissedReceipt ? undefined : feedback} party={party} burst={celebration.burst} inputCue={celebration.inputCue} active={active} level={celebration.level} pulse={music.pulse} onCue={music.cue} heroStyle={heroStyle} companionHost={companionHost} inputRoot={section} />;
    return <LearningGuidanceHost.Provider value={headerHost ? guidanceHost : null}><LearningSupportHost.Provider value={headerHost ? guidanceHost : null}><section ref={section} hidden={!active} inert={!active || undefined} className="island-learning island-workbench" aria-label="しまへ ひかりを とどけよう"
        onPointerDownCapture={music.unlock} onKeyDownCapture={music.unlock}
        data-show-level={celebration.level} data-show-completed={celebration.completed}
        data-learning-candidate={ISLAND_LEARNING_CANDIDATE}
        data-intro={intro}
        data-island-plan-id={plan.id} data-island-plan-revision={plan.revision} data-input-ready={!busy}
        data-learning-feedback={feedback?.kind ?? 'ready'} data-learning-reaction-id={feedback?.id ?? ''}
        data-party-riding={party.rideRemaining > 0} data-party-peak={celebration.burst?.kind ?? ''}>
        {headerHost ? createPortal(<>
            {progressView}
            <div className="island-learning-guidance-slot" ref={setGuidanceHost} />
            {feedbackView}
        </>, headerHost) : <>{progressView}{feedbackView}</>}
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
    </section></LearningSupportHost.Provider></LearningGuidanceHost.Provider>;
}
