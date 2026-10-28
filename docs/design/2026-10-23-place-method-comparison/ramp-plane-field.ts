import type { Cell } from '../../../src/domain/growingIsland/types';
export const RAMP_PLANE_REVISION = 'fixed-bilinear-interior-ramp-v1';
const smooth = (t: number) => t * t * (3 - 2 * t);
/** No height classifier, owner mask, or group switch. Four fixed nonnegative
 * weights sum to one. Equal-height cells produce a plateau; ascending equal
 * increments produce a plane in the interior. The fixed edge blend retains F's
 * old A shoreline interpolation, so this experiment changes interior ramps only.
 */
export function rampPlaneOffset(heights: Readonly<Record<string, number>>, cell: Cell,
    bounds: { minX: number; maxX: number; depth: number }) {
    const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
    const x = Math.floor(sx), z = Math.floor(sz), u = sx - x, v = sz - z;
    const h = (dx: number, dz: number) => heights[`${x + dx},${z + dz}`] ?? 0;
    const blend = (a: number, b: number) => ((1 - a) * h(0, 0) + a * h(1, 0)) * (1 - b)
        + ((1 - a) * h(0, 1) + a * h(1, 1)) * b;
    const edge = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
    const interior = smooth(Math.max(0, Math.min(1, edge * 6)));
    return blend(smooth(u), smooth(v)) * (1 - interior) + blend(u, v) * interior;
}
