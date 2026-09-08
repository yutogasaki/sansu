import type { IslandCustomizationItemId } from './customization';
import type { IslandExpressionItemId } from './expression';
import type { IslandOptionalFurnitureKind, IslandRecord } from './types';

/** This leaf has no runtime catalog imports. Legacy customization goals keep
 * their original field and receipt; only the other two categories use v1. */
export type IslandAdditionalRewardGoalTarget =
    | { category: 'furniture'; kind: IslandOptionalFurnitureKind }
    | { category: 'expression'; itemId: IslandExpressionItemId };
export type IslandRewardGoalTarget = { category: 'customization'; itemId: IslandCustomizationItemId } | IslandAdditionalRewardGoalTarget;
export interface IslandRewardGoalState { version: 1; target: IslandAdditionalRewardGoalTarget }
export type IslandRewardGoalAction = { type: 'choose'; target: IslandRewardGoalTarget } | { type: 'clear' };

export function sameIslandRewardGoalTarget(left: IslandRewardGoalTarget | null, right: IslandRewardGoalTarget | null): boolean {
    if (left === null || right === null) return left === right;
    if (left.category === 'furniture') return right.category === 'furniture' && left.kind === right.kind;
    return right.category === left.category && left.itemId === right.itemId;
}
/** Called only by an explicit goal change/clear or the matching acquisition.
 * Remove the optional field rather than materializing an empty state. */
export function clearIslandAdditionalRewardGoal(island: IslandRecord, acquired?: IslandAdditionalRewardGoalTarget): IslandRecord {
    if (island.rewardGoal === undefined || acquired && !sameIslandRewardGoalTarget(island.rewardGoal.target, acquired)) return island;
    const updated = { ...island }; delete updated.rewardGoal; return updated;
}
