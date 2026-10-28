import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { shapeOf, type EntranceDirection } from './directional-field';
import type { CoastalSection } from './coastal-section';

const axes: Record<EntranceDirection, Cell> = {
    west: { x: -1, z: 0 }, east: { x: 1, z: 0 }, north: { x: 0, z: -1 }, south: { x: 0, z: 1 },
};
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

/** C1 lower-only alternative to max(value, 0). It is exactly zero for <=0,
 * joins derivative 1 at epsilon, and never lowers by more than value. */
export function smoothPositivePart(value: number, epsilon: number): number {
    if (!(Number.isFinite(value) && Number.isFinite(epsilon) && epsilon > 0)) throw Error('Invalid lower-only transition');
    return value <= 0 ? 0 : value < epsilon ? value * value / (2 * epsilon) : value - epsilon / 2;
}

/** Compact lateral bump, with zero value, first and second derivatives at both
 * ends. Depth is a seaward displacement input, not a promised dry-area change. */
export function bayDisplacement(lateral: number, radius: number, depth: number, beta: 0 | .5 = 0): number {
    const t = (lateral + radius) / (2 * radius);
    const original = t <= 0 || t >= 1 ? 0 : depth * 64 * t ** 3 * (1 - t) ** 3;
    // Preserve the old arithmetic exactly. The explicit comparison spreads
    // central curvature towards the shoulders without changing depth or width;
    // it can still make the narrow side worse and requires an actual image test.
    return beta === 0 ? original : original * (1 + beta * (lateral / radius) ** 2);
}

export function createBayCoastalSection(state: Pick<GrowingState, 'land'>, sample: (cell: Cell) => number,
    mode: 'bay08' | 'bay12' | 'bay08spread', depthOverride?: number): CoastalSection {
    const shape = shapeOf(state);
    const noOp: CoastalSection = { mode, heightAt: sample, influenceContains: () => false,
        meshInfluenceContains: () => false, reserved: () => true };
    if (!shape) return noOp;
    if (shape.height >= 0) throw Error('湾の比較では、高さを「入り江」にしてね。');
    const depth = depthOverride ?? (mode === 'bay12' ? 1.2 : .8), beta = mode === 'bay08spread' ? .5 : 0;
    if (!(Number.isFinite(depth) && depth >= 0 && Number.isFinite(shape.radius) && shape.radius > 0)) throw Error('Invalid bay dimensions');
    if (depth === 0) return noOp;
    const b = landBounds(state), center = shape.center;
    const edges: { direction: EntranceDirection; distance: number }[] = [
        { direction: 'west', distance: center.x - b.minX + .5 },
        { direction: 'east', distance: b.maxX + .5 - center.x },
        { direction: 'north', distance: center.z + .5 },
        { direction: 'south', distance: b.depth - .5 - center.z },
    ];
    edges.sort((a, other) => a.distance - other.distance);
    const { direction, distance: coastDistance } = edges[0], axis = axes[direction];
    const bay = { depth, width: shape.radius * 2, innerBand: depth + 1, outwardBand: 1, positivePartEpsilon: .005,
        ...(beta ? { curveBeta: beta } : {}) };
    const coordinates = (cell: Cell) => {
        const dx = cell.x - center.x, dz = cell.z - center.z;
        return { inland: coastDistance - dx * axis.x - dz * axis.z, lateral: -dx * axis.z + dz * axis.x };
    };
    const influenceContains = (cell: Cell) => {
        const p = coordinates(cell);
        return Math.abs(p.lateral) < shape.radius && p.inland > -bay.outwardBand && p.inland < bay.innerBand;
    };
    const heightAt = (cell: Cell) => {
        const old = sample(cell);
        if (!influenceContains(cell)) return old;
        const p = coordinates(cell);
        const inlandWeight = 1 - smooth((p.inland - depth) / (bay.innerBand - depth));
        const seaWeight = smooth((p.inland + bay.outwardBand) / .2);
        const displacement = bayDisplacement(p.lateral, shape.radius, depth, beta) * inlandWeight * seaWeight;
        if (displacement === 0) return old;
        const shifted = sample({ x: cell.x + axis.x * displacement, z: cell.z + axis.z * displacement });
        return old - smoothPositivePart(old - shifted, bay.positivePartEpsilon);
    };
    const meshInfluenceContains = (cell: Cell, detail: number) => {
        if (!(Number.isFinite(detail) && detail > 0)) throw Error('Invalid mesh detail');
        const x = Math.floor(cell.x * detail + 1e-8) / detail, z = Math.floor(cell.z * detail + 1e-8) / detail;
        return [0, 1 / detail].some(dx => [0, 1 / detail].some(dz => influenceContains({ x: x + dx, z: z + dz })));
    };
    return { mode, direction, coastDistance, bay, heightAt, influenceContains, meshInfluenceContains,
        reserved: cell => !influenceContains(cell) };
}
