import { getIslandCustomization } from './customization';
import { clearIslandAdditionalRewardGoal } from './rewardGoalTypes';
import { ISLAND_OPTIONAL_FURNITURE_KINDS, type IslandItem, type IslandOptionalFurnitureKind, type IslandRecord } from './types';

export type { IslandOptionalFurnitureKind } from './types';
export type IslandFurnitureAction = { type: 'acquire-furniture'; kind: IslandOptionalFurnitureKind };
export const ISLAND_FURNITURE_CATALOG = [
    { kind: 'telescope', itemId: 'optional-telescope', name: 'ぼうえんきょう', description: 'ともだちと そらを のぞく', price: 30, radius: .90 },
    { kind: 'hammock', itemId: 'optional-hammock', name: 'ハンモック', description: 'ゆれる ぬのに からだを あずけて やすむ', price: 25, radius: 1.05 },
    { kind: 'tea-table', itemId: 'optional-tea-table', name: 'おちゃの テーブル', description: 'カップを わたして いっしょに ひとやすみ', price: 40, radius: 1.20 },
] as const;
export class IslandFurnitureConflict extends Error {
    constructor(public readonly code: 'invalid-action' | 'invalid-state' | 'already-owned' | 'insufficient', message: string) {
        super(message); this.name = 'IslandFurnitureConflict';
    }
}
const invalidState = () => new IslandFurnitureConflict('invalid-state', 'どうぐの きろくを たしかめてね');
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export function isIslandOptionalFurnitureKind(value: unknown): value is IslandOptionalFurnitureKind {
    return ISLAND_OPTIONAL_FURNITURE_KINDS.some(kind => kind === value);
}
function definition(kind: IslandOptionalFurnitureKind) {
    const item = ISLAND_FURNITURE_CATALOG.find(item => item.kind === kind);
    if (!item) throw new IslandFurnitureConflict('invalid-action', 'えらびなおしてね');
    return item;
}
export function islandFurnitureItemId(kind: IslandOptionalFurnitureKind) { return definition(kind).itemId; }

/** Current ownership and historical captures use the same finite identity contract.
 * Existing basic furniture may have duplicates; only these three kinds are singletons. */
export function hasValidIslandFurnitureItems(items: unknown): boolean {
    if (!Array.isArray(items)) return false;
    const seen = new Set<IslandOptionalFurnitureKind>();
    for (const item of items) {
        if (!record(item)) return false;
        if (!isIslandOptionalFurnitureKind(item.kind)) {
            if (ISLAND_FURNITURE_CATALOG.some(entry => entry.itemId === item.id)) return false;
            continue;
        }
        if (seen.has(item.kind) || item.id !== islandFurnitureItemId(item.kind) || !finite(item.rotation)
            || Object.keys(item).some(key => !['id', 'kind', 'position', 'rotation', 'habitatId', 'growthLevel', 'appearanceLevel', 'autoPlacementBlocked'].includes(key))
            || item.habitatId !== undefined || item.growthLevel !== undefined || item.appearanceLevel !== undefined || item.autoPlacementBlocked !== undefined
            || (item.position !== undefined && (!record(item.position) || Object.keys(item.position).some(key => !['x', 'z'].includes(key))
                || !finite(item.position.x) || !finite(item.position.z)))) return false;
        seen.add(item.kind);
    }
    return true;
}
export function getOwnedIslandFurniture(island: Pick<IslandRecord, 'items'>, kind: IslandOptionalFurnitureKind): IslandItem | undefined {
    const id = islandFurnitureItemId(kind);
    if (!hasValidIslandFurnitureItems(island.items)) throw invalidState();
    const item = island.items.find(item => item.id === id);
    return item ? { ...item, ...(item.position ? { position: { ...item.position } } : {}) } : undefined;
}
export function quoteIslandFurniture(island: Pick<IslandRecord, 'items' | 'customization' | 'completedSets'>, kind: IslandOptionalFurnitureKind) {
    const item = definition(kind), owned = Boolean(getOwnedIslandFurniture(island, kind));
    let points: number;
    try { points = getIslandCustomization(island).points; } catch { throw invalidState(); }
    const price = owned ? 0 : item.price;
    return { kind, itemId: item.itemId, listPrice: item.price, price, points, missingStars: Math.max(0, price - points), owned };
}
export function canonicalIslandFurnitureAction(action: IslandFurnitureAction): IslandFurnitureAction {
    if (!record(action) || Object.keys(action).some(key => !['type', 'kind'].includes(key))
        || action.type !== 'acquire-furniture' || !isIslandOptionalFurnitureKind(action.kind)) {
        throw new IslandFurnitureConflict('invalid-action', 'えらびなおしてね');
    }
    return { type: action.type, kind: action.kind };
}
/** A purchase grants a stored object; trial poses, growth and cosmetic selections never enter this action. */
export function reduceIslandFurniture(island: IslandRecord, action: IslandFurnitureAction): IslandRecord {
    const intent = canonicalIslandFurnitureAction(action), quote = quoteIslandFurniture(island, intent.kind);
    if (quote.owned) throw new IslandFurnitureConflict('already-owned', 'この どうぐは もう もっているよ');
    if (quote.missingStars) throw new IslandFurnitureConflict('insufficient', 'ほしが たまったら むかえよう');
    const customization = getIslandCustomization(island);
    return { ...clearIslandAdditionalRewardGoal(island, { category: 'furniture', kind: intent.kind }), customization: { ...customization, points: customization.points - quote.price },
        items: [...island.items, { id: quote.itemId, kind: intent.kind, rotation: 0 }] };
}
