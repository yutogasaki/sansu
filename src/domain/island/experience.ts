import { isValidIslandPlacement } from './catalog';
import { captureIslandCosmetics, cloneIslandCosmetics, getIslandCosmetics, getIslandCustomization, hasValidIslandCosmetics,
    ownsIslandCosmetics, type IslandCosmetics } from './customization';
import { resolveIslandAppearance, sameIslandAppearance } from './appearance';
import { applyIslandExpressionSelection, clearIslandExpressionOverrides } from './expression';
import { captureIslandSceneStyle, cloneIslandSceneStyle, hasValidIslandSceneStyle, type IslandSavedSceneStyle } from './sceneStyle';
import { ISLAND_RESIDENT_IDS, ISLAND_EMBLEMS, ISLAND_AMBIENCES, ISLAND_RESIDENT_LOOKS,
    type IslandResidentId, type IslandEmblem, type IslandAmbience, type IslandResidentLook } from './residentIdentity';
import type { IslandItemKind, IslandPosition, IslandRecord } from './types';

export { ISLAND_RESIDENT_IDS, ISLAND_EMBLEMS, ISLAND_AMBIENCES, ISLAND_RESIDENT_LOOKS } from './residentIdentity';
export type { IslandResidentId, IslandEmblem, IslandAmbience, IslandResidentLook } from './residentIdentity';
export type { IslandSavedSceneStyle } from './sceneStyle';
export const ISLAND_LAYOUT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;
export type IslandLayoutId = typeof ISLAND_LAYOUT_IDS[number];
export const ISLAND_EXPERIENCE_NAME_LIMIT = 16;
export const ISLAND_RESIDENT_PROFILES = {
    otter: { name: 'カワウソ', favoriteItemKind: 'fountain', favoriteLabel: 'みずべ' },
    rabbit: { name: 'ウサギ', favoriteItemKind: 'flower', favoriteLabel: 'おはな' },
    fox: { name: 'キツネ', favoriteItemKind: 'lantern', favoriteLabel: 'あかり' },
} as const satisfies Record<IslandResidentId, { name: string; favoriteItemKind: IslandItemKind; favoriteLabel: string }>;

export interface IslandSavedLayout {
    id: IslandLayoutId;
    name: string;
    poses: { id: string; position?: IslandPosition; rotation: number }[];
    cosmetics: IslandCosmetics;
    /** Omitted legacy layouts keep the current outfits, sound and emblem. Names are never restored. */
    sceneStyle?: IslandSavedSceneStyle;
    capturedAt: number;
}
export interface IslandExperienceState {
    version: 1;
    islandName: string;
    emblem: IslandEmblem;
    ambience: IslandAmbience;
    residents: Record<IslandResidentId, { name: string; look: IslandResidentLook }>;
    layouts: IslandSavedLayout[];
}
export type IslandExperienceAction =
    | { type: 'rename-island'; name: string }
    | { type: 'emblem'; emblem: IslandEmblem }
    | { type: 'ambience'; ambience: IslandAmbience }
    | { type: 'resident-name'; residentId: IslandResidentId; name: string }
    | { type: 'resident-look'; residentId: IslandResidentId; look: IslandResidentLook }
    | { type: 'resident'; residentId: IslandResidentId; name: string; look: IslandResidentLook }
    | { type: 'save-layout'; layoutId: IslandLayoutId; name: string }
    | { type: 'apply-layout' | 'delete-layout'; layoutId: IslandLayoutId };
export type IslandExperienceConflictCode = 'invalid-name' | 'invalid-state' | 'unknown-action'
    | 'layout-missing' | 'layout-item-missing' | 'layout-collision' | 'cosmetics-not-owned';
export class IslandExperienceConflict extends Error {
    constructor(public readonly code: IslandExperienceConflictCode, message: string) { super(message); this.name = 'IslandExperienceConflict'; }
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const member = <T extends string>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const control = /[\p{Cc}\p{Cf}]/u;

/** Text is kept as text. Canonical NFC/trim prevents retries from recording different spellings of the same intent. */
export function normalizeIslandExperienceName(value: unknown): string {
    if (typeof value !== 'string' || control.test(value)) throw new IslandExperienceConflict('invalid-name', 'なまえを 1〜16もじで いれてね');
    const name = value.normalize('NFC').trim();
    if (!name || [...name].length > ISLAND_EXPERIENCE_NAME_LIMIT) throw new IslandExperienceConflict('invalid-name', 'なまえを 1〜16もじで いれてね');
    return name;
}
function validName(value: unknown): value is string {
    try { return normalizeIslandExperienceName(value) === value; } catch { return false; }
}
function validLayout(value: unknown): value is IslandSavedLayout {
    if (!record(value) || !keys(value, ['id', 'name', 'poses', 'cosmetics', 'sceneStyle', 'capturedAt'])
        || !member(ISLAND_LAYOUT_IDS, value.id) || !validName(value.name)
        || !finite(value.capturedAt) || value.capturedAt < 0 || !hasValidIslandCosmetics(value.cosmetics)
        || (value.sceneStyle !== undefined && !hasValidIslandSceneStyle(value.sceneStyle)) || !Array.isArray(value.poses)) return false;
    const ids = new Set<string>();
    for (const pose of value.poses) {
        if (!record(pose) || !keys(pose, ['id', 'position', 'rotation']) || typeof pose.id !== 'string' || !pose.id
            || ids.has(pose.id) || !finite(pose.rotation)
            || (pose.position !== undefined && (!record(pose.position) || !keys(pose.position, ['x', 'z'])
                || !finite(pose.position.x) || !finite(pose.position.z)))) return false;
        ids.add(pose.id);
    }
    return true;
}

/** An absent v1 extension is compatible; unknown or malformed saved formats must never be silently replaced. */
export function hasValidIslandExperience(island: Pick<IslandRecord, 'experience'>): boolean {
    const state: unknown = island.experience;
    if (state === undefined) return true;
    if (!record(state) || !keys(state, ['version', 'islandName', 'emblem', 'ambience', 'residents', 'layouts'])
        || state.version !== 1 || !validName(state.islandName) || !member(ISLAND_EMBLEMS, state.emblem)
        || !member(ISLAND_AMBIENCES, state.ambience) || !record(state.residents) || !keys(state.residents, ISLAND_RESIDENT_IDS)
        || !Array.isArray(state.layouts) || state.layouts.length > ISLAND_LAYOUT_IDS.length || !state.layouts.every(validLayout)
        || new Set(state.layouts.map(layout => layout.id)).size !== state.layouts.length) return false;
    const residents = state.residents;
    return ISLAND_RESIDENT_IDS.every(id => {
        const resident = residents[id];
        return record(resident) && keys(resident, ['name', 'look']) && validName(resident.name) && member(ISLAND_RESIDENT_LOOKS, resident.look);
    });
}
export function getIslandExperience(island: Pick<IslandRecord, 'experience'>): IslandExperienceState {
    if (!hasValidIslandExperience(island)) throw new IslandExperienceConflict('invalid-state', 'しまの きろくを よみなおしてね');
    const state = island.experience;
    if (!state) return { version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off',
        residents: { otter: { name: ISLAND_RESIDENT_PROFILES.otter.name, look: 'original' },
            rabbit: { name: ISLAND_RESIDENT_PROFILES.rabbit.name, look: 'original' },
            fox: { name: ISLAND_RESIDENT_PROFILES.fox.name, look: 'original' } }, layouts: [] };
    return { ...state, residents: { otter: { ...state.residents.otter }, rabbit: { ...state.residents.rabbit }, fox: { ...state.residents.fox } },
        layouts: state.layouts.map(layout => ({ ...layout, cosmetics: cloneIslandCosmetics(layout.cosmetics),
            ...(layout.sceneStyle ? { sceneStyle: cloneIslandSceneStyle(layout.sceneStyle) } : {}), poses: layout.poses.map(pose => ({ ...pose,
            ...(pose.position ? { position: { ...pose.position } } : {}) })) })) };
}

/** Exact supported action shapes also prevent clients from supplying their own layout/growth snapshots. */
export function canonicalIslandExperienceAction(action: IslandExperienceAction): IslandExperienceAction {
    if (record(action)) {
        if (action.type === 'rename-island' && keys(action, ['type', 'name'])) return { type: action.type, name: normalizeIslandExperienceName(action.name) };
        if (action.type === 'emblem' && keys(action, ['type', 'emblem']) && member(ISLAND_EMBLEMS, action.emblem)) return { type: action.type, emblem: action.emblem };
        if (action.type === 'ambience' && keys(action, ['type', 'ambience']) && member(ISLAND_AMBIENCES, action.ambience)) return { type: action.type, ambience: action.ambience };
        if (action.type === 'resident-name' && keys(action, ['type', 'residentId', 'name']) && member(ISLAND_RESIDENT_IDS, action.residentId)) {
            return { type: action.type, residentId: action.residentId, name: normalizeIslandExperienceName(action.name) };
        }
        if (action.type === 'resident-look' && keys(action, ['type', 'residentId', 'look'])
            && member(ISLAND_RESIDENT_IDS, action.residentId) && member(ISLAND_RESIDENT_LOOKS, action.look)) {
            return { type: action.type, residentId: action.residentId, look: action.look };
        }
        if (action.type === 'resident' && keys(action, ['type', 'residentId', 'name', 'look'])
            && member(ISLAND_RESIDENT_IDS, action.residentId) && member(ISLAND_RESIDENT_LOOKS, action.look)) {
            return { type: action.type, residentId: action.residentId, name: normalizeIslandExperienceName(action.name), look: action.look };
        }
        if (action.type === 'save-layout' && keys(action, ['type', 'layoutId', 'name']) && member(ISLAND_LAYOUT_IDS, action.layoutId)) {
            return { type: action.type, layoutId: action.layoutId, name: normalizeIslandExperienceName(action.name) };
        }
        if ((action.type === 'apply-layout' || action.type === 'delete-layout') && keys(action, ['type', 'layoutId']) && member(ISLAND_LAYOUT_IDS, action.layoutId)) {
            return { type: action.type, layoutId: action.layoutId };
        }
    }
    throw new IslandExperienceConflict('unknown-action', 'えらびなおしてね');
}

function applyLayout(island: IslandRecord, layout: IslandSavedLayout): IslandRecord {
    const owned = getIslandCustomization(island).ownedItemIds;
    if (!ownsIslandCosmetics(owned, layout.cosmetics)) {
        throw new IslandExperienceConflict('cosmetics-not-owned', 'この きせかえは まだ もっていないよ');
    }
    const poses = new Map(layout.poses.map(pose => [pose.id, pose]));
    if (layout.poses.some(pose => !island.items.some(item => item.id === pose.id))) {
        throw new IslandExperienceConflict('layout-item-missing', 'いまの しまに ないものが あるよ');
    }
    const updated = { ...island, items: island.items.map(item => {
        const pose = poses.get(item.id);
        return pose ? { ...item, rotation: pose.rotation, position: pose.position ? { ...pose.position } : undefined, autoPlacementBlocked: undefined } : item;
    }) };
    // Check the entire merge, including current exhibit footprints: neither later possessions nor exhibits are removed to make room.
    if (updated.items.some(item => item.position && !isValidIslandPlacement(updated, item.id, item.position, item.rotation))) {
        throw new IslandExperienceConflict('layout-collision', 'いまの ものと ぶつかるよ。ばしょを かえてみよう');
    }
    const currentCosmetics = getIslandCosmetics(island);
    if (island.customization || currentCosmetics.accentId !== layout.cosmetics.accentId
        || !sameIslandAppearance(resolveIslandAppearance(currentCosmetics), resolveIslandAppearance(layout.cosmetics))) {
        const state = getIslandCustomization(island);
        // A legacy layout means its old theme, not any newer overrides left in the current state.
        delete state.appearance;
        updated.customization = { ...state, ...cloneIslandCosmetics(layout.cosmetics) };
    }
    return updated;
}

/** No learning fields, wallet balance, growth, or revision are changed by the pure expression reducer. */
export function reduceIslandExperience(island: IslandRecord, action: IslandExperienceAction, now: number): IslandRecord {
    const intent = canonicalIslandExperienceAction(action), experience = getIslandExperience(island);
    let updated = island;
    if (intent.type === 'rename-island') experience.islandName = intent.name;
    else if (intent.type === 'emblem') experience.emblem = intent.emblem;
    else if (intent.type === 'ambience') {
        experience.ambience = intent.ambience;
        updated = clearIslandExpressionOverrides(island, [], true);
    } else if (intent.type === 'resident-name') experience.residents[intent.residentId].name = intent.name;
    else if (intent.type === 'resident-look') {
        experience.residents[intent.residentId].look = intent.look;
        updated = clearIslandExpressionOverrides(island, [intent.residentId]);
    } else if (intent.type === 'resident') {
        experience.residents[intent.residentId] = { name: intent.name, look: intent.look };
        updated = clearIslandExpressionOverrides(island, [intent.residentId]);
    }
    else if (intent.type === 'save-layout') {
        if (!finite(now) || now < 0) throw new IslandExperienceConflict('invalid-state', 'しまの きろくを よみなおしてね');
        const layout: IslandSavedLayout = { id: intent.layoutId, name: intent.name, capturedAt: now, cosmetics: captureIslandCosmetics(island),
            sceneStyle: captureIslandSceneStyle(island),
            poses: island.items.map(item => ({ id: item.id, rotation: item.rotation, ...(item.position ? { position: { ...item.position } } : {}) })) };
        experience.layouts = [...experience.layouts.filter(saved => saved.id !== intent.layoutId), layout]
            .sort((a, b) => ISLAND_LAYOUT_IDS.indexOf(a.id) - ISLAND_LAYOUT_IDS.indexOf(b.id));
    } else {
        const layout = experience.layouts.find(saved => saved.id === intent.layoutId);
        if (!layout) throw new IslandExperienceConflict('layout-missing', 'この けしきは まだ のこしていないよ');
        if (intent.type === 'delete-layout') experience.layouts = experience.layouts.filter(saved => saved.id !== intent.layoutId);
        else {
            updated = applyLayout(island, layout);
            if (layout.sceneStyle) {
                for (const id of ISLAND_RESIDENT_IDS) experience.residents[id].look = layout.sceneStyle.residentLooks[id];
                experience.ambience = layout.sceneStyle.ambience;
                experience.emblem = layout.sceneStyle.emblem;
                updated = layout.sceneStyle.version === 2 ? applyIslandExpressionSelection(updated, layout.sceneStyle.expression)
                    : clearIslandExpressionOverrides(updated, ISLAND_RESIDENT_IDS, true);
            }
        }
    }
    return { ...updated, experience };
}

/** Same collision/ownership reducer as the actual apply; the source island and every save table stay untouched. */
export function previewIslandLayout(island: IslandRecord, layoutId: IslandLayoutId): IslandRecord {
    return reduceIslandExperience(island, { type: 'apply-layout', layoutId }, island.updatedAt);
}
