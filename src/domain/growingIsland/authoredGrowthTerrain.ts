import type { AuthoredDistrictTemplate, DistrictFacing } from './authoredDistrictWorld';
import { compileWorldDefinition, type IslandWorld, type CompiledWorldFloor } from './worldDefinition';
import { TREE_MATURE_HOURS } from './environment';
import type { Cell, GrowingState } from './types';
import type { WorldDistrict, WorldEdge, WorldPoint } from './worldTypes';

export type AuthoredGrowthTerrainShape = 'parallel' | 'seaward';
export interface AuthoredGrowthTerrainSocket {
    readonly id: string;
    /** Both origins are in the acquired district's local frame. */
    readonly logicalOrigin: Cell;
    readonly worldOrigin: WorldPoint;
    readonly turn: DistrictFacing;
    /** District-local shoreline direction; the profile direction is the fallback. */
    readonly shoreFacing?: DistrictFacing;
    /** Optional complete shape pair for this coast's distinct authored seam. */
    readonly variants?: readonly AuthoredGrowthTerrainVariant[];
    readonly landings: readonly { readonly baseSiteId: string; readonly patchSiteId: string }[];
    /** Only this socket's seam bank is removed when its patch is present. */
    readonly replaceSurfaceIds: readonly string[];
}
export interface AuthoredGrowthTerrainVariant {
    readonly id: AuthoredGrowthTerrainShape;
    /** Local, unturned frame; all sites/edges grant walking only. */
    readonly district: WorldDistrict;
    readonly edges: readonly WorldEdge[];
}
export interface AuthoredGrowthTerrainConnection {
    readonly id: string;
    readonly socketIds: readonly [string, string];
    readonly branchShape: AuthoredGrowthTerrainShape;
    /** The connection is authored directly in the acquired district's local frame. */
    readonly district: WorldDistrict;
    readonly edges: readonly WorldEdge[];
    readonly landings: readonly { readonly socketId: string; readonly patchSiteId: string; readonly connectionSiteId: string }[];
    readonly replaceSurfaceIds: readonly { readonly socketId: string; readonly surfaceIds: readonly string[] }[];
}
export interface AuthoredGrowthTerrainCatalog {
    readonly version: 1;
    readonly candidate: string;
    /** Small immutable asset revision (normally expanded artifact SHA-256). */
    readonly revision: string;
    readonly source: { readonly artifact: string; readonly sha256: string };
    /** Acquired independently of trees using the ordinary diagnostic district ledger. */
    readonly template: AuthoredDistrictTemplate;
    readonly profile: {
        /** District-local polygons. Source art uses logical = physical X/Z. */
        readonly trigger: readonly Cell[];
        readonly scope: readonly Cell[];
        readonly shoreFacing: DistrictFacing;
        readonly sockets: readonly AuthoredGrowthTerrainSocket[];
        readonly variants: readonly AuthoredGrowthTerrainVariant[];
        readonly connections?: readonly AuthoredGrowthTerrainConnection[];
    };
}
export interface AuthoredGrowthTerrainAssembly {
    readonly id: string;
    readonly districtId: string;
    readonly ownerIds: readonly string[];
    readonly socketId: string;
    readonly shape: AuthoredGrowthTerrainShape;
}
export interface AuthoredGrowthTerrainConnectionAssembly {
    readonly id: string;
    readonly districtId: string;
    readonly connectionId: string;
    readonly ownerIds: readonly string[];
}
export interface AuthoredGrowthTerrainPlan {
    readonly revision: string;
    readonly upstreamRevision: string;
    readonly catalogRevision: string;
    readonly assemblies: readonly AuthoredGrowthTerrainAssembly[];
    readonly connections: readonly AuthoredGrowthTerrainConnectionAssembly[];
    readonly rejectedReason?: string;
}

const EPSILON = 1e-7;
function fail(message: string): never { throw new Error(`Authored growth terrain: ${message}`); }
const key = ({ x, z }: Cell) => `${x},${z}`;
const rotate = ({ x, z }: Cell, turn: number): Cell => turn === 1 ? { x: -z, z: x }
    : turn === 2 ? { x: -x, z: -z } : turn === 3 ? { x: z, z: -x } : { x, z };
const near = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < EPSILON;
const finite = (p: Cell) => Number.isFinite(p.x) && Number.isFinite(p.z);
const compareIds = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const cross = (a: Cell, b: Cell, p: Cell) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
const area = (poly: readonly Cell[]) => poly.reduce((sum, p, i) => {
    const q = poly[(i + 1) % poly.length]; return sum + p.x * q.z - q.x * p.z;
}, 0) / 2;
function polygon(poly: readonly Cell[]) {
    if (poly.length < 3 || !poly.every(finite) || Math.abs(area(poly)) < EPSILON) fail('invalid scope polygon');
    const sign = Math.sign(area(poly));
    if (poly.some((p, i) => poly.some(q => sign * cross(p, poly[(i + 1) % poly.length], q) < -EPSILON)))
        fail('scope polygon must be convex');
}
function inside(p: Cell, poly: readonly Cell[]) {
    const sign = Math.sign(area(poly));
    return poly.every((a, i) => sign * cross(a, poly[(i + 1) % poly.length], p) >= -EPSILON);
}
function fingerprint(value: unknown) {
    const text = JSON.stringify(value); let a = 2166136261, b = 2246822507;
    for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b ^ text.charCodeAt(i), 3266489909); }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
const worldRevisions = new WeakMap<IslandWorld, string>();
function worldRevision(world: IslandWorld) {
    let revision = worldRevisions.get(world);
    if (!revision) { revision = fingerprint(world.definition); worldRevisions.set(world, revision); }
    return revision;
}
const derivedTemplate = (catalog: AuthoredGrowthTerrainCatalog, shape: AuthoredGrowthTerrainShape) => `${catalog.template.id}:growth:${shape}`;
const shapeIds: readonly AuthoredGrowthTerrainShape[] = ['parallel', 'seaward'];
const variantsAt = (profile: AuthoredGrowthTerrainCatalog['profile'], socket: AuthoredGrowthTerrainSocket) => socket.variants ?? profile.variants;
function validateVariantPair(variants: readonly AuthoredGrowthTerrainVariant[]) {
    if (!Array.isArray(variants) || variants.length !== 2 || !shapeIds.every(id => variants.filter(v => v.id === id).length === 1))
        fail('both authored growth shapes are required');
}
const validated = new WeakMap<AuthoredGrowthTerrainCatalog, string>();
function deeplyFrozen(value: unknown): boolean {
    return !value || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}
function validateGround(district: WorldDistrict, edges: readonly WorldEdge[], scope: readonly Cell[], local: (point: Cell) => Cell) {
    if (district.turn !== 0 || district.logicalOrigin.x || district.logicalOrigin.z || Object.values(district.worldOrigin).some(n => n !== 0)
        || district.anchorFloors?.length || district.waterCarvingScopes?.length || district.ports.length
        || !district.floors.length || district.floors.some(floor => floor.kind !== 'ground')
        || district.sites.some(site => site.placement || site.anchorPoint)
        || edges.some(edge => edge.from.districtId !== district.id || edge.to.districtId !== district.id
            || edge.allows.length !== 1 || edge.allows[0] !== 'walk')) fail('growth patch must grant only real ground walking');
    for (const floor of district.floors) for (const vertex of floor.vertices)
        if (Math.hypot(vertex.cell.x - vertex.point.x, vertex.cell.z - vertex.point.z) >= EPSILON || !inside(local(vertex.cell), scope))
            fail('growth floor leaves scope or its physical frame');
    for (const surface of district.surfaces ?? [])
        if (surface.kind !== 'bank' || surface.vertices.some(point => !inside(local(point), scope))) fail('growth bank leaves scope');
}

/** Read-only catalogs loaded by the caller may be deeply frozen and cached by identity. */
function validateCatalog(catalog: AuthoredGrowthTerrainCatalog) {
    if (validated.get(catalog) === catalog.revision) return;
    if (catalog.version !== 1 || !catalog.candidate || !catalog.revision || !/^[a-f0-9]{64}$/.test(catalog.source.sha256)) fail('invalid catalog identity');
    const { template, profile } = catalog, baseline = template.district;
    if (baseline.id !== template.id || baseline.turn !== 0 || baseline.logicalOrigin.x || baseline.logicalOrigin.z
        || Object.values(baseline.worldOrigin).some(n => n !== 0)) fail('template must use a local unturned frame');
    polygon(profile.trigger); polygon(profile.scope);
    if (![0, 1, 2, 3].includes(profile.shoreFacing) || !profile.sockets.length) fail('invalid shoreline or sockets');
    validateVariantPair(profile.variants);
    const socketIds = new Set<string>();
    for (const socket of profile.sockets) {
        if (!socket.id || socketIds.has(socket.id) || ![0, 1, 2, 3].includes(socket.turn)
            || !Number.isInteger(socket.logicalOrigin.x) || !Number.isInteger(socket.logicalOrigin.z)
            || socket.worldOrigin.x !== socket.logicalOrigin.x || socket.worldOrigin.z !== socket.logicalOrigin.z
            || socket.worldOrigin.y !== 0 || !socket.landings.length) fail('invalid socket frame');
        if (socket.shoreFacing !== undefined && ![0, 1, 2, 3].includes(socket.shoreFacing)) fail('invalid socket shoreline direction');
        if (socket.variants !== undefined) validateVariantPair(socket.variants);
        socketIds.add(socket.id);
        if (new Set(socket.replaceSurfaceIds).size !== socket.replaceSurfaceIds.length) fail('duplicate seam bank');
        for (const id of socket.replaceSurfaceIds) {
            const surface = baseline.surfaces?.find(surface => surface.id === id);
            if (!surface || surface.kind !== 'bank' || surface.vertices.some(point => !inside(point, profile.scope))) fail('seam bank leaves growth scope');
        }
        for (const variant of variantsAt(profile, socket)) {
            const district = variant.district;
            const local = (point: Cell) => {
                const p = rotate(point, socket.turn); return { x: p.x + socket.logicalOrigin.x, z: p.z + socket.logicalOrigin.z };
            };
            validateGround(district, variant.edges, profile.scope, local);
            const landingKeys = new Set<string>();
            for (const landing of socket.landings) {
                const id = JSON.stringify(landing);
                if (landingKeys.has(id) || !baseline.sites.some(site => site.id === landing.baseSiteId)
                    || !district.sites.some(site => site.id === landing.patchSiteId)) fail('unknown or duplicate landing');
                landingKeys.add(id);
            }
        }
    }
    const connectionIds = new Set<string>(), socketPairs = new Set<string>();
    for (const connection of profile.connections ?? []) {
        const pair = JSON.stringify([...connection.socketIds].sort(compareIds));
        if (!connection.id || connectionIds.has(connection.id) || socketPairs.has(pair) || !shapeIds.includes(connection.branchShape)
            || connection.socketIds.length !== 2 || new Set(connection.socketIds).size !== 2
            || connection.socketIds.some(id => !socketIds.has(id))) fail('invalid connection sockets');
        connectionIds.add(connection.id); socketPairs.add(pair);
        validateGround(connection.district, connection.edges, profile.scope, point => point);
        const landingKeys = new Set<string>();
        for (const landing of connection.landings) {
            const id = JSON.stringify(landing);
            const socket = profile.sockets.find(socket => socket.id === landing.socketId);
            const branch = socket && variantsAt(profile, socket).find(variant => variant.id === connection.branchShape);
            if (!branch || landingKeys.has(id) || !connection.socketIds.includes(landing.socketId)
                || !branch.district.sites.some(site => site.id === landing.patchSiteId)
                || !connection.district.sites.some(site => site.id === landing.connectionSiteId)) fail('unknown or duplicate connection landing');
            landingKeys.add(id);
        }
        if (connection.socketIds.some(id => !connection.landings.some(landing => landing.socketId === id))) fail('connection must land on both sockets');
        const removed = new Set<string>();
        for (const replacement of connection.replaceSurfaceIds) {
            if (!connection.socketIds.includes(replacement.socketId)) fail('unknown connection bank socket');
            const socket = profile.sockets.find(socket => socket.id === replacement.socketId)!;
            const branch = variantsAt(profile, socket).find(variant => variant.id === connection.branchShape)!;
            for (const id of replacement.surfaceIds) {
                const key = JSON.stringify([replacement.socketId, id]);
                if (removed.has(key) || !branch.district.surfaces?.some(surface => surface.id === id && surface.kind === 'bank')) fail('unknown or duplicate connection bank');
                removed.add(key);
            }
        }
    }
    // JSON.parse callers remain fully checked until they explicitly freeze their
    // authored catalog. No geometry payload is serialized for ordinary frame keys.
    if (deeplyFrozen(catalog)) validated.set(catalog, catalog.revision);
}
function validateInput(upstream: IslandWorld, catalog: AuthoredGrowthTerrainCatalog) {
    validateCatalog(catalog);
    if (upstream.definition.source?.sha256 !== catalog.source.sha256) fail('source differs');
    if (upstream.definition.districts.some(district => district.templateId.startsWith(`${catalog.template.id}:growth:`)))
        fail('requires immutable acquired terrain');
}
const planRevision = (upstreamRevision: string, catalogRevision: string, assemblies: readonly AuthoredGrowthTerrainAssembly[],
    connections: readonly AuthoredGrowthTerrainConnectionAssembly[]) => `growth-terrain:${fingerprint([upstreamRevision, catalogRevision, assemblies, connections])}`;
const patchId = (districtId: string, socketId: string) => `${districtId}:growth-terrain:${socketId}`;
const connectionId = (districtId: string, id: string) => `${districtId}:growth-connection:${id}`;

/** Pure placement/maturity derivation; mesh data never enters this plan or owner state. */
export function deriveAuthoredGrowthTerrainPlan(state: GrowingState, upstream: IslandWorld,
    catalog: AuthoredGrowthTerrainCatalog): AuthoredGrowthTerrainPlan {
    validateInput(upstream, catalog);
    const assemblies: AuthoredGrowthTerrainAssembly[] = [], connections: AuthoredGrowthTerrainConnectionAssembly[] = [], { profile } = catalog;
    const upstreamRevision = worldRevision(upstream), catalogRevision = catalog.revision;
    const finish = (): AuthoredGrowthTerrainPlan => {
        assemblies.sort((a, b) => compareIds(a.id, b.id)); connections.sort((a, b) => compareIds(a.id, b.id));
        return Object.freeze({ revision: planRevision(upstreamRevision, catalogRevision, assemblies, connections), upstreamRevision, catalogRevision,
            assemblies: Object.freeze(assemblies), connections: Object.freeze(connections) });
    };
    const reject = (reason: string) => rejectAuthoredGrowthTerrainPlan(finish(), `Authored growth terrain: ${reason}`);
    const siteByCell = new Map(upstream.sites.map(site => [key(site.cell), site]));
    for (const district of upstream.definition.districts.filter(d => d.templateId === catalog.template.id)) {
        const local = (p: Cell) => rotate({ x: p.x - district.logicalOrigin.x, z: p.z - district.logicalOrigin.z }, (4 - district.turn) % 4);
        const trees = state.landmarks.filter(tree => tree.kind === 'sapling' && tree.cell && tree.growth >= TREE_MATURE_HOURS
            && siteByCell.get(key(tree.cell))?.ref.districtId === district.id && siteByCell.get(key(tree.cell))?.placement
            && siteByCell.get(key(tree.cell))?.support && inside(local(tree.cell), profile.trigger)).sort((a, b) => compareIds(a.id, b.id));
        const byCell = new Map(trees.map(tree => [key(tree.cell!), tree])), visited = new Set<string>(), occupied = new Set<string>();
        const nearest = (point: Cell) => profile.sockets.map(socket => ({ socket,
            distance: Math.hypot(point.x - socket.logicalOrigin.x, point.z - socket.logicalOrigin.z) }))
            .sort((a, b) => a.distance - b.distance || compareIds(a.socket.id, b.socket.id));
        for (const tree of trees) {
            if (visited.has(tree.id)) continue;
            const group = [tree]; visited.add(tree.id);
            for (let i = 0; i < group.length; i++) for (const cell of upstream.neighbors(group[i].cell!, 'join')) {
                const neighbor = byCell.get(key(cell));
                if (neighbor && !visited.has(neighbor.id)) { visited.add(neighbor.id); group.push(neighbor); }
            }
            if (group.length < 2) continue;
            const points = group.map(tree => local(tree.cell!)), supportedSockets = new Set<string>();
            for (const point of points) {
                const choices = nearest(point);
                // An equidistant centre tree is not evidence for either shore mouth.
                if (choices.length === 1 || choices[1].distance - choices[0].distance > EPSILON) supportedSockets.add(choices[0].socket.id);
            }
            if (!supportedSockets.size) {
                const center = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, z: sum.z + p.z / points.length }), { x: 0, z: 0 });
                supportedSockets.add(nearest(center)[0].socket.id);
            }
            const socketIds = [...supportedSockets].sort(compareIds), owners = Object.freeze(group.map(tree => tree.id).sort(compareIds));
            const socket = profile.sockets.find(socket => socket.id === socketIds[0])!;
            const normal = rotate({ x: 1, z: 0 }, socket.shoreFacing ?? profile.shoreFacing);
            const spread = (axis: Cell) => {
                const values = points.map(p => p.x * axis.x + p.z * axis.z); return Math.max(...values) - Math.min(...values);
            };
            let shape: AuthoredGrowthTerrainShape = spread(normal) >= spread({ x: -normal.z, z: normal.x }) ? 'seaward' : 'parallel';
            if (socketIds.length > 1) {
                const connection = profile.connections?.find(candidate => candidate.socketIds.length === socketIds.length
                    && candidate.socketIds.every(id => supportedSockets.has(id)));
                if (!connection) return reject(`no authored connection for ${district.id} sockets ${socketIds.join(', ')}`);
                shape = connection.branchShape;
                connections.push(Object.freeze({ id: connectionId(district.id, connection.id), districtId: district.id,
                    connectionId: connection.id, ownerIds: owners }));
            }
            for (const socketId of socketIds) {
                if (occupied.has(socketId)) return reject(`multiple mature groups require ${district.id} socket ${socketId}`);
                occupied.add(socketId);
                assemblies.push(Object.freeze({ id: patchId(district.id, socketId), districtId: district.id, ownerIds: owners, socketId, shape }));
            }
        }
    }
    return finish();
}

/** A failed candidate is explanatory evidence only, never a new geometry input. */
export function rejectAuthoredGrowthTerrainPlan(plan: AuthoredGrowthTerrainPlan, reason: string): AuthoredGrowthTerrainPlan {
    return Object.freeze({ ...plan, revision: `growth-terrain:rejected:${fingerprint([plan.revision, reason])}`,
        assemblies: Object.freeze([]), connections: Object.freeze([]), rejectedReason: reason });
}

interface Triangle2 { points: readonly Cell[]; minX: number; maxX: number; minZ: number; maxZ: number }
function triangles(floors: readonly CompiledWorldFloor[], physical: boolean): Triangle2[] {
    return floors.flatMap(floor => {
        const result: Triangle2[] = [];
        for (let i = 0; i < floor.indices.length; i += 3) {
            const points = floor.indices.slice(i, i + 3).map(index => physical ? floor.vertices[index].point : floor.vertices[index].cell);
            if (Math.abs(area(points)) <= 1e-12) continue;
            result.push({ points, minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
                minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) });
        }
        return result;
    });
}
function intersectionArea(a: readonly Cell[], b: readonly Cell[]) {
    let result = [...a]; const sign = Math.sign(area(b));
    for (let j = 0; j < b.length && result.length; j++) {
        const p = b[j], q = b[(j + 1) % b.length], input = result; result = [];
        for (let i = 0; i < input.length; i++) {
            const u = input[i], v = input[(i + 1) % input.length], d = sign * cross(p, q, u), e = sign * cross(p, q, v);
            if (d >= 0) result.push(u);
            if ((d >= 0) !== (e >= 0)) { const t = d / (d - e); result.push({ x: u.x + (v.x - u.x) * t, z: u.z + (v.z - u.z) * t }); }
        }
    }
    return Math.abs(area(result));
}
/** Positive-area intersections are rejected, including narrow strips between sites. */
function rejectOverlap(old: readonly CompiledWorldFloor[], added: readonly CompiledWorldFloor[]) {
    for (const physical of [false, true]) {
        const index = new Map<string, Triangle2[]>();
        const buckets = (t: Triangle2) => {
            const keys: string[] = [];
            for (let x = Math.floor(t.minX); x <= Math.floor(t.maxX); x++) for (let z = Math.floor(t.minZ); z <= Math.floor(t.maxZ); z++) keys.push(`${x},${z}`);
            return keys;
        };
        for (const t of triangles(old, physical)) for (const id of buckets(t)) { const list = index.get(id) ?? []; list.push(t); index.set(id, list); }
        for (const t of triangles(added, physical)) {
            for (const other of new Set(buckets(t).flatMap(id => index.get(id) ?? [])))
                if (t.minX < other.maxX && t.maxX > other.minX && t.minZ < other.maxZ && t.maxZ > other.minZ
                    && intersectionArea(t.points, other.points) > 1e-8) fail('growth floor overlaps existing terrain');
            for (const id of buckets(t)) { const list = index.get(id) ?? []; list.push(t); index.set(id, list); }
        }
    }
}

/** Compose from the immutable acquired land, never from an earlier growth frame. */
export function composeAuthoredGrowthTerrainWorld(upstream: IslandWorld, catalog: AuthoredGrowthTerrainCatalog,
    plan: AuthoredGrowthTerrainPlan): IslandWorld {
    validateInput(upstream, catalog);
    if (plan.rejectedReason !== undefined) fail('rejected plan cannot be composed');
    if (plan.upstreamRevision !== worldRevision(upstream) || plan.catalogRevision !== catalog.revision
        || plan.revision !== planRevision(plan.upstreamRevision, plan.catalogRevision, plan.assemblies, plan.connections)) fail('plan is stale');
    if (!plan.assemblies.length && !plan.connections.length) return upstream;
    const districts = [...upstream.definition.districts], edges = [...upstream.definition.edges], newFloors: CompiledWorldFloor[] = [];
    const assembled = new Set<string>(), landingRefs: { districtId: string; siteId: string }[] = [];
    const append = (district: WorldDistrict, authoredEdges: readonly WorldEdge[]) => {
        const internal = authoredEdges.map(edge => ({ ...edge, from: { districtId: district.id, siteId: edge.from.siteId }, to: { districtId: district.id, siteId: edge.to.siteId } }));
        const child = compileWorldDefinition({ version: 1, id: district.id, districts: [district], edges: internal });
        newFloors.push(...child.floors); districts.push(district); edges.push(...internal); assembled.add(district.id);
        return child;
    };
    for (const assembly of plan.assemblies) {
        const parentIndex = districts.findIndex(d => d.id === assembly.districtId && d.templateId === catalog.template.id), parent = districts[parentIndex];
        const socket = catalog.profile.sockets.find(s => s.id === assembly.socketId);
        const variant = socket && variantsAt(catalog.profile, socket).find(v => v.id === assembly.shape);
        if (!parent || !variant || !socket || assembly.id !== patchId(parent.id, socket.id)
            || districts.some(d => d.id === assembly.id)) fail('invalid assembly');
        const logical = rotate(socket.logicalOrigin, parent.turn), physical = rotate(socket.worldOrigin, parent.turn);
        const district: WorldDistrict = { ...variant.district, id: assembly.id, templateId: derivedTemplate(catalog, variant.id),
            logicalOrigin: { x: parent.logicalOrigin.x + logical.x, z: parent.logicalOrigin.z + logical.z },
            worldOrigin: { x: parent.worldOrigin.x + physical.x, y: parent.worldOrigin.y, z: parent.worldOrigin.z + physical.z },
            turn: (parent.turn + socket.turn) % 4 as DistrictFacing };
        const remove = new Set(socket.replaceSurfaceIds);
        for (const id of remove) {
            const original = parent.surfaces?.find(surface => surface.id === id), reference = catalog.template.district.surfaces?.find(surface => surface.id === id);
            if (!original || !reference || fingerprint(original) !== fingerprint(reference)) fail('seam bank source differs');
        }
        districts[parentIndex] = { ...parent, surfaces: parent.surfaces?.filter(surface => !remove.has(surface.id)) };
        landingRefs.push(...socket.landings.map(landing => ({ districtId: parent.id, siteId: landing.baseSiteId })));
        append(district, variant.edges); edges.push(...socket.landings.map(landing => ({
            from: { districtId: parent.id, siteId: landing.baseSiteId }, to: { districtId: district.id, siteId: landing.patchSiteId }, allows: ['walk'] as const,
        })));
    }
    for (const assembly of plan.connections) {
        const parent = districts.find(d => d.id === assembly.districtId && d.templateId === catalog.template.id);
        const connection = catalog.profile.connections?.find(candidate => candidate.id === assembly.connectionId);
        if (!parent || !connection || assembly.id !== connectionId(parent.id, connection.id)
            || districts.some(d => d.id === assembly.id)) fail('invalid connection assembly');
        for (const socketId of connection.socketIds) {
            const branch = plan.assemblies.find(candidate => candidate.districtId === parent.id && candidate.socketId === socketId);
            if (!branch || branch.shape !== connection.branchShape || JSON.stringify(branch.ownerIds) !== JSON.stringify(assembly.ownerIds))
                fail('connection requires both branches of the same mature group');
        }
        for (const replacement of connection.replaceSurfaceIds) {
            const index = districts.findIndex(d => d.id === patchId(parent.id, replacement.socketId)), branch = districts[index];
            const socket = catalog.profile.sockets.find(socket => socket.id === replacement.socketId)!;
            const source = variantsAt(catalog.profile, socket).find(variant => variant.id === connection.branchShape)!.district;
            const remove = new Set(replacement.surfaceIds);
            for (const id of remove) {
                const original = branch.surfaces?.find(surface => surface.id === id), reference = source.surfaces?.find(surface => surface.id === id);
                if (!original || !reference || fingerprint(original) !== fingerprint(reference)) fail('connection bank source differs');
            }
            districts[index] = { ...branch, surfaces: branch.surfaces?.filter(surface => !remove.has(surface.id)) };
        }
        const child = append({ ...connection.district, id: assembly.id, templateId: `${catalog.template.id}:growth:connection:${connection.id}`,
            logicalOrigin: parent.logicalOrigin, worldOrigin: parent.worldOrigin, turn: parent.turn }, connection.edges);
        // Test the connection alone: the original shore must not disguise a
        // broken outer path by making each landing reachable from a different branch.
        const start = child.sites.find(site => site.ref.siteId === connection.landings[0].connectionSiteId)!;
        const queue = [start.cell], reached = new Set(queue.map(key));
        for (let i = 0; i < queue.length; i++) for (const cell of child.neighbors(queue[i], 'walk'))
            if (!reached.has(key(cell))) { reached.add(key(cell)); queue.push(cell); }
        if (child.sites.some(site => !reached.has(key(site.cell)))) fail('connection walking sites are disconnected between landings');
        edges.push(...connection.landings.map(landing => ({
            from: { districtId: patchId(parent.id, landing.socketId), siteId: landing.patchSiteId },
            to: { districtId: assembly.id, siteId: landing.connectionSiteId }, allows: ['walk'] as const,
        })));
    }
    rejectOverlap(upstream.floors, newFloors);
    const result = compileWorldDefinition({ ...upstream.definition, revision: plan.revision, districts, edges });
    const next = new Map(result.sites.map(site => [JSON.stringify(site.ref), site]));
    const queue = landingRefs.map(ref => next.get(JSON.stringify(ref))!.cell), reached = new Set(queue.map(key));
    for (let i = 0; i < queue.length; i++) for (const cell of result.neighbors(queue[i], 'walk'))
        if (!reached.has(key(cell))) { reached.add(key(cell)); queue.push(cell); }
    if (result.sites.some(site => assembled.has(site.ref.districtId) && !reached.has(key(site.cell))))
        fail('growth walking site is disconnected from its real landing');
    for (const old of upstream.sites) {
        const site = next.get(JSON.stringify(old.ref));
        if (!site || site.placement !== old.placement || !near(site.point, old.point) || Boolean(site.support) !== Boolean(old.support)
            || old.support && !near(site.support!.point, old.support.point)) fail('existing anchor or support changed');
        if (old.placement) for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) {
            const cell = { x: old.cell.x + dx, z: old.cell.z + dz }, before = upstream.floorAt(cell), after = result.floorAt(cell);
            if (Boolean(before) !== Boolean(after) || before && !near(before.point, after!.point)) fail('existing placement footprint changed');
        }
    }
    return result;
}
