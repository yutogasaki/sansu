import { growthStage, plantThresholds, type LifeItem } from '../../../domain/islandLife/model';
import { FLOWER_GROWTH_LABELS, TREE_GROWTH_LABELS, type FlowerGrowthStage } from './growthStatus';

export interface GrowthTransition {
    id: string;
    stage: FlowerGrowthStage;
    message: string;
}

export function growthSnapshot(items: readonly LifeItem[]): Record<string, FlowerGrowthStage> {
    return Object.fromEntries(items.filter(item => Boolean(plantThresholds(item.kind))).map(item => [item.id, growthStage(item) as FlowerGrowthStage]));
}

/** Return only genuine flower-stage advances after a previously observed state. */
export function growthTransitions(items: readonly LifeItem[], previous: Readonly<Record<string, number>> | undefined): GrowthTransition[] {
    if (!previous) return [];
    return items.filter(item => Boolean(plantThresholds(item.kind)) && item.cell).flatMap(item => {
        const from = previous[item.id], stage = growthStage(item) as FlowerGrowthStage;
        if (!Number.isInteger(from) || stage <= from) return [];
        const labels = item.kind === 'sapling' ? TREE_GROWTH_LABELS : FLOWER_GROWTH_LABELS;
        const message = item.kind === 'sapling' ? `${labels[stage]}に なったよ` : stage === 2 ? `${labels[stage]}よ` : `${labels[stage]}に なったよ`;
        return [{ id: item.id, stage, message }];
    });
}
