import type { Cell } from '../../../src/domain/growingIsland/types';

export const GROWTH_FIXED_FIELD_REVISION = 'fixed-cardinal-grid-v1';
const smooth = (t: number) => t * t * (3 - 2 * t);

/** One cardinal basis at every acquired coordinate. Growth may extend the
 * coefficient domain, but never changes the basis used at an existing point.
 * The newly acquired adjacent row must inherit the previous edge coefficient
 * to preserve its constant continuation through the old outer half-cell. */
export function growthFixedOffset(heights: Readonly<Record<string, number>>, cell: Cell,
    bounds: { minX: number; maxX: number; depth: number }): number {
    const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x));
    const sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
    const x = Math.floor(sx), z = Math.floor(sz);
    const blend = (fraction: number) => smooth(Math.max(0, Math.min(1, (fraction - .30) / .40)));
    const u = blend(sx - x), v = blend(sz - z);
    const at = (dx: number, dz: number) => heights[`${x + dx},${z + dz}`] ?? 0;
    return ((1 - u) * at(0, 0) + u * at(1, 0)) * (1 - v)
        + ((1 - u) * at(0, 1) + u * at(1, 1)) * v;
}
