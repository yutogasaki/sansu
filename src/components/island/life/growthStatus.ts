import { growthStage, LIFE_RULES, type LifeItem } from '../../../domain/islandLife/model';

export const FLOWER_GROWTH_LABELS = ['めが でた', 'つぼみ', 'さいた'] as const;

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
export function lifeGrowthStatus(item: Pick<LifeItem, 'kind' | 'growth' | 'cell'>): LifeGrowthStatus {
    const stage = growthStage(item) as FlowerGrowthStage;
    if (item.kind !== 'flower') return { stage, label: 'おいてある', progress: 1 };

    const growth = Number.isFinite(item.growth) ? Math.max(0, item.growth) : 0;
    const nextLabel = stage === 0 ? FLOWER_GROWTH_LABELS[1] : stage === 1 ? FLOWER_GROWTH_LABELS[2] : undefined;
    const threshold = stage === 0 ? LIFE_RULES.budHours : LIFE_RULES.bloomHours;
    return {
        stage,
        label: FLOWER_GROWTH_LABELS[stage],
        nextLabel,
        remainingHours: nextLabel && item.cell ? Math.max(1, Math.ceil(threshold - growth)) : undefined,
        progress: Math.min(1, growth / LIFE_RULES.bloomHours),
    };
}
