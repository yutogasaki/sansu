import type { IslandEvent, IslandPlan } from '../../domain/island/types';

export type IslandReaction = { id: string; kind: 'correct' | 'retry' | 'support' };
export interface IslandLearningFeedback {
    id: string;
    kind: 'correct' | 'retry' | 'support' | 'step' | 'supported';
    text: string;
}

/** World light follows completed questions; the receipt still distinguishes answers from modeled completion. */
export function islandFeedbackForReceipt(before: Pick<IslandPlan, 'id' | 'cursor'>, after: Pick<IslandPlan, 'id' | 'cursor'>,
    event: Pick<IslandEvent, 'id' | 'planId' | 'slotIndex' | 'type' | 'result'>): {
    feedback: IslandLearningFeedback;
    reaction?: IslandReaction;
} | undefined {
    if (event.planId !== before.id || after.id !== before.id || event.slotIndex !== before.cursor) return;
    if (event.type === 'support_opened' || event.type === 'skipped' || event.type === 'model_opened') {
        return { feedback: { id: event.id, kind: 'support', text: '' }, reaction: { id: event.id, kind: 'support' } };
    }
    if (event.type === 'supported_completed' && event.result === 'supported-completion' && after.cursor === before.cursor + 1) {
        return { feedback: { id: event.id, kind: 'supported', text: 'ひかりを とどけたよ' }, reaction: { id: event.id, kind: 'correct' } };
    }
    if (event.type !== 'answer') return;
    if (event.result === 'incorrect' || event.result === 'assisted-incorrect') {
        return { feedback: { id: event.id, kind: 'retry', text: 'もういちど' }, reaction: { id: event.id, kind: 'retry' } };
    }
    if (event.result === 'correct' || event.result === 'assisted-correct') {
        if (after.cursor === before.cursor + 1) {
            return { feedback: { id: event.id, kind: 'correct', text: 'せいかい' }, reaction: { id: event.id, kind: 'correct' } };
        }
        if (after.cursor === before.cursor) {
            return { feedback: { id: event.id, kind: 'step', text: 'このだんは せいかい' } };
        }
    }
}
