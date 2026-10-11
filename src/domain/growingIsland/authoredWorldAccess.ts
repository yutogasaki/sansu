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
    const ownerSite = world.sites.find(site => cellKey(site.cell) === cellKey(cell));
    if (!ownerSite) return [];
    if (!ownerSite.support) {
        // A water owner has no walk edge through its basin. A visitor approaches
        // its actual dry bank in the same district and stops outside the owner.
        // No route or district connection is invented between these candidates.
        const bankSupported = (site: typeof ownerSite) => {
            if (!site.support) return false;
            const anchor = ownerSite.point, p = site.support.point, dx = p.x - anchor.x, dz = p.z - anchor.z, length = Math.hypot(dx, dz);
            if (length <= clearance || length > 1.1 || Math.abs(p.y - anchor.y) > .28) return false;
            // Stop outside the occupied water owner's body. The short approach
            // and its foot band must remain on actual dry triangles; logical
            // proximity cannot bridge a physically separated floor patch.
            const stop = Math.min(length, clearance + .04), nx = -dz / length, nz = dx / length;
            for (let i = 0; i <= 4; i++) for (const side of [-AUTHORED_WALK_HALF_WIDTH, 0, AUTHORED_WALK_HALF_WIDTH]) {
                const r = length + (stop - length) * i / 4;
                const point = { x: anchor.x + dx / length * r + nx * side, z: anchor.z + dz / length * r + nz * side };
                const logical = world.logicalAt(point), floor = logical && world.floorAt(logical);
                if (!floor || Math.hypot(point.x - floor.point.x, point.z - floor.point.z) > .00001
                    || Math.abs(floor.point.y - p.y) > .25) return false;
            }
            return true;
        };
        return world.walkSites.filter(site => site.ref.districtId === ownerSite.ref.districtId
            && !authoredPointBlocked(site.cell, cell) && Math.hypot(site.cell.x - cell.x, site.cell.z - cell.z) <= 1.1 && bankSupported(site))
            .map(site => ({ ...site.cell })).sort((a, b) => Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b.x - cell.x, b.z - cell.z)
                || (b.z - cell.z) - (a.z - cell.z) || a.x - b.x);
    }
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
