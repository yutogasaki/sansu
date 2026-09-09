import { getIslandLandBounds, getIslandLandLevel, type IslandLandAccess, ISLAND_EAST_LAND, ISLAND_ITEMS, ISLAND_MAIN_LAND, ISLAND_RESERVED_AREAS, ISLAND_WEST_LAND } from '../../../domain/island/catalog';
import { islandFloorContains } from '../../../domain/island/landGeometry';
import type { IslandStageItem } from './types';

export interface GroundPoint { x: number; z: number }
interface Obstacle extends GroundPoint { radius: number }
export interface ResidentRoute { points: GroundPoint[]; yaw: number }
export interface ResidentRouteOptions { occupied?: readonly GroundPoint[]; obstacles?: readonly { x: number; z: number; radius: number }[] }
export interface ResidentPointRouteOptions extends ResidentRouteOptions {
    departingId?: string; departingIds?: readonly string[]; yaw?: number;
    /** Independent real geometry such as displays; never fake catalog furniture. */
    obstacles?: readonly { x: number; z: number; radius: number }[];
    /** A caller with actual articulated geometry may reject a segment beyond
     * the common foot clearance, for example a long tail beside a display. */
    segmentIsClear?: (from: GroundPoint, to: GroundPoint) => boolean;
}
export const RESIDENT_FOOTPRINT = .42;
const FOOTPRINT = RESIDENT_FOOTPRINT;
const STEP = .25;
const eastOpen = (access: IslandLandAccess) => getIslandLandLevel(access) >= 1;
const westOpen = (access: IslandLandAccess) => getIslandLandLevel(access) >= 2;
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const onEllipse = (point: GroundPoint, land: typeof ISLAND_MAIN_LAND) =>
    ((point.x - land.x) / (land.radiusX - FOOTPRINT)) ** 2 + ((point.z - land.z) / (land.radiusZ - FOOTPRINT)) ** 2 <= 1;

/** Foot centers stay inside an inset shore or on the explicit bridge deck. */
export function residentGroundIsSafe(point: GroundPoint, expanded: IslandLandAccess) {
    if (islandFloorContains(point, FOOTPRINT, getIslandLandLevel(expanded))) return true;
    if (eastOpen(expanded) && point.x >= 4.05 && point.x <= 5.5 && Math.abs(point.z) <= .09) return true;
    return westOpen(expanded) && point.x <= -4.05 && point.x >= -5.5 && Math.abs(point.z) <= .09;
}

export function residentGroundHeight(point: GroundPoint, expanded: IslandLandAccess) {
    const x = Math.abs(point.x), open = point.x < 0 ? westOpen(expanded) : eastOpen(expanded);
    if (!open || x < 4 || x > 5.44 || Math.abs(point.z) > .12) return 0;
    return .19 + Math.sin((x - 4) / 1.44 * Math.PI) * .15;
}

export function residentObstacles(items: readonly IslandStageItem[], targetId: string, departingId?: string): Obstacle[] {
    // The bridge is reserved against furnishing; it is deliberately walkable.
    return [
        ...ISLAND_RESERVED_AREAS.filter(area => !(Math.abs(area.x) > 4 && Math.abs(area.x) < 5.5)),
        ...items.filter(item => item.id !== targetId && item.id !== departingId && item.position).map(item => ({ ...item.position!, radius: ISLAND_ITEMS[item.kind].radius })),
    ];
}

export function residentPointIsClear(point: GroundPoint, expanded: IslandLandAccess, obstacles: Obstacle[]) {
    return residentGroundIsSafe(point, expanded) && obstacles.every(obstacle => distance(point, obstacle) >= obstacle.radius + FOOTPRINT);
}

/** Initial scene placement only. Saved possessions are never moved to make room.
 * A blocked spawn uses the nearest clear quarter-grid point on its own island. */
export function findSafeResidentSpawn(origin: GroundPoint, items: readonly IslandStageItem[], landAccess: IslandLandAccess,
    occupied: readonly GroundPoint[] = [], extraObstacles: readonly Obstacle[] = []): GroundPoint | undefined {
    const land = origin.x > 4.6 ? ISLAND_EAST_LAND : origin.x < -4.6 ? ISLAND_WEST_LAND : ISLAND_MAIN_LAND;
    if (land === ISLAND_EAST_LAND && !eastOpen(landAccess)) return undefined;
    if (land === ISLAND_WEST_LAND && !westOpen(landAccess)) return undefined;
    const obstacles = [...residentObstacles(items, ''), ...extraObstacles];
    const clear = (point: GroundPoint) => residentPointIsClear(point, landAccess, obstacles)
        && occupied.every(other => distance(point, other) >= FOOTPRINT * 2);
    // A valid current origin on newly connecting ground must survive a cancelled
    // visit. Searching for a replacement still stays within the original district.
    if (clear(origin) && (onEllipse(origin, land) || residentGroundHeight(origin, landAccess) === 0)) return { x: origin.x, z: origin.z };
    let nearest: GroundPoint | undefined, nearestDistance = Infinity;
    for (let ix = Math.ceil((land.x - land.radiusX) / STEP); ix <= Math.floor((land.x + land.radiusX) / STEP); ix++) {
        for (let iz = Math.ceil((land.z - land.radiusZ) / STEP); iz <= Math.floor((land.z + land.radiusZ) / STEP); iz++) {
            const point = { x: ix * STEP, z: iz * STEP }, d = distance(point, origin);
            if (d < nearestDistance && onEllipse(point, land) && clear(point)) { nearest = point; nearestDistance = d; }
        }
    }
    return nearest;
}

function segmentClear(a: GroundPoint, b: GroundPoint, expanded: IslandLandAccess, obstacles: Obstacle[]) {
    const count = Math.max(1, Math.ceil(distance(a, b) / .08));
    for (let i = 0; i <= count; i++) {
        const t = i / count;
        if (!residentPointIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, expanded, obstacles)) return false;
    }
    return true;
}

function segmentRoute(start: GroundPoint, end: GroundPoint, expanded: IslandLandAccess, obstacles: Obstacle[], geometryClear?: ResidentPointRouteOptions['segmentIsClear']): GroundPoint[] | undefined {
    const clear = (from: GroundPoint, to: GroundPoint) => segmentClear(from, to, expanded, obstacles) && (!geometryClear || geometryClear(from, to));
    if (clear(start, end)) return [start, end];
    const nodes: GroundPoint[] = [];
    const index = new Map<string, number>();
    const bounds = getIslandLandBounds(expanded);
    for (let ix = Math.ceil(bounds.minX / STEP); ix <= Math.floor(bounds.maxX / STEP); ix++) {
        for (let iz = Math.ceil(bounds.minZ / STEP); iz <= Math.floor(bounds.maxZ / STEP); iz++) {
            const point = { x: ix * STEP, z: iz * STEP };
            if (residentPointIsClear(point, expanded, obstacles)) { index.set(`${ix}:${iz}`, nodes.length); nodes.push(point); }
        }
    }
    const nearest = (point: GroundPoint, leaving: boolean) => nodes.map((node, id) => ({ id, d: distance(node, point) }))
        .sort((a, b) => a.d - b.d).find(candidate => leaving ? clear(point, nodes[candidate.id]) : clear(nodes[candidate.id], point))?.id;
    const source = nearest(start, true), destination = nearest(end, false);
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
                while (next > i + 1 && !clear(route[i], route[next])) next--;
                smooth.push(route[next]); i = next;
            }
            return smooth;
        }
        open.delete(current);
        const point = nodes[current], ix = Math.round(point.x / STEP), iz = Math.round(point.z / STEP);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            if (!dx && !dz) continue;
            const id = index.get(`${ix + dx}:${iz + dz}`);
            if (id === undefined || !clear(point, nodes[id])) continue;
            const next = costs.get(current)! + Math.hypot(dx, dz) * STEP;
            if (next < (costs.get(id) ?? Infinity)) { costs.set(id, next); parents.set(id, current); open.add(id); }
        }
    }
    return undefined;
}

function occupiedObstacles(occupied: readonly GroundPoint[] = []): Obstacle[] {
    return occupied.map(point => ({ ...point, radius: FOOTPRINT }));
}

/** A departure token only frees the furniture the origin actually overlaps.
 * Moving/storing that saved item cannot exempt its new location from collision. */
function departureAt(origin: GroundPoint, items: readonly IslandStageItem[], departingId?: string) {
    const item = items.find(candidate => candidate.id === departingId);
    return item?.position && distance(origin, item.position) <= ISLAND_ITEMS[item.kind].radius + FOOTPRINT + 1e-8 ? item.id : undefined;
}

function connectGroundRoute(origin: GroundPoint, end: GroundPoint, expanded: IslandLandAccess, obstacles: Obstacle[], geometryClear?: ResidentPointRouteOptions['segmentIsClear']) {
    const district = (point: GroundPoint) => point.x > 4.6 ? 1 : point.x < -4.6 ? -1 : 0;
    const from = district(origin), to = district(end);
    const bridge: GroundPoint[] = [];
    if (from !== to) {
        if (from) bridge.push({ x: from * 5.5, z: 0 }, { x: from * 4.05, z: 0 });
        if (to) bridge.push({ x: to * 4.05, z: 0 }, { x: to * 5.5, z: 0 });
    }
    const stops = [origin, ...bridge, end], points: GroundPoint[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const route = segmentRoute(stops[i], stops[i + 1], expanded, obstacles, geometryClear);
        if (!route) return undefined;
        points.push(...(i ? route.slice(1) : route));
    }
    return points;
}

export function planResidentPointRoute(origin: GroundPoint, destination: GroundPoint, items: readonly IslandStageItem[], landAccess: IslandLandAccess,
    options: ResidentPointRouteOptions = {}): ResidentRoute | undefined {
    if (![origin.x, origin.z, destination.x, destination.z].every(Number.isFinite)
        || (options.yaw !== undefined && !Number.isFinite(options.yaw))) return undefined;
    const expanded = landAccess, occupied = occupiedObstacles(options.occupied);
    const departingIds = new Set([options.departingId, ...(options.departingIds ?? [])]
        .map(id => departureAt(origin, items, id)).filter((id): id is string => Boolean(id)));
    const extra = options.obstacles ?? [];
    if (extra.some(obstacle => ![obstacle.x, obstacle.z, obstacle.radius].every(Number.isFinite) || obstacle.radius < 0)) return undefined;
    const obstacles = [...residentObstacles(items.filter(item => !departingIds.has(item.id)), ''), ...occupied, ...extra];
    // A departing seat may be crossed only to leave it, never to choose a new
    // standing point within its footprint or another resident's body.
    const arrivalObstacles = [...residentObstacles(items, ''), ...occupied, ...extra];
    if (!residentPointIsClear(origin, expanded, obstacles) || !residentPointIsClear(destination, expanded, arrivalObstacles)) return undefined;
    const points = connectGroundRoute(origin, destination, expanded, obstacles, options.segmentIsClear);
    return points ? { points, yaw: options.yaw ?? Math.atan2(destination.x - origin.x, destination.z - origin.z) } : undefined;
}

export function planResidentRoute(origin: GroundPoint, target: IslandStageItem, items: readonly IslandStageItem[], landAccess: IslandLandAccess,
    departingId?: string, options: ResidentRouteOptions = {}): ResidentRoute | undefined {
    if (!target.position) return undefined;
    const expanded = landAccess, occupied = occupiedObstacles(options.occupied);
    departingId = departureAt(origin, items, departingId);
    const obstacles = [...residentObstacles(items, target.id, departingId), ...occupied, ...(options.obstacles ?? [])];
    // A newly moved object can cover a standing resident. Every path segment
    // checks its start too, so no route can leave this point without clipping.
    // Reject once instead of rebuilding the same failed grid for every approach.
    if (!residentPointIsClear(origin, expanded, obstacles)) return undefined;
    // Leaving an occupied seat may cross its footprint. The new resting point must
    // still clear that seat, or the next visit would start inside an obstacle.
    const arrivalObstacles = departingId && departingId !== target.id ? [...residentObstacles(items, target.id), ...occupied, ...(options.obstacles ?? [])] : obstacles;
    const seated = ['bench', 'swing', 'mushroom'].includes(target.kind);
    const reach = target.kind === 'fountain' ? 1.1 : .77;
    const directions = seated ? [target.rotation] : [target.rotation, target.rotation + Math.PI, target.rotation + Math.PI / 2,
        target.rotation - Math.PI / 2, .25 * Math.PI, .75 * Math.PI, 1.25 * Math.PI, 1.75 * Math.PI];
    for (const angle of directions) {
        const end = seated ? target.position : { x: target.position.x + Math.sin(angle) * reach, z: target.position.z + Math.cos(angle) * reach };
        if (!residentPointIsClear(end, expanded, arrivalObstacles)) continue;
        const points = connectGroundRoute(origin, end, expanded, obstacles);
        if (points) return { points, yaw: seated ? target.rotation : angle + Math.PI };
    }
    return undefined;
}
