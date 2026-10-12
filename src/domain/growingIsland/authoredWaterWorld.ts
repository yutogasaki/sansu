import { connectedWaterChannels } from '../islandLife/waterChannels';
import { AUTHORED_OWNER_HALF_EXTENT, AUTHORED_WALK_HALF_WIDTH, findAuthoredShoreEntries } from './authoredWorldAccess';
import { waterLayout } from './environment';
import { isAuthoredWaterCarvingSafe, authoredWaterCarvingFloorIds } from './authoredWaterCarving';
import { adaptWaterContour, decomposeWaterOutline, pointInWaterOutline, waterRayExit, waterSegmentIntervals } from './authoredWaterContour';
import { buildWaterRim, scaledWaterOutline } from './authoredWaterRim';
import { composeAuthoredWaterBridges, type AuthoredWaterBridgePlan } from './authoredWaterBridge';
import nativeWaterSource from './nativeWaterSource.json';
import nativeWaterBridgeProfile from './nativeWaterBridgeProfile.json';
import { HOUSE_CELLS } from './space';
import type { Cell, GrowingState, Landmark } from './types';
import { compileWorldDefinition, isWorldWalkEdgeSupported, type IslandWorld } from './worldDefinition';
import type { WorldDistrict, WorldFloor, WorldFloorVertex, WorldPoint, WorldSurface } from './worldTypes';

type WaterOwner = Landmark & { cell: Cell };
type Outline = readonly WorldPoint[];
export interface AuthoredWaterPool {
    ownerId: string;
    ownerIds: readonly string[];
    districtId: string;
    /** The owner's original anchor, never a native beauty-scene pool centre. */
    center: WorldPoint;
    radius: number;
    waterY: number;
    bedY: number;
    outline: Outline;
    /** Real outer-bank cut; its sloping surfaces do not grant walking support. */
    outerOutline: Outline;
    sourceRole: string;
    /** Adapted positive/negative connection and transverse extents. */
    axes: readonly number[];
    /** Compiled IDs: JSON [districtId, local floorId]. */
    waterFloorId: string;
    bedFloorId: string;
    color: string;
    bedColor: string;
}
export interface AuthoredWaterStream {
    id: string;
    ownerIds: readonly string[];
    from: WorldPoint;
    to: WorldPoint;
    outline: Outline;
    /** Actual same-group water/bed floors covering this trench, including
     * shared junction pieces first cut by an adjoining stream or pool. */
    waterFloorIds: readonly string[];
    bedFloorIds: readonly string[];
    /** A visible drop, not an extra walking support or a water grant. */
    falling: boolean;
    centerline: readonly WorldPoint[];
    width: number;
}
export interface AuthoredWaterGroup {
    id: string;
    ownerIds: readonly string[];
    bowlIds: readonly string[];
    channelIds: readonly string[];
    cut: boolean;
    reason?: 'individual-bodies' | 'insufficient-clearance';
}
export interface AuthoredWaterGrotto {
    ownerId: string;
    pivot: WorldPoint;
    yaw: number;
    scale: number;
    footprint: Outline;
    surfaceIds: readonly string[];
}
export interface AuthoredWaterPlan {
    revision: string;
    /** Only these owners' individual bodies are replaced by actual shared cuts. */
    ownerIds: readonly string[];
    groups: readonly AuthoredWaterGroup[];
    pools: readonly AuthoredWaterPool[];
    streams: readonly AuthoredWaterStream[];
    grottos: readonly AuthoredWaterGrotto[];
    bridges: readonly AuthoredWaterBridgePlan[];
}

const EPS = 1e-9;
const SURFACE_RISE = .025, DEPTH = .18;
const WATER_COLORS = ['#287ca6', '#287ca6', '#287ca6'];
const BED_COLORS = ['#667e96', '#727e9c', '#647f8d'];
const key = (cell: Cell) => `${cell.x},${cell.z}`;
/** Match the supply graph: explicit grants still require adjacent integer cells. */
const waterNeighbors = (base: IslandWorld, cell: Cell) => base.neighbors(cell, 'water').filter(next =>
    Number.isInteger(cell.x) && Number.isInteger(cell.z) && Number.isInteger(next.x) && Number.isInteger(next.z)
    && Math.abs(cell.x - next.x) + Math.abs(cell.z - next.z) === 1);
const round = (value: number) => Math.round(value * 1e9) / 1e9 || 0;
const horizontal = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const cross = (a: WorldPoint, b: WorldPoint, p: WorldPoint) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const area = (polygon: readonly WorldFloorVertex[]) => polygon.reduce((sum, vertex, i) => {
    const next = polygon[(i + 1) % polygon.length];
    return sum + vertex.point.x * next.point.z - vertex.point.z * next.point.x;
}, 0) / 2;
const turn = (x: number, z: number, count: number): Cell => count === 1 ? { x: -z, z: x }
    : count === 2 ? { x: -x, z: -z } : count === 3 ? { x: z, z: -x } : { x, z };
const pointToLocal = (district: WorldDistrict, point: WorldPoint): WorldPoint => {
    const p = turn(point.x - district.worldOrigin.x, point.z - district.worldOrigin.z, (4 - district.turn) % 4);
    return { x: round(p.x), y: round(point.y - district.worldOrigin.y), z: round(p.z) };
};
const pointToWorld = (district: WorldDistrict, point: WorldPoint): WorldPoint => {
    const p = turn(point.x, point.z, district.turn);
    return { x: p.x + district.worldOrigin.x, y: point.y + district.worldOrigin.y, z: p.z + district.worldOrigin.z };
};
const cellToWorld = (district: WorldDistrict, cell: Cell): Cell => {
    const p = turn(cell.x, cell.z, district.turn);
    return { x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z };
};
const floorId = (districtId: string, local: string) => JSON.stringify([districtId, local]);
const localId = (kind: string, id: string) => `authored-water:${kind}:${encodeURIComponent(id)}`;
const refKey = (ref: { districtId: string; siteId: string }) => JSON.stringify([ref.districtId, ref.siteId]);
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}
function fingerprint(text: string) {
    let a = 2166136261, b = 2246822507;
    for (let i = 0; i < text.length; i++) {
        a = Math.imul(a ^ text.charCodeAt(i), 16777619);
        b = Math.imul(b ^ text.charCodeAt(i), 3266489909);
    }
    return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

function clean(polygon: WorldFloorVertex[]): WorldFloorVertex[] {
    const out = polygon.filter((vertex, i) => horizontal(vertex.point, polygon[(i + polygon.length - 1) % polygon.length].point) > 1e-8);
    return out.length >= 3 && Math.abs(area(out)) > 1e-10 ? out : [];
}
function interpolate(a: WorldFloorVertex, b: WorldFloorVertex, t: number): WorldFloorVertex {
    return { cell: { x: round(a.cell.x + (b.cell.x - a.cell.x) * t), z: round(a.cell.z + (b.cell.z - a.cell.z) * t) },
        point: { x: round(a.point.x + (b.point.x - a.point.x) * t), y: round(a.point.y + (b.point.y - a.point.y) * t),
            z: round(a.point.z + (b.point.z - a.point.z) * t) },
        // Keep the linear source field through repeated cuts. Normalizing each
        // intermediate split would change later barycentric interpolation.
        ...(a.normal && b.normal ? { normal: {
            x: a.normal.x + (b.normal.x - a.normal.x) * t,
            y: a.normal.y + (b.normal.y - a.normal.y) * t,
            z: a.normal.z + (b.normal.z - a.normal.z) * t,
        } } : {}) };
}
/** Split a convex polygon against one directed edge, preserving the source
 * triangle's barycentric mapping for every inserted logical/physical vertex. */
function halfPlane(polygon: readonly WorldFloorVertex[], a: WorldPoint, b: WorldPoint, inside: boolean) {
    const out: WorldFloorVertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i], q = polygon[(i + 1) % polygon.length];
        const dp = cross(a, b, p.point), dq = cross(a, b, q.point);
        const keepP = inside ? dp >= -EPS : dp <= EPS, keepQ = inside ? dq >= -EPS : dq <= EPS;
        if (keepP) out.push(p);
        if (keepP !== keepQ && Math.abs(dp - dq) > EPS) out.push(interpolate(p, q, Math.max(0, Math.min(1, dp / (dp - dq)))));
    }
    return clean(out);
}
function subtract(polygon: readonly WorldFloorVertex[], outline: Outline) {
    const outside: WorldFloorVertex[][] = [];
    let inside = [...polygon];
    for (let i = 0; i < outline.length && inside.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        const piece = halfPlane(inside, a, b, false); if (piece.length) outside.push(piece);
        inside = halfPlane(inside, a, b, true);
    }
    return { outside, inside };
}
function append(floor: { vertices: WorldFloorVertex[]; indices: number[] }, polygon: readonly WorldFloorVertex[], up = false) {
    if (!polygon.length) return;
    const offset = floor.vertices.length; floor.vertices.push(...polygon);
    const reverse = up && area(polygon) > 0;
    for (let i = 1; i + 1 < polygon.length; i++) {
        const a = polygon[0].cell, b = polygon[i].cell, c = polygon[i + 1].cell;
        if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) <= 1e-12) continue;
        floor.indices.push(offset, offset + (reverse ? i + 1 : i), offset + (reverse ? i : i + 1));
    }
}
interface Protection { cell: Cell; half: number }
function protectedCells(state: GrowingState, excluded: ReadonlySet<string>): Protection[] {
    const half = AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH;
    const out = HOUSE_CELLS.map(cell => ({ cell, half }));
    for (const item of [...state.plots, ...state.landmarks, ...state.keepsakes]) {
        if (!item.cell || excluded.has(item.id)) continue;
        out.push({ cell: item.cell, half });
        if ('kind' in item && item.kind === 'home') out.push({ cell: { x: item.cell.x, z: item.cell.z + .75 }, half: .18 });
    }
    return out;
}
function safeOutline(base: IslandWorld, outline: Outline, protections: readonly Protection[], districtId?: string) {
    const candidates = districtId ? [districtId] : base.definition.districts.map(district => district.id);
    return candidates.some(id => isAuthoredWaterCarvingSafe(base, id, outline, protections));
}
function poolFor(owner: WaterOwner, index: number, bowls: readonly WaterOwner[], base: IslandWorld, protections: readonly Protection[]): AuthoredWaterPool | undefined {
    const site = base.sites.find(site => key(site.cell) === key(owner.cell));
    const center = base.anchorAt(owner.cell) ?? base.floorAt(owner.cell)?.point;
    if (!site?.placement || !center) return;
    const source = nativeWaterSource.pools[index % nativeWaterSource.pools.length];
    const neighbors = bowls.filter(bowl => bowl.id !== owner.id).map(bowl => base.anchorAt(bowl.cell)!).filter(Boolean)
        .sort((a, b) => horizontal(center, a) - horizontal(center, b));
    const nearest = neighbors[0], yaw = nearest ? Math.atan2(nearest.z - center.z, nearest.x - center.x) : 0;
    const requested = [source.radiusX, source.radiusZ, source.radiusX, source.radiusZ];
    const axes = requested.map(value => Math.min(value, .24));
    const outerScale = nativeWaterSource.rim.rings[0].scale;
    const shape = () => adaptWaterContour(source.outline, center, axes[0], axes[1], yaw, axes[2], axes[3]);
    const valid = (outline: Outline) => {
        const outer = scaledWaterOutline(outline, center, outerScale);
        // Distinct water levels retain separate physical basins. Directional
        // half-spaces limit the connection axis, not every transverse radius.
        if (outer.some(p => neighbors.some(other => {
            const d = horizontal(center, other), projection = ((p.x - center.x) * (other.x - center.x) + (p.z - center.z) * (other.z - center.z)) / d;
            return projection > d / 2 - .025;
        }))) return false;
        return safeOutline(base, outer, protections, site.ref.districtId);
    };
    if (!valid(shape()) || !decomposeWaterOutline(shape()).length) return;
    // Grow four directions independently, starting with the transverse wings.
    // Each step is an exact occupied-polygon preflight, not a sampled outline.
    for (const axis of [1, 3, 0, 2]) {
        while (axes[axis] + .02 <= requested[axis] + EPS) {
            axes[axis] += .02;
            if (!valid(shape())) { axes[axis] -= .02; break; }
        }
    }
    const outline = shape(), waterY = round(center.y + SURFACE_RISE), bedY = round(waterY - DEPTH);
    return { ownerId: owner.id, ownerIds: [owner.id], districtId: site.ref.districtId, center: { ...center },
        radius: round(Math.max(...axes)), axes: axes.map(round), sourceRole: source.role,
        waterY, bedY, outline, outerOutline: scaledWaterOutline(outline, center, outerScale),
        waterFloorId: floorId(site.ref.districtId, localId('pool-water', owner.id)),
        bedFloorId: floorId(site.ref.districtId, localId('pool-bed', owner.id)), color: WATER_COLORS[index % 3], bedColor: BED_COLORS[index % 3] };
}

interface Cut { id: string; outline: Outline; outerOutline?: Outline; districtIds: readonly string[]; color: string; bedColor: string; heightAt: (point: WorldPoint) => number; ownerIds: string[]; pool?: AuthoredWaterPool; stream?: AuthoredWaterStream }
/** Keep the whole trench mouth inside the actual convex organic pool. Its
 * short rotated axis can end before a radius-based trim would reach the water. */
function poolMouthDistance(pool: AuthoredWaterPool | undefined, dx: number, dz: number, width: number): number | undefined {
    if (!pool) return 0;
    let distance = Infinity;
    for (const side of [-width, width]) {
        const origin = { x: pool.center.x + dz * side, y: pool.center.y, z: pool.center.z - dx * side };
        const exit = waterRayExit(origin, dx, dz, pool.outline); if (exit === undefined) return;
        distance = Math.min(distance, exit);
    }
    // The overlap is real area rather than a numerically touching boundary.
    return Number.isFinite(distance) && distance > .025 ? distance - .025 : undefined;
}
function intersectionPoints(a: Outline, b: Outline): WorldPoint[] {
    return [...a.filter(p => pointInWaterOutline(p, b)), ...b.filter(p => pointInWaterOutline(p, a)),
        ...a.flatMap((p, i) => waterSegmentIntervals(p, a[(i + 1) % a.length], b).flatMap(interval => interval.map(t => ({
            x: p.x + (a[(i + 1) % a.length].x - p.x) * t, y: p.y, z: p.z + (a[(i + 1) % a.length].z - p.z) * t,
        }))))];
}
function streamFor(a: WaterOwner, b: WaterOwner, pools: readonly AuthoredWaterPool[], base: IslandWorld, protections: readonly Protection[], adjoining: readonly AuthoredWaterStream[] = []): Cut[] | undefined {
    const a0 = base.anchorAt(a.cell), b0 = base.anchorAt(b.cell); if (!a0 || !b0) return;
    const length = horizontal(a0, b0); if (length <= .05) return;
    const dx = (b0.x - a0.x) / length, dz = (b0.z - a0.z) / length;
    const aPool = pools.find(pool => pool.ownerId === a.id), bPool = pools.find(pool => pool.ownerId === b.id);
    const width = .135, fromTrim = poolMouthDistance(aPool, dx, dz, width), toTrim = poolMouthDistance(bPool, -dx, -dz, width);
    if (fromTrim === undefined || toTrim === undefined) return;
    const from = { x: a0.x + dx * fromTrim, y: a0.y + SURFACE_RISE, z: a0.z + dz * fromTrim };
    const to = { x: b0.x - dx * toTrim, y: b0.y + SURFACE_RISE, z: b0.z - dz * toTrim };
    if (horizontal(from, to) <= .05) return;
    const seed = Array.from({ length: 9 }, (_, i) => {
        const t = i / 8, bend = .035 * Math.sin(Math.PI * t);
        return { x: from.x + (to.x - from.x) * t + dz * bend,
            y: from.y, z: from.z + (to.z - from.z) * t - dx * bend };
    });
    const seedOutline = [...seed.map(p => ({ ...p, x: p.x + dz * width, z: p.z - dx * width })),
        ...[...seed].reverse().map(p => ({ ...p, x: p.x - dz * width, z: p.z + dx * width }))];
    const vx = to.x - from.x, vz = to.z - from.z, squared = vx * vx + vz * vz;
    const projection = (p: WorldPoint) => ((p.x - from.x) * vx + (p.z - from.z) * vz) / squared;
    const id = JSON.stringify([a.id, b.id].sort());
    const junctionPoints = (ownerId: string) => adjoining.filter(other => other.id !== id && other.ownerIds.includes(ownerId))
        .flatMap(other => intersectionPoints(seedOutline, other.outline));
    // A pool and every same-owner junction are one horizontal water surface.
    // Start the drop beyond their real occupied extent, rather than falling
    // from the small overlap inserted solely to make the mouth connected.
    const startPoints = [...aPool?.outline ?? [], ...junctionPoints(a.id)], endPoints = [...bPool?.outline ?? [], ...junctionPoints(b.id)];
    const dropStart = Math.max(0, Math.min(1, Math.max(0, ...startPoints.map(projection))));
    const dropEnd = Math.max(0, Math.min(1, Math.min(1, ...endPoints.map(projection))));
    if (dropEnd - dropStart < 1e-6 && Math.abs(from.y - to.y) > EPS) return;
    const knots = [...new Set([...seed.map((_, i) => i / 8), dropStart, dropEnd].map(round))].sort((a, b) => a - b);
    const centerline = knots.map(t => {
        const i = Math.min(7, Math.floor(t * 8)), u = t * 8 - i;
        const fall = dropEnd - dropStart > EPS ? smoothFall(Math.max(0, Math.min(1, (t - dropStart) / (dropEnd - dropStart)))) : 0;
        // Added height knots interpolate the existing straight seed segments.
        // They do not change the accepted physical cut or widen the water.
        return { x: seed[i].x + (seed[i + 1].x - seed[i].x) * u,
            y: from.y + (to.y - from.y) * fall, z: seed[i].z + (seed[i + 1].z - seed[i].z) * u };
    });
    const left = centerline.map(p => ({ ...p, x: p.x + dz * width, z: p.z - dx * width }));
    const right = centerline.map(p => ({ ...p, x: p.x - dz * width, z: p.z + dx * width }));
    const outline = [...left, ...[...right].reverse()];
    const ownerDistricts = new Set([a, b].map(owner => base.sites.find(site => key(site.cell) === key(owner.cell))?.ref.districtId));
    // An acquired but unrelated stacked district is not this owner's support.
    // Cross-district hydraulic sculpture needs a separate physical seam plan;
    // until then it falls back instead of carving another district's terrain.
    if (ownerDistricts.size !== 1 || ownerDistricts.has(undefined)) return;
    const districtIds = base.definition.districts.filter(district => ownerDistricts.has(district.id)
        && isAuthoredWaterCarvingSafe(base, district.id, outline, protections)).map(district => district.id);
    if (!districtIds.length) return;
    const stream: AuthoredWaterStream = { id, ownerIds: [a.id, b.id], from, to, outline, centerline, width: width * 2,
        waterFloorIds: [], bedFloorIds: [], falling: Math.abs(from.y - to.y) > .06 };
    const common = { districtIds, ownerIds: [...stream.ownerIds], color: '#50b5ca', bedColor: '#667e96', stream };
    return centerline.slice(1).map((end, i) => ({ ...common, id: `stream:${id}:${i}`, outline: [left[i], left[i + 1], right[i + 1], right[i]],
        heightAt: (point: WorldPoint) => {
            const t = Math.max(0, Math.min(1, (projection(point) - knots[i]) / (knots[i + 1] - knots[i])));
            return round(centerline[i].y + (end.y - centerline[i].y) * t);
        } }));
}

const smoothFall = (t: number) => t * t * (3 - 2 * t);

function bounds(outline: Outline) { return { minX: Math.min(...outline.map(p => p.x)), maxX: Math.max(...outline.map(p => p.x)),
    minZ: Math.min(...outline.map(p => p.z)), maxZ: Math.max(...outline.map(p => p.z)) }; }
const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) => a.minX <= b.maxX + EPS && a.maxX + EPS >= b.minX && a.minZ <= b.maxZ + EPS && a.maxZ + EPS >= b.minZ;
function floorIntersectsOutline(floor: WorldFloor, district: WorldDistrict, outline: Outline) {
    const box = bounds(outline), pieces = decomposeWaterOutline(outline), vertices = floor.vertices.map(vertex => ({ ...vertex, point: pointToWorld(district, vertex.point) }));
    for (let i = 0; i < floor.indices.length; i += 3) {
        const triangle = floor.indices.slice(i, i + 3).map(index => vertices[index]);
        if (overlaps(bounds(triangle.map(vertex => vertex.point)), box) && pieces.some(piece => subtract(triangle, piece).inside.length)) return true;
    }
    return false;
}
/** Remove portions of a bank where another actual cut opens into this water. */
function bankIntervals(a: WorldPoint, b: WorldPoint, outlines: readonly Outline[]) {
    let intervals: [number, number][] = [[0, 1]];
    for (const outline of outlines) for (const [min, max] of waterSegmentIntervals(a, b, outline)) {
        intervals = intervals.flatMap(([lo, hi]) => max <= lo || min >= hi ? [[lo, hi] as [number, number]]
            : [...(lo < min ? [[lo, min] as [number, number]] : []), ...(max < hi ? [[max, hi] as [number, number]] : [])]);
    }
    return intervals;
}
function bankFor(cut: Cut, district: WorldDistrict, base: IslandWorld, others: readonly Cut[]): WorldSurface[] {
    if (cut.pool) {
        const surfaces = buildWaterRim({ id: localId('bank', cut.id), outline: cut.pool.outline, center: cut.pool.center,
            waterY: cut.pool.waterY, rings: nativeWaterSource.rim.rings,
            groundAt: p => { const cell = base.logicalAt(p); return cell ? base.floorAt(cell)?.point.y : undefined; },
            mouths: others.filter(other => other !== cut).map(other => other.outline), body: nativeWaterSource.rim.body, lip: nativeWaterSource.rim.lip });
        return (surfaces ?? []).map(surface => ({ ...surface, vertices: surface.vertices.map(p => pointToLocal(district, p)) }));
    }
    const vertices: WorldPoint[] = [], indices: number[] = [];
    for (let i = 0; i < cut.outline.length; i++) {
        const a0 = cut.outline[i], b0 = cut.outline[(i + 1) % cut.outline.length];
        const top = (p: WorldPoint) => {
            const cell = base.logicalAt(p), y = cell ? base.floorAt(cell)?.point.y : undefined;
            return pointToLocal(district, { ...p, y: Math.max(y ?? cut.heightAt(p), cut.heightAt(p) + .035) });
        };
        for (const [from, to] of bankIntervals(a0, b0, others.filter(other => other !== cut).map(other => other.outline))) {
            const at = (t: number) => ({ x: a0.x + (b0.x - a0.x) * t, y: a0.y + (b0.y - a0.y) * t, z: a0.z + (b0.z - a0.z) * t });
            const a = at(from), b = at(to), offset = vertices.length;
            // Adjacent exact height strips can leave a zero-width clipped rim
            // interval after local coordinate rounding. It is no visible bank.
            if (horizontal(a, b) <= 1e-9) continue;
            vertices.push(top(a), top(b), pointToLocal(district, { ...b, y: cut.heightAt(b) - DEPTH }), pointToLocal(district, { ...a, y: cut.heightAt(a) - DEPTH }));
            indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        }
    }
    if (!indices.length) return [];
    return [{ id: localId('bank', cut.id), kind: 'bank', vertices, indices, material: { color: nativeWaterSource.rim.body.color, roughness: .56, metalness: 0 } }];
}
function flowFor(cut: Cut, district: WorldDistrict): WorldSurface | undefined {
    if (!cut.stream?.falling) return;
    const stream = cut.stream, length = horizontal(stream.from, stream.to), dx = (stream.to.x - stream.from.x) / length,
        dz = (stream.to.z - stream.from.z) / length, width = stream.width / 2;
    const vertices = stream.centerline.flatMap(p => [
        { x: p.x + dz * width, y: p.y + .002, z: p.z - dx * width },
        { x: p.x - dz * width, y: p.y + .002, z: p.z + dx * width },
    ].map(p => pointToLocal(district, p)));
    const indices = stream.centerline.slice(1).flatMap((_, i) => [i * 2, i * 2 + 2, i * 2 + 3, i * 2, i * 2 + 3, i * 2 + 1]);
    return { id: localId('flow', stream.id), kind: 'flow', vertices, indices,
        material: { color: '#50b5ca', roughness: .16, metalness: 0, opacity: .82 } };
}

function grottoFor(pool: AuthoredWaterPool, streams: readonly AuthoredWaterStream[], base: IslandWorld, protections: readonly Protection[]) {
    const link = streams.find(stream => stream.ownerIds.includes(pool.ownerId));
    if (!link) return;
    const target = horizontal(link.from, pool.center) < horizontal(link.to, pool.center) ? link.to : link.from;
    const length = horizontal(target, pool.center), dx = (target.x - pool.center.x) / length, dz = (target.z - pool.center.z) / length;
    const yaw = Math.atan2(-dx, dz), sourceVertices = nativeWaterSource.grotto.primitives.flatMap(part => part.vertices);
    for (const scale of [1, .95, .9, .85, .8, .75, .7, .65, .6]) {
        const pivot = { x: pool.center.x - dx * .07, y: pool.bedY - .025, z: pool.center.z - dz * .07 };
        const transform = (p: WorldPoint): WorldPoint => ({ x: pivot.x + scale * (p.x * Math.cos(yaw) - p.z * Math.sin(yaw)),
            y: pivot.y + p.y * scale, z: pivot.z + scale * (p.x * Math.sin(yaw) + p.z * Math.cos(yaw)) });
        const vertices = sourceVertices.map(transform), box = bounds(vertices);
        const footprint = [{ x: box.minX, y: pivot.y, z: box.minZ }, { x: box.maxX, y: pivot.y, z: box.minZ },
            { x: box.maxX, y: pivot.y, z: box.maxZ }, { x: box.minX, y: pivot.y, z: box.maxZ }];
        // Both actual source feet penetrate the existing pool bed slightly;
        // their plan positions must stay inside this owner's real wet floor.
        if (!safeOutline(base, footprint, protections, pool.districtId)
            || sourceVertices.filter(p => p.y < .035).some(p => !pointInWaterOutline(transform(p), pool.outline))) continue;
        const surfaces: WorldSurface[] = nativeWaterSource.grotto.primitives.map((part, i) => ({
            id: localId('grotto', `${pool.ownerId}:${i}`), kind: 'bank', vertices: part.vertices.map(transform), indices: part.indices, material: part.material,
        }));
        return { plan: { ownerId: pool.ownerId, pivot, yaw, scale, footprint,
            surfaceIds: surfaces.map(surface => floorId(pool.districtId, surface.id)) }, surfaces };
    }
}

/** Compose once from the immutable source and raw ownership. No final place
 * growth, rendering receipt, clock, save write or navigation grant feeds back. */
export function composeAuthoredWaterWorld(state: GrowingState, base: IslandWorld): { world: IslandWorld; plan: AuthoredWaterPlan } {
    const supplied = connectedWaterChannels(waterLayout(state, base));
    const owners = state.landmarks.filter((owner): owner is WaterOwner => !!owner.cell && base.owns(owner.cell)
        && (owner.kind === 'water-bowl' || owner.kind === 'water-channel' && supplied.has(key(owner.cell))))
        .sort((a, b) => a.id.localeCompare(b.id));
    const byCell = new Map(owners.map(owner => [key(owner.cell), owner]));
    const groups: AuthoredWaterGroup[] = [], pools: AuthoredWaterPool[] = [], cuts: Cut[] = [], streams: AuthoredWaterStream[] = [];
    const seen = new Set<string>();
    for (const owner of owners) {
        if (seen.has(owner.id)) continue;
        const members = [owner]; seen.add(owner.id);
        for (let i = 0; i < members.length; i++) for (const cell of waterNeighbors(base, members[i].cell)) {
            const other = byCell.get(key(cell));
            if (!other || seen.has(other.id)) continue;
            seen.add(other.id); members.push(other);
        }
        members.sort((a, b) => a.id.localeCompare(b.id));
        const bowls = members.filter(member => member.kind === 'water-bowl').sort((a, b) => (base.anchorAt(b.cell)?.y ?? 0) - (base.anchorAt(a.cell)?.y ?? 0) || a.id.localeCompare(b.id)), channels = members.filter(member => member.kind === 'water-channel');
        const group: AuthoredWaterGroup = { id: `water-group:${JSON.stringify(members.map(member => member.id))}`, ownerIds: members.map(member => member.id),
            bowlIds: bowls.map(bowl => bowl.id), channelIds: channels.map(channel => channel.id), cut: false, reason: 'individual-bodies' };
        groups.push(group);
        if (bowls.length < 3 || channels.length < 2) continue;
        const protections = protectedCells(state, new Set(group.ownerIds));
        const nextPools = bowls.map((bowl, i) => poolFor(bowl, i, bowls, base, protections));
        if (nextPools.some(pool => !pool)) { group.reason = 'insufficient-clearance'; continue; }
        const edgeIds = new Set<string>(), links: [WaterOwner, WaterOwner][] = [];
        for (const member of members) for (const cell of waterNeighbors(base, member.cell)) {
            const other = byCell.get(key(cell)); if (!other || !group.ownerIds.includes(other.id)) continue;
            const id = JSON.stringify([member.id, other.id].sort()); if (edgeIds.has(id)) continue; edgeIds.add(id);
            links.push([member, other]);
        }
        const initialStreams = links.map(([a, b]) => streamFor(a, b, nextPools as AuthoredWaterPool[], base, protections));
        const adjoining = initialStreams.filter((cut): cut is Cut[] => !!cut).map(cut => cut[0].stream!);
        const nextStreams = initialStreams.some(stream => !stream) ? initialStreams
            : links.map(([a, b]) => streamFor(a, b, nextPools as AuthoredWaterPool[], base, protections, adjoining));
        // A logical supply link must have its full physical trench. Never cut
        // pools or suppress all owner bodies for a partially disconnected garden.
        if (nextStreams.some(stream => !stream)) { group.reason = 'insufficient-clearance'; continue; }
        group.cut = true; delete group.reason;
        for (const pool of nextPools as AuthoredWaterPool[]) {
            pools.push(pool); cuts.push({ id: `pool:${pool.ownerId}`, outline: pool.outline, outerOutline: pool.outerOutline, districtIds: [pool.districtId], color: pool.color, bedColor: pool.bedColor,
                ownerIds: [pool.ownerId], heightAt: () => pool.waterY, pool });
        }
        for (const nextCuts of nextStreams as Cut[][]) { cuts.push(...nextCuts); streams.push(nextCuts[0].stream!); }
    }
    const grottoCandidates = groups.filter(group => group.cut).flatMap(group => {
        const upper = pools.find(pool => group.bowlIds.includes(pool.ownerId));
        const result = upper && grottoFor(upper, streams, base, protectedCells(state, new Set(group.ownerIds)));
        return result ? [{ districtId: upper!.districtId, ...result }] : [];
    });
    const revision = `authored-water-v2:${fingerprint(JSON.stringify({ base: [base.id, base.definition.revision, base.definition.source],
        profile: nativeWaterSource, scopes: base.definition.districts.map(district => [district.id, district.waterCarvingScopes]),
        water: owners.map(owner => [owner.id, owner.kind, owner.cell, owner.growth]),
        obstacles: protectedCells(state, new Set()).map(p => [p.cell, p.half]),
        pools: pools.map(pool => [pool.ownerId, pool.axes, pool.outline, pool.outerOutline]), streams: streams.map(stream => [stream.id, stream.outline, stream.centerline]), grottos: grottoCandidates.map(grotto => grotto.plan) }))}`;
    const plan: AuthoredWaterPlan = { revision, ownerIds: [...new Set(cuts.flatMap(cut => cut.ownerIds))], groups, pools, streams, grottos: grottoCandidates.map(grotto => grotto.plan), bridges: [] };
    const actualCuts: { cut: Cut; district: WorldDistrict; water: WorldFloor; bed: WorldFloor }[] = [];
    let definition = structuredClone(base.definition);
    definition.revision = revision;
    definition.districts = definition.districts.map(district => {
        const worldCuts = cuts.filter(cut => cut.districtIds.includes(district.id));
        const localCuts = worldCuts.map(cut => {
            const outline = cut.outline.map(p => pointToLocal(district, p)), outerOutline = (cut.outerOutline ?? cut.outline).map(p => pointToLocal(district, p));
            return { cut, pieces: decomposeWaterOutline(outline), outerPieces: decomposeWaterOutline(outerOutline), box: bounds(outerOutline) };
        });
        const additions = new Map<Cut, { water: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] }; bed: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] } }>();
        const floors = district.floors.flatMap(floor => {
            const allowedFloors = authoredWaterCarvingFloorIds(base, district.id);
            if (floor.kind !== 'ground' || !localCuts.length || allowedFloors && !allowedFloors.includes(floorId(district.id, floor.id))) return [floor];
            const vertices = [...floor.vertices], indices: number[] = [];
            for (let i = 0; i < floor.indices.length; i += 3) {
                const sourceIndices = floor.indices.slice(i, i + 3), triangle = sourceIndices.map(index => floor.vertices[index]);
                const box = bounds(triangle.map(v => v.point)), applicable = localCuts.filter(cut => overlaps(box, cut.box));
                if (!applicable.length) { indices.push(...sourceIndices); continue; }
                let remaining = [triangle], changed = false;
                // The outer bank is a real cut and never a fake supporting floor.
                for (const { outerPieces } of applicable) for (const outline of outerPieces) {
                    const next: WorldFloorVertex[][] = [];
                    for (const polygon of remaining) {
                        const pieces = subtract(polygon, outline);
                        changed ||= !!pieces.inside.length; next.push(...pieces.inside.length ? pieces.outside : [polygon]);
                    }
                    remaining = next;
                }
                if (!changed) indices.push(...sourceIndices);
                else for (const polygon of remaining) append({ vertices, indices }, polygon);
                // Water comes from the immutable source, independently of the
                // bank cut. A stream mouth crossing the annulus therefore has
                // real water instead of a hole left by an earlier pool cut.
                let wetRemaining = [triangle];
                for (const { cut, pieces: wetPieces } of applicable) for (const outline of wetPieces) {
                    const next: WorldFloorVertex[][] = [];
                    for (const polygon of wetRemaining) {
                        const pieces = subtract(polygon, outline);
                        if (!pieces.inside.length) { next.push(polygon); continue; }
                        next.push(...pieces.outside);
                        let addition = additions.get(cut);
                        if (!addition) {
                            const waterLocalId = cut.pool ? localId('pool-water', cut.pool.ownerId) : localId('stream-water', cut.id);
                            const bedLocalId = cut.pool ? localId('pool-bed', cut.pool.ownerId) : localId('stream-bed', cut.id);
                            addition = { water: { id: waterLocalId, kind: 'water', color: cut.color, vertices: [], indices: [] },
                                bed: { id: bedLocalId, kind: 'ground', color: cut.bedColor, vertices: [], indices: [] } }; additions.set(cut, addition);
                        }
                        const wet = pieces.inside.map(vertex => ({ cell: { ...vertex.cell }, point: { ...vertex.point,
                            y: round(cut.heightAt(pointToWorld(district, vertex.point)) - district.worldOrigin.y) } }));
                        append(addition.water, wet, true);
                        append(addition.bed, wet.map(vertex => ({ cell: { ...vertex.cell }, point: { ...vertex.point, y: round(vertex.point.y - DEPTH) } })), true);
                    }
                    wetRemaining = next;
                }
            }
            return indices.length ? [{ ...floor, vertices, indices }] : [];
        });
        const surfaces = [...district.surfaces ?? [], ...grottoCandidates.filter(grotto => grotto.districtId === district.id).flatMap(grotto => grotto.surfaces.map(surface => ({ ...surface, vertices: surface.vertices.map(p => pointToLocal(district, p)) })))];
        for (const [cut, addition] of additions) {
            if (!addition.water.indices.length || !addition.bed.indices.length) continue;
            floors.push(addition.water, addition.bed);
            actualCuts.push({ cut, district, ...addition });
            // A cross-district trench has one independently transformed part per
            // actual district, without inventing support between those parts.
            if (cut.stream) {
                (cut.stream.waterFloorIds as string[]).push(floorId(district.id, addition.water.id));
                (cut.stream.bedFloorIds as string[]).push(floorId(district.id, addition.bed.id));
            }
            surfaces.push(...bankFor(cut, district, base, worldCuts));
            const flow = flowFor(cut, district);
            if (flow && !surfaces.some(surface => surface.id === flow.id)) surfaces.push(flow);
        }
        return { ...district, floors, surfaces, anchorFloors: district.anchorFloors ?? district.floors,
            sites: district.sites.map(site => ({ ...site, anchorPoint: pointToLocal(district, base.anchorAt(cellToWorld(district, site.cell))!) })) };
    });
    // Sequential clipping leaves one physical floor at overlapping junctions.
    // Resolve that shared floor instead of adding a second coplanar water mesh
    // or pretending the later trench has no water where an earlier cut owns it.
    for (const stream of streams) {
        const group = groups.find(group => group.cut && stream.ownerIds.every(id => group.ownerIds.includes(id)))!;
        const waterIds = new Set(stream.waterFloorIds), bedIds = new Set(stream.bedFloorIds);
        for (const actual of actualCuts) {
            if (!actual.cut.ownerIds.every(id => group.ownerIds.includes(id))
                || !floorIntersectsOutline(actual.water, actual.district, stream.outline)) continue;
            waterIds.add(floorId(actual.district.id, actual.water.id)); bedIds.add(floorId(actual.district.id, actual.bed.id));
        }
        stream.waterFloorIds = [...waterIds]; stream.bedFloorIds = [...bedIds];
    }
    const sourceEdges = definition.edges;
    // Compile the actual new support without trusting source walking grants;
    // restore only edges which the compiler's same foot-band helper accepts.
    definition.edges = sourceEdges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk') })).filter(edge => edge.allows.length);
    const cutWorld = compileWorldDefinition(definition), bridgeComposition = composeAuthoredWaterBridges(state, base, cutWorld, plan);
    definition = bridgeComposition.definition; plan.bridges = bridgeComposition.bridges;
    const supportWorld = bridgeComposition.supportWorld, refs = new Map(supportWorld.sites.map(site => [refKey(site.ref), site.cell]));
    definition.edges = sourceEdges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk'
        || isWorldWalkEdgeSupported(supportWorld, refs.get(refKey(edge.from))!, refs.get(refKey(edge.to))!)) })).filter(edge => edge.allows.length);
    const dryWorld = compileWorldDefinition(definition);
    definition.districts = definition.districts.map(district => ({ ...district, shoreAccess: owners.filter(owner => plan.ownerIds.includes(owner.id))
        .map(owner => {
            const site = dryWorld.sites.find(site => site.ref.districtId === district.id && key(site.cell) === key(owner.cell));
            if (!site) return undefined;
            const waterFloorIds = [...new Set([...pools.filter(pool => pool.ownerIds.includes(owner.id)).map(pool => pool.waterFloorId),
                ...streams.filter(stream => stream.ownerIds.includes(owner.id)).flatMap(stream => stream.waterFloorIds)])];
            return { ownerSiteId: site.ref.siteId, waterFloorIds: waterFloorIds.filter(id => JSON.parse(id)[0] === district.id).map(id => JSON.parse(id)[1] as string), entrySiteIds: findAuthoredShoreEntries(dryWorld, waterFloorIds)
                .filter(ref => ref.districtId === district.id).map(ref => ref.siteId) };
        }).filter((access): access is NonNullable<typeof access> => !!access) }));
    const finalRevision = `${revision}:${fingerprint(JSON.stringify({ bridgeProfile: nativeWaterBridgeProfile, bridges: plan.bridges, shore: definition.districts.map(district => [district.id, district.shoreAccess]) }))}`;
    definition.revision = finalRevision; plan.revision = finalRevision;
    return { world: compileWorldDefinition(definition), plan: freeze(plan) };
}
