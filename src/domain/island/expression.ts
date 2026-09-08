import { getIslandCustomization } from './customization';
import { clearIslandAdditionalRewardGoal } from './rewardGoalTypes';
import { ISLAND_RESIDENT_IDS, type IslandResidentId } from './residentIdentity';
import type { IslandRecord } from './types';

export const ISLAND_EXPRESSION_OUTFIT_IDS = ['raincoat', 'star-beret'] as const;
export type IslandExpressionOutfitId = typeof ISLAND_EXPRESSION_OUTFIT_IDS[number];
export const ISLAND_EXPRESSION_PATTERN_IDS = ['river-check', 'butterfly-stitch'] as const;
export type IslandExpressionPatternId = typeof ISLAND_EXPRESSION_PATTERN_IDS[number];
export const ISLAND_EXPRESSION_TRAIL_IDS = ['leaf-trail', 'water-ring-trail'] as const;
export type IslandExpressionTrailId = typeof ISLAND_EXPRESSION_TRAIL_IDS[number];
export type IslandExpressionSoundId = 'shell-three-notes';
export type IslandExpressionCoverId = 'leaf-album-cover';
export type IslandExpressionStampId = 'butterfly-stamp';
export type IslandExpressionFlagTrimId = 'leaf-bird-flag-trim';
export type IslandExpressionItemId = IslandExpressionOutfitId | IslandExpressionPatternId | IslandExpressionTrailId
    | IslandExpressionSoundId | IslandExpressionCoverId | IslandExpressionStampId | IslandExpressionFlagTrimId;
export const ISLAND_DAY_PERIODS = ['morning', 'day', 'evening'] as const;
export type IslandDayPeriod = typeof ISLAND_DAY_PERIODS[number];
export const ISLAND_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type IslandSeason = typeof ISLAND_SEASONS[number];

export const ISLAND_EXPRESSION_CATALOG = [
    { itemId: 'raincoat', name: 'あまがっぱ', description: 'すきな こに あめの みじたく', slot: 'outfit', price: 25, requirement: null },
    { itemId: 'star-beret', name: 'ほしの ベレー', description: 'やわらかい ぼうしに ほしの しるし', slot: 'outfit', price: 20, requirement: null },
    { itemId: 'river-check', name: 'みずべチェック', description: 'みずいろの ぬのを つけよう', slot: 'pattern', price: 10, requirement: null },
    { itemId: 'butterfly-stitch', name: 'ちょうの ぬいめ', description: 'みつけた ちょうを ぬいもように', slot: 'pattern', price: 0, requirement: 'ribbon-butterfly' },
    { itemId: 'leaf-trail', name: 'はっぱの あしあと', description: 'あるいた ところに ちいさな はっぱ', slot: 'trail', price: 10, requirement: null },
    { itemId: 'water-ring-trail', name: 'みずの わ', description: 'あるいた ところに ちいさな みずの わ', slot: 'trail', price: 15, requirement: null },
    { itemId: 'shell-three-notes', name: 'かいの みっつの おと', description: 'こうさくで みつけた みっつの おと', slot: 'soundscape', price: 0, requirement: 'bell' },
    { itemId: 'leaf-album-cover', name: 'はっぱの ひょうし', description: 'しゃしんを はっぱの ひょうしに', slot: 'album-cover', price: 5, requirement: null },
    { itemId: 'butterfly-stamp', name: 'ちょうの スタンプ', description: 'しゃしんの そとに ちょうの しるし', slot: 'album-stamp', price: 0, requirement: 'ribbon-butterfly' },
    { itemId: 'leaf-bird-flag-trim', name: 'ことりの はたかざり', description: 'はたの ふちに はっぱの ことり', slot: 'flag-trim', price: 0, requirement: 'leaf-bird' },
] as const;
export type IslandExpressionCatalogItem = typeof ISLAND_EXPRESSION_CATALOG[number];
export type IslandExpressionSlot = IslandExpressionCatalogItem['slot'];
export type IslandExpressionRequirement = NonNullable<IslandExpressionCatalogItem['requirement']>;

export interface IslandExpressionSelection {
    version: 1;
    residents: Record<IslandResidentId, {
        outfit: IslandExpressionOutfitId | null;
        pattern: IslandExpressionPatternId | null;
        trail: IslandExpressionTrailId | null;
    }>;
    soundscape: IslandExpressionSoundId | null;
    environment: { period: IslandDayPeriod | null; season: IslandSeason | null };
    album: { cover: IslandExpressionCoverId | null; stamp: IslandExpressionStampId | null };
    flagTrim: IslandExpressionFlagTrimId | null;
}
export interface IslandExpressionState {
    version: 1;
    ownedItemIds: IslandExpressionItemId[];
    selection: IslandExpressionSelection;
}
export type IslandExpressionEquipAction =
    | { type: 'equip-outfit'; residentId: IslandResidentId; itemId: IslandExpressionOutfitId | null }
    | { type: 'equip-pattern'; residentId: IslandResidentId; itemId: IslandExpressionPatternId | null }
    | { type: 'equip-trail'; residentId: IslandResidentId; itemId: IslandExpressionTrailId | null }
    | { type: 'equip-soundscape'; itemId: IslandExpressionSoundId | null }
    | { type: 'equip-album-cover'; itemId: IslandExpressionCoverId | null }
    | { type: 'equip-album-stamp'; itemId: IslandExpressionStampId | null }
    | { type: 'equip-flag-trim'; itemId: IslandExpressionFlagTrimId | null }
    | { type: 'period'; period: IslandDayPeriod | null }
    | { type: 'season'; season: IslandSeason | null };
export type IslandExpressionAction = IslandExpressionEquipAction | { type: 'acquire'; itemId: IslandExpressionItemId };
export interface IslandExpressionPreview { action: IslandExpressionEquipAction; selection: IslandExpressionSelection }
export type IslandExpressionConflictCode = 'invalid-state' | 'unknown-action' | 'not-owned' | 'not-eligible' | 'insufficient-stars' | 'already-owned';
export class IslandExpressionConflict extends Error {
    constructor(public readonly code: IslandExpressionConflictCode, message: string) { super(message); this.name = 'IslandExpressionConflict'; }
}
const invalidState = () => new IslandExpressionConflict('invalid-state', 'みじたくの きろくを たしかめてね');
const unknownAction = () => new IslandExpressionConflict('unknown-action', 'えらびなおしてね');
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).length === allowed.length
    && allowed.every(key => Object.prototype.hasOwnProperty.call(value, key));
const member = <T extends string>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);
const nullable = <T extends string>(values: readonly T[], value: unknown): value is T | null => value === null || member(values, value);
export function isIslandExpressionItemId(value: unknown): value is IslandExpressionItemId {
    return ISLAND_EXPRESSION_CATALOG.some(item => item.itemId === value);
}
function definition(itemId: IslandExpressionItemId): IslandExpressionCatalogItem {
    const item = ISLAND_EXPRESSION_CATALOG.find(item => item.itemId === itemId);
    if (!item) throw unknownAction();
    return item;
}
export function createIslandExpressionSelection(): IslandExpressionSelection {
    return { version: 1, residents: {
        otter: { outfit: null, pattern: null, trail: null }, rabbit: { outfit: null, pattern: null, trail: null }, fox: { outfit: null, pattern: null, trail: null },
    }, soundscape: null, environment: { period: null, season: null }, album: { cover: null, stamp: null }, flagTrim: null };
}
/** Selection validation is independent of ownership, so historical captures and unowned trials can share it. */
export function hasValidIslandExpressionSelection(value: unknown): value is IslandExpressionSelection {
    if (!record(value) || !keys(value, ['version', 'residents', 'soundscape', 'environment', 'album', 'flagTrim']) || value.version !== 1
        || !record(value.residents) || !keys(value.residents, ISLAND_RESIDENT_IDS)
        || !nullable(['shell-three-notes'], value.soundscape) || !nullable(['leaf-bird-flag-trim'], value.flagTrim)
        || !record(value.environment) || !keys(value.environment, ['period', 'season'])
        || !nullable(ISLAND_DAY_PERIODS, value.environment.period) || !nullable(ISLAND_SEASONS, value.environment.season)
        || !record(value.album) || !keys(value.album, ['cover', 'stamp'])
        || !nullable(['leaf-album-cover'], value.album.cover) || !nullable(['butterfly-stamp'], value.album.stamp)) return false;
    const residents = value.residents;
    return ISLAND_RESIDENT_IDS.every(id => {
        const resident = residents[id];
        return record(resident) && keys(resident, ['outfit', 'pattern', 'trail'])
            && nullable(ISLAND_EXPRESSION_OUTFIT_IDS, resident.outfit) && nullable(ISLAND_EXPRESSION_PATTERN_IDS, resident.pattern)
            && nullable(ISLAND_EXPRESSION_TRAIL_IDS, resident.trail);
    });
}
export function cloneIslandExpressionSelection(value: IslandExpressionSelection): IslandExpressionSelection {
    if (!hasValidIslandExpressionSelection(value)) throw invalidState();
    const resident = (id: IslandResidentId) => ({ outfit: value.residents[id].outfit, pattern: value.residents[id].pattern, trail: value.residents[id].trail });
    return { version: 1, residents: { otter: resident('otter'), rabbit: resident('rabbit'), fox: resident('fox') },
        soundscape: value.soundscape, environment: { period: value.environment.period, season: value.environment.season },
        album: { cover: value.album.cover, stamp: value.album.stamp }, flagTrim: value.flagTrim };
}
export function ownsIslandExpressionSelection(ownedItemIds: readonly IslandExpressionItemId[], selection: IslandExpressionSelection): boolean {
    if (!hasValidIslandExpressionSelection(selection)) return false;
    const selected = [selection.soundscape, selection.album.cover, selection.album.stamp, selection.flagTrim,
        ...ISLAND_RESIDENT_IDS.flatMap(id => Object.values(selection.residents[id]))];
    return selected.every(id => id === null || ownedItemIds.includes(id));
}
export function hasValidIslandExpression(island: Pick<IslandRecord, 'expression'>): boolean {
    const value: unknown = island.expression;
    if (value === undefined) return true;
    if (!record(value) || !keys(value, ['version', 'ownedItemIds', 'selection']) || value.version !== 1
        || !Array.isArray(value.ownedItemIds) || value.ownedItemIds.length > ISLAND_EXPRESSION_CATALOG.length
        || Object.keys(value.ownedItemIds).length !== value.ownedItemIds.length || !hasValidIslandExpressionSelection(value.selection)) return false;
    let previous = -1;
    for (const id of value.ownedItemIds) {
        const index = ISLAND_EXPRESSION_CATALOG.findIndex(item => item.itemId === id);
        if (index <= previous) return false;
        previous = index;
    }
    return ownsIslandExpressionSelection(value.ownedItemIds, value.selection);
}
/** Old absence stays absent in the caller and in ordinary learning writes. */
export function getIslandExpression(island: Pick<IslandRecord, 'expression'>): IslandExpressionState {
    if (!hasValidIslandExpression(island)) throw invalidState();
    return island.expression ? { version: 1, ownedItemIds: [...island.expression.ownedItemIds], selection: cloneIslandExpressionSelection(island.expression.selection) }
        : { version: 1, ownedItemIds: [], selection: createIslandExpressionSelection() };
}
export function sameIslandExpressionSelection(a: IslandExpressionSelection, b: IslandExpressionSelection): boolean {
    return JSON.stringify(cloneIslandExpressionSelection(a)) === JSON.stringify(cloneIslandExpressionSelection(b));
}
/** The repository validates the full saved observation before this narrow, dependency-free projection. */
export function getIslandExpressionEligibility(island: Pick<IslandRecord, 'growth' | 'workshop'>, itemId: IslandExpressionItemId):
{ eligible: boolean; reason?: IslandExpressionRequirement } {
    const requirement = definition(itemId).requirement;
    if (requirement === null) return { eligible: true };
    const eligible = requirement === 'bell' ? Boolean(island.workshop?.creations.some(creation => creation.partId === 'bell'))
        : Boolean(island.growth?.discoveries.some(discovery => discovery.id === requirement));
    return eligible ? { eligible: true } : { eligible: false, reason: requirement };
}
export function canonicalIslandExpressionAction(value: unknown): IslandExpressionAction {
    if (record(value)) {
        if (value.type === 'acquire' && keys(value, ['type', 'itemId']) && isIslandExpressionItemId(value.itemId)) return { type: value.type, itemId: value.itemId };
        if (value.type === 'period' && keys(value, ['type', 'period']) && nullable(ISLAND_DAY_PERIODS, value.period)) return { type: value.type, period: value.period };
        if (value.type === 'season' && keys(value, ['type', 'season']) && nullable(ISLAND_SEASONS, value.season)) return { type: value.type, season: value.season };
        if (keys(value, ['type', 'residentId', 'itemId']) && member(ISLAND_RESIDENT_IDS, value.residentId)) {
            if (value.type === 'equip-outfit' && nullable(ISLAND_EXPRESSION_OUTFIT_IDS, value.itemId)) return { type: value.type, residentId: value.residentId, itemId: value.itemId };
            if (value.type === 'equip-pattern' && nullable(ISLAND_EXPRESSION_PATTERN_IDS, value.itemId)) return { type: value.type, residentId: value.residentId, itemId: value.itemId };
            if (value.type === 'equip-trail' && nullable(ISLAND_EXPRESSION_TRAIL_IDS, value.itemId)) return { type: value.type, residentId: value.residentId, itemId: value.itemId };
        }
        if (keys(value, ['type', 'itemId'])) {
            if (value.type === 'equip-soundscape' && nullable(['shell-three-notes'], value.itemId)) return { type: value.type, itemId: value.itemId };
            if (value.type === 'equip-album-cover' && nullable(['leaf-album-cover'], value.itemId)) return { type: value.type, itemId: value.itemId };
            if (value.type === 'equip-album-stamp' && nullable(['butterfly-stamp'], value.itemId)) return { type: value.type, itemId: value.itemId };
            if (value.type === 'equip-flag-trim' && nullable(['leaf-bird-flag-trim'], value.itemId)) return { type: value.type, itemId: value.itemId };
        }
    }
    throw unknownAction();
}
function changeSelection(selection: IslandExpressionSelection, action: IslandExpressionEquipAction): IslandExpressionSelection {
    const updated = cloneIslandExpressionSelection(selection);
    switch (action.type) {
        case 'equip-outfit': updated.residents[action.residentId].outfit = action.itemId; break;
        case 'equip-pattern': updated.residents[action.residentId].pattern = action.itemId; break;
        case 'equip-trail': updated.residents[action.residentId].trail = action.itemId; break;
        case 'equip-soundscape': updated.soundscape = action.itemId; break;
        case 'equip-album-cover': updated.album.cover = action.itemId; break;
        case 'equip-album-stamp': updated.album.stamp = action.itemId; break;
        case 'equip-flag-trim': updated.flagTrim = action.itemId; break;
        case 'period': updated.environment.period = action.period; break;
        case 'season': updated.environment.season = action.season; break;
    }
    return updated;
}
export function previewIslandExpression(island: Pick<IslandRecord, 'expression'>, action: IslandExpressionEquipAction): IslandExpressionPreview {
    const intent = canonicalIslandExpressionAction(action);
    if (intent.type === 'acquire') throw unknownAction();
    return { action: intent, selection: changeSelection(getIslandExpression(island).selection, intent) };
}
/** An acquisition changes only the existing wallet and this finite ownership; equipping is a separate intent. */
export function reduceIslandExpression(island: IslandRecord, action: IslandExpressionAction): IslandRecord {
    const intent = canonicalIslandExpressionAction(action), expression = getIslandExpression(island);
    if (intent.type === 'acquire') {
        const item = definition(intent.itemId);
        if (expression.ownedItemIds.includes(item.itemId)) throw new IslandExpressionConflict('already-owned', 'これは もう もっているよ');
        if (!getIslandExpressionEligibility(island, item.itemId).eligible) throw new IslandExpressionConflict('not-eligible', 'みつけた しるしが まだ ないよ');
        let wallet;
        try { wallet = getIslandCustomization(island); } catch { throw invalidState(); }
        if (wallet.points < item.price) throw new IslandExpressionConflict('insufficient-stars', 'ほしが たまったら もらおう');
        expression.ownedItemIds = ISLAND_EXPRESSION_CATALOG.filter(entry => entry.itemId === item.itemId || expression.ownedItemIds.includes(entry.itemId)).map(entry => entry.itemId);
        return { ...clearIslandAdditionalRewardGoal(island, { category: 'expression', itemId: item.itemId }), expression,
            ...(item.price ? { customization: { ...wallet, points: wallet.points - item.price } } : {}) };
    }
    if ('itemId' in intent && intent.itemId !== null && !expression.ownedItemIds.includes(intent.itemId)) {
        throw new IslandExpressionConflict('not-owned', 'もらってから つけよう');
    }
    expression.selection = changeSelection(expression.selection, intent);
    return { ...island, expression };
}

/** Used inside an experience transaction: an explicit free choice cannot leave an override active. */
export function clearIslandExpressionOverrides(island: IslandRecord, residentIds: readonly IslandResidentId[], soundscape = false): IslandRecord {
    const expression = getIslandExpression(island);
    if (!island.expression) return island;
    for (const id of residentIds) expression.selection.residents[id].outfit = null;
    if (soundscape) expression.selection.soundscape = null;
    return { ...island, expression };
}
/** Whole-scene apply restores selection only and may never grant the ownership shown in a snapshot. */
export function applyIslandExpressionSelection(island: IslandRecord, selection: IslandExpressionSelection): IslandRecord {
    const expression = getIslandExpression(island), selected = cloneIslandExpressionSelection(selection);
    if (!ownsIslandExpressionSelection(expression.ownedItemIds, selected)) throw new IslandExpressionConflict('not-owned', 'この みじたくは まだ もっていないよ');
    if (!island.expression && sameIslandExpressionSelection(selected, expression.selection)) return island;
    return { ...island, expression: { ...expression, selection: selected } };
}
