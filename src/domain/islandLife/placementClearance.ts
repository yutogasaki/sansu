import { occupiedCells } from './footprint';
import { landBounds } from './landRules';
import { CATALOG, ROAM_VISIT_PREFIX, type Cell, type ItemKind, type LifeState, type ResidentId } from './model';
import { route, vacant, walkable } from './space';
import { routeDuration, sampleRoute } from './walkingSpace';

export const PLACEMENT_CLEARANCE_PREFIX = `${ROAM_VISIT_PREFIX}clear-placement:`;
export const PLACEMENT_CLEARANCE_HOLD_MS = 1500;
/** Arrival clock, excluding the short hold reserved for the following placement. */
export function placementClearanceEnd(state: LifeState) {
    return Math.max(state.now, ...state.residents.flatMap(resident => resident.visit?.itemId.startsWith(PLACEMENT_CLEARANCE_PREFIX)
        ? [resident.visit.start + routeDuration(resident.visit.path)] : []));
}

export interface PlacementClearanceTarget { kind: ItemKind; cell: Cell; itemId?: string }
export interface PlacementClearanceMove { residentId: ResidentId; from: Cell; path: Cell[] }
/** Plan in the existing world: the prospective object does not exist until everyone has walked clear. */
export function planPlacementClearance(state: LifeState, target: PlacementClearanceTarget) {
    if (state.placementVersion !== 1) throw new Error('島を よみなおしてから おこう。');
    const existing = target.itemId ? state.items.find(item => item.id === target.itemId) : undefined;
    if (!CATALOG[target.kind] || target.itemId && (!existing || existing.kind !== target.kind)) throw new Error('その ものが みつからないよ。');
    const candidate = { id: target.itemId ?? '__placement-clearance__', kind: target.kind, cell: target.cell, growth: 0, style: 'original' as const };
    if (!occupiedCells(candidate).every(cell => vacant(state, cell, target.itemId))) throw new Error('そこには おけないよ。べつの ばしょを えらぼう。');
    const trial = { ...state, items: [...state.items.filter(item => item.id !== candidate.id), candidate] };
    const positions = state.residents.map(resident => ({ residentId: resident.id,
        from: resident.visit ? sampleRoute(resident.visit.path, state.now - resident.visit.start) : { ...resident.cell } }));
    const affected = positions.filter(position => walkable(state, position.from) && !walkable(trial, position.from));
    if (!affected.length) return { moves: [] as PlacementClearanceMove[], durationMs: 0 };
    const { minX, maxX, depth } = landBounds(state), destinations: Cell[] = [];
    for (let z = 0; z < depth; z += .25) for (let x = minX; x <= maxX; x += .25) {
        const point = { x, z }; if (walkable(state, point) && walkable(trial, point)) destinations.push(point);
    }
    const moves: PlacementClearanceMove[] = [];
    for (const position of affected) {
        const avoid = [...positions.filter(other => other.residentId !== position.residentId).map(other => other.from), ...moves.map(move => move.path[move.path.length - 1])];
        const ranked = [...destinations].sort((a, b) => Math.hypot(a.x - position.from.x, a.z - position.from.z) - Math.hypot(b.x - position.from.x, b.z - position.from.z) || a.z - b.z || a.x - b.x);
        let path: Cell[] | undefined;
        for (const destination of ranked) {
            if (avoid.some(point => Math.hypot(point.x - destination.x, point.z - destination.z) < .4)) continue;
            path = route(state, position.from, destination, avoid);
            if (path) break;
        }
        if (!path) throw new Error('ここから あるけないよ。べつの ばしょを えらぼう。');
        moves.push({ ...position, path });
    }
    return { moves, durationMs: Math.max(...moves.map(move => routeDuration(move.path))) };
}
