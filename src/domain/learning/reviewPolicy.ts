import type { MemoryState } from '../types';
import { parseISO } from 'date-fns';

/** New independent evidence gives graduated items deadlines too; old placement
 * assumptions alone remain in the low-frequency maintenance pool. */
export const isNormalReviewEligible = (
    state: Pick<MemoryState, 'status' | 'needsRelearning' | 'lastIndependentCorrectAt'>,
): boolean => state.needsRelearning === true
    || typeof state.lastIndependentCorrectAt === 'string' && Number.isFinite(parseISO(state.lastIndependentCorrectAt).getTime())
    || (state.status !== 'retired' && state.status !== 'maintenance');

export const isReviewDue = (
    state: Pick<MemoryState, 'nextReview'>,
    now: Date = new Date(),
): boolean => {
    if (typeof state.nextReview !== 'string') return false;
    const deadline = parseISO(state.nextReview).getTime();
    return Number.isFinite(deadline) && deadline <= now.getTime();
};
