import { getIslandLandAccess, islandPlacementCandidates, isValidIslandPlacement, type IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandRecord } from '../../../domain/island/types';
import { planResidentRoute, type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export interface ResidentCandidate {
    position: GroundPoint;
    visible: boolean;
    itemId?: string;
    departingId?: string;
}
export interface ResidentVisitChoice { index: number; route: ResidentRoute; replay: boolean }

/** Existing residents keep their actual path/seat/position through ordinary edits. */
export function residentNeedsInitialSpawn(species: 'otter' | 'rabbit' | 'fox', completedSets: number, previousCompletedSets?: number,
    pending = false, savedLayoutChanged = false, eastJustOpened = false) {
    return previousCompletedSets === undefined || (species === 'fox' && previousCompletedSets < 4 && completedSets >= 4)
        || (species === 'fox' && eastJustOpened) || (pending && savedLayoutChanged);
}

/** A preview, an answer receipt, or an unplaced gift does not free saved land. */
export function savedResidentLayoutChanged(previous: readonly IslandStageItem[], current: readonly IslandStageItem[]) {
    const placed = (items: readonly IslandStageItem[]) => items.filter(item => item.position);
    const before = placed(previous), after = placed(current);
    return before.length !== after.length || after.some(item => {
        const old = before.find(candidate => candidate.id === item.id);
        return !old || old.kind !== item.kind || old.rotation !== item.rotation
            || old.position!.x !== item.position!.x || old.position!.z !== item.position!.z;
    });
}

/** Fair turns among reachable residents. An occupied object keeps its current
 * user for a replay, so two bodies never share the same seat or viewing point. */
export function chooseReachableResident(residents: readonly ResidentCandidate[], target: IslandStageItem,
    items: IslandStageItem[], landAccess: IslandLandAccess, afterIndex = -1): ResidentVisitChoice | undefined {
    const occupant = residents.findIndex(resident => resident.visible && resident.itemId === target.id);
    const order = occupant >= 0 ? [occupant] : Array.from({ length: residents.length }, (_, i) =>
        (Math.max(-1, afterIndex) + 1 + i) % residents.length);
    for (const index of order) {
        const resident = residents[index];
        if (!resident.visible) continue;
        const occupied = residents.filter((other, otherIndex) => otherIndex !== index && other.visible).map(other => other.position);
        const route = planResidentRoute(resident.position, target, items, landAccess, resident.itemId || resident.departingId, { occupied });
        if (route) return { index, route, replay: occupant === index };
    }
    return undefined;
}

/** Initial placement advice only. The bounded search never changes valid land,
 * saves a position, or alters a position the child has moved by hand. */
export function suggestReachablePlacement(island: Pick<IslandRecord, 'items' | 'completedSets' | 'growth'>,
    item: IslandStageItem, residents: readonly ResidentCandidate[]): GroundPoint | undefined {
    if (!residents.some(resident => resident.visible)) return undefined;
    const preferred = item.position ?? { x: 0, z: 1 };
    const access = getIslandLandAccess(island), candidates = islandPlacementCandidates(access);
    candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z));
    candidates.unshift(preferred);
    let attempts = 0;
    for (const position of candidates) {
        const target = { ...item, position };
        const items = island.items.some(candidate => candidate.id === item.id)
            ? island.items.map(candidate => candidate.id === item.id ? target : candidate) : [...island.items, target];
        // Identity fields never leave this pure calculation; saved growth keeps
        // the real earned land separate from the learning section count.
        const layout: IslandRecord = { profileId: '', schemaVersion: 1, revision: 0, pendingRewards: [], updatedAt: 0,
            completedSets: island.completedSets, growth: island.growth, items };
        if (!isValidIslandPlacement(layout, item.id, position, item.rotation)) continue;
        if (chooseReachableResident(residents, target, items, access)) return { ...position };
        // Placement advice runs once on the main thread. Keep a small pathfinding
        // budget even when all reachable components have been fenced off.
        if (++attempts >= 6) break;
    }
    return undefined;
}
