import type { Cell } from './types';

const stable = (n: number) => Math.round(n * 1e9) / 1e9;
const linearSample = (f: (n: number) => number, n: number) => {
    const lo = Math.floor(n), t = n - lo;
    return f(lo) * (1 - t) + f(lo + 1) * t;
};
// Fixed coordinates, never current bounds: adding land cannot reshape the old garden.
const bend = (x: number) => {
    const d = Math.max(0, -x, x - 5);
    return (x < 0 ? .56 : .72) * d * d / (6 + d);
};
const sway = (z: number) => {
    const d = Math.max(0, z - 5);
    return 1.65 * (1 - Math.exp(-d / 6)) * Math.sin(d * Math.PI / 12);
};
const b = (x: number) => linearSample(bend, x);
const s = (z: number) => linearSample(sway, z);

/** An orientation-preserving pair of grid-linear shears. All acquired cells remain
 * real ground; an inlet is the concave outline, never deleted land or an inner hole.
 * Within each cell X/Z are affine, matching the rendered floor triangles exactly. */
export function landscapePoint(cell: Cell): Cell {
    return { x: stable(cell.x + s(cell.z)), z: stable(cell.z + b(cell.x)) };
}

/** |b' s'| < .34: this contraction converges for unlimited districts as well as
 * fractional feet/hit points. Rounding to cells belongs to the caller. */
export function landscapeCell(point: Cell): Cell {
    let x = point.x, z = point.z;
    for (let i = 0; i < 32; i++) { x = point.x - s(z); z = point.z - b(x); }
    return { x: stable(x), z: stable(z) };
}

const hill = (x: number, z: number) => {
    const d = Math.max(0, z - 7), gate = 1 - Math.exp(-d / 3);
    const center = 2.5 + .8 * Math.sin(d * Math.PI / 12);
    const width = 1 + ((x - center) / 5.2) ** 2;
    return 1.16 * gate * (.5 - .5 * Math.cos(d * Math.PI / 6)) / width;
};

/** Relative to the existing shared floor. Sample the same diagonal as its triangles;
 * gallery floors retain their height above the ground rather than being buried. */
export function landscapeRise(cell: Cell): number {
    const x = Math.floor(cell.x), z = Math.floor(cell.z), u = cell.x - x, v = cell.z - z;
    const a = hill(x, z), b = hill(x + 1, z), c = hill(x, z + 1), d = hill(x + 1, z + 1);
    return stable(u + v <= 1 ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d));
}
