import { ISLAND_EAST_LAND, ISLAND_ITEMS, ISLAND_MAIN_LAND, ISLAND_WEST_LAND } from '../../../domain/island/catalog';
import { planResidentPointRoute, RESIDENT_FOOTPRINT, residentObstacles, residentPointIsClear,
    type GroundPoint, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

export interface FurnitureClearanceResident {
    position: GroundPoint;
    visible: boolean;
    itemId?: string;
    departingId?: string;
}
export interface FurnitureClearancePlan {
    moves: Array<{ index: number; route: ResidentRoute }>;
    blocked: number[];
}
type PlacedItem = IslandStageItem & { position: GroundPoint };
const STEP = .25, MARGIN = .25, EPSILON = 1e-8;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const radius = (item: IslandStageItem) => ISLAND_ITEMS[item.kind].radius + RESIDENT_FOOTPRINT;
const overlaps = (point: GroundPoint, item: PlacedItem) => distance(point, item.position) < radius(item) - EPSILON;

/** Leaving an already overlapping object is necessary, but a side step must
 * not go farther into it or later enter that footprint again. */
function leavesFurniture(route: ResidentRoute, items: PlacedItem[]) {
    const start = route.points[0], minimum = items.map(item => distance(start, item.position));
    const exited = items.map(() => false);
    for (let index = 1; index < route.points.length; index++) {
        const a = route.points[index - 1], b = route.points[index], steps = Math.max(1, Math.ceil(distance(a, b) / .04));
        for (let step = 0; step <= steps; step++) {
            const t = step / steps, point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
                const d = distance(point, items[itemIndex].position), edge = radius(items[itemIndex]);
                if (d < minimum[itemIndex] - EPSILON || (exited[itemIndex] && d < edge - EPSILON)) return false;
                if (d >= edge) exited[itemIndex] = true;
            }
        }
    }
    return true;
}

/** Saved-layout reconciliation only. The caller decides when to run these
 * ordinary walks; a preview never enters this pure planner. */
export function planFurnitureClearance(items: readonly IslandStageItem[], residents: readonly FurnitureClearanceResident[],
    completedSets: number): FurnitureClearancePlan {
    const placed = items.filter((item): item is PlacedItem => Boolean(item.position));
    const positions = residents.map(resident => ({ x: resident.position.x, z: resident.position.z }));
    const pending = residents.flatMap((resident, index) => resident.visible
        && placed.some(item => item.id !== resident.itemId && overlaps(positions[index], item)) ? [index] : []);
    const plan: FurnitureClearancePlan = { moves: [], blocked: [] };
    if (!pending.length) return plan;
    const expanded = completedSets >= 2;
    const obstacles = residentObstacles(items, '');
    const grid: GroundPoint[] = [];
    for (let ix = Math.ceil((completedSets >= 12 ? ISLAND_WEST_LAND.x - ISLAND_WEST_LAND.radiusX : ISLAND_MAIN_LAND.x - ISLAND_MAIN_LAND.radiusX) / STEP);
        ix <= Math.floor((expanded ? ISLAND_EAST_LAND.x + ISLAND_EAST_LAND.radiusX : ISLAND_MAIN_LAND.radiusX) / STEP); ix++) {
        for (let iz = Math.ceil(-ISLAND_MAIN_LAND.radiusZ / STEP); iz <= Math.floor(ISLAND_MAIN_LAND.radiusZ / STEP); iz++) {
            const point = { x: ix * STEP, z: iz * STEP };
            if (residentPointIsClear(point, completedSets, obstacles)
                && placed.every(item => distance(point, item.position) >= radius(item) + MARGIN)) grid.push(point);
        }
    }

    const choose = (index: number) => {
        const origin = positions[index], occupied = positions.filter((_, otherIndex) => otherIndex !== index && residents[otherIndex].visible);
        const departing = placed.filter(item => distance(origin, item.position) <= radius(item) + EPSILON);
        const departingIds = new Set(departing.map(item => item.id));
        const blockers = [...residentObstacles(items.filter(item => !departingIds.has(item.id)), ''),
            ...occupied.map(point => ({ ...point, radius: RESIDENT_FOOTPRINT }))];
        if (!residentPointIsClear(origin, completedSets, blockers)) return undefined;
        const collision = departing.filter(item => item.id !== residents[index].itemId && overlaps(origin, item))
            .sort((a, b) => (radius(b) - distance(origin, b.position)) - (radius(a) - distance(origin, a.position))
                || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
        if (!collision) return undefined;
        const separation = distance(origin, collision.position);
        const forward = separation > EPSILON
            ? { x: (origin.x - collision.position.x) / separation, z: (origin.z - collision.position.z) / separation }
            : { x: Math.sin(collision.rotation), z: Math.cos(collision.rotation) };
        const candidates = grid.filter(point => occupied.every(other => distance(point, other) >= RESIDENT_FOOTPRINT * 2))
            .map(point => {
                const d = distance(point, origin), longitudinal = Math.abs((point.x - origin.x) * forward.x + (point.z - origin.z) * forward.z);
                return { point, score: d + .9 * longitudinal / Math.max(EPSILON, d), d };
            }).sort((a, b) => a.score - b.score || a.d - b.d || a.point.x - b.point.x || a.point.z - b.point.z);
        for (const { point } of candidates) {
            const route = planResidentPointRoute(origin, point, items, completedSets, { occupied,
                departingIds: departing.map(item => item.id),
                yaw: Math.atan2(collision.position.x - point.x, collision.position.z - point.z) });
            if (route && leavesFurniture(route, departing)) return route;
        }
        return undefined;
    };

    // A later resident may make room for an earlier blocked one. Retry only
    // after a real planned arrival changes the occupied points.
    let remaining = pending;
    while (remaining.length) {
        const blocked: number[] = [];
        for (const index of remaining) {
            const route = choose(index);
            if (!route) { blocked.push(index); continue; }
            plan.moves.push({ index, route });
            positions[index] = { ...route.points[route.points.length - 1] };
        }
        if (blocked.length === remaining.length) { plan.blocked = blocked; break; }
        remaining = blocked;
    }
    return plan;
}
