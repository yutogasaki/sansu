import type { Cell, LifeItem, LifeState, ResidentId } from './model';
import { districts, pathToActivity, sameCell } from './space';

const endpoint = (path: Cell[]) => path[path.length - 1];

export interface PlayTourCursor { memberIds: string[]; lastItemId: string; visitedIds?: string[] }
export interface PendingPlayTour { residentId: ResidentId; cursor: PlayTourCursor }
export interface PlayTourDeparture { residentId: ResidentId; itemId: string; path: Cell[] }

/** Only the current GP3 component supplies destinations. Coordinate order is
 * independent of purchase order and opaque instance IDs. */
export function playTourMembers(state: LifeState, itemId: string): string[] | undefined {
    const group = districts(state).find(group => group.kind === 'play' && group.ids.length >= 3 && group.ids.includes(itemId));
    if (!group) return;
    const order = (a: LifeItem, b: LifeItem) => a.cell!.z - b.cell!.z || a.cell!.x - b.cell!.x || a.id.localeCompare(b.id);
    return state.items.filter(item => group.ids.includes(item.id)).sort(order).map(item => item.id);
}

/** Plan simultaneous departures, without moving residents or awarding anything.
 * A waiting resident's current cell is released only when that resident also
 * receives a route. Other visits keep their existing exclusive seat reservation.
 * Interrupted, split or reconfigured tours are returned to the caller to cancel. */
export function planPlayTourDepartures(state: LifeState, requested: readonly PendingPlayTour[]) {
    const cancelled: ResidentId[] = [];
    const seen = new Set<ResidentId>();
    const pending = [...requested].sort((a, b) => a.residentId.localeCompare(b.residentId)).filter(tour => {
        if (seen.has(tour.residentId)) throw new Error('Duplicate tour resident');
        seen.add(tour.residentId);
        const resident = state.residents.find(r => r.id === tour.residentId);
        const current = playTourMembers(state, tour.cursor.lastItemId);
        const valid = current && current.length === tour.cursor.memberIds.length
            && current.every((id, index) => id === tour.cursor.memberIds[index]);
        if (!resident || !valid || resident.id === 'pokomoko' && state.target) { cancelled.push(tour.residentId); return false; }
        // An in-progress use or walk must finish (or be explicitly interrupted)
        // before the scheduler includes this resident in a departure round.
        return !resident.visit;
    });
    const residents = pending.map(tour => state.residents.find(r => r.id === tour.residentId)!);
    const outside = state.residents.filter(r => !residents.includes(r));
    const reserved = outside.map(r => r.visit ? endpoint(r.visit.path) : r.cell);
    const options = pending.map((tour, index) => {
        const ids = tour.cursor.memberIds, after = ids.indexOf(tour.cursor.lastItemId);
        const visited = new Set(tour.cursor.visitedIds ?? [tour.cursor.lastItemId]);
        if (ids.every(id => visited.has(id))) { visited.clear(); visited.add(tour.cursor.lastItemId); }
        const ordered = [...ids.slice(after + 1), ...ids.slice(0, after)].filter(id => !visited.has(id));
        return ordered.flatMap(id => {
            const item = state.items.find(i => i.id === id && i.cell)!;
            if (outside.some(r => r.visit?.itemId === id)) return [];
            const path = pathToActivity(state, residents[index].cell, item, reserved);
            return path ? [{ itemId: id, path }] : [];
        });
    });
    type Choice = (typeof options)[number][number] | undefined;
    let best: Choice[] = [], count = -1;
    const search = (chosen: Choice[]) => {
        if (chosen.length === pending.length) {
            // A partial solution may not send someone into the cell of a
            // resident who stays behind, even if that cell is an approach.
            if (chosen.some(choice => choice && residents.some((r, i) => !chosen[i] && sameCell(r.cell, endpoint(choice.path))))) return;
            const moved = chosen.filter(Boolean).length;
            if (moved > count) { count = moved; best = [...chosen]; }
            return;
        }
        for (const option of [...options[chosen.length], undefined]) {
            if (option && chosen.some(other => other && (other.itemId === option.itemId || sameCell(endpoint(other.path), endpoint(option.path))))) continue;
            search([...chosen, option]);
        }
    };
    search([]);
    const departures: PlayTourDeparture[] = best.flatMap((choice, index) => choice ? [{ residentId: pending[index].residentId, ...choice }] : []);
    return { departures, cancelled, waiting: pending.filter(tour => !departures.some(d => d.residentId === tour.residentId)).map(tour => tour.residentId) };
}


export function advancePlayTourCursor(cursor: PlayTourCursor, itemId: string): PlayTourCursor {
    const visited = new Set(cursor.visitedIds ?? [cursor.lastItemId]);
    if (cursor.memberIds.every(id => visited.has(id))) { visited.clear(); visited.add(cursor.lastItemId); }
    if (!cursor.memberIds.includes(itemId) || visited.has(itemId)) throw new Error('Invalid tour destination');
    visited.add(itemId);
    return { memberIds: [...cursor.memberIds], lastItemId: itemId, visitedIds: [...visited] };
}
