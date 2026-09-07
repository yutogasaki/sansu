import type { IslandLearningSlot } from './types';

/** Legacy assisted v1 slots may have seen an answer; never resume them as independent. */
export function islandSupportStage(slot: Pick<IslandLearningSlot, 'assisted' | 'supportStage'>) {
    return slot.assisted ? slot.supportStage ?? 'model' : undefined;
}

export function hasValidIslandSupportState(slot: IslandLearningSlot): boolean {
    return typeof slot.assisted === 'boolean' && (slot.supportStage === undefined
        || (slot.assisted && (slot.supportStage === 'hint' || slot.supportStage === 'model')));
}
