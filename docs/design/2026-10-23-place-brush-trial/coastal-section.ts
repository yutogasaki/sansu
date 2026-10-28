import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { shapeOf, type EntranceDirection } from './directional-field';
import { createBayCoastalSection } from './bay-section';
import { assemblyEnabled } from './assembly-mode';
import { createAssemblySection } from './assembly-section';

export type CoastalMode = 'off' | 'soft08' | 'soft12' | 'contour' | 'bay08' | 'bay12' | 'bay08spread';
export const COASTAL_SECTION_REVISION = 'local-lower-shore-v1';
const SEA_FLOOR = -.52, LOW_SHORE = -.27, MESH_HALO = 2 / 12;
const axes: Record<EntranceDirection, Cell> = {
    west: { x: -1, z: 0 }, east: { x: 1, z: 0 }, north: { x: 0, z: -1 }, south: { x: 0, z: 1 },
};
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
const point = (center: Cell, axis: Cell, along: number, lateral: number): Cell => ({
    x: center.x + axis.x * along - axis.z * lateral,
    z: center.z + axis.z * along + axis.x * lateral,
});

/** This unsaved geometry experiment must never reinterpret the v3 saved world. */
let lastQuery: string | undefined, lastMode: CoastalMode = 'off';
export function coastalTrialMode(): CoastalMode {
    if (assemblyEnabled()) return 'bay08';
    const search = typeof window === 'undefined' ? '' : window.location.search;
    if (search === lastQuery) return lastMode;
    const query = new URLSearchParams(search);
    const value = query.get('shoreTrial');
    if (value !== 'soft08' && value !== 'soft12' && value !== 'contour' && value !== 'bay08' && value !== 'bay12' && value !== 'bay08spread') {
        lastQuery = search; lastMode = 'off'; return 'off';
    }
    if (query.get('trialSave') === 'local') throw Error('岸の比較は保存を使わない専用画面で開いてね。');
    if ((value === 'bay08' || value === 'bay12' || value === 'bay08spread') && query.get('placeSetTrial') === 'two')
        throw Error('湾の比較は2つの高台の比較と分けて開いてね。');
    if (query.get('trialScene') !== 'shore' || query.get('terrainTrial') !== 'H')
        throw Error('岸の比較は専用の地形H・shore画面で開いてね。');
    lastQuery = search; lastMode = value;
    return value;
}

/** In bay mode the shape is only an inlet/center/width input. Never apply the
 * former negative ellipse before displacing the completed original shoreline. */
export function coastalBypassesPlaceField(state: object, mode: CoastalMode = coastalTrialMode()): boolean {
    if (assemblyEnabled()) return false;
    if (mode !== 'bay08' && mode !== 'bay12' && mode !== 'bay08spread') return false;
    const shape = shapeOf(state);
    if (!shape) return false;
    if (shape.height >= 0) throw Error('湾の比較では、高さを「入り江」にしてね。');
    return true;
}

export interface CoastalSection {
    mode: CoastalMode;
    direction?: EntranceDirection;
    requestedWidth?: number;
    coastDistance?: number;
    centerStart?: number;
    centerShoulderWidth?: number;
    contour?: { innerRadius: number; bevel: number; face: number; rim: number; waterTransition: number; arcDegrees: number; lateralExtent?: number };
    bay?: { depth: number; width: number; innerBand: number; outwardBand: number; positivePartEpsilon: number; curveBeta?: number };
    heightAt(cell: Cell): number;
    influenceContains(cell: Cell): boolean;
    meshInfluenceContains(cell: Cell, detail: number): boolean;
    reserved(cell: Cell): boolean;
}

/** Applies to the completed surface, after the ordinary outer shoreline fade.
 * It only lowers that surface. No owner positions enter the field, and no dry
 * land or covered opening can be introduced by this additional operator.
 * The explicit top and the entire ramp strip have a two-lattice-cell reserve.
 * Requested widths are clipped against that reserve, not obtained by shrinking
 * the usable top. The same nearest-edge rule is used at every place position. */
export function createCoastalPlaceSection(state: Pick<GrowingState, 'land'>, sample: (cell: Cell) => number,
    mode: CoastalMode = coastalTrialMode()): CoastalSection {
    const noOp: CoastalSection = { mode, heightAt: sample, influenceContains: () => false,
        meshInfluenceContains: () => false, reserved: () => true };
    if (mode === 'off') return noOp;
    if (assemblyEnabled()) return createAssemblySection(state, sample);
    if (mode === 'bay08' || mode === 'bay12' || mode === 'bay08spread') return createBayCoastalSection(state, sample, mode);
    if (!['soft08', 'soft12', 'contour'].includes(mode)) throw Error('Unknown coastal comparison mode');
    const shape = shapeOf(state);
    if (!shape || shape.height < 0 || shape.flatRadius === undefined) return noOp;
    const b = landBounds(state), center = shape.center, flat = shape.flatRadius;
    const edges: { direction: EntranceDirection; distance: number }[] = [
        { direction: 'west', distance: center.x - b.minX + .5 },
        { direction: 'east', distance: b.maxX + .5 - center.x },
        { direction: 'north', distance: center.z + .5 },
        { direction: 'south', distance: b.depth - .5 - center.z },
    ];
    edges.sort((a, other) => a.distance - other.distance);
    const { direction, distance: coastDistance } = edges[0], axis = axes[direction];
    const ramp = axes[shape.rampDirection ?? 'north'];
    const requestedWidth = mode === 'soft08' ? .8 : 1.2;
    const lateralOuter = flat + shape.radius * .42;
    const parts = (cell: Cell) => {
        const dx = cell.x - center.x, dz = cell.z - center.z;
        return { along: dx * axis.x + dz * axis.z, lateral: -dx * axis.z + dz * axis.x,
            rampAlong: dx * ramp.x + dz * ramp.z, rampLateral: -dx * ramp.z + dz * ramp.x,
            radial: Math.hypot(dx, dz / .8) };
    };
    const reserved = (cell: Cell) => {
        const p = parts(cell);
        return p.radial <= flat + MESH_HALO
            || p.rampAlong >= -MESH_HALO && Math.abs(p.rampLateral) <= shape.entrance / 2 + .5 + MESH_HALO;
    };
    if (mode === 'contour') {
        // A single elliptic distance owns the grass edge, bevel, cliff and rim.
        // The sea-facing 120-degree arc fades at its ends; no owner positions
        // select or truncate it. Continuing each ray to existing sea avoids a
        // lowered trench followed by the old outer wall.
        const contour = { innerRadius: flat + MESH_HALO, bevel: .12, face: .28, rim: .18,
            waterTransition: .14, arcDegrees: 120, lateralExtent: 0 };
        contour.lateralExtent = (contour.innerRadius + contour.bevel + contour.face + contour.rim)
            * (axis.x ? .8 : 1) * Math.sin(Math.PI / 3);
        const normalized = (cell: Cell) => {
            const dx = cell.x - center.x, dz = cell.z - center.z, radius = Math.hypot(dx, dz / .8);
            const unit = radius ? { x: dx / radius, z: dz / radius } : { x: 0, z: 0 };
            const facing = radius ? axis.x * unit.x + axis.z * unit.z / .8 : 0;
            const distances = [unit.x < 0 ? (b.minX - 1.5 - center.x) / unit.x : unit.x > 0 ? (b.maxX + 1.5 - center.x) / unit.x : Infinity,
                unit.z < 0 ? (-1.5 - center.z) / unit.z : unit.z > 0 ? (b.depth + .5 - center.z) / unit.z : Infinity];
            return { radius, unit, facing, endRadius: Math.min(...distances) };
        };
        const influenceContains = (cell: Cell) => {
            const p = normalized(cell);
            return !reserved(cell) && Math.abs(parts(cell).lateral) < contour.lateralExtent
                && p.facing > .5 && p.radius > contour.innerRadius && p.radius < p.endRadius;
        };
        const heightAt = (cell: Cell) => {
            const old = sample(cell);
            if (!influenceContains(cell)) return old;
            const p = normalized(cell), offset = p.radius - contour.innerRadius;
            const upper = sample({ x: center.x + p.unit.x * contour.innerRadius, z: center.z + p.unit.z * contour.innerRadius });
            const lip = upper - .06, rimHeight = -.31;
            const bevelEnd = contour.bevel, faceEnd = bevelEnd + contour.face, rimEnd = faceEnd + contour.rim;
            const profile = offset < bevelEnd ? upper - .06 * smooth(offset / contour.bevel)
                : offset < faceEnd ? lip + (rimHeight - lip) * smooth((offset - bevelEnd) / contour.face)
                    : offset < rimEnd ? rimHeight : rimHeight + (SEA_FLOOR - rimHeight) * smooth((offset - rimEnd) / contour.waterTransition);
            const arcWeight = smooth((p.facing - .5) / (Math.sqrt(3) / 2 - .5));
            const part = parts(cell);
            // Bound the arc's ends by its own rim width. An unbounded angular
            // fan would widen towards the sea and cut unrelated distant coast.
            const endWeight = 1 - smooth((Math.abs(part.lateral) - contour.lateralExtent * .65) / (contour.lateralExtent * .35));
            const rampWeight = part.rampAlong < -MESH_HALO ? 1
                : smooth((Math.abs(part.rampLateral) - shape.entrance / 2 - .5 - MESH_HALO) / .25);
            return Math.min(old, old + (profile - old) * arcWeight * rampWeight * endWeight);
        };
        const meshInfluenceContains = (cell: Cell, detail: number) => {
            if (!(Number.isFinite(detail) && detail > 0)) throw Error('Invalid mesh detail');
            const x = Math.floor(cell.x * detail + 1e-8) / detail, z = Math.floor(cell.z * detail + 1e-8) / detail;
            return [0, 1 / detail].some(dx => [0, 1 / detail].some(dz => influenceContains({ x: x + dx, z: z + dz })));
        };
        return { mode, direction, coastDistance, contour, heightAt, influenceContains, meshInfluenceContains, reserved };
    }
    const topEdge = (lateral: number) => {
        const crossScale = axis.x ? .8 : 1, alongScale = axis.x ? 1 : .8;
        return Math.sqrt(Math.max(0, (flat + MESH_HALO) ** 2 - (lateral / crossScale) ** 2)) * alongScale;
    };
    const startAt = (lateral: number) => Math.max(coastDistance - requestedWidth, topEdge(lateral));
    const shoreStart = coastDistance - .08, shoreEnd = coastDistance + .18, end = coastDistance + .9;
    const influenceContains = (cell: Cell) => {
        const p = parts(cell), start = startAt(p.lateral);
        return !reserved(cell) && Math.abs(p.lateral) < lateralOuter && start < shoreStart
            && p.along > start && p.along < end;
    };
    const heightAt = (cell: Cell) => {
        const old = sample(cell);
        if (!influenceContains(cell)) return old;
        const p = parts(cell), start = startAt(p.lateral);
        const upper = sample(point(center, axis, start, p.lateral));
        const profile = p.along < shoreStart
            ? upper + (LOW_SHORE - upper) * smooth((p.along - start) / (shoreStart - start))
            : p.along < shoreEnd ? LOW_SHORE
                : LOW_SHORE + (SEA_FLOOR - LOW_SHORE) * smooth((p.along - shoreEnd) / (end - shoreEnd));
        const sideWeight = 1 - smooth((Math.abs(p.lateral) - flat * .7) / (lateralOuter - flat * .7));
        const rampWeight = p.rampAlong < -MESH_HALO ? 1
            : smooth((Math.abs(p.rampLateral) - shape.entrance / 2 - .5 - MESH_HALO) / .25);
        return Math.min(old, old + (profile - old) * sideWeight * rampWeight);
    };
    const meshInfluenceContains = (cell: Cell, detail: number) => {
        if (!(Number.isFinite(detail) && detail > 0)) throw Error('Invalid mesh detail');
        // Bounds and the H sampling origin are half-integers on the 1/12 grid.
        const x = Math.floor(cell.x * detail + 1e-8) / detail, z = Math.floor(cell.z * detail + 1e-8) / detail;
        return [0, 1 / detail].some(dx => [0, 1 / detail].some(dz => influenceContains({ x: x + dx, z: z + dz })));
    };
    return { mode, direction, requestedWidth, coastDistance, centerStart: startAt(0),
        centerShoulderWidth: Math.max(0, shoreStart - startAt(0)), heightAt, influenceContains, meshInfluenceContains, reserved };
}
