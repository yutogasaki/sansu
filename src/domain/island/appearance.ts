/** Acquisition parts and independently equipped surfaces are deliberately distinct. */
export const APPEARANCE_FAMILIES = ['moon-garden', 'starry', 'candy', 'crystal'] as const;
export type IslandAppearanceFamily = typeof APPEARANCE_FAMILIES[number];
export const ISLAND_APPEARANCE_PART_IDS = ['sky', 'ground', 'water', 'house', 'plants', 'bridge'] as const;
export type IslandAppearancePartId = typeof ISLAND_APPEARANCE_PART_IDS[number];
export const ISLAND_APPEARANCE_SLOT_IDS = ['sky', 'ground', 'shore', 'path', 'water', 'houseBody', 'houseRoof',
    'houseWindows', 'tree', 'flower', 'mushroom', 'bridge'] as const;
export type IslandAppearanceSlotId = typeof ISLAND_APPEARANCE_SLOT_IDS[number];
export const ISLAND_APPEARANCE_PART_SLOTS = {
    sky: ['sky'], ground: ['ground', 'shore', 'path'], water: ['water'],
    house: ['houseBody', 'houseRoof', 'houseWindows'], plants: ['tree', 'flower', 'mushroom'], bridge: ['bridge'],
} as const satisfies Record<IslandAppearancePartId, readonly IslandAppearanceSlotId[]>;
export const ISLAND_APPEARANCE_VERSIONS = ['legacy-v1', 'parts-v1'] as const;
export type IslandAppearanceVersion = typeof ISLAND_APPEARANCE_VERSIONS[number];
export type IslandAppearanceStyleId = `${IslandAppearanceVersion}:${IslandAppearanceFamily}:${IslandAppearanceSlotId}`;
export interface IslandResolvedAppearance {
    version: 1;
    slots: Record<IslandAppearanceSlotId, IslandAppearanceStyleId>;
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const member = <T extends string>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);
export const isIslandAppearancePartId = (value: unknown): value is IslandAppearancePartId => member(ISLAND_APPEARANCE_PART_IDS, value);
export const isIslandAppearanceSlotId = (value: unknown): value is IslandAppearanceSlotId => member(ISLAND_APPEARANCE_SLOT_IDS, value);

export function getIslandAppearanceStyle(value: IslandAppearanceStyleId) {
    const [version, family, slot, extra] = typeof value === 'string' ? value.split(':') : [];
    if (extra !== undefined || !member(ISLAND_APPEARANCE_VERSIONS, version) || !member(APPEARANCE_FAMILIES, family)
        || !isIslandAppearanceSlotId(slot)) throw new Error('Invalid island appearance style');
    return { version, family, slot };
}
export function getIslandAppearancePart(slot: IslandAppearanceSlotId): IslandAppearancePartId {
    if (!isIslandAppearanceSlotId(slot)) throw new Error('Invalid island appearance slot');
    return ISLAND_APPEARANCE_PART_IDS.find(part => (ISLAND_APPEARANCE_PART_SLOTS[part] as readonly string[]).includes(slot))!;
}
export function islandAppearanceStyleId(family: IslandAppearanceFamily, slot: IslandAppearanceSlotId,
    version: IslandAppearanceVersion = 'parts-v1'): IslandAppearanceStyleId {
    const id: IslandAppearanceStyleId = `${version}:${family}:${slot}`;
    getIslandAppearanceStyle(id);
    return id;
}
export function hasValidIslandAppearance(value: unknown): value is IslandResolvedAppearance {
    if (!record(value) || value.version !== 1 || Object.keys(value).some(key => !['version', 'slots'].includes(key))
        || !record(value.slots) || Object.keys(value.slots).length !== ISLAND_APPEARANCE_SLOT_IDS.length
        || Object.keys(value.slots).some(key => !isIslandAppearanceSlotId(key))) return false;
    const slots = value.slots;
    return ISLAND_APPEARANCE_SLOT_IDS.every(slot => {
        try { return getIslandAppearanceStyle(slots[slot] as IslandAppearanceStyleId).slot === slot; } catch { return false; }
    });
}
export function cloneIslandAppearance(value: IslandResolvedAppearance): IslandResolvedAppearance {
    if (!hasValidIslandAppearance(value)) throw new Error('Invalid island appearance');
    return { version: 1, slots: { ...value.slots } };
}
export function createIslandAppearance(family: IslandAppearanceFamily, version: IslandAppearanceVersion = 'parts-v1'): IslandResolvedAppearance {
    const slots = Object.fromEntries(ISLAND_APPEARANCE_SLOT_IDS.map(slot => [slot, islandAppearanceStyleId(family, slot, version)])) as
        Record<IslandAppearanceSlotId, IslandAppearanceStyleId>;
    return { version: 1, slots };
}
/** Missing old fields resolve to an explicitly versioned old picture, never new scenery. */
export function resolveIslandAppearance(cosmetics: { themeId: IslandAppearanceFamily; appearance?: IslandResolvedAppearance }): IslandResolvedAppearance {
    if (!member(APPEARANCE_FAMILIES, cosmetics.themeId)) throw new Error('Invalid island appearance family');
    return cosmetics.appearance === undefined ? createIslandAppearance(cosmetics.themeId, 'legacy-v1') : cloneIslandAppearance(cosmetics.appearance);
}
export function sameIslandAppearance(left: IslandResolvedAppearance, right: IslandResolvedAppearance) {
    if (!hasValidIslandAppearance(left) || !hasValidIslandAppearance(right)) return false;
    return ISLAND_APPEARANCE_SLOT_IDS.every(slot => left.slots[slot] === right.slots[slot]);
}
