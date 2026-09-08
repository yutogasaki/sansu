export interface ReviewBudget {
    reviewLimit: number;
    suppressPlusOne: boolean;
}

/** The caller counts distinct Due items after applying eligibility and day stops.
 * This is a workload policy, not an estimate of a learner's forgetting rate. */
export function resolveReviewBudget(options: { count: number; dueCount: number }): ReviewBudget {
    const count = Number.isFinite(options.count) ? Math.max(0, Math.floor(options.count)) : 0;
    const dueCount = Number.isFinite(options.dueCount) ? Math.max(0, Math.floor(options.dueCount)) : 0;
    const backlog = count > 0 && dueCount >= count;
    const reviewLimit = count === 0 || dueCount === 0 ? 0
        : count === 1 ? 1
            : Math.min(dueCount, backlog ? Math.floor(count * 0.5) : 1);
    return {
        reviewLimit,
        suppressPlusOne: backlog || count - reviewLimit <= 1,
    };
}
