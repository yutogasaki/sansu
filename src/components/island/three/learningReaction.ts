export type LearningReactionKind = 'correct' | 'retry' | 'support';
export type LearningReactionPhase = 'travel' | 'contact' | 'settled';
export type LearningBeat = 'step' | 'halfway' | 'complete';
export interface LearningProgress { sectionId: string; completed: number; total: number }

export const LIGHT_TRAVEL_MS = 350;
export const RESIDENT_REPLY_MS = 550;

export function normalizedLearningProgress(progress?: LearningProgress): LearningProgress | undefined {
    if (!progress) return undefined;
    const total = Math.max(1, Math.min(6, Math.round(progress.total)));
    return { sectionId: progress.sectionId, total, completed: Math.max(0, Math.min(total, Math.floor(progress.completed))) };
}

export function learningBeat(progress?: LearningProgress, previous?: LearningProgress): LearningBeat {
    if (!progress) return 'step';
    const prior = previous?.sectionId === progress.sectionId ? previous.completed : 0;
    if (progress.completed >= progress.total && prior < progress.total) return 'complete';
    const halfway = Math.ceil(progress.total / 2);
    return progress.completed >= halfway && prior < halfway ? 'halfway' : 'step';
}

/** A pending light belongs to one saved section; a later scene must never inherit it. */
export function reconcileLearningProgress(displayed: LearningProgress | undefined, pending: LearningProgress | undefined,
    incoming: LearningProgress | undefined, freshKind?: LearningReactionKind) {
    const sameSection = incoming && displayed && incoming.sectionId === displayed.sectionId && incoming.total === displayed.total;
    if (!sameSection) return { displayed: incoming, pending: undefined };
    if (freshKind === 'correct' && incoming.completed > displayed.completed) return { displayed, pending: incoming };
    // A newer receipt may interrupt the animation, but cannot erase already saved progress.
    if (freshKind) return { displayed: incoming, pending: undefined };
    if (pending && pending.sectionId === incoming.sectionId && incoming.completed >= pending.completed) return { displayed, pending: incoming };
    return { displayed: incoming, pending: undefined };
}

/** The scene samples its own independent clock. No input or persistence waits on this. */
export function sampleLearningReaction(kind: LearningReactionKind, elapsed: number, reduced: boolean, beat: LearningBeat = 'step') {
    const travel = kind === 'correct' ? LIGHT_TRAVEL_MS : 0;
    const duration = travel + RESIDENT_REPLY_MS;
    const phase: LearningReactionPhase = reduced || elapsed >= duration ? 'settled' : elapsed < travel ? 'travel' : 'contact';
    const reply = reduced ? 1 : Math.max(0, Math.min(1, (elapsed - travel) / RESIDENT_REPLY_MS));
    const strength = beat === 'complete' ? 1.3 : beat === 'halfway' ? 1.15 : 1;
    const envelope = phase === 'contact' ? Math.sin(reply * Math.PI) : 0;
    return {
        phase, duration, arrived: reduced || elapsed >= travel,
        travel: reduced ? 1 : Math.max(0, Math.min(1, elapsed / LIGHT_TRAVEL_MS)),
        paw: kind === 'correct' ? (reduced ? .48 : envelope * strength) : 0,
        look: reduced ? .34 : kind === 'correct' ? envelope : Math.sin(reply * Math.PI),
        earnedLight: kind === 'correct',
        moving: !reduced && elapsed < duration,
    };
}
