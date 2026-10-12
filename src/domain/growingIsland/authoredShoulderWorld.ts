import type { Cell } from './types';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { WorldDistrict, WorldEdge, WorldFloor, WorldFloorVertex, WorldPoint, WorldSiteRef } from './worldTypes';

export const AUTHORED_SHOULDER_CANDIDATE = 'native05-central-shoulder-sw-v3-source-v1';
export const AUTHORED_SHOULDER_COMPONENT_SHA = 'c79e2cd7a228b24ff526e6d78913f6a07880e35dec1532d4c278dd7cbf10411e';
const BASE_SHA = '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d';
const GEOMETRY_SHA = '7b4772489932b225d7b31ced5bd53c6835a47e8e63c71eeb43d7b59af1523d3b';
const DISTRICT = 'diagnostic-central-shoulder-c-feasibility';

/** Explicit diagnostic land extension, independent of tree ownership/maturity.
 * Loaded on demand by the caller; this module imports no source geometry JSON. */
export interface AuthoredShoulderProfile {
    readonly version: 1;
    readonly candidate: string;
    readonly source: { readonly baseSha256: string; readonly componentSha256: string; readonly geometryProfileSha256: string };
    readonly localGround: { readonly min: Cell; readonly max: Cell; readonly revision: string };
    readonly boundary: readonly Cell[];
    readonly sourceDistrictId: string;
    readonly clipFloorIds: readonly string[];
    readonly transferSiteIds: readonly string[];
    readonly district: WorldDistrict;
    readonly edges: readonly WorldEdge[];
    readonly triangleLineage: readonly { readonly sourceFloorId: string; readonly sourceTriangle: number; readonly targetFloorId: string }[];
    readonly physicalRevision: string;
}

const fail = (message: string): never => { throw new Error(`Authored shoulder: ${message}`); };
const refKey = (ref: WorldSiteRef) => JSON.stringify([ref.districtId, ref.siteId]);
const physicalVertex = ({ cell, point }: WorldFloorVertex) => ({ cell, point });
const physicalFloor = (floor: WorldFloor) => ({ id: floor.id, kind: floor.kind, vertices: floor.vertices.map(physicalVertex), indices: floor.indices });
function fingerprint(value: unknown): string {
    const text = JSON.stringify(value); let a = 2166136261, b = 2246822507;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** Drawing attributes never authorize different physical support. */
export function authoredShoulderGroundRevision(world: IslandWorld, bounds: { readonly min: Cell; readonly max: Cell }): string {
    const triangles: unknown[] = [];
    for (const floor of world.floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const vertices = floor.indices.slice(i, i + 3).map(index => floor.vertices[index]), points = vertices.map(vertex => vertex.point);
        if (Math.max(...points.map(p => p.x)) < bounds.min.x || Math.min(...points.map(p => p.x)) > bounds.max.x
            || Math.max(...points.map(p => p.z)) < bounds.min.z || Math.min(...points.map(p => p.z)) > bounds.max.z) continue;
        triangles.push([floor.id, floor.kind, vertices.map(physicalVertex)]);
    }
    return fingerprint(triangles);
}
export function authoredShoulderProfilePhysicalRevision(profile: AuthoredShoulderProfile): string {
    return fingerprint({ candidate: profile.candidate, source: profile.source, localGround: profile.localGround, boundary: profile.boundary,
        sourceDistrictId: profile.sourceDistrictId, clipFloorIds: profile.clipFloorIds, transferSiteIds: profile.transferSiteIds,
        district: { ...profile.district, floors: profile.district.floors.map(physicalFloor) }, edges: profile.edges,
        triangleLineage: profile.triangleLineage });
}
/** For a renderer/cache key; unlike physical applicability this includes shading. */
export function authoredShoulderDrawingRevision(world: IslandWorld): string { return fingerprint(world.definition); }
export function authoredShoulderProfileDrawingRevision(profile: AuthoredShoulderProfile): string { return fingerprint(profile); }

function area(poly: readonly WorldFloorVertex[]): number {
    return poly.length < 3 ? 0 : Math.abs(poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p.cell.x * q.cell.z - q.cell.x * p.cell.z; }, 0)) / 2;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPoint = (a: WorldPoint, b: WorldPoint, t: number): WorldPoint => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
function half(poly: readonly WorldFloorVertex[], distance: (cell: Cell) => number): WorldFloorVertex[] {
    const result: WorldFloorVertex[] = [];
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], d = distance(p.cell), e = distance(q.cell);
        if (d >= -1e-12) result.push(p);
        if ((d >= 0) !== (e >= 0)) {
            const t = d / (d - e);
            result.push({ cell: { x: lerp(p.cell.x, q.cell.x, t), z: lerp(p.cell.z, q.cell.z, t) }, point: lerpPoint(p.point, q.point, t),
                // Keep linear source interpolation through successive clips;
                // normalizing at each cut changes the original shading field.
                ...(p.normal && q.normal ? { normal: lerpPoint(p.normal, q.normal, t) } : {}) });
        }
    }
    return area(result) > 1e-12 ? result : [];
}
function carve(poly: readonly WorldFloorVertex[], boundary: readonly Cell[]) {
    let inside = [...poly]; const outside: WorldFloorVertex[][] = [];
    for (let i = 0; i < boundary.length; i++) {
        const p = boundary[i], q = boundary[(i + 1) % boundary.length];
        const distance = (c: Cell) => (q.x - p.x) * (c.z - p.z) - (q.z - p.z) * (c.x - p.x);
        const remainder = half(inside, cell => -distance(cell)); if (remainder.length) outside.push(remainder);
        inside = half(inside, distance); if (!inside.length) break;
    }
    return { inside, outside };
}
function clipFloor(floor: WorldFloor, boundary: readonly Cell[]): WorldFloor {
    const vertices = [...floor.vertices], indices: number[] = [];
    for (let i = 0; i < floor.indices.length; i += 3) {
        const sourceIndices = floor.indices.slice(i, i + 3), result = carve(sourceIndices.map(index => floor.vertices[index]), boundary);
        if (!result.inside.length) { indices.push(...sourceIndices); continue; }
        for (const poly of result.outside) {
            const offset = vertices.length; vertices.push(...poly);
            for (let j = 1; j + 1 < poly.length; j++) {
                // Same compiler-area threshold used by the archived source probe.
                if (area([poly[0], poly[j], poly[j + 1]]) * 2 > 1.0001e-12) indices.push(offset, offset + j, offset + j + 1);
            }
        }
    }
    return { ...floor, vertices, indices };
}
function checkProfile(profile: AuthoredShoulderProfile): void {
    if (profile.version !== 1 || profile.candidate !== AUTHORED_SHOULDER_CANDIDATE || profile.source.baseSha256 !== BASE_SHA
        || profile.source.componentSha256 !== AUTHORED_SHOULDER_COMPONENT_SHA || profile.source.geometryProfileSha256 !== GEOMETRY_SHA) fail('source identity differs');
    if (profile.physicalRevision !== authoredShoulderProfilePhysicalRevision(profile)) fail('physical profile differs');
    const district = profile.district;
    if (district.id !== DISTRICT || district.turn !== 0 || district.logicalOrigin.x !== 0 || district.logicalOrigin.z !== 0
        || Object.values(district.worldOrigin).some(value => value !== 0) || district.floors.length !== 2
        || district.floors.some(floor => floor.kind !== 'ground') || district.sites.length !== 19
        || district.sites.filter(site => site.placement).length !== 2 || profile.transferSiteIds.length !== 2
        || profile.edges.length !== 36 || profile.edges.filter(edge => edge.allows.length === 1 && edge.allows[0] === 'walk').length !== 35)
        fail('diagnostic extension contract differs');
}

/** Compose from immutable source/water terrain, before places/cove. No state, owners,
 * purchases or receipts are consulted; storing a tree never removes land. */
export function composeAuthoredShoulderWorld(upstream: IslandWorld, profile: AuthoredShoulderProfile): IslandWorld {
    checkProfile(profile);
    if (upstream.definition.districts.some(district => district.id === DISTRICT || district.id.startsWith('native05-cove-')))
        fail('requires immutable terrain without shoulder or cove');
    if (upstream.definition.source?.sha256 !== profile.source.baseSha256
        || authoredShoulderGroundRevision(upstream, profile.localGround) !== profile.localGround.revision) fail('upstream physical locality differs');
    const source = upstream.definition.districts.find(district => district.id === profile.sourceDistrictId) ?? fail('source district frame differs');
    if (source.turn !== 0 || source.logicalOrigin.x !== 0 || source.logicalOrigin.z !== 0
        || Object.values(source.worldOrigin).some(value => value !== 0)
        || profile.clipFloorIds.some(id => !source.floors.some(floor => floor.id === id))) fail('source district frame differs');
    const transfer = new Set(profile.transferSiteIds);
    for (const id of transfer) {
        const old = source.sites.find(site => site.id === id), next = profile.district.sites.find(site => site.id === id);
        if (!old || old.placement || !next?.placement || old.cell.x !== next.cell.x || old.cell.z !== next.cell.z) fail('new land must replace the audited walk-only site');
    }
    for (const site of upstream.sites.filter(site => site.placement)) {
        const { x, z } = site.cell;
        const square = [[x - .46, z - .46], [x + .46, z - .46], [x + .46, z + .46], [x - .46, z + .46]]
            .map(([x, z]) => ({ cell: { x, z }, point: { x, y: 0, z } }));
        if (area(carve(square, profile.boundary).inside) > 1e-12) fail('replacement intersects an acquired footprint');
    }
    const definition = structuredClone(upstream.definition);
    definition.districts = definition.districts.map(district => district.id !== source.id ? district : { ...district,
        floors: district.floors.map(floor => profile.clipFloorIds.includes(floor.id) ? clipFloor(floor, profile.boundary) : floor),
        anchorFloors: district.anchorFloors ?? district.floors,
        sites: district.sites.filter(site => !transfer.has(site.id)).map(site => ({ ...site,
            anchorPoint: site.anchorPoint ?? upstream.anchorAt(site.cell)! })) });
    definition.districts = [...definition.districts, structuredClone(profile.district)];
    const mapRef = (ref: WorldSiteRef): WorldSiteRef => ref.districtId === source.id && transfer.has(ref.siteId) ? { districtId: DISTRICT, siteId: ref.siteId } : ref;
    const oldEdges = definition.edges.map(edge => ({ ...edge, from: mapRef(edge.from), to: mapRef(edge.to) }));
    // Compile supported endpoints first, then revalidate all old walking edges
    // against the replacement. Join/water rights are never silently removed.
    definition.edges = oldEdges.map(edge => ({ ...edge, allows: edge.allows.filter(passage => passage !== 'walk') })).filter(edge => edge.allows.length);
    definition.revision = `authored-shoulder:${profile.physicalRevision}`;
    const support = compileWorldDefinition(definition), cells = new Map(support.sites.map(site => [refKey(site.ref), site.cell]));
    definition.edges = oldEdges.map(edge => ({ ...edge, allows: edge.allows.filter(passage => passage !== 'walk'
        || support.isWalkEdgeSupported(cells.get(refKey(edge.from))!, cells.get(refKey(edge.to))!)) })).filter(edge => edge.allows.length);
    definition.edges = [...definition.edges, ...structuredClone(profile.edges)];
    // Physical authorization is stable across shading, but a renderer must see
    // new source NORMAL/PBR attributes in the composed-world identity.
    definition.revision = `authored-shoulder:${profile.physicalRevision}:${fingerprint({ ...definition, revision: undefined })}`;
    const world = compileWorldDefinition(definition);
    for (const site of upstream.sites.filter(site => site.placement)) {
        if (JSON.stringify(world.anchorAt(site.cell)) !== JSON.stringify(site.point)) fail('acquired anchor changed');
        for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
            const cell = { x: site.cell.x + dx, z: site.cell.z + dz };
            if (JSON.stringify(world.floorAt(cell)?.point) !== JSON.stringify(upstream.floorAt(cell)?.point)) fail('acquired support changed');
        }
    }
    return world;
}
