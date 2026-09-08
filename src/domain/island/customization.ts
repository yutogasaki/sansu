import type { IslandPlan, IslandRecord } from './types';
import { islandPlanStars, LEGACY_ISLAND_STARS_PER_SET } from './pacing';
import { clearIslandAdditionalRewardGoal } from './rewardGoalTypes';
import { APPEARANCE_FAMILIES, ISLAND_APPEARANCE_PART_IDS, ISLAND_APPEARANCE_PART_SLOTS, ISLAND_APPEARANCE_SLOT_IDS,
    cloneIslandAppearance, createIslandAppearance, getIslandAppearancePart, getIslandAppearanceStyle, hasValidIslandAppearance,
    islandAppearanceStyleId, isIslandAppearancePartId, isIslandAppearanceSlotId, resolveIslandAppearance,
    type IslandAppearanceFamily, type IslandAppearancePartId, type IslandAppearanceSlotId, type IslandResolvedAppearance } from './appearance';

export type IslandThemeId = IslandAppearanceFamily;
export type IslandPaidThemeId = Exclude<IslandThemeId, 'moon-garden'>;
export type IslandAccentId = 'star-lanterns' | 'candy-flags' | 'crystal-charms';
export type IslandAppearanceItemId = `${IslandPaidThemeId}-${IslandAppearancePartId}`;
export type IslandCompleteSetId = `${IslandPaidThemeId}-complete`;
export type IslandCustomizationItemId = IslandThemeId | IslandAccentId | IslandAppearanceItemId | IslandCompleteSetId;
export interface IslandCosmetics { themeId: IslandThemeId; accentId: IslandAccentId | null; appearance?: IslandResolvedAppearance }
export interface IslandCustomizationState extends IslandCosmetics {
    version: 1;
    points: number;
    /** Raw historical grants. Bundle/part equivalence is resolved, never bulk-written on reads. */
    ownedItemIds: IslandCustomizationItemId[];
    desiredItemId: IslandCustomizationItemId | null;
}
export type IslandCustomizationAction =
    | { type: 'purchase' | 'equip'; itemId: IslandCustomizationItemId; slot?: IslandAppearanceSlotId }
    | { type: 'desire'; itemId: IslandCustomizationItemId }
    | { type: 'restore-part'; partId: IslandAppearancePartId; slot?: IslandAppearanceSlotId }
    | { type: 'clear-accent' }
    | { type: 'clear-desire' };
export interface IslandCustomizationItem {
    id: IslandCustomizationItemId;
    kind: 'theme' | 'accent' | 'part' | 'set';
    name: string;
    price: number;
    themeId: IslandThemeId;
    partId?: IslandAppearancePartId;
}
export const ISLAND_CUSTOMIZATION_FAMILIES = ['starry', 'candy', 'crystal'] as const;
export const ISLAND_THEME_ACCENTS = { starry: 'star-lanterns', candy: 'candy-flags', crystal: 'crystal-charms' } as const;
export const ISLAND_APPEARANCE_PART_PRICES = {
    starry: { sky: 10, ground: 10, water: 10, house: 15, plants: 10, bridge: 5 },
    candy: { sky: 15, ground: 15, water: 15, house: 25, plants: 20, bridge: 10 },
    crystal: { sky: 25, ground: 20, water: 25, house: 35, plants: 30, bridge: 15 },
} as const;
const partNames = { sky: 'そら', ground: 'じめんと みち', water: 'みず', house: 'おうち', plants: 'しょくぶつ', bridge: 'はし' };
const familyNames = { starry: 'ほしぞら', candy: 'おかし', crystal: 'すいしょう' };
export const CUSTOMIZATION_CATALOG: readonly IslandCustomizationItem[] = [
    { id: 'moon-garden', kind: 'theme', name: 'いつもの しま', price: 0, themeId: 'moon-garden' },
    { id: 'starry', kind: 'theme', name: 'ほしぞらの しま', price: 60, themeId: 'starry' },
    { id: 'candy', kind: 'theme', name: 'おかしの もり', price: 100, themeId: 'candy' },
    { id: 'crystal', kind: 'theme', name: 'すいしょうの みずべ', price: 150, themeId: 'crystal' },
    { id: 'star-lanterns', kind: 'accent', name: 'ほしの あかり', price: 15, themeId: 'starry' },
    { id: 'candy-flags', kind: 'accent', name: 'キャンディの かざり', price: 20, themeId: 'candy' },
    { id: 'crystal-charms', kind: 'accent', name: 'すいしょうの かざり', price: 25, themeId: 'crystal' },
    ...ISLAND_CUSTOMIZATION_FAMILIES.flatMap(themeId => ISLAND_APPEARANCE_PART_IDS.map(partId => ({
        id: `${themeId}-${partId}` as IslandAppearanceItemId, kind: 'part' as const, partId, themeId,
        name: `${familyNames[themeId]}の ${partNames[partId]}`, price: ISLAND_APPEARANCE_PART_PRICES[themeId][partId],
    }))),
    ...ISLAND_CUSTOMIZATION_FAMILIES.map((themeId, index) => ({ id: `${themeId}-complete` as IslandCompleteSetId,
        kind: 'set' as const, themeId, name: `${familyNames[themeId]}の ぜんぶセット`, price: [75, 120, 175][index] })),
];
export const DEFAULT_ISLAND_COSMETICS: Readonly<IslandCosmetics> = { themeId: 'moon-garden', accentId: null };
export class IslandCustomizationConflict extends Error {
    constructor(public readonly code: 'invalid-action' | 'unowned' | 'insufficient' | 'already-owned', message: string) {
        super(message); this.name = 'IslandCustomizationConflict';
    }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const definition = (id: IslandCustomizationItemId) => CUSTOMIZATION_CATALOG.find(item => item.id === id)!;
export function isIslandCustomizationItemId(value: unknown): value is IslandCustomizationItemId {
    return CUSTOMIZATION_CATALOG.some(item => item.id === value);
}
function validCosmeticFields(value: Record<string, unknown>) {
    return APPEARANCE_FAMILIES.some(family => family === value.themeId)
        && (value.accentId === null || Object.values(ISLAND_THEME_ACCENTS).some(id => id === value.accentId))
        && (value.appearance === undefined || hasValidIslandAppearance(value.appearance));
}
export function hasValidIslandCosmetics(value: unknown): value is IslandCosmetics {
    return record(value) && keys(value, ['themeId', 'accentId', 'appearance']) && validCosmeticFields(value);
}
function components(itemId: IslandCustomizationItemId): IslandCustomizationItemId[] {
    const item = definition(itemId);
    if (item.kind === 'part' || item.kind === 'accent' || itemId === 'moon-garden') return [itemId];
    const family = item.themeId as IslandPaidThemeId;
    return [...ISLAND_APPEARANCE_PART_IDS.map(part => `${family}-${part}` as IslandAppearanceItemId),
        ...(item.kind === 'set' ? [ISLAND_THEME_ACCENTS[family]] : [])];
}
/** Bundle ids are historical grants, not a second chargeable component. */
function ownsComponent(owned: readonly IslandCustomizationItemId[], id: IslandCustomizationItemId) {
    if (owned.includes(id)) return true;
    const item = definition(id);
    if (item.themeId === 'moon-garden') return false;
    return owned.includes(`${item.themeId}-complete`)
        || item.kind === 'part' && owned.includes(item.themeId);
}
function ownsItem(owned: readonly IslandCustomizationItemId[], id: IslandCustomizationItemId) {
    return components(id).every(component => ownsComponent(owned, component));
}
export function ownsIslandCosmetics(owned: readonly IslandCustomizationItemId[], cosmetics: IslandCosmetics) {
    if (!hasValidIslandCosmetics(cosmetics) || !ownsItem(owned, cosmetics.themeId)
        || cosmetics.accentId !== null && !ownsItem(owned, cosmetics.accentId)) return false;
    return !cosmetics.appearance || ISLAND_APPEARANCE_SLOT_IDS.every(slot => {
        const style = getIslandAppearanceStyle(cosmetics.appearance!.slots[slot]);
        return style.family === 'moon-garden' || ownsItem(owned, `${style.family}-${getIslandAppearancePart(slot)}`);
    });
}
export function hasValidIslandCustomization(island: Pick<IslandRecord, 'customization' | 'completedSets'>) {
    const state = island.customization;
    if (state === undefined) return Number.isSafeInteger(island.completedSets) && island.completedSets >= 0
        && Number.isSafeInteger(island.completedSets * LEGACY_ISLAND_STARS_PER_SET);
    if (!record(state) || !keys(state, ['version', 'points', 'ownedItemIds', 'desiredItemId', 'themeId', 'accentId', 'appearance'])
        || state.version !== 1 || !Number.isSafeInteger(state.points) || state.points < 0 || !validCosmeticFields(state)
        || !Array.isArray(state.ownedItemIds) || !Array.from(state.ownedItemIds).every(isIslandCustomizationItemId)
        || new Set(state.ownedItemIds).size !== state.ownedItemIds.length || !state.ownedItemIds.includes('moon-garden')) return false;
    const cosmetics = { themeId: state.themeId, accentId: state.accentId, ...(state.appearance ? { appearance: state.appearance } : {}) };
    return ownsIslandCosmetics(state.ownedItemIds, cosmetics) && (state.desiredItemId === null
        || isIslandCustomizationItemId(state.desiredItemId) && !ownsItem(state.ownedItemIds, state.desiredItemId));
}
export function cloneIslandCosmetics(cosmetics: IslandCosmetics): IslandCosmetics {
    if (!hasValidIslandCosmetics(cosmetics)) throw new Error('Invalid island cosmetics');
    return { themeId: cosmetics.themeId, accentId: cosmetics.accentId,
        ...(cosmetics.appearance ? { appearance: cloneIslandAppearance(cosmetics.appearance) } : {}) };
}
/** The only legacy credit rule. Reads keep raw grants and absent appearance absent. */
export function getIslandCustomization(island: Pick<IslandRecord, 'customization' | 'completedSets'>): IslandCustomizationState {
    if (!hasValidIslandCustomization(island)) throw new Error('Invalid island customization');
    if (island.customization !== undefined) return { ...island.customization, ...cloneIslandCosmetics({ themeId: island.customization.themeId,
        accentId: island.customization.accentId, ...(island.customization.appearance ? { appearance: island.customization.appearance } : {}) }),
        ownedItemIds: [...island.customization.ownedItemIds] };
    return { version: 1, ...DEFAULT_ISLAND_COSMETICS, points: island.completedSets * LEGACY_ISLAND_STARS_PER_SET,
        ownedItemIds: ['moon-garden'], desiredItemId: null };
}
export function getIslandCosmetics(island: Pick<IslandRecord, 'customization'>): IslandCosmetics {
    if (island.customization === undefined) return { ...DEFAULT_ISLAND_COSMETICS };
    const state = island.customization;
    if (!record(state) || !validCosmeticFields(state)) throw new Error('Invalid island cosmetics');
    return cloneIslandCosmetics({ themeId: state.themeId, accentId: state.accentId,
        ...(state.appearance ? { appearance: state.appearance } : {}) });
}
/** New history freezes all resolved ids, including the legacy visual revision. */
export function captureIslandCosmetics(island: Pick<IslandRecord, 'customization'>): IslandCosmetics {
    const cosmetics = getIslandCosmetics(island);
    return { ...cosmetics, appearance: resolveIslandAppearance(cosmetics) };
}
export function getIslandCustomizationEntitlements(island: Pick<IslandRecord, 'customization' | 'completedSets'>) {
    const { ownedItemIds } = getIslandCustomization(island);
    return CUSTOMIZATION_CATALOG.filter(item => ownsItem(ownedItemIds, item.id)).map(item => item.id);
}
export function hasIslandCustomizationItem(island: Pick<IslandRecord, 'customization' | 'completedSets'>, itemId: IslandCustomizationItemId) {
    return isIslandCustomizationItemId(itemId) && ownsItem(getIslandCustomization(island).ownedItemIds, itemId);
}
export interface IslandCustomizationQuote {
    itemId: IslandCustomizationItemId; listPrice: number; price: number; owned: boolean; missingItemIds: IslandCustomizationItemId[];
}
export function quoteIslandCustomization(island: Pick<IslandRecord, 'customization' | 'completedSets'>,
    itemId: IslandCustomizationItemId): IslandCustomizationQuote {
    if (!isIslandCustomizationItemId(itemId)) throw new IslandCustomizationConflict('invalid-action', 'Unknown island customization');
    const owned = getIslandCustomization(island).ownedItemIds;
    const missingItemIds = components(itemId).filter(id => !ownsComponent(owned, id));
    return { itemId, listPrice: definition(itemId).price, price: missingItemIds.reduce((sum, id) => sum + definition(id).price, 0),
        owned: missingItemIds.length === 0, missingItemIds };
}
export function canonicalIslandCustomizationAction(action: IslandCustomizationAction): IslandCustomizationAction {
    if (record(action)) {
        if ((action.type === 'clear-accent' || action.type === 'clear-desire') && keys(action, ['type'])) return { type: action.type };
        if (action.type === 'restore-part' && keys(action, ['type', 'partId', 'slot']) && isIslandAppearancePartId(action.partId)
            && (action.slot === undefined || isIslandAppearanceSlotId(action.slot) && getIslandAppearancePart(action.slot) === action.partId)) {
            return { type: action.type, partId: action.partId, ...(action.slot !== undefined ? { slot: action.slot } : {}) };
        }
        if ((action.type === 'purchase' || action.type === 'equip' || action.type === 'desire') && isIslandCustomizationItemId(action.itemId)
            && keys(action, action.type === 'desire' ? ['type', 'itemId'] : ['type', 'itemId', 'slot'])) {
            if (action.type === 'desire') return { type: action.type, itemId: action.itemId };
            const item = definition(action.itemId);
            if (action.slot === undefined || item.kind === 'part' && isIslandAppearanceSlotId(action.slot)
                && getIslandAppearancePart(action.slot) === item.partId) {
                // In particular, old actions retain exactly the same receipt payload.
                return { type: action.type, itemId: action.itemId, ...(action.slot !== undefined ? { slot: action.slot } : {}) };
            }
        }
    }
    throw new IslandCustomizationConflict('invalid-action', 'Unknown island customization');
}
/** Shared by previews and saved edits. Only the explicit target, never other trial slots, is applied. */
export function previewIslandCustomization(current: IslandCosmetics, action: IslandCustomizationAction): IslandCosmetics {
    const intent = canonicalIslandCustomizationAction(action), result = cloneIslandCosmetics(current);
    if (intent.type === 'desire' || intent.type === 'clear-desire') return result;
    if (intent.type === 'clear-accent') return { ...result, accentId: null };
    if (intent.type === 'restore-part') {
        const appearance = resolveIslandAppearance(current);
        const slots = intent.slot ? [intent.slot] : ISLAND_APPEARANCE_PART_SLOTS[intent.partId];
        for (const slot of slots) appearance.slots[slot] = islandAppearanceStyleId('moon-garden', slot, 'legacy-v1');
        return { ...result, appearance };
    }
    const item = definition(intent.itemId);
    if (item.kind === 'accent') return { ...result, accentId: item.id as IslandAccentId };
    if (item.kind === 'part') {
        const appearance = resolveIslandAppearance(current);
        const slots = intent.slot ? [intent.slot] : ISLAND_APPEARANCE_PART_SLOTS[item.partId!];
        for (const slot of slots) appearance.slots[slot] = islandAppearanceStyleId(item.themeId, slot);
        return { ...result, appearance };
    }
    return { ...result, themeId: item.themeId, appearance: createIslandAppearance(item.themeId, item.themeId === 'moon-garden' ? 'legacy-v1' : 'parts-v1'),
        ...(item.kind === 'set' ? { accentId: ISLAND_THEME_ACCENTS[item.themeId as IslandPaidThemeId] } : {}) };
}
export function reduceIslandCustomization(island: IslandRecord, action: IslandCustomizationAction): IslandRecord {
    const intent = canonicalIslandCustomizationAction(action), state = getIslandCustomization(island);
    if (intent.type === 'clear-desire') state.desiredItemId = null;
    else if (intent.type === 'desire') {
        if (ownsItem(state.ownedItemIds, intent.itemId)) throw new IslandCustomizationConflict('already-owned', 'Customization already owned');
        state.desiredItemId = intent.itemId;
    } else {
        if (intent.type === 'purchase' || intent.type === 'equip') {
            const quote = quoteIslandCustomization(island, intent.itemId);
            if (!quote.owned) {
                if (intent.type !== 'purchase') throw new IslandCustomizationConflict('unowned', 'Customization not owned');
                if (state.points < quote.price) throw new IslandCustomizationConflict('insufficient', 'Not enough island stars');
                state.points -= quote.price;
                state.ownedItemIds.push(intent.itemId);
            }
        }
        Object.assign(state, previewIslandCustomization(getIslandCosmetics(island), intent));
        if (state.desiredItemId && ownsItem(state.ownedItemIds, state.desiredItemId)) state.desiredItemId = null;
    }
    return { ...(intent.type === 'desire' ? clearIslandAdditionalRewardGoal(island) : island), customization: state };
}
/** Call with the committed count BEFORE adding this section; no growth transform may grant stars. */
export function earnIslandCustomizationStars(island: IslandRecord, plan: Pick<IslandPlan, 'rewardPacing' | 'slots'>): IslandCustomizationState {
    const state = getIslandCustomization(island);
    const points = state.points + islandPlanStars(plan);
    if (!Number.isSafeInteger(points)) throw new Error('Island stars exceed safe balance');
    return { ...state, points };
}
