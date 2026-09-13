import { growthHoursRemaining } from '../../../domain/islandLife/economyRules';
import { growthStage, plantThresholds, type LifeItem, type LifeState } from '../../../domain/islandLife/model';

export const FLOWER_GROWTH_LABELS = ['めが でた', 'つぼみ', 'さいた'] as const;

export const TREE_GROWTH_LABELS = ['木の なえ', 'わか木', '大きな 木'] as const;

export type FlowerGrowthStage = 0 | 1 | 2;

export interface LifeGrowthStatus {
    stage: FlowerGrowthStage;
    label: string;
    nextLabel?: string;
    remainingHours?: number;
    progress: number;
}

/** Render-only growth information for the living-island pilot.
 * The thresholds stay owned by the domain model; this helper never changes
 * learning, ownership, or the saved clock.
 */
export function lifeGrowthStatus(item: Pick<LifeItem, 'kind' | 'growth' | 'cell'>, state?: Pick<LifeState, 'now' | 'economy'>): LifeGrowthStatus {
    const stage = growthStage(item) as FlowerGrowthStage;
    const thresholds = plantThresholds(item.kind);
    const labels = item.kind === 'sapling' ? TREE_GROWTH_LABELS : FLOWER_GROWTH_LABELS;
    if (!thresholds) return { stage, label: 'おいてある', progress: 1 };

    const growth = Number.isFinite(item.growth) ? Math.max(0, item.growth) : 0;
    const nextLabel = stage === 0 ? labels[1] : stage === 1 ? labels[2] : undefined;
    const threshold = stage === 0 ? thresholds[0] : thresholds[1];
    return {
        stage,
        label: labels[stage],
        nextLabel,
        remainingHours: nextLabel && item.cell ? Math.max(1, Math.ceil(state?.economy ? growthHoursRemaining(state.economy.completionTimes, state.now, Math.max(0, threshold - growth)) : threshold - growth)) : undefined,
        progress: Math.min(1, growth / thresholds[1]),
    };
}
