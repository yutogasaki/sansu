import type { IslandEvent, IslandPlan } from '../../domain/island/types';
import { islandFeedbackForReceipt } from './learningFeedback';

/** Display the committed boundary once; a partial answer or old receipt cannot
 * become a new earning animation merely because its plan later completed. */
export function islandStarReceipt(before: Pick<IslandPlan, 'id' | 'cursor' | 'revision' | 'status'>,
    after: Pick<IslandPlan, 'id' | 'cursor' | 'revision' | 'status'>,
    event: Pick<IslandEvent, 'id' | 'planId' | 'slotIndex' | 'type' | 'result'>, lastReceiptId?: string) {
    if (before.status !== 'active' || after.status !== 'completed' || after.revision !== before.revision + 1
        || event.id === lastReceiptId || after.cursor !== before.cursor + 1) return;
    return islandFeedbackForReceipt(before, after, event)?.reaction?.kind === 'correct' ? event.id : undefined;
}
