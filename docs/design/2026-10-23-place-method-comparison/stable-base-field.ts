import type { Cell } from '../../../src/domain/growingIsland/types';

export const STABLE_BASE_REVISION = 'fixed-core-base-v1';
const smooth = (t: number) => t * t * (3 - 2 * t);
const stable = (n: number) => Math.round(n * 1e9) / 1e9;
const height = (x: number, z: number) => {
    const east = Math.max(0, x - 5), west = Math.max(0, -x), south = Math.max(0, z - 4);
    const towardBay = Math.max(0, z - 3) / 3.4, forest = 1 / (1 + towardBay * towardBay);
    return 2.3 * (1 - Math.exp(-(Math.max(east, west) * .34 * forest + south * .04) / 2.3));
};

/** Coordinate-only base, independent of acquired land and placed owners. The
 * original garden includes its outer half-cell support footprint. Editing is
 * added by the ordinary rawHeight function after this base and is not frozen.
 * A one-cell outer collar joins the existing coordinate-defined banks. */
export function stableBaseHeightAt(cell: Cell): number {
    const dx = Math.max(0, -.5 - cell.x, cell.x - 5.5), dz = Math.max(0, -.5 - cell.z, cell.z - 4.5);
    const distance = Math.hypot(dx, dz);
    if (distance === 0) return 0;
    const weight = smooth(Math.min(1, distance));
    const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
    const a = height(x, z), b = height(x + 1, z), c = height(x, z + 1), d = height(x + 1, z + 1);
    const original = u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    return stable(original * weight);
}
