import type { Cell } from './types';
import type { IslandWorld } from './worldDefinition';

/** The authored planting footprint and the supported width of a walking actor. */
export const AUTHORED_OWNER_HALF_EXTENT = .46;
export const AUTHORED_WALK_HALF_WIDTH = .12;
const clearance = AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH;
const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;

/** Quarter-grid points inside a house/furniture footprint are not walking lanes. */
export function authoredPointBlocked(point: Cell, owner: Cell) {
    return Math.abs(point.x - owner.x) <= clearance && Math.abs(point.z - owner.z) <= clearance;
}

/** Supported approaches outside one owner's footprint. The search discovers an
 * entrance; actual routes still run only over the caller's open graph. */
export function authoredApproachCells(cell: Cell, world: IslandWorld): Cell[] {
    if (!world.sites.some(site => cellKey(site.cell) === cellKey(cell))) return [];
    const queue = [cell], seen = new Set([cellKey(cell)]), approaches: Cell[] = [];
    for (let i = 0; i < queue.length; i++) for (const next of world.neighbors(queue[i], 'walk')) {
        const id = cellKey(next);
        if (seen.has(id) || Math.hypot(next.x - cell.x, next.z - cell.z) > 1.1) continue;
        seen.add(id);
        if (authoredPointBlocked(next, cell)) queue.push(next);
        else approaches.push(next);
    }
    // Prefer the dry front door, then the other shortest supported sides.
    return [cell, ...approaches.sort((a, b) => {
        const d = Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b.x - cell.x, b.z - cell.z);
        return d || (b.z - cell.z) - (a.z - cell.z) || a.x - b.x;
    })];
}

/** Gameplay limits are in logical land units, independent of walking resolution. */
export function walkPathDistance(path: readonly Cell[]) {
    return path.slice(1).reduce((length, cell, i) => length + Math.hypot(cell.x - path[i].x, cell.z - path[i].z), 0);
}
