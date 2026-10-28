import type { Cell } from '../../../src/domain/growingIsland/types';

/** A fixed-space projection experiment, independent of land, owners or edits.
 * Compose after the old landscape projection. These two sequential shears
 * preserve continuous signed area exactly; their inverse is algebraic. */
export const CURVED_GRID_REVISION = 'fixed-two-shear-grid-v1';
const xAmplitude = .72, zAmplitude = .44, frequency = Math.PI / 5, phase = .55;
const xShift = (z: number) => xAmplitude * Math.sin((z - 2) * frequency);
const zShift = (x: number) => zAmplitude * (Math.sin((x - 2.5) * frequency + phase) - Math.sin(phase));
const xSlope = (z: number) => xAmplitude * frequency * Math.cos((z - 2) * frequency);
const zSlope = (x: number) => zAmplitude * frequency * Math.cos((x - 2.5) * frequency + phase);
export function curvedGridPoint(point: Cell): Cell {
    const x = point.x + xShift(point.z);
    return { x, z: point.z + zShift(x) };
}
export function curvedGridCell(point: Cell): Cell {
    const z = point.z - zShift(point.x);
    return { x: point.x - xShift(z), z };
}
export function curvedGridJacobian(point: Cell) {
    const a = xSlope(point.z), b = zSlope(point.x + xShift(point.z));
    return { xx: 1, xz: a, zx: b, zz: 1 + a * b };
}
export const CURVED_GRID_DESIGN = { xAmplitude, zAmplitude, frequency, phase,
    pivot: { x: 2.5, z: 2 }, xSlopeBound: xAmplitude * frequency, zSlopeBound: zAmplitude * frequency,
    limitation: 'analytic map preserves area; rendered triangles approximate it. Real world inverse and physical model footprints must be tested separately.' };
