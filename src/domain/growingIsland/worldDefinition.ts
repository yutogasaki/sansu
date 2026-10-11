import type { Cell } from './types';
import type { WorldDefinition, WorldDistrict, WorldFloor, WorldPassage, WorldPoint, WorldSiteRef } from './worldTypes';

const EPSILON = 1e-7;
const stable = (value: number) => Math.round(value * 1e9) / 1e9 || 0;
const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;
const refKey = (ref: WorldSiteRef) => JSON.stringify([ref.districtId, ref.siteId]);
const floorKey = (districtId: string, floorId: string) => JSON.stringify([districtId, floorId]);
const turn = (x: number, z: number, count: number): Cell => count === 1 ? { x: -z, z: x }
    : count === 2 ? { x: -x, z: -z } : count === 3 ? { x: z, z: -x } : { x, z };
function requireWorld(valid: unknown, message: string): asserts valid { if (!valid) throw new Error(`Invalid island world: ${message}`); }
function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freeze); Object.freeze(value);
    }
    return value;
}

interface Triangle {
    floorId: string;
    kind: WorldFloor['kind'];
    cells: readonly [Cell, Cell, Cell];
    points: readonly [WorldPoint, WorldPoint, WorldPoint];
}
interface FloorBucket { indices: number[]; fine?: Map<number, number[]> }
const FINE_DIVISIONS = 16;
const FINE_THRESHOLD = 64;
const fineCell = (value: number) => Math.max(0, Math.min(FINE_DIVISIONS - 1, Math.floor(value * FINE_DIVISIONS)));
export interface WorldFloorSample { cell: Cell; point: WorldPoint; floorId: string; triangle: number }
export interface CompiledWorldSite {
    ref: WorldSiteRef;
    cell: Cell;
    point: WorldPoint;
    floorId: string;
    placement: boolean;
}
export interface CompiledWorldFloor {
    id: string;
    kind: WorldFloor['kind'];
    vertices: readonly { cell: Cell; point: WorldPoint }[];
    indices: readonly number[];
    color: string;
}

/** The same barycentric coordinates drive floor height, world position and inverse hit. */
function barycentric(at: Cell, a: Cell, b: Cell, c: Cell): readonly [number, number, number] | undefined {
    const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(determinant) <= 1e-12) return undefined;
    const u = ((b.z - c.z) * (at.x - c.x) + (c.x - b.x) * (at.z - c.z)) / determinant;
    const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant;
    const w = 1 - u - v;
    return u >= -EPSILON && v >= -EPSILON && w >= -EPSILON ? [u, v, w] : undefined;
}
const interpolate = (points: readonly WorldPoint[], weights: readonly number[]): WorldPoint => ({
    x: stable(points.reduce((value, point, i) => value + point.x * weights[i], 0)),
    y: stable(points.reduce((value, point, i) => value + point.y * weights[i], 0)),
    z: stable(points.reduce((value, point, i) => value + point.z * weights[i], 0)),
});

/** Immutable compiled geometry, indexed in both logical and physical space. Bounds
 * accelerate lookups; explicit sites and edges grant placement and passage rights. */
export function compileWorldDefinition(input: WorldDefinition) {
    requireWorld(input.version === 1 && typeof input.id === 'string' && input.id.length > 0, 'unknown version or missing ID');
    requireWorld(Array.isArray(input.districts) && Array.isArray(input.edges), 'districts or edges');
    if (input.source) requireWorld(input.source.artifact && /^[a-f0-9]{64}$/.test(input.source.sha256), 'source identity');
    const definition = structuredClone(input);
    const triangles: Triangle[] = [], floors: CompiledWorldFloor[] = [], sites: CompiledWorldSite[] = [];
    const districtIds = new Set<string>(), allFloors = new Set<string>(), refs = new Map<string, CompiledWorldSite>(), cells = new Map<string, CompiledWorldSite>();
    const finite = (point: Cell | WorldPoint) => Number.isFinite(point.x) && Number.isFinite(point.z)
        && (!('y' in point) || Number.isFinite(point.y));
    const logicalPoint = (district: WorldDistrict, cell: Cell): Cell => {
        const p = turn(cell.x, cell.z, district.turn);
        return { x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z };
    };
    const worldPoint = (district: WorldDistrict, point: WorldPoint): WorldPoint => {
        const p = turn(point.x, point.z, district.turn);
        return { x: p.x + district.worldOrigin.x, y: point.y + district.worldOrigin.y, z: p.z + district.worldOrigin.z };
    };
    for (const district of definition.districts) {
        requireWorld(district.id && !districtIds.has(district.id), 'duplicate district'); districtIds.add(district.id);
        requireWorld(finite(district.logicalOrigin) && Number.isInteger(district.logicalOrigin.x) && Number.isInteger(district.logicalOrigin.z)
            && finite(district.worldOrigin) && [0, 1, 2, 3].includes(district.turn), 'district origin or turn');
        for (const floor of district.floors) {
            const id = floorKey(district.id, floor.id);
            requireWorld(floor.id && !allFloors.has(id), 'duplicate floor'); allFloors.add(id);
            requireWorld(['ground', 'deck', 'water'].includes(floor.kind) && floor.indices.length > 0 && floor.indices.length % 3 === 0, 'floor kind or indices');
            requireWorld(/^#[a-fA-F0-9]{6}$/.test(floor.color), 'floor color');
            const vertices = floor.vertices.map(vertex => {
                requireWorld(finite(vertex.cell) && finite(vertex.point), 'non-finite floor vertex');
                return { cell: logicalPoint(district, vertex.cell), point: worldPoint(district, vertex.point) };
            });
            for (const index of floor.indices) requireWorld(Number.isInteger(index) && index >= 0 && index < vertices.length, 'floor index out of range');
            for (let i = 0; i < floor.indices.length; i += 3) {
                const v = floor.indices.slice(i, i + 3).map(index => vertices[index]);
                const area = (points: readonly Cell[]) => Math.abs((points[1].x - points[0].x) * (points[2].z - points[0].z)
                    - (points[2].x - points[0].x) * (points[1].z - points[0].z));
                requireWorld(area(v.map(vertex => vertex.cell)) > 1e-12 && area(v.map(vertex => vertex.point)) > 1e-12, 'collapsed floor triangle');
                triangles.push({ floorId: id, kind: floor.kind,
                    cells: v.map(vertex => vertex.cell) as [Cell, Cell, Cell], points: v.map(vertex => vertex.point) as [WorldPoint, WorldPoint, WorldPoint] });
            }
            floors.push({ id, kind: floor.kind, color: floor.color, vertices, indices: [...floor.indices] });
        }
    }
    const bins = (physical: boolean) => {
        const buckets = new Map<string, FloorBucket>();
        const bounds = triangles.map(triangle => {
            const points = physical ? triangle.points : triangle.cells;
            const minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
            const minZ = Math.min(...points.map(p => p.z)), maxZ = Math.max(...points.map(p => p.z));
            // Barycentric tolerance admits a thin band outside the triangle. Keep
            // it in the fine index too, including coordinate rounding at seams.
            const pad = (min: number, max: number) => EPSILON * (1 + 2 * (max - min))
                + Number.EPSILON * Math.max(1, Math.abs(min), Math.abs(max)) * 8;
            const area = Math.abs((points[1].x - points[0].x) * (points[2].z - points[0].z)
                - (points[2].x - points[0].x) * (points[1].z - points[0].z));
            // Very thin triangles retain the coarse candidate list's coverage,
            // rather than depending on a numerically sensitive bounding band.
            const broad = area <= Math.max(maxX - minX, maxZ - minZ) ** 2 * 1e-8;
            return { minX, maxX, minZ, maxZ, padX: pad(minX, maxX), padZ: pad(minZ, maxZ), broad };
        });
        bounds.forEach((box, index) => {
            const x0 = Math.floor(box.minX), x1 = Math.floor(box.maxX);
            const z0 = Math.floor(box.minZ), z1 = Math.floor(box.maxZ);
            requireWorld((x1 - x0 + 1) * (z1 - z0 + 1) <= 100_000, 'floor triangle spans an excessive search area');
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
                const id = cellKey({ x, z }), bucket = buckets.get(id) ?? { indices: [] };
                bucket.indices.push(index); buckets.set(id, bucket);
            }
        });
        for (const [id, bucket] of buckets) {
            if (bucket.indices.length <= FINE_THRESHOLD) continue;
            const [x, z] = id.split(',').map(Number);
            const ranges = bucket.indices.map(index => {
                const box = bounds[index];
                return { index,
                    x0: box.broad ? 0 : fineCell(box.minX - box.padX - x), x1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxX + box.padX - x),
                    z0: box.broad ? 0 : fineCell(box.minZ - box.padZ - z), z1: box.broad ? FINE_DIVISIONS - 1 : fineCell(box.maxZ + box.padZ - z) };
            });
            // Broad overlapping floors gain no filtering from subdivision. Avoid
            // expanding their coarse lists into hundreds of redundant copies.
            if (ranges.reduce((count, box) => count + (box.x1 - box.x0 + 1) * (box.z1 - box.z0 + 1), 0)
                >= bucket.indices.length * FINE_DIVISIONS ** 2 / 4) continue;
            const fine = new Map<number, number[]>();
            // Each filtered list keeps the original coarse bucket's triangle
            // order. Neighbouring coarse buckets still have the same priority.
            for (const { index, x0, x1, z0, z1 } of ranges) {
                for (let fz = z0; fz <= z1; fz++) for (let fx = x0; fx <= x1; fx++) {
                    const cell = fz * FINE_DIVISIONS + fx, list = fine.get(cell) ?? [];
                    list.push(index); fine.set(cell, list);
                }
            }
            bucket.fine = fine;
        }
        return buckets;
    };
    const logicalBins = bins(false), physicalBins = bins(true);
    const sample = (at: Cell, physical: boolean, floorId?: string, y?: number): WorldFloorSample | undefined => {
        if (!finite(at)) return undefined;
        let best: WorldFloorSample | undefined;
        const water: WorldPoint[] = [];
        const buckets = physical ? physicalBins : logicalBins;
        // Include the neighbouring bucket at exact shared edges, so a rounded
        // floating point hit does not turn a genuine floor boundary into sea.
        const candidates = new Set<number>();
        const seenBuckets = new Set<string>();
        for (const dx of [0, -EPSILON, EPSILON]) for (const dz of [0, -EPSILON, EPSILON]) {
            const x = Math.floor(at.x + dx), z = Math.floor(at.z + dz), id = cellKey({ x, z });
            if (seenBuckets.has(id)) continue;
            seenBuckets.add(id);
            const bucket = buckets.get(id); if (!bucket) continue;
            const list = bucket.fine ? bucket.fine.get(fineCell(at.z - z) * FINE_DIVISIONS + fineCell(at.x - x)) : bucket.indices;
            for (const index of list ?? []) candidates.add(index);
        }
        for (const index of candidates) {
            const triangle = triangles[index]; if (floorId && triangle.floorId !== floorId && triangle.kind !== 'water') continue;
            const weights = barycentric(at, ...(physical ? triangle.points : triangle.cells)); if (!weights) continue;
            const point = interpolate(triangle.points, weights);
            if (triangle.kind === 'water') { water.push(point); continue; }
            const cell = { x: stable(triangle.cells.reduce((value, p, i) => value + p.x * weights[i], 0)), z: stable(triangle.cells.reduce((value, p, i) => value + p.z * weights[i], 0)) };
            if (!best || (y === undefined ? point.y > best.point.y + EPSILON : Math.abs(point.y - y) < Math.abs(best.point.y - y) - EPSILON))
                best = { cell, point, floorId: triangle.floorId, triangle: index };
        }
        if (best && water.some(point => Math.hypot(point.x - best!.point.x, point.z - best!.point.z) < .00001 && point.y > best!.point.y + EPSILON)) return undefined;
        return best;
    };
    for (const district of definition.districts) {
        for (const site of district.sites) {
            const ref = { districtId: district.id, siteId: site.id }, id = refKey(ref), cell = logicalPoint(district, site.cell), floorId = floorKey(district.id, site.floorId);
            requireWorld(site.id && !refs.has(id) && !cells.has(cellKey(cell)), 'duplicate site ID or logical cell');
            requireWorld(typeof site.placement === 'boolean' && finite(site.cell)
                && (!site.placement || Number.isInteger(site.cell.x) && Number.isInteger(site.cell.z)), 'site cell or placement right');
            requireWorld(allFloors.has(floorId), 'site refers to an unknown floor');
            const floor = sample(cell, false, floorId); requireWorld(floor, 'site has no actual dry floor');
            const compiled = { ref, cell, point: floor.point, floorId, placement: site.placement };
            refs.set(id, compiled); cells.set(cellKey(cell), compiled); sites.push(compiled);
        }
        const ports = new Set<string>();
        for (const port of district.ports) {
            requireWorld(port.id && !ports.has(port.id) && refs.has(refKey({ districtId: district.id, siteId: port.siteId })), 'port ID or site'); ports.add(port.id);
        }
    }
    const graphs = Object.fromEntries((['walk', 'join', 'water'] as const).map(kind => [kind, new Map<string, Set<string>>()]));
    const edgeIds = new Set<string>();
    for (const edge of definition.edges) {
        const a = refKey(edge.from), b = refKey(edge.to), edgeId = JSON.stringify([a, b].sort());
        requireWorld(a !== b && refs.has(a) && refs.has(b) && !edgeIds.has(edgeId), 'duplicate edge or unknown endpoint'); edgeIds.add(edgeId);
        requireWorld(edge.allows.length > 0 && new Set(edge.allows).size === edge.allows.length
            && edge.allows.every(kind => ['walk', 'join', 'water'].includes(kind)), 'edge passage rights');
        if (edge.allows.includes('walk')) {
            const from = refs.get(a)!.cell, to = refs.get(b)!.cell;
            const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
            requireWorld(length > 0 && length <= 256, 'walk edge length');
            const steps = Math.max(8, Math.ceil(length * 8));
            const physicalStep = Math.hypot(refs.get(b)!.point.x - refs.get(a)!.point.x, refs.get(b)!.point.z - refs.get(a)!.point.z) / steps * 2 + .15;
            // An explicit edge grants no imaginary bridge. The centre and both
            // sides of its foot lane must be supported by actual dry triangles.
            let previous: WorldPoint | undefined;
            for (let i = 0; i <= steps; i++) {
                for (const side of [-.12, 0, .12]) {
                    const cell = { x: from.x + dx * i / steps - dz / length * side, z: from.z + dz * i / steps + dx / length * side };
                    const floor = sample(cell, false); requireWorld(floor, 'walk edge crosses missing floor or water');
                    if (side !== 0) continue;
                    if (previous) {
                        requireWorld(Math.abs(floor.point.y - previous.y) <= .25, 'walk edge has an unsupported vertical step');
                        requireWorld(Math.hypot(floor.point.x - previous.x, floor.point.z - previous.z) <= physicalStep, 'walk edge crosses separated physical floors');
                    }
                    const endpoint = i === 0 ? refs.get(a) : i === steps ? refs.get(b) : undefined;
                    if (endpoint) requireWorld(Math.hypot(floor.point.x - endpoint.point.x, floor.point.y - endpoint.point.y, floor.point.z - endpoint.point.z) < .025, 'walk endpoint differs from its site floor');
                    previous = floor.point;
                }
            }
        }
        for (const kind of edge.allows) {
            const graph = graphs[kind];
            for (const [from, to] of [[a, b], [b, a]]) { const next = graph.get(from) ?? new Set<string>(); next.add(to); graph.set(from, next); }
        }
    }
    const neighbors = (cell: Cell, passage: WorldPassage = 'walk'): Cell[] => {
        const site = cells.get(cellKey(cell)); if (!site) return [];
        return [...(graphs[passage].get(refKey(site.ref)) ?? [])].map(id => ({ ...refs.get(id)!.cell }));
    };
    const owns = (cell: Cell) => cells.get(cellKey(cell))?.placement === true;
    const floorKinds = new Map(floors.map(floor => [floor.id, floor.kind]));
    const siteAt = (point: WorldPoint): CompiledWorldSite | undefined => {
        const floor = sample(point, true, undefined, point.y); if (!floor || Math.abs(floor.point.y - point.y) > .025) return undefined;
        const site = cells.get(cellKey({ x: Math.round(floor.cell.x), z: Math.round(floor.cell.z) }));
        // A single owned footprint can cross a material or terrace seam. Keep
        // that ground selectable while preventing an overlapping elevated deck
        // or another district from borrowing its placement right.
        return site?.placement && JSON.parse(floor.floorId)[0] === site.ref.districtId
            && floorKinds.get(floor.floorId) === floorKinds.get(site.floorId) ? site : undefined;
    };
    const route = (from: Cell, to: Cell, open: ReadonlySet<string>, passage: WorldPassage = 'walk'): Cell[] | undefined => {
        if (!cells.has(cellKey(from)) || !cells.has(cellKey(to)) || !open.has(cellKey(from)) || !open.has(cellKey(to))) return undefined;
        const queue = [from], previous = new Map<string, Cell | undefined>([[cellKey(from), undefined]]);
        for (let i = 0; i < queue.length; i++) {
            const cell = queue[i];
            if (cellKey(cell) === cellKey(to)) {
                const result: Cell[] = []; let at: Cell | undefined = cell;
                while (at) { result.unshift({ ...at }); at = previous.get(cellKey(at)); } return result;
            }
            for (const next of neighbors(cell, passage)) if (open.has(cellKey(next)) && !previous.has(cellKey(next))) {
                previous.set(cellKey(next), cell); queue.push(next);
            }
        }
    };
    const points = floors.filter(floor => floor.kind !== 'water').flatMap(floor => floor.vertices.map(v => v.point));
    requireWorld(points.length > 0, 'world has no dry floor');
    const bounds = points.reduce((box, point) => ({
        min: { x: Math.min(box.min.x, point.x), y: Math.min(box.min.y, point.y), z: Math.min(box.min.z, point.z) },
        max: { x: Math.max(box.max.x, point.x), y: Math.max(box.max.y, point.y), z: Math.max(box.max.z, point.z) },
    }), { min: { ...points[0] }, max: { ...points[0] } });
    return Object.freeze({ id: definition.id, definition: freeze(definition), floors: freeze(floors), sites: freeze(sites), bounds: freeze(bounds), owns, neighbors, route, siteAt,
        floorAt: (cell: Cell, floorId?: string) => sample(cell, false, floorId),
        logicalAt: (point: Cell & Partial<Pick<WorldPoint, 'y'>>) => sample(point, true, undefined, point.y)?.cell });
}
export type IslandWorld = ReturnType<typeof compileWorldDefinition>;
