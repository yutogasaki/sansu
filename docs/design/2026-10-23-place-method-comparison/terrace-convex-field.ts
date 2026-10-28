import type { Cell } from '../../../src/domain/growingIsland/types';

export const CONVEX_TERRACE_FIELD_REVISION = 'cardinal-convex-terrace-v2';
export const CONVEX_TERRACE_FLAT_RADIUS = .30;
export const CONVEX_TERRACE_DETAIL = 12;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Fixed cardinal partition of unity. Positive, zero and negative coefficients
 * all use the same four nonnegative weights, which sum to one. A single saved
 * coefficient change of one therefore changes every output by at most one.
 * The flat radius never changes with height, component membership or owners.
 * This preserves cell-centre values, but it cannot promise that arbitrary
 * neighbouring heights form both flat furniture supports and walkable slopes.
 */
export function convexTerraceOffset(heights: Readonly<Record<string, number>>, cell: Cell,
    bounds: { minX: number; maxX: number; depth: number }) {
    const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
    const x = Math.floor(sx), z = Math.floor(sz);
    const blend = (fraction: number) => smooth(Math.max(0, Math.min(1,
        (fraction - CONVEX_TERRACE_FLAT_RADIUS) / (1 - 2 * CONVEX_TERRACE_FLAT_RADIUS))));
    const u = blend(sx - x), v = blend(sz - z);
    const height = (dx: number, dz: number) => heights[`${x + dx},${z + dz}`] ?? 0;
    const plateau = ((1 - u) * height(0, 0) + u * height(1, 0)) * (1 - v)
        + ((1 - u) * height(0, 1) + u * height(1, 1)) * v;
    const oldU = smooth(sx - x), oldV = smooth(sz - z);
    const original = ((1 - oldU) * height(0, 0) + oldU * height(1, 0)) * (1 - oldV)
        + ((1 - oldU) * height(0, 1) + oldU * height(1, 1)) * oldV;
    // A fixed spatial blend preserves the outer half-cell and the old shoreline
    // interpolation. It is another convex combination, independent of heights.
    const edge = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
    const interior = smooth(Math.max(0, Math.min(1, edge * 6)));
    return original * (1 - interior) + plateau * interior;
}

/** Fine triangles can exactly subdivide an old coarse triangle. Use this for
 * both Y and curved X/Z outside the acquired cell centres, so changing detail
 * does not subtly move the existing exterior floor or shoreline. */
export function coarseTriangleValue(sample: (cell: Cell) => number, cell: Cell, detail = 6) {
    const gx = cell.x * detail, gz = cell.z * detail, ix = Math.floor(gx), iz = Math.floor(gz);
    const u = gx - ix, v = gz - iz;
    const a = sample({ x: ix / detail, z: iz / detail }), b = sample({ x: (ix + 1) / detail, z: iz / detail });
    const c = sample({ x: ix / detail, z: (iz + 1) / detail }), d = sample({ x: (ix + 1) / detail, z: (iz + 1) / detail });
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
