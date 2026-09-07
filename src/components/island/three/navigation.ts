import { ISLAND_EAST_LAND, ISLAND_ITEMS, ISLAND_MAIN_LAND, ISLAND_RESERVED_AREAS } from '../../../domain/island/catalog';
import type { IslandStageItem } from './types';

export interface GroundPoint { x: number; z: number }
interface Obstacle extends GroundPoint { radius: number }
export interface ResidentRoute { points: GroundPoint[]; yaw: number }
const FOOTPRINT = .42;
const STEP = .25;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const onEllipse = (point: GroundPoint, land: typeof ISLAND_MAIN_LAND) =>
    ((point.x - land.x) / (land.radiusX - FOOTPRINT)) ** 2 + ((point.z - land.z) / (land.radiusZ - FOOTPRINT)) ** 2 <= 1;

/** Foot centers stay inside an inset shore or on the explicit bridge deck. */
export function residentGroundIsSafe(point: GroundPoint, expanded: boolean) {
    if (onEllipse(point, ISLAND_MAIN_LAND)) return true;
    if (!expanded) return false;
    return onEllipse(point, ISLAND_EAST_LAND) || (point.x >= 4.05 && point.x <= 5.5 && Math.abs(point.z) <= .09);
}

export function residentGroundHeight(point: GroundPoint, expanded: boolean) {
    if (!expanded || point.x < 4 || point.x > 5.44 || Math.abs(point.z) > .12) return 0;
    return .19 + Math.sin((point.x - 4) / 1.44 * Math.PI) * .15;
}

export function residentObstacles(items: IslandStageItem[], targetId: string, departingId?: string): Obstacle[] {
    // The bridge is reserved against furnishing; it is deliberately walkable.
    return [
        ...ISLAND_RESERVED_AREAS.filter(area => !(area.x > 4 && area.x < 5.5)),
        ...items.filter(item => item.id !== targetId && item.id !== departingId && item.position).map(item => ({ ...item.position!, radius: ISLAND_ITEMS[item.kind].radius })),
    ];
}

export function residentPointIsClear(point: GroundPoint, expanded: boolean, obstacles: Obstacle[]) {
    return residentGroundIsSafe(point, expanded) && obstacles.every(obstacle => distance(point, obstacle) >= obstacle.radius + FOOTPRINT);
}

/** Initial scene placement only. Saved possessions are never moved to make room.
 * A blocked spawn uses the nearest clear quarter-grid point on its own island. */
export function findSafeResidentSpawn(origin: GroundPoint, items: IslandStageItem[], completedSets: number,
    occupied: readonly GroundPoint[] = []): GroundPoint | undefined {
    const land = origin.x > 4.6 ? ISLAND_EAST_LAND : ISLAND_MAIN_LAND;
    if (land === ISLAND_EAST_LAND && completedSets < 2) return undefined;
    const obstacles = residentObstacles(items, '');
    const clear = (point: GroundPoint) => onEllipse(point, land)
        && residentPointIsClear(point, completedSets >= 2, obstacles)
        && occupied.every(other => distance(point, other) >= FOOTPRINT * 2);
    if (clear(origin)) return { x: origin.x, z: origin.z };
    let nearest: GroundPoint | undefined, nearestDistance = Infinity;
    for (let ix = Math.ceil((land.x - land.radiusX) / STEP); ix <= Math.floor((land.x + land.radiusX) / STEP); ix++) {
        for (let iz = Math.ceil((land.z - land.radiusZ) / STEP); iz <= Math.floor((land.z + land.radiusZ) / STEP); iz++) {
            const point = { x: ix * STEP, z: iz * STEP }, d = distance(point, origin);
            if (d < nearestDistance && clear(point)) { nearest = point; nearestDistance = d; }
        }
    }
    return nearest;
}

function segmentClear(a: GroundPoint, b: GroundPoint, expanded: boolean, obstacles: Obstacle[]) {
    const count = Math.max(1, Math.ceil(distance(a, b) / .08));
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        if (!residentPointIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, expanded, obstacles)) return false;
    }
    return true;
}

function segmentRoute(start: GroundPoint, end: GroundPoint, expanded: boolean, obstacles: Obstacle[]): GroundPoint[] | undefined {
    if (segmentClear(start, end, expanded, obstacles)) return [start, end];
    const nodes: GroundPoint[] = [];
    const index = new Map<string, number>();
    for (let ix = -18; ix <= (expanded ? 31 : 18); ix++) for (let iz = -13; iz <= 13; iz++) {
        const point = { x: ix * STEP, z: iz * STEP };
        if (residentPointIsClear(point, expanded, obstacles)) { index.set(`${ix}:${iz}`, nodes.length); nodes.push(point); }
    }
    const nearest = (point: GroundPoint) => nodes.map((node, id) => ({ id, d: distance(node, point) }))
        .sort((a, b) => a.d - b.d).find(candidate => segmentClear(point, nodes[candidate.id], expanded, obstacles))?.id;
    const source = nearest(start), destination = nearest(end);
    if (source === undefined || destination === undefined) return undefined;
    const open = new Set([source]), costs = new Map([[source, 0]]), parents = new Map<number, number>();
    while (open.size) {
        let current = -1, score = Infinity;
        for (const id of open) {
            const candidate = costs.get(id)! + distance(nodes[id], nodes[destination]);
            if (candidate < score) { current = id; score = candidate; }
        }
        if (current === destination) {
            const route: GroundPoint[] = [end, nodes[current]];
            while (parents.has(current)) { current = parents.get(current)!; route.push(nodes[current]); }
            route.push(start); route.reverse();
            // Collapse grid corners only when every intervening sample remains safe.
            const smooth = [route[0]];
            for (let i = 0; i < route.length - 1;) {
                let next = route.length - 1;
                while (next > i + 1 && !segmentClear(route[i], route[next], expanded, obstacles)) next--;
                smooth.push(route[next]); i = next;
            }
            return smooth;
        }
        open.delete(current);
        const point = nodes[current], ix = Math.round(point.x / STEP), iz = Math.round(point.z / STEP);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            if (!dx && !dz) continue;
            const id = index.get(`${ix + dx}:${iz + dz}`);
            if (id === undefined || !segmentClear(point, nodes[id], expanded, obstacles)) continue;
            const next = costs.get(current)! + Math.hypot(dx, dz) * STEP;
            if (next < (costs.get(id) ?? Infinity)) { costs.set(id, next); parents.set(id, current); open.add(id); }
        }
    }
    return undefined;
}

export function planResidentRoute(origin: GroundPoint, target: IslandStageItem, items: IslandStageItem[], completedSets: number, departingId?: string): ResidentRoute | undefined {
    if (!target.position) return undefined;
    const expanded = completedSets >= 2, obstacles = residentObstacles(items, target.id, departingId);
    // A newly moved object can cover a standing resident. Every path segment
    // checks its start too, so no route can leave this point without clipping.
    // Reject once instead of rebuilding the same failed grid for every approach.
    if (!residentPointIsClear(origin, expanded, obstacles)) return undefined;
    // Leaving an occupied seat may cross its footprint. The new resting point must
    // still clear that seat, or the next visit would start inside an obstacle.
    const arrivalObstacles = departingId && departingId !== target.id ? residentObstacles(items, target.id) : obstacles;
    const seated = ['bench', 'swing', 'mushroom'].includes(target.kind);
    const reach = target.kind === 'fountain' ? 1.1 : .77;
    const directions = seated ? [target.rotation] : [target.rotation, target.rotation + Math.PI, target.rotation + Math.PI / 2,
        target.rotation - Math.PI / 2, .25 * Math.PI, .75 * Math.PI, 1.25 * Math.PI, 1.75 * Math.PI];
    for (const angle of directions) {
        const end = seated ? target.position : { x: target.position.x + Math.sin(angle) * reach, z: target.position.z + Math.cos(angle) * reach };
        if (!residentPointIsClear(end, expanded, arrivalObstacles)) continue;
        const crossing = expanded && (origin.x > 4.6) !== (end.x > 4.6);
        const bridge: GroundPoint[] = origin.x > 4.6 ? [{ x: 5.5, z: 0 }, { x: 4.05, z: 0 }] : [{ x: 4.05, z: 0 }, { x: 5.5, z: 0 }];
        const stops = [origin, ...(crossing ? bridge : []), end];
        const points: GroundPoint[] = [];
        let reachable = true;
        for (let i = 0; i < stops.length - 1; i++) {
            const route = segmentRoute(stops[i], stops[i + 1], expanded, obstacles);
            if (!route) { reachable = false; break; }
            points.push(...(i ? route.slice(1) : route));
        }
        if (reachable) return { points, yaw: seated ? target.rotation : angle + Math.PI };
    }
    return undefined;
}
