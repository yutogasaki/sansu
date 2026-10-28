import type { Cell } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import type { WorldPoint } from '../../../src/domain/growingIsland/worldTypes';

const OWNER_RADIUS = .46;
const HEIGHT_EPSILON = 1e-6;
// A geometric round-off allowance, not a sampled-hole or gameplay tolerance.
const AREA_EPSILON = 1e-12;
type Polygon = WorldPoint[];
const cache = new WeakMap<IslandWorld, Map<string, boolean>>();
const side = (a: Cell, b: Cell, p: Cell) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
function signedArea(polygon: readonly Cell[]) {
    if (polygon.length < 3) return 0;
    const a = polygon[0];
    let twice = 0;
    for (let i = 1; i + 1 < polygon.length; i++) twice += side(a, polygon[i], polygon[i + 1]);
    return twice / 2;
}
const area = (polygon: readonly Cell[]) => Math.abs(signedArea(polygon));
function clean(polygon: Polygon): Polygon {
    return polygon.filter((p, i) => {
        const q = polygon[(i + polygon.length - 1) % polygon.length];
        return Math.hypot(p.x - q.x, p.z - q.z) > 1e-12;
    });
}

/** Clip a convex polygon to one closed half-plane, interpolating its real height. */
function halfPlane(polygon: Polygon, a: Cell, b: Cell, inside: boolean): Polygon {
    const result: Polygon = [];
    for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const dp = side(a, b, p) * (inside ? 1 : -1), dq = side(a, b, q) * (inside ? 1 : -1);
        if (dp >= 0) result.push(p);
        if ((dp >= 0) !== (dq >= 0)) {
            const t = dp / (dp - dq);
            result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });
        }
    }
    return clean(result);
}

function intersection(subject: Polygon, clip: Polygon): Polygon {
    let result = subject;
    for (let i = 0; i < clip.length && result.length; i++) result = halfPlane(result, clip[i], clip[(i + 1) % clip.length], true);
    return result;
}

/** Partition subject \ clip into convex pieces. Overlapping support triangles
 * cannot cancel a hole because coverage is removed from the remaining polygons. */
function subtract(subject: Polygon, clip: Polygon): Polygon[] {
    const result: Polygon[] = [];
    let remaining = subject;
    for (let i = 0; i < clip.length && remaining.length; i++) {
        const a = clip[i], b = clip[(i + 1) % clip.length];
        const outside = halfPlane(remaining, a, b, false);
        // Keep even very small pieces: the final tolerance applies to their
        // total area, not independently to every tiny gap in the mesh.
        if (area(outside) > 0) result.push(outside);
        remaining = halfPlane(remaining, a, b, true);
    }
    return result;
}

function evaluate(world: IslandWorld, cell: Cell, radius: number, placement: boolean): boolean {
    if (!Number.isFinite(cell.x) || !Number.isFinite(cell.z) || placement && !world.owns(cell)) return false;
    const center = world.floorAt(cell);
    if (!center || world.floors.find(floor => floor.id === center.floorId)?.kind !== 'ground') return false;
    const { x, y, z } = center.point;
    const footprint: Polygon = [
        { x: x - radius, y, z: z - radius }, { x: x + radius, y, z: z - radius },
        { x: x + radius, y, z: z + radius }, { x: x - radius, y, z: z + radius },
    ];
    const cover: Polygon[] = [];
    for (const floor of world.floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const points = floor.indices.slice(i, i + 3).map(index => floor.vertices[index].point);
        if (points.every(p => p.x <= x - radius) || points.every(p => p.x >= x + radius)
            || points.every(p => p.z <= z - radius) || points.every(p => p.z >= z + radius)) continue;
        const clipped = intersection(points, footprint);
        if (area(clipped) <= AREA_EPSILON) continue;
        if (floor.id !== center.floorId) {
            // An overlapping higher/equal floor or water is not the same rigid
            // support plane. This conservative fallback never bridges layers.
            if (clipped.some(p => p.y >= y - HEIGHT_EPSILON)) return false;
            continue;
        }
        if (clipped.some(p => !Number.isFinite(p.y) || Math.abs(p.y - y) > HEIGHT_EPSILON)) return false;
        // Sutherland-Hodgman preserves winding; subtraction expects CCW.
        if (signedArea(clipped) < 0) clipped.reverse();
        cover.push(clipped);
    }
    let uncovered: Polygon[] = [footprint];
    for (const polygon of cover) {
        uncovered = uncovered.flatMap(piece => subtract(piece, polygon));
        if (!uncovered.length) return true;
        // A malformed/overlapping mesh must fail closed instead of growing an
        // unbounded arrangement in an interactive placement check.
        if (uncovered.length > 4096) return false;
    }
    return uncovered.reduce((sum, polygon) => sum + area(polygon), 0) <= AREA_EPSILON;
}

/** Trial-only alternative to legacy-slope preservation. It proves the whole
 * physical .92 × .92 owner footprint is covered by one flat dry floor. It does
 * not grant placement rights, a route, or permission to move a pinned actor.
 * Immutable compiled worlds make cached results independent of owner moves. */
function flatFootprintSupported(world: IslandWorld, cell: Cell, radius: number, placement: boolean): boolean {
    let results = cache.get(world);
    if (!results) { results = new Map(); cache.set(world, results); }
    const key = `${cell.x},${cell.z}:${radius}:${placement}`;
    const known = results.get(key);
    if (known !== undefined) return known;
    const accepted = evaluate(world, cell, radius, placement);
    if (results.size >= 4096) results.delete(results.keys().next().value!);
    results.set(key, accepted);
    return accepted;
}

export function flatOwnerFootprintSupported(world: IslandWorld, cell: Cell): boolean {
    return flatFootprintSupported(world, cell, OWNER_RADIUS, true);
}

/** A .36 × .36 physical square covers the trial walker's .18-radius body at
 * its destination, including half-cell walk sites without furniture rights. */
export function flatBodyFootprintSupported(world: IslandWorld, cell: Cell): boolean {
    return flatFootprintSupported(world, cell, .18, false);
}
