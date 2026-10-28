import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { placeHeight as northHeight, planRamp as northPlan, placeRevision as northRevision, resetNorthPlacePlans,
    type PlaceShape as NorthShape, type RampPlan } from './field';
import { shoulderRevision, shoulderTrialMode, shoulderWidth, shoulderOutline } from './shoulder-section';

export type EntranceDirection = 'north' | 'east' | 'south' | 'west';
export interface PlaceShape extends NorthShape { rampDirection?: EntranceDirection; bayDepth?: number }
export type ShapeState = { trialPlace?: PlaceShape };
export interface DirectionalRampPlan extends RampPlan {
    direction: EntranceDirection;
    end: Cell;
    endpointHeights: number[];
    availableLength: number;
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const directions: Record<EntranceDirection, Cell> = {
    north: { x: 0, z: -1 }, east: { x: 1, z: 0 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 },
};
const plans = new WeakMap<object, Map<string, DirectionalRampPlan>>();
/** Call once on a compiled-world cache miss, before sampling any field height.
 * Clearing both variants also handles a direction change on the same state. */
export function resetPlacePlans(state: object): void {
    plans.delete(state);
    resetNorthPlacePlans(state);
}
export const shapeOf = (state: object) => (state as ShapeState).trialPlace;
export const placeRevision = (state: object) => {
    const place = shapeOf(state);
    const original = !place?.rampDirection || place.rampDirection === 'north'
        ? northRevision(state) : JSON.stringify(['directional-platform-diagnostic-v1', place]);
    return shoulderTrialMode() === 'off' ? original : JSON.stringify([shoulderRevision(), original]);
};
const directionOf = (place: PlaceShape) => {
    const direction = place.rampDirection ?? 'north';
    if (!(direction in directions)) throw Error('Unknown diagnostic entrance direction');
    return direction;
};
const pointAt = (center: Cell, axis: Cell, along: number, side = 0): Cell => ({
    x: center.x + axis.x * along - axis.z * side,
    z: center.z + axis.z * along + axis.x * side,
});

/** Diagnostic only. A changed direction never changes the requested height or
 * platform ellipse. A half-cell inset keeps the end within acquired ground.
 * The actual triangulated world still decides fixed supports and body routes. */
export function planDirectionalRamp(state: Pick<GrowingState, 'land'>, place: PlaceShape,
    sample: (cell: Cell) => number): DirectionalRampPlan {
    const direction = directionOf(place), axis = directions[direction];
    if (direction === 'north') {
        const plan = northPlan(place, sample);
        return { ...plan, direction, end: { x: place.center.x, z: plan.endZ }, endpointHeights: [plan.endHeight],
            availableLength: place.center.z - plan.topDistance - .5 };
    }
    if (place.height < 0) throw Error('Directional inlet is outside this ramp diagnostic');
    const bounds = landBounds(state), cross = { x: -axis.z, z: axis.x };
    const topDistance = place.flatRadius === undefined
        ? place.radius * .45 / (Math.hypot(axis.x, axis.z / .8) * .8)
        : place.flatRadius / Math.hypot(axis.x, axis.z / .8);
    const endLimit = direction === 'west' ? place.center.x - (bounds.minX + .5)
        : direction === 'east' ? bounds.maxX - .5 - place.center.x : bounds.depth - 1.5 - place.center.z;
    const availableLength = endLimit - topDistance;
    for (let length = .75; length <= availableLength + 1e-8; length += .25) {
        const end = pointAt(place.center, axis, topDistance + length);
        const probes = [-.18, 0, .18].map(side => ({ x: end.x + cross.x * side, z: end.z + cross.z * side }));
        if (probes.some(p => p.x < bounds.minX + .5 || p.x > bounds.maxX - .5 || p.z < .5 || p.z > bounds.depth - 1.5)) continue;
        const endpointHeights = probes.map(sample);
        // Changing direction must not silently use a water gap as its access
        // corridor. This is a sampled source-strip guard; it is not a general
        // proof that every opening in the outline's blend region is preserved.
        const steps = Math.max(1, Math.ceil(length / .08));
        const sourceDry = Array.from({ length: steps + 1 }, (_, i) => topDistance + length * i / steps)
            .every(along => [-.18, 0, .18].every(side => {
                const y = sample(pointAt(place.center, axis, along, side));
                return Number.isFinite(y) && y > -.375;
            }));
        if (!sourceDry) continue;
        if (endpointHeights.every(y => Number.isFinite(y) && y > -.375 && Math.abs(place.height - y) * 1.5 / length <= .45))
            return { direction, topDistance, length, end, endZ: end.z, endHeight: endpointHeights[1], endpointHeights,
                availableLength, designSlope: .45 };
    }
    throw Error('この向きには、乾いた足場へ登る坂をつくる広さが足りないよ。');
}

/** Keep the old export for diagnostic consumers that only plan north ramps. */
export const planRamp = northPlan;
export const diagnosticPlanFor = (state: object) => {
    const plan = plans.get(state)?.values().next().value;
    return plan && structuredClone(plan);
};

export function placeHeight(state: object, cell: Cell, baseline: number,
    sample: (cell: Cell) => number = () => baseline, cacheTag = 'default'): number {
    const place = shapeOf(state);
    if (!place || directionOf(place) === 'north') return northHeight(state, cell, baseline, sample, cacheTag);
    if (place.height < 0) throw Error('Directional inlet is outside this ramp diagnostic');
    const direction = directionOf(place), axis = directions[direction];
    const dx = cell.x - place.center.x, dz = cell.z - place.center.z;
    const radius = Math.hypot(dx / place.radius, dz / (place.radius * .8));
    const outline = place.flatRadius !== undefined
        ? shoulderOutline(place, cell)
        : 1 - smooth((radius - .68) / .42);
    const ordinary = baseline * (1 - outline) + place.height * outline;
    const along = dx * axis.x + dz * axis.z, lateral = -dx * axis.z + dz * axis.x;
    let map = plans.get(state);
    if (!map) { map = new Map(); plans.set(state, map); }
    let plan = map.get(cacheTag);
    if (!plan) { plan = planDirectionalRamp(state as Pick<GrowingState, 'land'>, place, sample); map.set(cacheTag, plan); }
    if (along < 0) return ordinary;
    const side = 1 - smooth((Math.abs(lateral) - place.entrance / 2) / .5);
    const end = sample(pointAt(place.center, axis, plan.topDistance + plan.length, lateral));
    const t = (along - plan.topDistance) / plan.length;
    const profile = t > 1 ? baseline : place.height * (1 - smooth(t)) + end * smooth(t);
    const begin = smooth(along / Math.max(.2, plan.topDistance));
    return ordinary * (1 - side * begin) + profile * side * begin;
}

export function diagnosticInfluenceContains(place: PlaceShape, plan: DirectionalRampPlan, cell: Cell): boolean {
    const dx = cell.x - place.center.x, dz = cell.z - place.center.z;
    const outline = place.flatRadius === undefined
        ? Math.hypot(dx / place.radius, dz / (place.radius * .8)) < 1.1
        : Math.hypot(dx, dz / .8) < place.flatRadius + shoulderWidth(place, cell);
    const axis = directions[plan.direction], along = dx * axis.x + dz * axis.z, lateral = -dx * axis.z + dz * axis.x;
    return outline || along >= 0 && along <= plan.topDistance + plan.length && Math.abs(lateral) < place.entrance / 2 + .5;
}

/** A sampled field's compiled triangles can carry a change across the analytic
 * boundary. The containing lattice cell is a conservative, explicit closure;
 * it is not permissible to describe the continuous formula as the exact mesh edge. */
export function diagnosticMeshInfluenceContains(place: PlaceShape, plan: DirectionalRampPlan, cell: Cell, detail: number): boolean {
    if (!(Number.isFinite(detail) && detail > 0)) throw Error('Invalid diagnostic mesh detail');
    const x = Math.floor(cell.x * detail + 1e-8) / detail, z = Math.floor(cell.z * detail + 1e-8) / detail;
    return [0, 1 / detail].some(dx => [0, 1 / detail].some(dz => diagnosticInfluenceContains(place, plan, { x: x + dx, z: z + dz })));
}
