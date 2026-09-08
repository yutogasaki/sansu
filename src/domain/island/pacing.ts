import type { IslandHabitatId, IslandPlan, IslandRecord } from './types';

/** Whole problems per growth mark; visible stages remain at marks 1, 3 and 6. */
export const ISLAND_GROWTH_ANSWER_COSTS = [3, 6, 9, 12, 15, 18] as const;
export const LEGACY_ISLAND_STARS_PER_SET = 10;

/** Frozen reservations, including the absent legacy field, own their reward contract. */
export function islandPlanStars(plan: Pick<IslandPlan, 'rewardPacing' | 'slots'>) {
    return plan.rewardPacing === 'answers-v1' ? plan.slots.length : LEGACY_ISLAND_STARS_PER_SET;
}

export function islandGrowthStep(island: Pick<IslandRecord, 'growth'>, habitat: IslandHabitatId) {
    const progress = island.growth?.progress[habitat] ?? 0;
    const pending = island.growth?.pendingAnswers?.[habitat] ?? 0;
    const required = ISLAND_GROWTH_ANSWER_COSTS[progress] ?? 0;
    return { progress, pending, required, remaining: Math.max(0, required - pending),
        value: progress + (required ? pending / required : 0) };
}

/** No time, accuracy, streak or assistance multipliers; never transfers a frozen target. */
export function advanceIslandGrowth(progress: number, pending: number, answers?: number) {
    if (answers === undefined) return { progress: Math.min(6, progress + 1), pending: progress >= 5 ? 0 : pending };
    if (!Number.isSafeInteger(answers) || answers < 1 || answers > 6) throw new Error('Invalid island completion size');
    let remainder = pending + answers, next = progress;
    while (next < 6 && remainder >= ISLAND_GROWTH_ANSWER_COSTS[next]) {
        remainder -= ISLAND_GROWTH_ANSWER_COSTS[next];
        next += 1;
    }
    return { progress: next, pending: next === 6 ? 0 : remainder };
}
