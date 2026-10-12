import { authoredWaterCarvingFloorIds, isAuthoredWaterCarvingSafe } from './authoredWaterCarving';
import { outlineArea, pointInWaterOutline, subtractWaterConvexPieces, waterSegmentIntervals } from './authoredWaterContour';
import type { AuthoredWaterGrotto, AuthoredWaterPool, AuthoredWaterStream } from './authoredWaterWorld';
import nativeBridge from './nativeWaterBridgeProfile.json';
import { AUTHORED_OWNER_HALF_EXTENT, AUTHORED_WALK_HALF_WIDTH } from './authoredWorldAccess';
import { HOUSE_CELLS } from './space';
import type { Cell, GrowingState } from './types';
import { compileWorldDefinition, isWorldWalkEdgeSupported, type IslandWorld } from './worldDefinition';
import type { WorldDefinition, WorldDistrict, WorldEdge, WorldFloor, WorldFloorVertex, WorldPoint } from './worldTypes';

export interface AuthoredWaterBridgePlan {
    ownerId: string;
    districtId: string;
    /** Compiled ID of the real continuous, source-shaped walking strip. */
    deckFloorId: string;
    sourceId: string;
    sourceSHA: string;
    center: WorldPoint;
    /** Three Y rotation: local +X becomes (cos yaw, 0, -sin yaw). */
    yaw: number;
    span: number;
    width: number;
    deckY: number;
    archHeight: number;
    outline: readonly WorldPoint[];
    footprint: readonly WorldPoint[];
    landingPoints: readonly WorldPoint[];
    /** Existing source edge identities, never newly authored passage grants. */
    restoredEdgeIds: readonly string[];
}
export interface AuthoredWaterBridgeInput {
    ownerIds: readonly string[];
    pools: readonly AuthoredWaterPool[];
    streams: readonly AuthoredWaterStream[];
    grottos: readonly AuthoredWaterGrotto[];
}
const EPS = 1e-9;
const key = (cell: Cell) => `${cell.x},${cell.z}`;
const refKey = (ref: { districtId: string; siteId: string }) => JSON.stringify([ref.districtId, ref.siteId]);
const edgeKey = (edge: WorldEdge) => JSON.stringify([refKey(edge.from), refKey(edge.to)].sort());
const round = (n: number) => Math.round(n * 1e9) / 1e9 || 0;
const cross = (a: WorldPoint, b: WorldPoint, p: WorldPoint) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const area = (polygon: readonly WorldFloorVertex[]) => polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return sum + p.point.x * q.point.z - p.point.z * q.point.x;
}, 0) / 2;
const turn = (x: number, z: number, n: number): Cell => n === 1 ? { x: -z, z: x } : n === 2 ? { x: -x, z: -z } : n === 3 ? { x: z, z: -x } : { x, z };
function localPoint(district: WorldDistrict, p: WorldPoint): WorldPoint {
    const xy = turn(p.x - district.worldOrigin.x, p.z - district.worldOrigin.z, (4 - district.turn) % 4);
    return { x: round(xy.x), y: round(p.y - district.worldOrigin.y), z: round(xy.z) };
}
function worldPoint(district: WorldDistrict, p: WorldPoint): WorldPoint {
    const xy = turn(p.x, p.z, district.turn);
    return { x: xy.x + district.worldOrigin.x, y: p.y + district.worldOrigin.y, z: xy.z + district.worldOrigin.z };
}
function intersect(polygon: readonly WorldFloorVertex[], outline: readonly WorldPoint[]) {
    let out = [...polygon];
    for (let i = 0; i < outline.length && out.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length], input = out; out = [];
        for (let j = 0; j < input.length; j++) {
            const p = input[j], q = input[(j + 1) % input.length], dp = cross(a, b, p.point), dq = cross(a, b, q.point);
            if (dp >= -EPS) out.push(p);
            if ((dp >= -EPS) !== (dq >= -EPS) && Math.abs(dp - dq) > EPS) {
                const t = Math.max(0, Math.min(1, dp / (dp - dq)));
                out.push({ cell: { x: round(p.cell.x + (q.cell.x - p.cell.x) * t), z: round(p.cell.z + (q.cell.z - p.cell.z) * t) },
                    point: { x: round(p.point.x + (q.point.x - p.point.x) * t), y: round(p.point.y + (q.point.y - p.point.y) * t), z: round(p.point.z + (q.point.z - p.point.z) * t) } });
            }
        }
        out = out.filter((p, j) => Math.hypot(p.point.x - out[(j + out.length - 1) % out.length].point.x,
            p.point.z - out[(j + out.length - 1) % out.length].point.z) > 1e-8);
        if (out.length < 3 || Math.abs(area(out)) < 1e-12) return [];
    }
    return out;
}
function overlaps(a: readonly WorldPoint[], b: readonly WorldPoint[]) {
    return a.some(p => pointInWaterOutline(p, b)) || b.some(p => pointInWaterOutline(p, a))
        || a.some((p, i) => waterSegmentIntervals(p, a[(i + 1) % a.length], b).some(([from, to]) => to - from > EPS));
}
function protections(state: GrowingState, waterOwners: ReadonlySet<string>) {
    const out = HOUSE_CELLS.map(cell => ({ cell, half: AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH }));
    for (const owner of [...state.plots, ...state.landmarks, ...state.keepsakes]) {
        if (!owner.cell || waterOwners.has(owner.id)) continue;
        out.push({ cell: owner.cell, half: AUTHORED_OWNER_HALF_EXTENT + AUTHORED_WALK_HALF_WIDTH });
        if ('kind' in owner && owner.kind === 'home') out.push({ cell: { x: owner.cell.x, z: owner.cell.z + .75 }, half: .18 });
    }
    return out;
}
function footBand(base: IslandWorld, from: Cell, to: Cell): WorldPoint[] | undefined {
    const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz), steps = Math.max(8, Math.ceil(length * 8)), points: WorldPoint[] = [];
    for (let i = 0; i <= steps; i++) for (const side of [-AUTHORED_WALK_HALF_WIDTH, 0, AUTHORED_WALK_HALF_WIDTH]) {
        const cell = { x: from.x + dx * i / steps - dz / length * side, z: from.z + dz * i / steps + dx / length * side };
        const floor = base.anchorFloorAt(cell); if (!floor) return;
        points.push(floor.point);
    }
    return points;
}
function bandIntersects(points: readonly WorldPoint[], outline: readonly WorldPoint[]) {
    return points.some((p, i) => pointInWaterOutline(p, outline)
        || i % 3 < 2 && waterSegmentIntervals(p, points[i + 1], outline).length > 0
        || i + 3 < points.length && waterSegmentIntervals(p, points[i + 3], outline).length > 0);
}
/** Source board tops joined across their original small gaps. The renderer
 * uses the same source offsets and adaptations for the 33 visual components. */
export function authoredBridgeHeightAt(plan: Pick<AuthoredWaterBridgePlan, 'span' | 'archHeight' | 'deckY'>, localX: number) {
    const sourceX = localX * nativeBridge.span / plan.span, rows = nativeBridge.deckRows;
    const index = rows.findIndex(row => row.x >= sourceX - EPS), b = rows[index < 0 ? rows.length - 1 : index], a = rows[Math.max(0, (index < 0 ? rows.length - 1 : index) - 1)];
    const t = a === b ? 0 : Math.max(0, Math.min(1, (sourceX - a.x) / (b.x - a.x)));
    return plan.deckY + (a.y + (b.y - a.y) * t - nativeBridge.deckBaseY) * plan.archHeight / nativeBridge.archHeight;
}
function rectangle(center: WorldPoint, across: Cell, flow: Cell, minX: number, maxX: number, minZ: number, maxZ: number): WorldPoint[] {
    return [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]].map(([x, z]) => ({ x: center.x + across.x * x + flow.x * z, y: center.y, z: center.z + across.z * x + flow.z * z }));
}
function makeDeck(base: IslandWorld, district: WorldDistrict, plan: AuthoredWaterBridgePlan, across: Cell, flow: Cell): WorldFloor | undefined {
    const vertices: WorldFloorVertex[] = [], indices: number[] = [], allowed = authoredWaterCarvingFloorIds(base, district.id);
    const box = { minX: Math.min(...plan.outline.map(p => p.x)), maxX: Math.max(...plan.outline.map(p => p.x)), minZ: Math.min(...plan.outline.map(p => p.z)), maxZ: Math.max(...plan.outline.map(p => p.z)) };
    const strips = nativeBridge.deckRows.slice(1).map((row, i) => rectangle(plan.center, across, flow,
        nativeBridge.deckRows[i].x * plan.span / nativeBridge.span, row.x * plan.span / nativeBridge.span, -plan.width / 2, plan.width / 2));
    for (const floor of district.floors) {
        if (floor.kind !== 'ground' || allowed && !allowed.includes(JSON.stringify([district.id, floor.id]))) continue;
        for (let i = 0; i < floor.indices.length; i += 3) {
            const triangle = floor.indices.slice(i, i + 3).map(index => ({ cell: floor.vertices[index].cell, point: worldPoint(district, floor.vertices[index].point) }));
            if (triangle.every(v => v.point.x < box.minX) || triangle.every(v => v.point.x > box.maxX)
                || triangle.every(v => v.point.z < box.minZ) || triangle.every(v => v.point.z > box.maxZ)) continue;
            const clipped = intersect(triangle, plan.outline); if (!clipped.length) continue;
            for (const strip of strips) {
                const polygon = intersect(clipped, strip); if (!polygon.length) continue;
                const offset = vertices.length;
                vertices.push(...polygon.map(vertex => ({ cell: { ...vertex.cell }, point: localPoint(district, { ...vertex.point,
                    y: authoredBridgeHeightAt(plan, (vertex.point.x - plan.center.x) * across.x + (vertex.point.z - plan.center.z) * across.z) }) })));
                for (let j = 1; j + 1 < polygon.length; j++) indices.push(offset,
                    offset + (area(polygon) > 0 ? j + 1 : j), offset + (area(polygon) > 0 ? j : j + 1));
            }
        }
    }
    return indices.length ? { id: JSON.parse(plan.deckFloorId)[1], kind: 'deck', color: nativeBridge.material.color, vertices, indices } : undefined;
}
function waterClearance(world: IslandWorld, ids: readonly string[], center: WorldPoint, across: Cell, flow: Cell, span: number, width: number, archHeight: number): number | undefined {
    let minimumDeckY = -Infinity;
    // The water and each source arch strip are planar. Checking all vertices
    // of their actual triangle intersections proves clearance over the whole
    // area, including a narrow sliver a regular grid could miss.
    const strips = nativeBridge.deckRows.slice(1).map((row, i) => rectangle(center, across, flow,
        nativeBridge.deckRows[i].x * span / nativeBridge.span, row.x * span / nativeBridge.span, -width / 2, width / 2));
    for (const floor of world.floors.filter(floor => floor.kind === 'water' && ids.includes(floor.id))) for (let i = 0; i < floor.indices.length; i += 3) {
        const triangle = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]);
        for (const strip of strips) for (const vertex of intersect(triangle, strip)) {
            const localX = (vertex.point.x - center.x) * across.x + (vertex.point.z - center.z) * across.z;
            minimumDeckY = Math.max(minimumDeckY, vertex.point.y + .018 - authoredBridgeHeightAt({ span, archHeight, deckY: 0 }, localX));
        }
    }
    return Number.isFinite(minimumDeckY) ? minimumDeckY : undefined;
}
function dryLanding(world: IslandWorld, outline: readonly WorldPoint[], bedIds: ReadonlySet<string>): WorldPoint[] | undefined {
    const box = { minX: Math.min(...outline.map(p => p.x)), maxX: Math.max(...outline.map(p => p.x)), minZ: Math.min(...outline.map(p => p.z)), maxZ: Math.max(...outline.map(p => p.z)) };
    let uncovered = [[...outline]];
    const points: WorldPoint[] = [];
    for (const floor of world.floors) {
        if (floor.kind === 'deck' || bedIds.has(floor.id)) continue;
        for (let i = 0; i < floor.indices.length; i += 3) {
            const triangle = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]);
            if (triangle.every(v => v.point.x < box.minX) || triangle.every(v => v.point.x > box.maxX)
                || triangle.every(v => v.point.z < box.minZ) || triangle.every(v => v.point.z > box.maxZ)) continue;
            const clipped = intersect(triangle, outline); if (!clipped.length) continue;
            if (floor.kind === 'water') return; // A landing is a dry shore, not another water-covered floor.
            points.push(...clipped.map(v => v.point));
            const stencil = clipped.map(v => v.point); if (outlineArea(stencil) < 0) stencil.reverse();
            uncovered = uncovered.flatMap(piece => subtractWaterConvexPieces(piece, [stencil]));
        }
    }
    return uncovered.reduce((sum, p) => sum + Math.abs(outlineArea(p)), 0) < 1e-9 && points.length ? points : undefined;
}

/** A fed terminal's current cut may remove a source path foot band. A bridge
 * spans that actual band between dry shores; it never adds sites or edges. */
export function composeAuthoredWaterBridges(state: GrowingState, base: IslandWorld, cutWorld: IslandWorld, water: AuthoredWaterBridgeInput): { definition: WorldDefinition; bridges: AuthoredWaterBridgePlan[]; supportWorld: IslandWorld } {
    let definition = structuredClone(cutWorld.definition), current = cutWorld;
    const bridges: AuthoredWaterBridgePlan[] = [], sites = new Map(base.sites.map(site => [refKey(site.ref), site]));
    const protectedOwners = protections(state, new Set(water.ownerIds));
    const bedIds = new Set([...water.pools.map(pool => pool.bedFloorId), ...water.streams.flatMap(stream => stream.bedFloorIds)]);
    for (const owner of state.landmarks.filter(owner => owner.cell && owner.kind === 'water-channel' && water.ownerIds.includes(owner.id)).sort((a, b) => a.id.localeCompare(b.id))) {
        const links = water.streams.filter(stream => stream.ownerIds.includes(owner.id)); if (links.length !== 1) continue;
        const anchor = base.anchorAt(owner.cell!)!, site = base.sites.find(site => key(site.cell) === key(owner.cell!)), stream = links[0];
        if (!site) continue;
        const other = Math.hypot(stream.from.x - anchor.x, stream.from.z - anchor.z) < Math.hypot(stream.to.x - anchor.x, stream.to.z - anchor.z) ? stream.to : stream.from;
        const length = Math.hypot(anchor.x - other.x, anchor.z - other.z); if (length < .05) continue;
        const flow = { x: (anchor.x - other.x) / length, z: (anchor.z - other.z) / length }, across = { x: flow.z, z: -flow.x };
        const project = (p: WorldPoint) => ({ x: (p.x - anchor.x) * across.x + (p.z - anchor.z) * across.z, z: (p.x - anchor.x) * flow.x + (p.z - anchor.z) * flow.z });
        const candidates: { edge: WorldEdge; points: WorldPoint[] }[] = [];
        for (const edge of base.definition.edges) {
            if (!edge.allows.includes('walk') || edge.from.districtId !== site.ref.districtId || edge.to.districtId !== site.ref.districtId) continue;
            const a = sites.get(refKey(edge.from))!, b = sites.get(refKey(edge.to))!;
            const mid = project({ x: (a.point.x + b.point.x) / 2, y: 0, z: (a.point.z + b.point.z) / 2 });
            // This is a deliberately broad physical source-size bound. The
            // logical foot width is mapped by the original floor below, never
            // added to a world-space midpoint as if all districts were identity.
            if (Math.abs(mid.x) > nativeBridge.span / 2 || mid.z < -.13 || mid.z > .28
                || isWorldWalkEdgeSupported(current, a.cell, b.cell)) continue;
            const points = footBand(base, a.cell, b.cell); if (!points) continue;
            if (!bandIntersects(points, stream.outline)) continue;
            if (points.some(p => { const q = project(p); return q.z < -.16 || q.z > .41 || Math.abs(q.x) > nativeBridge.span / 2; })) continue;
            candidates.push({ edge, points });
        }
        if (!candidates.length) continue;
        const points = candidates.flatMap(candidate => candidate.points).map(project), minX = Math.min(...points.map(p => p.x)) - .01, maxX = Math.max(...points.map(p => p.x)) + .01,
            minZ = Math.min(...points.map(p => p.z)) - .01, maxZ = Math.max(...points.map(p => p.z)) + .01;
        const span = Math.max(nativeBridge.span * .4, maxX - minX), width = Math.max(nativeBridge.width, maxZ - minZ);
        if (span > nativeBridge.span + EPS || width > nativeBridge.width * 1.4) continue;
        const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, center = { x: anchor.x + across.x * cx + flow.x * cz, y: 0, z: anchor.z + across.z * cx + flow.z * cz };
        const outline = rectangle(center, across, flow, -span / 2, span / 2, -width / 2, width / 2), footprint = rectangle(center, across, flow,
            nativeBridge.bounds.min[0] * span / nativeBridge.span, nativeBridge.bounds.max[0] * span / nativeBridge.span,
            nativeBridge.bounds.min[2] * width / nativeBridge.width, nativeBridge.bounds.max[2] * width / nativeBridge.width);
        if (!isAuthoredWaterCarvingSafe(base, site.ref.districtId, footprint, protectedOwners)
            || water.pools.some(pool => overlaps(outline, pool.outline)) || water.grottos.some(grotto => overlaps(footprint, grotto.footprint))) continue;
        const landings = [-1, 1].map(side => dryLanding(current, rectangle(center, across, flow,
            side * span / 2 - .015, side * span / 2 + .015, -width / 2, width / 2), bedIds));
        if (landings.some(landing => !landing)) continue;
        const landingPoints = landings.flatMap(landing => landing!);
        if (Math.max(...landingPoints.map(p => p.y)) - Math.min(...landingPoints.map(p => p.y)) > .12) continue;
        const archHeight = nativeBridge.archHeight * span / nativeBridge.span;
        const clearDeckY = waterClearance(current, stream.waterFloorIds, center, across, flow, span, width, archHeight);
        if (clearDeckY === undefined) continue;
        const deckY = Math.max(Math.max(...landingPoints.map(p => p.y)) + .006, clearDeckY);
        if (deckY - Math.min(...landingPoints.map(p => p.y)) > .12) continue;
        const localId = `authored-water:bridge:${encodeURIComponent(owner.id)}`;
        const plan: AuthoredWaterBridgePlan = { ownerId: owner.id, districtId: site.ref.districtId, deckFloorId: JSON.stringify([site.ref.districtId, localId]),
            sourceId: nativeBridge.source.id, sourceSHA: nativeBridge.source.sha256, center: { ...center, y: round(deckY) }, yaw: Math.atan2(flow.x, flow.z),
            span: round(span), width: round(width), deckY: round(deckY), archHeight: round(archHeight), outline, footprint, landingPoints, restoredEdgeIds: [] };
        const district = base.definition.districts.find(district => district.id === site.ref.districtId)!, deck = makeDeck(base, district, plan, across, flow);
        if (!deck) continue;
        const next = { ...definition, districts: definition.districts.map(district => district.id === site.ref.districtId ? { ...district, floors: [...district.floors, deck] } : district) };
        const supported = compileWorldDefinition(next);
        if (candidates.some(({ edge }) => !isWorldWalkEdgeSupported(supported, sites.get(refKey(edge.from))!.cell, sites.get(refKey(edge.to))!.cell))) continue;
        plan.restoredEdgeIds = candidates.map(({ edge }) => edgeKey(edge));
        definition = next; current = supported; bridges.push(plan);
    }
    // Every adopted deck has already been compiled to verify its foot bands.
    // The caller can restore source edges against that same support snapshot;
    // rejected candidates never replace it, and later definition edits are separate.
    return { definition, bridges, supportWorld: current };
}
