import type { IslandEvent, IslandPlan } from '../../domain/island/types';

export type IslandReaction = { id: string; kind: 'correct' | 'retry' | 'support' };
export interface IslandLearningFeedback {
    id: string;
    kind: 'correct' | 'retry' | 'support' | 'step';
    text: string;
}

/** A correct Hissan row is saved work, but only the completed problem earns world light. */
export function islandFeedbackForReceipt(before: Pick<IslandPlan, 'id' | 'cursor'>, after: Pick<IslandPlan, 'id' | 'cursor'>,
    event: Pick<IslandEvent, 'id' | 'planId' | 'slotIndex' | 'type' | 'result'>): {
    feedback: IslandLearningFeedback;
    reaction?: IslandReaction;
} | undefined {
    if (event.planId !== before.id || after.id !== before.id || event.slotIndex !== before.cursor) return;
    if (event.type === 'support_opened' || event.type === 'skipped') {
        return { feedback: { id: event.id, kind: 'support', text: 'いっしょに たしかめよう' }, reaction: { id: event.id, kind: 'support' } };
    }
    if (event.result === 'incorrect' || event.result === 'assisted-incorrect') {
        return { feedback: { id: event.id, kind: 'retry', text: 'もういちど みてみよう' }, reaction: { id: event.id, kind: 'retry' } };
    }
    if (event.result === 'correct' || event.result === 'assisted-correct') {
        if (after.cursor === before.cursor + 1) {
            return { feedback: { id: event.id, kind: 'correct', text: 'しまに ひかりが もどったよ' }, reaction: { id: event.id, kind: 'correct' } };
        }
        if (after.cursor === before.cursor) {
            return { feedback: { id: event.id, kind: 'step', text: 'ひとだん できたよ。つぎへ すすもう' } };
        }
    }
}
