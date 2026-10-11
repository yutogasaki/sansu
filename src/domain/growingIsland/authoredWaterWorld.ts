import { connectedWaterChannels } from '../islandLife/waterChannels';
import { AUTHORED_OWNER_HALF_EXTENT, AUTHORED_WALK_HALF_WIDTH } from './authoredWorldAccess';
import { waterLayout } from './environment';
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
}
export interface AuthoredWaterGroup {
    id: string;
    ownerIds: readonly string[];
    bowlIds: readonly string[];
    channelIds: readonly string[];
    cut: boolean;
    reason?: 'individual-bodies' | 'insufficient-clearance';
}
export interface AuthoredWaterPlan {
    revision: string;
    /** Only these owners' individual bodies are replaced by actual shared cuts. */
    ownerIds: readonly string[];
    groups: readonly AuthoredWaterGroup[];
    pools: readonly AuthoredWaterPool[];
    streams: readonly AuthoredWaterStream[];
}

const EPS = 1e-9;
const SURFACE_RISE = .025, DEPTH = .18, SHORE_WIDTH = .14;
const WATER_COLORS = ['#66bbdc', '#879fd9', '#69cfc6'];
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
            z: round(a.point.z + (b.point.z - a.point.z) * t) } };
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
function outlineAt(center: WorldPoint, radius: number, seed: number): WorldPoint[] {
    const rotation = seed * .43;
    return Array.from({ length: 16 }, (_, i) => {
        const a = i * Math.PI / 8, r = radius * (1 + .035 * Math.cos(3 * a + seed));
        const x = Math.cos(a) * r, z = Math.sin(a) * r * (.86 + seed % 3 * .025);
        return { x: round(center.x + x * Math.cos(rotation) - z * Math.sin(rotation)), y: center.y,
            z: round(center.z + x * Math.sin(rotation) + z * Math.cos(rotation)) };
    });
}
function convex(outline: Outline) {
    return outline.every((p, i) => cross(p, outline[(i + 1) % outline.length], outline[(i + 2) % outline.length]) > EPS);
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
function safePoint(base: IslandWorld, point: WorldPoint, protections: readonly Protection[], districtId?: string) {
    const cell = base.logicalAt(point); if (!cell || !base.floorAt(cell)) return false;
    const owned = base.sites.find(site => site.placement && Math.abs(cell.x - site.cell.x) <= .5 + EPS && Math.abs(cell.z - site.cell.z) <= .5 + EPS);
    if (!owned || districtId && owned.ref.districtId !== districtId) return false;
    return !protections.some(p => Math.abs(cell.x - p.cell.x) < p.half && Math.abs(cell.z - p.cell.z) < p.half);
}
function safeOutline(base: IslandWorld, outline: Outline, protections: readonly Protection[], districtId?: string) {
    for (let i = 0; i < outline.length; i++) for (const t of [0, .25, .5, .75]) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        if (!safePoint(base, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }, protections, districtId)) return false;
    }
    return true;
}
function poolFor(owner: WaterOwner, index: number, bowls: readonly WaterOwner[], base: IslandWorld, protections: readonly Protection[]): AuthoredWaterPool | undefined {
    const site = base.sites.find(site => key(site.cell) === key(owner.cell));
    const center = base.anchorAt(owner.cell) ?? base.floorAt(owner.cell)?.point;
    if (!site?.placement || !center) return;
    const nearest = Math.min(...bowls.filter(bowl => bowl.id !== owner.id).map(bowl => horizontal(center, base.anchorAt(bowl.cell)!)));
    const max = Math.min(.68, .54 + index * .07, nearest / 2 - SHORE_WIDTH);
    for (let radius = max; radius >= .32 - EPS; radius -= .02) {
        const outline = outlineAt(center, radius, index + 1);
        // Preserve a real dry band around the pool. It cannot claim another
        // owner's support, doorway or the unacquired side of a narrow shore.
        const bodyProtections = protections.map(p => ({ ...p, half: Math.max(0, p.half - AUTHORED_WALK_HALF_WIDTH) }));
        if (!convex(outline) || !safeOutline(base, outline, protections, site.ref.districtId)
            || !safeOutline(base, outlineAt(center, radius + AUTHORED_WALK_HALF_WIDTH, index + 1), bodyProtections, site.ref.districtId)) continue;
        const waterY = round(center.y + SURFACE_RISE), bedY = round(waterY - DEPTH);
        return { ownerId: owner.id, ownerIds: [owner.id], districtId: site.ref.districtId, center: { ...center }, radius: round(radius), waterY, bedY,
            outline, waterFloorId: floorId(site.ref.districtId, localId('pool-water', owner.id)),
            bedFloorId: floorId(site.ref.districtId, localId('pool-bed', owner.id)), color: WATER_COLORS[index % 3], bedColor: BED_COLORS[index % 3] };
    }
}

interface Cut { id: string; outline: Outline; color: string; bedColor: string; heightAt: (point: WorldPoint) => number; ownerIds: string[]; pool?: AuthoredWaterPool; stream?: AuthoredWaterStream }
/** Keep the whole trench mouth inside the actual convex organic pool. Its
 * short rotated axis can end before a radius-based trim would reach the water. */
function poolMouthDistance(pool: AuthoredWaterPool | undefined, dx: number, dz: number, width: number): number | undefined {
    if (!pool) return 0;
    let distance = Infinity;
    for (const side of [-width, width]) {
        const origin = { x: pool.center.x + dz * side, y: pool.center.y, z: pool.center.z - dx * side };
        for (let i = 0; i < pool.outline.length; i++) {
            const a = pool.outline[i], b = pool.outline[(i + 1) % pool.outline.length];
            const atOrigin = cross(a, b, origin), alongRay = (b.x - a.x) * dz - (b.z - a.z) * dx;
            if (atOrigin < -EPS) return;
            if (alongRay < -EPS) distance = Math.min(distance, atOrigin / -alongRay);
        }
    }
    // The overlap is real area rather than a numerically touching boundary.
    return Number.isFinite(distance) && distance > .025 ? distance - .025 : undefined;
}
function streamFor(a: WaterOwner, b: WaterOwner, pools: readonly AuthoredWaterPool[], base: IslandWorld, protections: readonly Protection[]): Cut[] | undefined {
    const a0 = base.anchorAt(a.cell), b0 = base.anchorAt(b.cell); if (!a0 || !b0) return;
    const length = horizontal(a0, b0); if (length <= .05) return;
    const dx = (b0.x - a0.x) / length, dz = (b0.z - a0.z) / length;
    const aPool = pools.find(pool => pool.ownerId === a.id), bPool = pools.find(pool => pool.ownerId === b.id);
    const width = .095, fromTrim = poolMouthDistance(aPool, dx, dz, width), toTrim = poolMouthDistance(bPool, -dx, -dz, width);
    if (fromTrim === undefined || toTrim === undefined) return;
    const from = { x: a0.x + dx * fromTrim, y: a0.y + SURFACE_RISE, z: a0.z + dz * fromTrim };
    const to = { x: b0.x - dx * toTrim, y: b0.y + SURFACE_RISE, z: b0.z - dz * toTrim };
    if (horizontal(from, to) <= .05) return;
    const outline = [
        { x: from.x + dz * width, y: from.y, z: from.z - dx * width },
        { x: to.x + dz * width, y: to.y, z: to.z - dx * width },
        { x: to.x - dz * width, y: to.y, z: to.z + dx * width },
        { x: from.x - dz * width, y: from.y, z: from.z + dx * width },
    ].map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z) }));
    if (!safeOutline(base, outline, protections)) return;
    // The whole trench must be over actual original ground. Water grants alone
    // cannot bridge an inlet or invent a physical link between two terraces.
    for (let i = 0, steps = Math.max(8, Math.ceil(length * 16)); i <= steps; i++) for (const side of [-width, 0, width]) {
        if (!safePoint(base, { x: from.x + (to.x - from.x) * i / steps - dz * side, y: from.y + (to.y - from.y) * i / steps,
            z: from.z + (to.z - from.z) * i / steps + dx * side }, protections)) return;
    }
    const id = JSON.stringify([a.id, b.id].sort());
    const stream: AuthoredWaterStream = { id, ownerIds: [a.id, b.id], from, to, outline, waterFloorIds: [], bedFloorIds: [], falling: Math.abs(from.y - to.y) > .06 };
    const vx = to.x - from.x, vz = to.z - from.z, squared = vx * vx + vz * vz;
    const common = { ownerIds: [...stream.ownerIds], color: '#79cbd8', bedColor: '#667e96', stream };
    if (stream.falling) {
        const p = { x: (outline[0].x + outline[1].x) / 2, y: from.y, z: (outline[0].z + outline[1].z) / 2 };
        const q = { x: (outline[2].x + outline[3].x) / 2, y: to.y, z: (outline[2].z + outline[3].z) / 2 };
        return [{ ...common, id: `stream:${id}:from`, outline: [outline[0], p, q, outline[3]], heightAt: () => from.y },
            { ...common, id: `stream:${id}:to`, outline: [p, outline[1], outline[2], q], heightAt: () => to.y }];
    }
    return [{ ...common, id: `stream:${id}`, outline,
        heightAt: point => round(from.y + (to.y - from.y) * Math.max(0, Math.min(1, ((point.x - from.x) * vx + (point.z - from.z) * vz) / squared))) }];
}

function bounds(outline: Outline) { return { minX: Math.min(...outline.map(p => p.x)), maxX: Math.max(...outline.map(p => p.x)),
    minZ: Math.min(...outline.map(p => p.z)), maxZ: Math.max(...outline.map(p => p.z)) }; }
const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>) => a.minX <= b.maxX + EPS && a.maxX + EPS >= b.minX && a.minZ <= b.maxZ + EPS && a.maxZ + EPS >= b.minZ;
function floorIntersectsOutline(floor: WorldFloor, district: WorldDistrict, outline: Outline) {
    const box = bounds(outline), vertices = floor.vertices.map(vertex => ({ ...vertex, point: pointToWorld(district, vertex.point) }));
    for (let i = 0; i < floor.indices.length; i += 3) {
        const triangle = floor.indices.slice(i, i + 3).map(index => vertices[index]);
        if (overlaps(bounds(triangle.map(vertex => vertex.point)), box) && subtract(triangle, outline).inside.length) return true;
    }
    return false;
}
/** Remove portions of a bank where another actual cut opens into this water. */
function bankIntervals(a: WorldPoint, b: WorldPoint, outlines: readonly Outline[]) {
    let intervals = [[0, 1]];
    for (const outline of outlines) {
        let min = 0, max = 1;
        for (let i = 0; i < outline.length && min <= max; i++) {
            const p = outline[i], q = outline[(i + 1) % outline.length], da = cross(p, q, a), db = cross(p, q, b), delta = db - da;
            if (Math.abs(delta) <= EPS) { if (da < -EPS) { min = 1; max = 0; } }
            else if (delta > 0) min = Math.max(min, -da / delta);
            else max = Math.min(max, -da / delta);
        }
        if (min > max || max - min < 1e-8) continue;
        intervals = intervals.flatMap(([lo, hi]) => max <= lo || min >= hi ? [[lo, hi]]
            : [...(lo < min ? [[lo, min]] : []), ...(max < hi ? [[max, hi]] : [])]);
    }
    return intervals;
}
function bankFor(cut: Cut, district: WorldDistrict, base: IslandWorld, others: readonly Cut[]): WorldSurface | undefined {
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
            vertices.push(top(a), top(b), pointToLocal(district, { ...b, y: cut.heightAt(b) - DEPTH }), pointToLocal(district, { ...a, y: cut.heightAt(a) - DEPTH }));
            indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
        }
    }
    if (!indices.length) return;
    return { id: localId('bank', cut.id), kind: 'bank', vertices, indices, material: { color: cut.bedColor, roughness: .82, metalness: 0 } };
}
function flowFor(cut: Cut, district: WorldDistrict): WorldSurface | undefined {
    if (!cut.stream?.falling) return;
    const { from, to } = cut.stream, middle = { x: (from.x + to.x) / 2, z: (from.z + to.z) / 2 }, length = horizontal(from, to);
    const nx = -(to.z - from.z) / length * .095, nz = (to.x - from.x) / length * .095;
    const y0 = Math.max(from.y, to.y), y1 = Math.min(from.y, to.y);
    return { id: localId('flow', cut.stream.id), kind: 'flow', vertices: [
        { x: middle.x - nx, y: y0, z: middle.z - nz }, { x: middle.x + nx, y: y0, z: middle.z + nz },
        { x: middle.x + nx, y: y1, z: middle.z + nz }, { x: middle.x - nx, y: y1, z: middle.z - nz },
    ].map(p => pointToLocal(district, p)), indices: [0, 1, 2, 0, 2, 3], material: { color: '#a2e0ed', roughness: .2, metalness: .08, opacity: .78 } };
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
        const bowls = members.filter(member => member.kind === 'water-bowl'), channels = members.filter(member => member.kind === 'water-channel');
        const group: AuthoredWaterGroup = { id: `water-group:${JSON.stringify(members.map(member => member.id))}`, ownerIds: members.map(member => member.id),
            bowlIds: bowls.map(bowl => bowl.id), channelIds: channels.map(channel => channel.id), cut: false, reason: 'individual-bodies' };
        groups.push(group);
        if (bowls.length < 3 || channels.length < 2) continue;
        const protections = protectedCells(state, new Set(group.ownerIds));
        const nextPools = bowls.map((bowl, i) => poolFor(bowl, i, bowls, base, protections));
        if (nextPools.some(pool => !pool)) { group.reason = 'insufficient-clearance'; continue; }
        const edgeIds = new Set<string>(), nextStreams: (Cut[] | undefined)[] = [];
        for (const member of members) for (const cell of waterNeighbors(base, member.cell)) {
            const other = byCell.get(key(cell)); if (!other || !group.ownerIds.includes(other.id)) continue;
            const id = JSON.stringify([member.id, other.id].sort()); if (edgeIds.has(id)) continue; edgeIds.add(id);
            nextStreams.push(streamFor(member, other, nextPools as AuthoredWaterPool[], base, protections));
        }
        // A logical supply link must have its full physical trench. Never cut
        // pools or suppress all owner bodies for a partially disconnected garden.
        if (nextStreams.some(stream => !stream)) { group.reason = 'insufficient-clearance'; continue; }
        group.cut = true; delete group.reason;
        for (const pool of nextPools as AuthoredWaterPool[]) {
            pools.push(pool); cuts.push({ id: `pool:${pool.ownerId}`, outline: pool.outline, color: pool.color, bedColor: pool.bedColor,
                ownerIds: [pool.ownerId], heightAt: () => pool.waterY, pool });
        }
        for (const nextCuts of nextStreams as Cut[][]) { cuts.push(...nextCuts); streams.push(nextCuts[0].stream!); }
    }
    const revision = `authored-water-v1:${fingerprint(JSON.stringify({ base: [base.id, base.definition.revision, base.definition.source],
        water: owners.map(owner => [owner.id, owner.kind, owner.cell, owner.growth]),
        obstacles: protectedCells(state, new Set()).map(p => [p.cell, p.half]),
        pools: pools.map(pool => [pool.ownerId, pool.radius, pool.outline]), streams: streams.map(stream => [stream.id, stream.outline]) }))}`;
    const plan: AuthoredWaterPlan = { revision, ownerIds: [...new Set(cuts.flatMap(cut => cut.ownerIds))], groups, pools, streams };
    const actualCuts: { cut: Cut; district: WorldDistrict; water: WorldFloor; bed: WorldFloor }[] = [];
    const definition = structuredClone(base.definition);
    definition.revision = revision;
    definition.districts = definition.districts.map(district => {
        const worldCuts = cuts.filter(cut => cut.pool ? cut.pool.districtId === district.id : true);
        const localCuts = worldCuts.map(cut => ({ cut, outline: cut.outline.map(p => pointToLocal(district, p)), box: bounds(cut.outline.map(p => pointToLocal(district, p))) }));
        const additions = new Map<Cut, { water: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] }; bed: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] } }>();
        const floors = district.floors.flatMap(floor => {
            if (floor.kind !== 'ground' || !localCuts.length) return [floor];
            const vertices = [...floor.vertices], indices: number[] = [];
            for (let i = 0; i < floor.indices.length; i += 3) {
                const sourceIndices = floor.indices.slice(i, i + 3), triangle = sourceIndices.map(index => floor.vertices[index]);
                const box = bounds(triangle.map(v => v.point)), applicable = localCuts.filter(cut => overlaps(box, cut.box));
                if (!applicable.length) { indices.push(...sourceIndices); continue; }
                let remaining = [triangle]; let changed = false;
                for (const { cut, outline } of applicable) {
                    const next: WorldFloorVertex[][] = [];
                    for (const polygon of remaining) {
                        const pieces = subtract(polygon, outline);
                        if (!pieces.inside.length) { next.push(polygon); continue; }
                        changed = true; next.push(...pieces.outside);
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
                    remaining = next;
                }
                if (!changed) indices.push(...sourceIndices);
                else for (const polygon of remaining) append({ vertices, indices }, polygon);
            }
            return indices.length ? [{ ...floor, vertices, indices }] : [];
        });
        const surfaces = [...district.surfaces ?? []];
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
            const bank = bankFor(cut, district, base, cuts); if (bank) surfaces.push(bank);
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
    const supportWorld = compileWorldDefinition(definition), refs = new Map(supportWorld.sites.map(site => [refKey(site.ref), site.cell]));
    definition.edges = sourceEdges.map(edge => ({ ...edge, allows: edge.allows.filter(kind => kind !== 'walk'
        || isWorldWalkEdgeSupported(supportWorld, refs.get(refKey(edge.from))!, refs.get(refKey(edge.to))!)) })).filter(edge => edge.allows.length);
    return { world: compileWorldDefinition(definition), plan: freeze(plan) };
}
