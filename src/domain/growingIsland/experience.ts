import { editableIslandWorld } from './editableTerrainWorld';
import { derivePlaces, placeWalkSearch } from './places';
import { isReachable, key, reachableFromHome } from './space';
import type { PlaceFamily } from './placeTypes';
import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';

export interface SharedPlayReceipt { placeId: string; revision: string; actorId: string; targetId: string; overlapMs: number }
export interface SharedMemory { family: PlaceFamily; actorId: string; targetId: string; at: number; memberIds: string[]; variant: string; revision: string }
export interface IslandExperience { version: 1; shared: SharedMemory[] }
const families: readonly PlaceFamily[] = ['grove', 'spring', 'community', 'flowers'];
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export const sharedMemoryKey = (memory: Pick<SharedMemory, 'family' | 'actorId'>) => JSON.stringify([memory.family, memory.actorId]);

export function validateExperience(value: IslandExperience) {
    if (!value || value.version !== 1 || !Array.isArray(value.shared) || Object.keys(value).some(k => k !== 'version' && k !== 'shared')
        || value.shared.some(m => !m || !families.includes(m.family) || !text(m.actorId) || m.actorId === 'pokomoko' || !text(m.targetId)
            || !Number.isFinite(m.at) || m.at < 0 || !text(m.variant) || !text(m.revision) || !Array.isArray(m.memberIds)
            || !m.memberIds.length || !m.memberIds.every(text) || new Set(m.memberIds).size !== m.memberIds.length
            || Object.keys(m).some(k => !['family', 'actorId', 'targetId', 'at', 'memberIds', 'variant', 'revision'].includes(k)))
        || new Set(value.shared.map(sharedMemoryKey)).size !== value.shared.length)
        throw new Error('この島の思い出は新しい版で開いてください。');
}

/** Current, reachable music owner and place. Stored snapshots survive later editing. */
export function concertPlace(state: GrowingState, targetId: string, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    const stand = state.landmarks.find(item => item.id === targetId && item.kind === 'bandstand' && item.cell);
    if (!stand?.cell) return;
    const reached = reachableFromHome(state, undefined, world);
    if (!isReachable(stand.cell, reached, world)) return;
    const nearby = derivePlaces(state, world).filter(place => place.stage === 'grown' || place.stage === 'lived').map(place => {
        const search = placeWalkSearch(reached, place.entrances, 3, world);
        const cost = Math.min(...[...reached].map(id => {
            const [x, z] = id.split(',').map(Number);
            return Math.abs(x - stand.cell!.x) + Math.abs(z - stand.cell!.z) === 1 ? search.costs.get(key({ x, z })) ?? Infinity : Infinity;
        }));
        return { place, cost };
    }).filter(entry => entry.cost <= 3).sort((a, b) => a.cost - b.cost || a.place.id.localeCompare(b.place.id));
    return nearby[0]?.place;
}

export function recordSharedPlay(state: GrowingState, receipt: SharedPlayReceipt, now: number, world?: IslandWorld) {
    world ??= editableIslandWorld(state);
    if (state.experience) validateExperience(state.experience);
    const place = concertPlace(state, receipt.targetId, world);
    const actor = state.villagers.find(friend => friend.id === receipt.actorId && !friend.away && !state.arrivals.includes(friend.id));
    const home = actor && state.plots.find(plot => plot.id === actor.home && plot.kind === 'home' && plot.stage > 0 && plot.cell && !state.unopened.includes(plot.id));
    if (!place || place.id !== receipt.placeId || place.revision !== receipt.revision || !actor
        || actor.home !== 'pokomoko' && (!home?.cell || !isReachable(home.cell, reachableFromHome(state, undefined, world), world))
        || !Number.isFinite(receipt.overlapMs) || receipt.overlapMs < 3000 || !Number.isFinite(now) || now < 0) return false;
    const fact: SharedMemory = { family: place.family, actorId: actor.id, targetId: receipt.targetId, at: now,
        memberIds: [...place.memberIds], variant: place.variant, revision: place.revision };
    if (state.experience?.shared.some(old => sharedMemoryKey(old) === sharedMemoryKey(fact))) return true;
    state.experience ??= { version: 1, shared: [] };
    state.experience.shared.push(fact); return true;
}
