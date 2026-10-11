import { AUTHORED_OWNER_HALF_EXTENT } from './authoredWorldAccess';
import type { Cell } from './types';
import type { IslandWorld } from './worldDefinition';
import type { WorldPoint } from './worldTypes';

interface Triangle { cells: readonly Cell[]; points: readonly WorldPoint[]; water: boolean; minX: number; maxX: number; minZ: number; maxZ: number }
interface SupportIndex { buckets: Map<string, Triangle[]>; answers: Map<string, boolean> }
const indexes = new WeakMap<IslandWorld, SupportIndex>();
const key = (cell: Cell) => `${cell.x},${cell.z}`;
const EPSILON = 1e-7;
// Each affine component stays inside this band across the entire clipped
// region, proving the Euclidean x/z match used by the actual water mask.
const PHYSICAL_MATCH_BAND = .00001 / Math.SQRT2 * .9999;
const area = (polygon: readonly Cell[]) => polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.z - q.x * p.z;
}, 0);
const hasArea = (polygon: readonly Cell[]) => polygon.length >= 3 && Math.abs(area(polygon)) > 1e-12;

function clip(polygon: readonly Cell[], distance: (point: Cell) => number): Cell[] {
    const result: Cell[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
        if (da >= 0) result.push(a);
        if ((da >= 0) !== (db >= 0)) {
            const t = da / (da - db); result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
    }
    return result;
}

function coordinateAt(triangle: Triangle, at: Cell, coordinate: keyof WorldPoint) {
    const [a, b, c] = triangle.cells, determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    const u = ((b.z - c.z) * (at.x - c.x) + (c.x - b.x) * (at.z - c.z)) / determinant;
    const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant;
    return triangle.points[0][coordinate] * u + triangle.points[1][coordinate] * v + triangle.points[2][coordinate] * (1 - u - v);
}
const heightAt = (triangle: Triangle, at: Cell) => coordinateAt(triangle, at, 'y');

function matchingCover(polygon: readonly Cell[], floor: Triangle, water: Triangle): Cell[] {
    let result = [...polygon];
    for (const coordinate of ['x', 'z'] as const) {
        const delta = (at: Cell) => coordinateAt(floor, at, coordinate) - coordinateAt(water, at, coordinate);
        result = clip(result, at => PHYSICAL_MATCH_BAND - delta(at));
        result = clip(result, at => PHYSICAL_MATCH_BAND + delta(at));
    }
    return result;
}

/** Subtract a convex dry cover from a convex wet piece, retaining every uncovered part. */
function subtract(polygon: readonly Cell[], cover: readonly Cell[]): Cell[][] {
    const result: Cell[][] = [], orientation = Math.sign(area(cover));
    let inside = [...polygon];
    for (let i = 0; i < cover.length && hasArea(inside); i++) {
        const a = cover[i], b = cover[(i + 1) % cover.length];
        const side = (p: Cell) => orientation * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x));
        const outside = clip(inside, p => -side(p)); if (hasArea(outside)) result.push(outside);
        inside = clip(inside, side);
    }
    return result;
}

function intersect(polygon: readonly Cell[], boundary: readonly Cell[]): Cell[] {
    let result = [...polygon];
    const orientation = Math.sign(area(boundary));
    for (let i = 0; i < boundary.length && hasArea(result); i++) {
        const a = boundary[i], b = boundary[(i + 1) % boundary.length];
        result = clip(result, p => orientation * ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)));
    }
    return result;
}

function supportIndex(world: IslandWorld): SupportIndex {
    const existing = indexes.get(world); if (existing) return existing;
    const index: SupportIndex = { buckets: new Map(), answers: new Map() };
    for (const floor of world.floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const vertices = floor.indices.slice(i, i + 3).map(id => floor.vertices[id]);
        const cells = vertices.map(v => v.cell), points = vertices.map(v => v.point);
        const triangle: Triangle = { cells, points, water: floor.kind === 'water',
            minX: Math.min(...cells.map(p => p.x)), maxX: Math.max(...cells.map(p => p.x)),
            minZ: Math.min(...cells.map(p => p.z)), maxZ: Math.max(...cells.map(p => p.z)) };
        for (let z = Math.floor(triangle.minZ); z <= Math.floor(triangle.maxZ); z++) for (let x = Math.floor(triangle.minX); x <= Math.floor(triangle.maxX); x++) {
            const id = key({ x, z }), bucket = index.buckets.get(id) ?? []; bucket.push(triangle); index.buckets.set(id, bucket);
        }
    }
    indexes.set(world, index); return index;
}

/** Acquired centres need the whole owner footprint, including water between the nine probes. */
export function hasAuthoredPlacementSupport(world: IslandWorld, cell: Cell): boolean {
    const center = world.floorAt(cell); if (!center) return false;
    const radius = AUTHORED_OWNER_HALF_EXTENT;
    for (const x of [-radius, 0, radius]) for (const z of [-radius, 0, radius]) {
        const support = world.floorAt({ x: cell.x + x, z: cell.z + z });
        if (!support || Math.abs(support.point.y - center.point.y) > .28) return false;
    }
    if (!world.floors.some(floor => floor.kind === 'water')) return true;
    const index = supportIndex(world), id = key(cell), cached = index.answers.get(id); if (cached !== undefined) return cached;
    const bounds = { minX: cell.x - radius, maxX: cell.x + radius, minZ: cell.z - radius, maxZ: cell.z + radius };
    const candidates = new Set<Triangle>();
    for (let z = Math.floor(bounds.minZ); z <= Math.floor(bounds.maxZ); z++) for (let x = Math.floor(bounds.minX); x <= Math.floor(bounds.maxX); x++)
        for (const triangle of index.buckets.get(key({ x, z })) ?? [])
            if (triangle.maxX >= bounds.minX && triangle.minX <= bounds.maxX && triangle.maxZ >= bounds.minZ && triangle.minZ <= bounds.maxZ) candidates.add(triangle);
    const dry = [...candidates].filter(triangle => !triangle.water);
    let supported = true;
    for (const water of candidates) {
        if (!water.water) continue;
        let polygon = clip(water.cells, p => p.x - bounds.minX); polygon = clip(polygon, p => bounds.maxX - p.x);
        polygon = clip(polygon, p => p.z - bounds.minZ); polygon = clip(polygon, p => bounds.maxZ - p.z);
        if (!hasArea(polygon)) continue;
        const overlapping = dry.filter(floor => floor.maxX >= water.minX && floor.minX <= water.maxX && floor.maxZ >= water.minZ && floor.minZ <= water.maxZ);
        // A lower deck cannot authorize placement underneath a higher current support.
        if (overlapping.some(floor => {
            const high = clip(floor.cells, p => heightAt(floor, p) - center.point.y - .28 - EPSILON);
            return hasArea(high) && hasArea(intersect(high, polygon));
        })) { supported = false; break; }
        // A physically separated logical overlay can become the current floor
        // above a real lower deck. Prove that every exposed above-water region
        // matches the water's physical x/z mapping; higher dry triangles may
        // hide a mismatched region, but a lower deck cannot authorize it.
        if (overlapping.some(floor => {
            const above = intersect(clip(floor.cells, p => heightAt(floor, p) + EPSILON - heightAt(water, p)), polygon);
            if (!hasArea(above)) return false;
            const matching = matchingCover(above, floor, water);
            let mismatched = hasArea(matching) ? subtract(above, matching) : [above];
            if (!mismatched.length) return false;
            for (const other of overlapping) {
                if (other === floor) continue;
                const higher = clip(other.cells, p => heightAt(other, p) - heightAt(floor, p) - EPSILON);
                if (hasArea(higher)) mismatched = mismatched.flatMap(piece => subtract(piece, higher));
                if (!mismatched.length) return false;
            }
            return true;
        })) { supported = false; break; }
        let uncovered: Cell[][] = [polygon];
        for (const floor of overlapping) {
            let cover = clip(floor.cells, p => heightAt(floor, p) + EPSILON - heightAt(water, p));
            cover = clip(cover, p => heightAt(floor, p) - center.point.y + .28 + EPSILON);
            cover = clip(cover, p => center.point.y + .28 + EPSILON - heightAt(floor, p));
            cover = matchingCover(cover, floor, water);
            if (!hasArea(cover)) continue;
            uncovered = uncovered.flatMap(piece => subtract(piece, cover)); if (!uncovered.length) break;
        }
        if (uncovered.length) { supported = false; break; }
    }
    if (index.answers.size >= 16_384) index.answers.clear(); index.answers.set(id, supported);
    return supported;
}
