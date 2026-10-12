import type { Cell } from './types';
import type { CompiledWorldFloor, CompiledWorldSite, IslandWorld, WorldFloorSample } from './worldDefinition';
import type { WorldSiteRef } from './worldTypes';
import { clipPolygon, intersectPolygons, mapTrianglePoint, polygonArea, polygonBounds, polygonHasArea, protectionRectangle, subtractPolygon } from './authoredWaterGeometry';

/** The authored planting footprint and the supported width of a walking actor. */
export const AUTHORED_OWNER_HALF_EXTENT = .46;
export const AUTHORED_WALK_HALF_WIDTH = .12;
const clearance = AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH;
const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;

interface ShoreGeometry {
    floors: readonly CompiledWorldFloor[];
    walkSites: readonly CompiledWorldSite[];
    floorAt: (cell: Cell) => WorldFloorSample | undefined;
    anchorFloorAt: (cell: Cell) => WorldFloorSample | undefined;
}
interface ShoreTriangle { floorId: string; water: boolean; points: readonly { x: number; y: number; z: number }[]; box: ReturnType<typeof polygonBounds>; order: number }
interface ShoreIndex {
    buckets: Map<string, ShoreTriangle[]>;
    waterBuckets: Map<string, ShoreTriangle[]>;
    waterFloors: Map<string, ReturnType<typeof polygonBounds>>;
    footAnswers: Map<string, boolean>;
    waterDistances: Map<string, Map<string, number>>;
}
const shoreIndexes = new WeakMap<readonly CompiledWorldFloor[], ShoreIndex>();
const walkKeys = new WeakMap<readonly CompiledWorldSite[], ReadonlySet<string>>();
const SHORE_DISTANCE = .65;
const MAX_SHORE_ANSWERS = 16_384;
function shoreIndex(floors: readonly CompiledWorldFloor[]): ShoreIndex {
    const existing = shoreIndexes.get(floors); if (existing) return existing;
    const index: ShoreIndex = { buckets: new Map(), waterBuckets: new Map(), waterFloors: new Map(), footAnswers: new Map(), waterDistances: new Map() };
    let order = 0;
    for (const floor of floors) {
        if (floor.kind === 'water') index.waterFloors.set(floor.id, polygonBounds(floor.vertices.map(vertex => vertex.point)));
        for (let i = 0; i < floor.indices.length; i += 3) {
            const points = floor.indices.slice(i, i + 3).map(id => floor.vertices[id].point), box = polygonBounds(points);
            const triangle = { floorId: floor.id, water: floor.kind === 'water', points, box, order: order++ };
            for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
                const id = cellKey({ x, z }), list = index.buckets.get(id) ?? []; list.push(triangle); index.buckets.set(id, list);
                if (triangle.water) {
                    const water = index.waterBuckets.get(id) ?? []; water.push(triangle); index.waterBuckets.set(id, water);
                }
            }
        }
    }
    shoreIndexes.set(floors, index); return index;
}
function shoreTriangles(buckets: ReadonlyMap<string, readonly ShoreTriangle[]>, point: Cell, radius: number) {
    const triangles = new Set<ShoreTriangle>();
    for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++)
        for (const triangle of buckets.get(cellKey({ x, z })) ?? []) if (triangle.box.minX <= point.x + radius && triangle.box.maxX >= point.x - radius
            && triangle.box.minZ <= point.z + radius && triangle.box.maxZ >= point.z - radius) triangles.add(triangle);
    return [...triangles];
}
function waterDistance(point: Cell, triangle: ShoreTriangle) {
    const crosses = triangle.points.map((a, i) => {
        const b = triangle.points[(i + 1) % triangle.points.length];
        return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    });
    if (crosses.every(value => value >= -1e-12) || crosses.every(value => value <= 1e-12)) return 0;
    return Math.min(...triangle.points.map((a, i) => {
        const b = triangle.points[(i + 1) % triangle.points.length], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
    }));
}
function shoreHeight(triangle: ShoreTriangle, point: Cell) {
    return mapTrianglePoint(point, triangle.points, triangle.points.map(p => ({ x: p.y, z: 0 }))).x;
}
function hasWalkRef(world: ShoreGeometry, cell: Cell) {
    // The compiler's in-progress list is not frozen yet. Do not retain an
    // index for arbitrary mutable callers; published compiled refs are fixed.
    if (!Object.isFrozen(world.walkSites)) return world.walkSites.some(site => cellKey(site.cell) === cellKey(cell));
    let keys = walkKeys.get(world.walkSites);
    if (!keys) { keys = new Set(world.walkSites.map(site => cellKey(site.cell))); walkKeys.set(world.walkSites, keys); }
    return keys.has(cellKey(cell));
}
function distancesAt(index: ShoreIndex, point: Cell) {
    const id = cellKey(point), existing = index.waterDistances.get(id); if (existing) return existing;
    const distances = new Map<string, number>();
    for (const triangle of shoreTriangles(index.waterBuckets, point, SHORE_DISTANCE)) {
        const distance = waterDistance(point, triangle), previous = distances.get(triangle.floorId) ?? Infinity;
        distances.set(triangle.floorId, Math.min(previous, distance));
    }
    if (index.waterDistances.size >= MAX_SHORE_ANSWERS) index.waterDistances.clear();
    index.waterDistances.set(id, distances); return distances;
}
function subtractShoreCover(polygon: Cell[], cover: readonly Cell[], orientation: number): Cell[][] {
    // These strict cases produce exactly the original subtraction's values:
    // earlier planes keep every vertex, then one rejects every vertex, or all
    // planes keep every vertex. Boundary/mixed cases retain its full partition
    // and per-piece area thresholds rather than replacing them by a union.
    for (let i = 0; i < cover.length; i++) {
        const a = cover[i], b = cover[(i + 1) % cover.length];
        let inside = true, outside = true;
        for (const p of polygon) {
            const distance = orientation * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
            inside &&= distance > 0; outside &&= distance < 0;
            if (!inside && !outside) break;
        }
        if (inside) continue;
        if (outside) return [polygon];
        return subtractPolygon(polygon, cover);
    }
    return [];
}
function footSupported(index: ShoreIndex, point: { x: number; y: number; z: number }): boolean {
    const id = `${point.x},${point.y},${point.z}`, existing = index.footAnswers.get(id); if (existing !== undefined) return existing;
    const square = protectionRectangle(point, AUTHORED_WALK_HALF_WIDTH);
    const triangles = shoreTriangles(index.buckets, point, AUTHORED_WALK_HALF_WIDTH);
    // A narrower query visits fewer bins. Restore the former .65-query order
    // exactly, so its per-piece area threshold and floating-point partitions
    // still see the same covering triangles in the same order.
    const minX = Math.floor(point.x - SHORE_DISTANCE), minZ = Math.floor(point.z - SHORE_DISTANCE);
    triangles.sort((a, b) => Math.max(minZ, Math.floor(a.box.minZ)) - Math.max(minZ, Math.floor(b.box.minZ))
        || Math.max(minX, Math.floor(a.box.minX)) - Math.max(minX, Math.floor(b.box.minX)) || a.order - b.order);
    const overlaps: { triangle: ShoreTriangle; overlap: Cell[] }[] = [];
    let answer = true;
    // Wet or over-height interiors reject before any dry union is subtracted.
    // No amount of earlier ground coverage may conceal a later unsafe face.
    for (const triangle of triangles) {
        const overlap = intersectPolygons(square, triangle.points); if (!polygonHasArea(overlap)) continue;
        if (triangle.water || polygonHasArea(clipPolygon(overlap, p => shoreHeight(triangle, p) - point.y - .25 - 1e-7))) { answer = false; break; }
        overlaps.push({ triangle, overlap });
    }
    if (answer) {
        let uncovered: Cell[][] = [square];
        for (const { triangle, overlap } of overlaps) {
            let cover = clipPolygon(overlap, p => shoreHeight(triangle, p) - point.y + .25 + 1e-7);
            cover = clipPolygon(cover, p => point.y + .25 + 1e-7 - shoreHeight(triangle, p));
            if (polygonHasArea(cover)) {
                const orientation = Math.sign(polygonArea(cover));
                uncovered = uncovered.flatMap(piece => subtractShoreCover(piece, cover, orientation));
            }
            if (!uncovered.length) break;
        }
        answer = !uncovered.length;
    }
    if (index.footAnswers.size >= MAX_SHORE_ANSWERS) index.footAnswers.clear();
    index.footAnswers.set(id, answer); return answer;
}

/** A real, original graph ref outside the water, with its whole physical foot
 * square supported. It grants neither a new site nor a route to the bank. */
export function isAuthoredShoreEntrySupported(world: ShoreGeometry, cell: Cell, waterFloorIds: readonly string[]): boolean {
    if (!hasWalkRef(world, cell)) return false;
    const support = world.floorAt(cell), original = world.anchorFloorAt(cell);
    if (!support || !original || Math.hypot(support.point.x - original.point.x, support.point.z - original.point.z) > .00001
        || Math.abs(support.point.y - original.point.y) > .28) return false;
    const index = shoreIndex(world.floors);
    if (!waterFloorIds.length || waterFloorIds.some(id => !index.waterFloors.has(id))) return false;
    const distances = distancesAt(index, support.point);
    const distance = Math.min(...waterFloorIds.map(id => distances.get(id) ?? Infinity));
    return distance > AUTHORED_WALK_HALF_WIDTH * Math.SQRT2 && distance <= SHORE_DISTANCE && footSupported(index, support.point);
}

/** Discover existing dry refs beside actual water; owner distance is not a shore proxy. */
export function findAuthoredShoreEntries(world: ShoreGeometry, waterFloorIds: readonly string[]): WorldSiteRef[] {
    const index = shoreIndex(world.floors), bounds = waterFloorIds.flatMap(id => { const box = index.waterFloors.get(id); return box ? [box] : []; });
    if (!bounds.length) return [];
    return world.walkSites.filter(site => bounds.some(box => site.support!.point.x >= box.minX - SHORE_DISTANCE && site.support!.point.x <= box.maxX + SHORE_DISTANCE
        && site.support!.point.z >= box.minZ - SHORE_DISTANCE && site.support!.point.z <= box.maxZ + SHORE_DISTANCE)
        && isAuthoredShoreEntrySupported(world, site.cell, waterFloorIds)).sort((a, b) => a.cell.z - b.cell.z || a.cell.x - b.cell.x).map(site => ({ ...site.ref }));
}

/** Quarter-grid points inside a house/furniture footprint are not walking lanes. */
export function authoredPointBlocked(point: Cell, owner: Cell) {
    return Math.abs(point.x - owner.x) <= clearance && Math.abs(point.z - owner.z) <= clearance;
}

/** Supported approaches outside one owner's footprint. The search discovers an
 * entrance; actual routes still run only over the caller's open graph. */
export function authoredApproachCells(cell: Cell, world: IslandWorld): Cell[] {
    const ownerSite = world.sites.find(site => cellKey(site.cell) === cellKey(cell));
    if (!ownerSite) return [];
    const explicit = world.shoreApproachCells(cell);
    if (explicit !== undefined) return explicit.length ? [cell, ...explicit] : [];
    if (!ownerSite.support) {
        // A water owner has no walk edge through its basin. A visitor approaches
        // its actual dry bank in the same district and stops outside the owner.
        // No route or district connection is invented between these candidates.
        const bankSupported = (site: typeof ownerSite) => {
            if (!site.support) return false;
            const anchor = ownerSite.point, p = site.support.point, dx = p.x - anchor.x, dz = p.z - anchor.z, length = Math.hypot(dx, dz);
            if (length <= clearance || length > 1.1 || Math.abs(p.y - anchor.y) > .28) return false;
            // Stop outside the occupied water owner's body. The short approach
            // and its foot band must remain on actual dry triangles; logical
            // proximity cannot bridge a physically separated floor patch.
            const stop = Math.min(length, clearance + .04), nx = -dz / length, nz = dx / length;
            for (let i = 0; i <= 4; i++) for (const side of [-AUTHORED_WALK_HALF_WIDTH, 0, AUTHORED_WALK_HALF_WIDTH]) {
                const r = length + (stop - length) * i / 4;
                const point = { x: anchor.x + dx / length * r + nx * side, z: anchor.z + dz / length * r + nz * side };
                const logical = world.logicalAt(point), floor = logical && world.floorAt(logical);
                if (!floor || Math.hypot(point.x - floor.point.x, point.z - floor.point.z) > .00001
                    || Math.abs(floor.point.y - p.y) > .25) return false;
            }
            return true;
        };
        return world.walkSites.filter(site => site.ref.districtId === ownerSite.ref.districtId
            && !authoredPointBlocked(site.cell, cell) && Math.hypot(site.cell.x - cell.x, site.cell.z - cell.z) <= 1.1 && bankSupported(site))
            .map(site => ({ ...site.cell })).sort((a, b) => Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b.x - cell.x, b.z - cell.z)
                || (b.z - cell.z) - (a.z - cell.z) || a.x - b.x);
    }
    const queue = [cell], seen = new Set([cellKey(cell)]), approaches: Cell[] = [];
    for (let i = 0; i < queue.length; i++) for (const next of world.neighbors(queue[i], 'walk')) {
        const id = cellKey(next);
        if (seen.has(id) || Math.hypot(next.x - cell.x, next.z - cell.z) > 1.1) continue;
        seen.add(id);
        if (authoredPointBlocked(next, cell)) queue.push(next);
        else approaches.push(next);
    }
    // Prefer the dry front door, then the other shortest supported sides.
    return [cell, ...approaches.sort((a, b) => {
        const d = Math.hypot(a.x - cell.x, a.z - cell.z) - Math.hypot(b.x - cell.x, b.z - cell.z);
        return d || (b.z - cell.z) - (a.z - cell.z) || a.x - b.x;
    })];
}

/** Gameplay limits are in logical land units, independent of walking resolution. */
export function walkPathDistance(path: readonly Cell[]) {
    return path.slice(1).reduce((length, cell, i) => length + Math.hypot(cell.x - path[i].x, cell.z - path[i].z), 0);
}
