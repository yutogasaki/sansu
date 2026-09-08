import { CUSTOMIZATION_CATALOG, getIslandCustomization, hasValidIslandCustomization, isIslandCustomizationItemId,
    quoteIslandCustomization, reduceIslandCustomization } from './customization';
import { getIslandExpression, getIslandExpressionEligibility, ISLAND_EXPRESSION_CATALOG, isIslandExpressionItemId } from './expression';
import { getOwnedIslandFurniture, ISLAND_FURNITURE_CATALOG, isIslandOptionalFurnitureKind, quoteIslandFurniture } from './furniture';
import { clearIslandAdditionalRewardGoal, type IslandRewardGoalAction, type IslandRewardGoalTarget } from './rewardGoalTypes';
import type { IslandRecord } from './types';

export type { IslandRewardGoalAction, IslandRewardGoalState, IslandRewardGoalTarget, IslandAdditionalRewardGoalTarget } from './rewardGoalTypes';
export { sameIslandRewardGoalTarget } from './rewardGoalTypes';
export class IslandRewardGoalConflict extends Error {
    constructor(public readonly code: 'invalid-action' | 'invalid-state' | 'already-owned', message: string) {
        super(message); this.name = 'IslandRewardGoalConflict';
    }
}
type GoalIsland = Pick<IslandRecord, 'rewardGoal' | 'customization' | 'completedSets' | 'items' | 'expression'>;
type QuoteIsland = GoalIsland & Pick<IslandRecord, 'growth' | 'workshop'>;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).length === allowed.length
    && allowed.every(key => Object.prototype.hasOwnProperty.call(value, key));
const invalidAction = () => new IslandRewardGoalConflict('invalid-action', 'ほしいものを えらびなおしてね');
const invalidState = () => new IslandRewardGoalConflict('invalid-state', 'ほしいものの きろくを たしかめてね');

export function canonicalIslandRewardGoalTarget(value: unknown): IslandRewardGoalTarget {
    if (record(value)) {
        if (value.category === 'furniture' && keys(value, ['category', 'kind']) && isIslandOptionalFurnitureKind(value.kind)) {
            return { category: value.category, kind: value.kind };
        }
        if (value.category === 'expression' && keys(value, ['category', 'itemId']) && isIslandExpressionItemId(value.itemId)) {
            return { category: value.category, itemId: value.itemId };
        }
        if (value.category === 'customization' && keys(value, ['category', 'itemId']) && isIslandCustomizationItemId(value.itemId)) {
            return { category: value.category, itemId: value.itemId };
        }
    }
    throw invalidAction();
}
export function canonicalIslandRewardGoalAction(value: unknown): IslandRewardGoalAction {
    if (record(value)) {
        if (value.type === 'clear' && keys(value, ['type'])) return { type: 'clear' };
        if (value.type === 'choose' && keys(value, ['type', 'target'])) return { type: 'choose', target: canonicalIslandRewardGoalTarget(value.target) };
    }
    throw invalidAction();
}
/** Checks the combined invariant without selecting a winner or migrating data. */
export function hasValidIslandRewardGoal(island: GoalIsland): boolean {
    if (!hasValidIslandCustomization(island)) return false;
    const state = island.rewardGoal;
    if (state === undefined) return true;
    if (!record(state) || !keys(state, ['version', 'target']) || state.version !== 1
        || island.customization?.desiredItemId != null) return false;
    try {
        const target = canonicalIslandRewardGoalTarget(state.target);
        if (target.category === 'customization') return false;
        return target.category === 'furniture' ? !getOwnedIslandFurniture(island, target.kind)
            : !getIslandExpression(island).ownedItemIds.includes(target.itemId);
    } catch { return false; }
}
export function getIslandRewardGoal(island: GoalIsland): IslandRewardGoalTarget | null {
    if (!hasValidIslandRewardGoal(island)) throw invalidState();
    if (island.rewardGoal) return { ...island.rewardGoal.target };
    const itemId = island.customization?.desiredItemId;
    return itemId ? { category: 'customization', itemId } : null;
}
export type IslandRewardGoalRequirement =
    | { kind: 'discovery'; id: 'ribbon-butterfly' | 'leaf-bird'; label: string; met: boolean }
    | { kind: 'creation'; id: 'bell'; label: string; met: boolean };
export interface IslandRewardGoalQuote {
    target: IslandRewardGoalTarget;
    name: string;
    listPrice: number;
    price: number;
    points: number;
    missingStars: number;
    owned: boolean;
    requirement: IslandRewardGoalRequirement | null;
    canChoose: boolean;
    canAcquire: boolean;
}
/** The quote reads existing ownership/qualification. Eligibility never acquires
 * the item or clears a goal, and a zero price never substitutes for observation. */
export function quoteIslandRewardGoal(island: QuoteIsland, value: IslandRewardGoalTarget): IslandRewardGoalQuote {
    if (!hasValidIslandRewardGoal(island)) throw invalidState();
    const target = canonicalIslandRewardGoalTarget(value), points = getIslandCustomization(island).points;
    let name: string, listPrice: number, price: number, owned: boolean;
    let requirement: IslandRewardGoalRequirement | null = null;
    if (target.category === 'customization') {
        const item = CUSTOMIZATION_CATALOG.find(item => item.id === target.itemId)!;
        const quote = quoteIslandCustomization(island, target.itemId);
        name = item.name; ({ listPrice, price, owned } = quote);
    } else if (target.category === 'furniture') {
        const item = ISLAND_FURNITURE_CATALOG.find(item => item.kind === target.kind)!;
        const quote = quoteIslandFurniture(island, target.kind);
        name = item.name; ({ listPrice, price, owned } = quote);
    } else {
        const item = ISLAND_EXPRESSION_CATALOG.find(item => item.itemId === target.itemId)!;
        name = item.name; listPrice = item.price; owned = getIslandExpression(island).ownedItemIds.includes(item.itemId); price = owned ? 0 : item.price;
        if (item.requirement) {
            const met = getIslandExpressionEligibility(island, item.itemId).eligible;
            requirement = item.requirement === 'bell'
                ? { kind: 'creation', id: 'bell', label: 'こうさくで かいの おとを みとどける', met }
                : { kind: 'discovery', id: item.requirement,
                    label: item.requirement === 'ribbon-butterfly' ? 'リボンの ちょうを みつける' : 'はっぱの ことりを みつける', met };
        }
    }
    const missingStars = Math.max(0, price - points);
    return { target, name, listPrice, price, points, missingStars, owned, requirement,
        canChoose: !owned, canAcquire: !owned && missingStars === 0 && (requirement === null || requirement.met) };
}
export function reduceIslandRewardGoal(island: IslandRecord, action: IslandRewardGoalAction): IslandRecord {
    const intent = canonicalIslandRewardGoalAction(action);
    if (!hasValidIslandRewardGoal(island)) throw invalidState();
    if (intent.type === 'clear') {
        const updated = clearIslandAdditionalRewardGoal(island);
        return updated.customization?.desiredItemId
            ? { ...updated, customization: { ...updated.customization, desiredItemId: null } } : updated;
    }
    if (!quoteIslandRewardGoal(island, intent.target).canChoose) throw new IslandRewardGoalConflict('already-owned', 'これは もう もっているよ');
    if (intent.target.category === 'customization') return reduceIslandCustomization(island, { type: 'desire', itemId: intent.target.itemId });
    return { ...island,
        ...(island.customization?.desiredItemId ? { customization: { ...island.customization, desiredItemId: null } } : {}),
        rewardGoal: { version: 1, target: { ...intent.target } } };
}
