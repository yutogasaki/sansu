import { cloneIslandExpressionSelection, getIslandExpression, hasValidIslandExpressionSelection, type IslandExpressionSelection } from './expression';
import { ISLAND_AMBIENCES, ISLAND_EMBLEMS, ISLAND_RESIDENT_IDS, ISLAND_RESIDENT_LOOKS,
    type IslandAmbience, type IslandEmblem, type IslandResidentId, type IslandResidentLook } from './residentIdentity';
import type { IslandRecord } from './types';

export interface IslandSavedSceneStyleV1 {
    version: 1;
    residentLooks: Record<IslandResidentId, IslandResidentLook>;
    ambience: IslandAmbience;
    emblem: IslandEmblem;
}
export interface IslandSavedSceneStyleV2 {
    version: 2;
    residentLooks: Record<IslandResidentId, IslandResidentLook>;
    ambience: IslandAmbience;
    emblem: IslandEmblem;
    expression: IslandExpressionSelection;
}
export type IslandSavedSceneStyle = IslandSavedSceneStyleV1 | IslandSavedSceneStyleV2;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, expected: readonly string[]) => Object.keys(value).length === expected.length
    && expected.every(key => Object.prototype.hasOwnProperty.call(value, key));
const member = <T extends string>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);

export function hasValidIslandSceneStyle(value: unknown): value is IslandSavedSceneStyle {
    if (!record(value) || (value.version !== 1 && value.version !== 2)
        || !keys(value, value.version === 1 ? ['version', 'residentLooks', 'ambience', 'emblem'] : ['version', 'residentLooks', 'ambience', 'emblem', 'expression'])
        || !member(ISLAND_AMBIENCES, value.ambience) || !member(ISLAND_EMBLEMS, value.emblem)
        || !record(value.residentLooks) || !keys(value.residentLooks, ISLAND_RESIDENT_IDS)) return false;
    const looks = value.residentLooks;
    return ISLAND_RESIDENT_IDS.every(id => member(ISLAND_RESIDENT_LOOKS, looks[id]))
        && (value.version === 1 || hasValidIslandExpressionSelection(value.expression));
}
export function cloneIslandSceneStyle(value: IslandSavedSceneStyle): IslandSavedSceneStyle {
    if (!hasValidIslandSceneStyle(value)) throw new Error('Invalid island scene style');
    const base = { residentLooks: { otter: value.residentLooks.otter, rabbit: value.residentLooks.rabbit, fox: value.residentLooks.fox },
        ambience: value.ambience, emblem: value.emblem };
    return value.version === 1 ? { version: 1, ...base } : { version: 2, ...base, expression: cloneIslandExpressionSelection(value.expression) };
}
/** Capture a detached style from confirmed fields only; no dependency on experience's world reducer. */
export function captureIslandSceneStyle(island: Pick<IslandRecord, 'experience' | 'expression'>): IslandSavedSceneStyleV2 {
    const experience = island.experience;
    if (experience !== undefined && (!record(experience) || experience.version !== 1 || !record(experience.residents)
        || !ISLAND_RESIDENT_IDS.every(id => record(experience.residents[id]) && member(ISLAND_RESIDENT_LOOKS, experience.residents[id].look)))) {
        throw new Error('Invalid island scene style');
    }
    const style: IslandSavedSceneStyleV2 = { version: 2,
        residentLooks: experience ? { otter: experience.residents.otter.look, rabbit: experience.residents.rabbit.look, fox: experience.residents.fox.look }
            : { otter: 'original', rabbit: 'original', fox: 'original' },
        ambience: experience ? experience.ambience : 'off', emblem: experience ? experience.emblem : 'leaf', expression: getIslandExpression(island).selection };
    if (!hasValidIslandSceneStyle(style)) throw new Error('Invalid island scene style');
    return style;
}
