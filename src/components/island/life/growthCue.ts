import { growthStage, type LifeItem } from '../../../domain/islandLife/model';
import { FLOWER_GROWTH_LABELS, type FlowerGrowthStage } from './growthStatus';

export interface GrowthTransition {
    id: string;
    stage: FlowerGrowthStage;
    message: string;
}

export function growthSnapshot(items: readonly LifeItem[]): Record<string, FlowerGrowthStage> {
    return Object.fromEntries(items.filter(item => item.kind === 'flower').map(item => [item.id, growthStage(item) as FlowerGrowthStage]));
}

/** Return only genuine flower-stage advances after a previously observed state. */
export function growthTransitions(items: readonly LifeItem[], previous: Readonly<Record<string, number>> | undefined): GrowthTransition[] {
    if (!previous) return [];
    return items.filter(item => item.kind === 'flower' && item.cell).flatMap(item => {
        const from = previous[item.id], stage = growthStage(item) as FlowerGrowthStage;
        if (!Number.isInteger(from) || stage <= from) return [];
        const message = stage === 2 ? `${FLOWER_GROWTH_LABELS[stage]}よ` : `${FLOWER_GROWTH_LABELS[stage]}に なったよ`;
        return [{ id: item.id, stage, message }];
    });
}
