import type { IslandRecord } from './types';

export type IslandThemeId = 'moon-garden' | 'starry' | 'candy' | 'crystal';
export type IslandAccentId = 'star-lanterns' | 'candy-flags' | 'crystal-charms';
export type IslandCustomizationItemId = IslandThemeId | IslandAccentId;
export interface IslandCosmetics { themeId: IslandThemeId; accentId: IslandAccentId | null }
export interface IslandCustomizationState extends IslandCosmetics {
    version: 1;
    points: number;
    ownedItemIds: IslandCustomizationItemId[];
    desiredItemId: IslandCustomizationItemId | null;
}
export type IslandCustomizationAction =
    | { type: 'purchase' | 'equip' | 'desire'; itemId: IslandCustomizationItemId }
    | { type: 'clear-accent' }
    | { type: 'clear-desire' };
export interface IslandCustomizationItem {
    id: IslandCustomizationItemId;
    kind: 'theme' | 'accent';
    name: string;
    price: number;
    themeId: IslandThemeId;
}
export const CUSTOMIZATION_CATALOG: readonly IslandCustomizationItem[] = [
    { id: 'moon-garden', kind: 'theme', name: 'いつもの しま', price: 0, themeId: 'moon-garden' },
    { id: 'starry', kind: 'theme', name: 'ほしぞらの しま', price: 30, themeId: 'starry' },
    { id: 'candy', kind: 'theme', name: 'おかしの もり', price: 50, themeId: 'candy' },
    { id: 'crystal', kind: 'theme', name: 'すいしょうの みずべ', price: 70, themeId: 'crystal' },
    { id: 'star-lanterns', kind: 'accent', name: 'ほしの あかり', price: 10, themeId: 'starry' },
    { id: 'candy-flags', kind: 'accent', name: 'キャンディの かざり', price: 10, themeId: 'candy' },
    { id: 'crystal-charms', kind: 'accent', name: 'すいしょうの かざり', price: 10, themeId: 'crystal' },
];
export const ISLAND_STARS_PER_SET = 10;
export const DEFAULT_ISLAND_COSMETICS: Readonly<IslandCosmetics> = { themeId: 'moon-garden', accentId: null };

export function isIslandCustomizationItemId(value: unknown): value is IslandCustomizationItemId {
    return CUSTOMIZATION_CATALOG.some(item => item.id === value);
}
export function hasValidIslandCosmetics(value: unknown): value is IslandCosmetics {
    if (!value || typeof value !== 'object') return false;
    const cosmetics = value as IslandCosmetics;
    return CUSTOMIZATION_CATALOG.some(item => item.kind === 'theme' && item.id === cosmetics.themeId)
        && (cosmetics.accentId === null || CUSTOMIZATION_CATALOG.some(item => item.kind === 'accent' && item.id === cosmetics.accentId));
}
export function hasValidIslandCustomization(island: Pick<IslandRecord, 'customization' | 'completedSets'>) {
    const state = island.customization;
    if (state === undefined) return Number.isSafeInteger(island.completedSets) && island.completedSets >= 0
        && Number.isSafeInteger(island.completedSets * ISLAND_STARS_PER_SET);
    return Boolean(state && state.version === 1 && Number.isSafeInteger(state.points) && state.points >= 0
        && hasValidIslandCosmetics(state) && Array.isArray(state.ownedItemIds)
        && state.ownedItemIds.every(isIslandCustomizationItemId)
        && new Set(state.ownedItemIds).size === state.ownedItemIds.length
        && state.ownedItemIds.includes('moon-garden') && state.ownedItemIds.includes(state.themeId)
        && (state.accentId === null || state.ownedItemIds.includes(state.accentId))
        && (state.desiredItemId === null || isIslandCustomizationItemId(state.desiredItemId) && !state.ownedItemIds.includes(state.desiredItemId)));
}

/** The only legacy credit rule. Reads are virtual; the first mutation persists this state. */
export function getIslandCustomization(island: Pick<IslandRecord, 'customization' | 'completedSets'>): IslandCustomizationState {
    if (!hasValidIslandCustomization(island)) throw new Error('Invalid island customization');
    if (island.customization !== undefined) return { ...island.customization, ownedItemIds: [...island.customization.ownedItemIds] };
    return { version: 1, ...DEFAULT_ISLAND_COSMETICS, points: island.completedSets * ISLAND_STARS_PER_SET,
        ownedItemIds: ['moon-garden'], desiredItemId: null };
}
export function getIslandCosmetics(island: Pick<IslandRecord, 'customization'>): IslandCosmetics {
    if (island.customization === undefined) return { ...DEFAULT_ISLAND_COSMETICS };
    if (!hasValidIslandCosmetics(island.customization)) throw new Error('Invalid island cosmetics');
    return { themeId: island.customization.themeId, accentId: island.customization.accentId };
}

/** Call with the committed count BEFORE adding this section; no growth transform may grant stars. */
export function earnIslandCustomizationStars(island: IslandRecord): IslandCustomizationState {
    const state = getIslandCustomization(island);
    const points = state.points + ISLAND_STARS_PER_SET;
    if (!Number.isSafeInteger(points)) throw new Error('Island stars exceed safe balance');
    return { ...state, points };
}
