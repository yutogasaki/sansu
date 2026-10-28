import { landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { CONVEX_TERRACE_DETAIL } from '../2026-10-23-place-method-comparison/terrace-convex-field';
import { placeHeight as singleHeight, placeRevision as singleRevision, resetPlacePlans as resetSinglePlans,
    planDirectionalRamp, diagnosticInfluenceContains, shapeOf, type PlaceShape, type DirectionalRampPlan } from './directional-field';
import { maximumShoulderWidth, shoulderTrialMode, shoulderRevision } from './shoulder-section';
import { assemblyEnabled, coastSetEnabled, ASSEMBLY_RECIPE, MULTI_BAY_RECIPE } from './assembly-mode';

export type PlaceSlot = 'west' | 'east' | 'bay' | 'bay2';
export type PlaceSet = Partial<Record<PlaceSlot, PlaceShape>>;
export type CompositeState = { trialPlaceSet?: PlaceSet };
export const COMPOSITE_RECIPE = 'disjoint-two-platform-memory-v1';
const slots: PlaceSlot[] = ['west', 'east'];
export const compositeOf = (state: object): PlaceSet | undefined => (state as CompositeState).trialPlaceSet;
export function compositeEnabled(): boolean {
    assemblyEnabled(); coastSetEnabled();
    shoulderTrialMode(); // Fail closed before the trial hook can enable a real profile.
    const query = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    if (query.get('placeSetTrial') !== 'two') return false;
    if (query.has('trialSave') && query.get('trialSave') !== (assemblyEnabled() ? 'assembly-local' : 'two-local')) throw Error('2つの場所の比較はこの指定では保存できません。保存専用URLで開いてください。');
    if (query.has('shoreTrial') && query.get('shoreTrial') !== 'off') throw Error('2つの場所の比較では岸の加工をoffにしてください。');
    if (query.get('terrainTrial') !== 'H') throw Error('2つの場所の比較は地形Hで開いてください。');
    if (query.get('trialScene') !== 'shore') throw Error('2つの場所の比較は専用の岸の初期データで開いてください。');
    return true;
}
export const normalizedShape = (shape: PlaceShape): PlaceShape => ({ center: { x: shape.center.x, z: shape.center.z }, radius: shape.radius,
    height: shape.height, entrance: shape.entrance, ...(shape.flatRadius === undefined ? {} : { flatRadius: shape.flatRadius }),
    ...(shape.rampDirection === undefined ? {} : { rampDirection: shape.rampDirection }),
    ...(shape.bayDepth === undefined ? {} : { bayDepth: shape.bayDepth }) });
export const normalizedSet = (set: PlaceSet): PlaceSet => Object.fromEntries(([...slots, 'bay', 'bay2'] as PlaceSlot[]).flatMap(slot => set[slot] ? [[slot, normalizedShape(set[slot]!)]] : []));
export const placeRevision = (state: object) => {
    if (compositeOf(state) === undefined) return singleRevision(state);
    const original = JSON.stringify([coastSetEnabled() ? MULTI_BAY_RECIPE : assemblyEnabled() ? ASSEMBLY_RECIPE : COMPOSITE_RECIPE, normalizedSet(compositeOf(state)!)]);
    return shoulderTrialMode() === 'off' ? original : JSON.stringify([shoulderRevision(), original]);
};
export const hasFlatPlace = (state: object) => compositeOf(state) === undefined ? shapeOf(state)?.flatRadius !== undefined
    : slots.some(slot => compositeOf(state)![slot]?.flatRadius !== undefined);

interface PlannedSlot { slot: PlaceSlot; shape: PlaceShape; proxy: object; plan: DirectionalRampPlan; cells: Set<string> }
const prepared = new WeakMap<object, Map<string, PlannedSlot[]>>();
export function resetPlacePlans(state: object): void {
    if (compositeOf(state) !== undefined && !compositeEnabled()) throw Error('2つの場所の比較専用画面で開いてください。');
    prepared.delete(state); resetSinglePlans(state);
}

/** Conservative closure of the analytic outline/ramp on the actual H lattice.
 * A cell is reserved if any corner is affected; touching reservations reject. */
function influenceCells(state: Pick<GrowingState, 'land'>, shape: PlaceShape, plan: DirectionalRampPlan): Set<string> {
    const b = landBounds(state), detail = CONVEX_TERRACE_DETAIL, result = new Set<string>();
    const radius = shape.flatRadius === undefined ? shape.radius * 1.1 : shape.flatRadius + maximumShoulderWidth(shape);
    const width = shape.entrance / 2 + .5;
    const minX = Math.floor(Math.min(shape.center.x - radius, plan.end.x - width) * detail) - 1;
    const maxX = Math.ceil(Math.max(shape.center.x + radius, plan.end.x + width) * detail) + 1;
    const minZ = Math.floor(Math.min(shape.center.z - radius, plan.end.z - width) * detail) - 1;
    const maxZ = Math.ceil(Math.max(shape.center.z + radius, plan.end.z + width) * detail) + 1;
    for (let z = Math.max(minZ, Math.floor((-.5) * detail)); z <= Math.min(maxZ, Math.ceil((b.depth - .5) * detail)); z++)
        for (let x = Math.max(minX, Math.floor((b.minX - .5) * detail)); x <= Math.min(maxX, Math.ceil((b.maxX + .5) * detail)); x++)
            if ([0, 1].some(dx => [0, 1].some(dz => diagnosticInfluenceContains(shape, plan, { x: (x + dx) / detail, z: (z + dz) / detail }))))
                result.add(`${x},${z}`);
    return result;
}
function prepare(state: object, sample: (cell: Cell) => number, tag: string): PlannedSlot[] {
    let cache = prepared.get(state);
    if (!cache) { cache = new Map(); prepared.set(state, cache); }
    const known = cache.get(tag); if (known) return known;
    const set = compositeOf(state)!;
    const plans = slots.flatMap(slot => {
        const shape = set[slot]; if (!shape) return [];
        const landState = state as Pick<GrowingState, 'land'>;
        const proxy = { land: landState.land, trialPlace: shape };
        const plan = planDirectionalRamp(landState, shape, sample);
        return [{ slot, shape, proxy, plan, cells: influenceCells(landState, shape, plan) }];
    });
    if (plans.length === 2 && [...plans[0].cells].some(cell => plans[1].cells.has(cell)))
        throw Error('2つの場所の輪郭か坂が重なっています。少し離して選んでね。');
    cache.set(tag, plans); return plans;
}
export function placeHeight(state: object, cell: Cell, baseline: number,
    sample: (cell: Cell) => number = () => baseline, cacheTag = 'default'): number {
    if (compositeOf(state) === undefined) return singleHeight(state, cell, baseline, sample, cacheTag);
    const plans = prepare(state, sample, cacheTag);
    // All deltas are evaluated against the same unmodified baseline. Stable
    // slot order and disjoint influence make insertion order irrelevant.
    if (plans.length === 1) return singleHeight(plans[0].proxy, cell, baseline, sample, cacheTag);
    const active = plans.filter(item => diagnosticInfluenceContains(item.shape, item.plan, cell));
    if (active.length > 1) throw Error('場所の影響範囲が重なっています。');
    // At most one nonzero delta exists. Return that independent sample directly
    // to preserve exact single-place numerics, avoiding subtract/add round-off.
    // A legacy blend of baseline with itself can differ by one ULP beyond its
    // analytic support. Such round-off is not a second geometric delta.
    return active.length ? singleHeight(active[0].proxy, cell, baseline, sample, cacheTag) : baseline;
}
export const compositePlansFor = (state: object) => prepared.get(state)?.values().next().value?.map(item => ({
    slot: item.slot, plan: structuredClone(item.plan), influenceCells: [...item.cells].sort(),
}));
