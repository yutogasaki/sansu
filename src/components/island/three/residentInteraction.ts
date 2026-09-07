import { isValidIslandPlacement } from '../../../domain/island/catalog';
import type { IslandRecord } from '../../../domain/island/types';
import { planResidentRoute, type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export interface ResidentCandidate {
    position: GroundPoint;
    visible: boolean;
    itemId?: string;
}
export interface ResidentVisitChoice { index: number; route: ResidentRoute; replay: boolean }

/** Existing residents keep their actual path/seat/position through ordinary edits. */
export function residentNeedsInitialSpawn(species: 'otter' | 'rabbit' | 'fox', completedSets: number, previousCompletedSets?: number,
    pending = false, savedLayoutChanged = false) {
    return previousCompletedSets === undefined || (species === 'fox' && previousCompletedSets < 4 && completedSets >= 4)
        || (pending && savedLayoutChanged);
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
    items: IslandStageItem[], completedSets: number, afterIndex = -1): ResidentVisitChoice | undefined {
    const occupant = residents.findIndex(resident => resident.visible && resident.itemId === target.id);
    const order = occupant >= 0 ? [occupant] : Array.from({ length: residents.length }, (_, i) =>
        (Math.max(-1, afterIndex) + 1 + i) % residents.length);
    for (const index of order) {
        const resident = residents[index];
        if (!resident.visible) continue;
        const route = planResidentRoute(resident.position, target, items, completedSets, resident.itemId);
        if (route) return { index, route, replay: occupant === index };
    }
    return undefined;
}

/** Initial placement advice only. The bounded search never changes valid land,
 * saves a position, or alters a position the child has moved by hand. */
export function suggestReachablePlacement(island: Pick<IslandRecord, 'items' | 'completedSets'>,
    item: IslandStageItem, residents: readonly ResidentCandidate[]): GroundPoint | undefined {
    if (!residents.some(resident => resident.visible)) return undefined;
    const preferred = item.position ?? { x: 0, z: 1 };
    const candidates: GroundPoint[] = [];
    for (let z = 2.5; z >= -3; z -= .5) for (let x = -4; x <= (island.completedSets >= 2 ? 7.5 : 4); x += .5) {
        candidates.push({ x, z });
    }
    candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z));
    candidates.unshift(preferred);
    let attempts = 0;
    for (const position of candidates) {
        const target = { ...item, position };
        const items = island.items.some(candidate => candidate.id === item.id)
            ? island.items.map(candidate => candidate.id === item.id ? target : candidate) : [...island.items, target];
        // The catalog uses only completedSets/items; these identity fields never leave this pure calculation.
        const layout: IslandRecord = { profileId: '', schemaVersion: 1, revision: 0, pendingRewards: [], updatedAt: 0,
            completedSets: island.completedSets, items };
        if (!isValidIslandPlacement(layout, item.id, position, item.rotation)) continue;
        if (chooseReachableResident(residents, target, items, island.completedSets)) return { ...position };
        // Placement advice runs once on the main thread. Keep a small pathfinding
        // budget even when all reachable components have been fenced off.
        if (++attempts >= 6) break;
    }
    return undefined;
}
