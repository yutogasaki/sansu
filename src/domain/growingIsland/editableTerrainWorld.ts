import { landscapePoint, landscapeRise } from './landscape';
import { legacyIslandWorld } from './legacyWorldDefinition';
import { baseTerrainHeightAt } from './placeTerrain';
import { landBounds } from './space';
import { JUMP_RISE, TERRACE_BANK, terracePlan, terrainForm, type TerracePlan } from './terraceTerrain';
import type { Cell, GrowingState } from './types';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { WorldDefinition, WorldFloor, WorldFloorVertex, WorldSite, WorldSurface } from './worldTypes';

export const TERRAIN_STEP = .18;
export const TERRAIN_SEA_LEVEL = -.4;
export const TERRAIN_DRY_LEVEL = TERRAIN_SEA_LEVEL + .025;
type TerrainLand = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge' | 'terrain' | 'plots' | 'landmarks' | 'keepsakes'>>;
const cache = new Map<string, IslandWorld>();
const terraces = new WeakMap<IslandWorld, TerracePlan>();
/** The terrace plan a world was built from, when the DEV terrace form is active. */
export const terracePlanOf = (world: IslandWorld | undefined) => world ? terraces.get(world) : undefined;
/**
 * DEV terrace form: one ground for every island. An island the child never sculpted is read
 * as all heights zero, so its first edit no longer swaps the whole ground. Nothing is saved.
 */
export const terrainOf = (state: Partial<Pick<GrowingState, 'terrain'>>) => state.terrain
    ?? (terrainForm() === 'terrace' && !(BARE in state) ? UNSCULPTED : undefined);
/** Marks the land-only state that proves original geometry; it never reads as sculpted. */
const BARE = Symbol('bare-land');
const UNSCULPTED: NonNullable<GrowingState['terrain']> = Object.freeze({ version: 1 as const, heights: Object.freeze({}) as Record<string, number>, undo: [], redo: [] });
const sculpted = <S extends TerrainLand>(state: S): S => state.terrain || !terrainOf(state) ? state : { ...state, terrain: terrainOf(state) };

/** The terrace plan alone, without floor geometry: cheap enough for every placement probe. */
export function editableTerracePlan(input: TerrainLand, curved = true) {
    const state = sculpted(input);
    return terrainForm() === 'terrace' && state.terrain
        ? terracePlan(state, cell => baseTerrainHeightAt(state, cell) + (curved ? landscapeRise(cell) : 0), TERRAIN_STEP, TERRAIN_DRY_LEVEL) : undefined;
}
const stable = (value: number) => Math.round(value * 1e9) / 1e9;
const key = (cell: Cell) => `${cell.x},${cell.z}`;
const smooth = (value: number) => value * value * (3 - 2 * value);

/** Undo/redo receipts do not reshape the world; only the current acquired land and heights do. */
export function terrainRevision(state: TerrainLand): string {
    const heights = Object.entries(state.terrain?.heights ?? {}).filter(([, height]) => height !== 0).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify([state.land, state.bridge?.x ?? null, heights]);
}

/** Smooth authored samples; callers needing support use editableIslandWorld's actual triangles. */
function rawHeight(state: TerrainLand, cell: Cell, curved: boolean): number {
    const bounds = landBounds(state);
    // Extend a shore cell's edit through its outer half footprint. Interpolating
    // toward an unowned zero sample would leave a thin dry dam around a carved inlet.
    const sx = Math.max(bounds.minX, Math.min(bounds.maxX, cell.x)), sz = Math.max(0, Math.min(bounds.depth - 1, cell.z));
    const x = Math.floor(sx), z = Math.floor(sz), u = smooth(sx - x), v = smooth(sz - z);
    const height = (dx: number, dz: number) => state.terrain?.heights[`${x + dx},${z + dz}`] ?? 0;
    const offset = ((1 - u) * height(0, 0) + u * height(1, 0)) * (1 - v)
        + ((1 - u) * height(0, 1) + u * height(1, 1)) * v;
    return baseTerrainHeightAt(state, cell) + (curved ? landscapeRise(cell) : 0) + offset * TERRAIN_STEP;
}

/** A smooth, triangulated editable surface. Acquired coordinates stay fixed, even under water. */
export function editableIslandWorld(input: TerrainLand, curved = true): IslandWorld | undefined {
    const state = sculpted(input);
    if (!state.terrain) return undefined;
    // The terrace form derives stairs from where owners stand, so they join the revision.
    const plan = editableTerracePlan(state, curved);
    // The plan also reads where owners stand (stairs, reach), so those cells join the key.
    const revision = `${curved}:${terrainRevision(state)}${plan ? `:terrace:${JSON.stringify(plan.stairs)}:${[...plan.occupied].sort().join(';')}` : ''}`, previous = cache.get(revision);
    if (previous) return previous;
    // Never feed the edited state back through the legacy adapter: original geometry proves rights.
    const bare = { land: state.land, bridge: state.bridge, [BARE]: true as const };
    const original = legacyIslandWorld(bare, curved);
    const source = original.definition.districts[0], bounds = landBounds(state);
    const districtId = source.id, minX = bounds.minX - .5, maxX = bounds.maxX + .5, minZ = -.5, maxZ = bounds.depth - .5;
    const detail = 6, margin = 1.5;
    const floor: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] } = {
        id: 'editable-ground', kind: 'ground', color: '#a4cb87', vertices: [], indices: [],
    };
    const water: WorldFloor & { vertices: WorldFloorVertex[]; indices: number[] } = {
        id: 'editable-water', kind: 'water', color: '#79d4d0', vertices: [], indices: [],
    };
    const ids = new Map<string, number>(), waterIds = new Map<string, number>();
    const bankVertices: { x: number; y: number; z: number }[] = [], bankIndices: number[] = [];
    const physical = (cell: Cell) => curved ? landscapePoint(cell) : cell;
    const surfaceHeight = (cell: Cell) => {
        const clamped = { x: Math.max(minX, Math.min(maxX, cell.x)), z: Math.max(minZ, Math.min(maxZ, cell.z)) };
        const distance = Math.hypot(cell.x - clamped.x, cell.z - clamped.z);
        const angle = Math.atan2(cell.z - (maxZ + minZ) / 2, cell.x - (minX + maxX) / 2);
        // Terraces end in a short beveled wall, so their floor drops quickly to the sea.
        const shoreWidth = plan ? .14 : .65 + .13 * Math.sin(angle * 3 + .4) + .08 * Math.sin(angle * 5);
        const fade = smooth(Math.max(0, Math.min(1, distance / shoreWidth)));
        const surface = plan ? plan.heightAt(clamped) : rawHeight(state, clamped, curved);
        // A dug shoreline stays open all the way to the sea: no decorative rim restores land.
        return stable(surface * (1 - fade) + (TERRAIN_SEA_LEVEL - .12) * fade);
    };
    type Sample = Cell & { y: number };
    const add = (target: typeof floor, map: Map<string, number>, p: Sample, wet: boolean) => {
        const id = `${stable(p.x)},${stable(p.z)}`, known = map.get(id); if (known !== undefined) return known;
        const cell = { x: stable(p.x), z: stable(p.z) }, point = physical(cell), index = target.vertices.length;
        target.vertices.push({ cell, point: { ...point, y: wet ? TERRAIN_SEA_LEVEL : stable(p.y) } });
        map.set(id, index); return index;
    };
    const clippedTriangle = (input: Sample[], wet: boolean) => {
        const polygon: Sample[] = [];
        for (let i = 0; i < input.length; i++) {
            const a = input[i], b = input[(i + 1) % input.length], inside = wet ? a.y < TERRAIN_DRY_LEVEL : a.y >= TERRAIN_DRY_LEVEL;
            if (inside) polygon.push(a);
            if (inside !== (wet ? b.y < TERRAIN_DRY_LEVEL : b.y >= TERRAIN_DRY_LEVEL)) {
                const t = (TERRAIN_DRY_LEVEL - a.y) / (b.y - a.y);
                polygon.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: TERRAIN_DRY_LEVEL });
            }
        }
        const target = wet ? water : floor, map = wet ? waterIds : ids;
        for (let i = 1; i + 1 < polygon.length; i++) {
            const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
            if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) < 1e-10) continue;
            if (wet) {
                const start = bankVertices.length;
                bankVertices.push(...[a, b, c].map(p => ({ ...physical(p), y: p.y })));
                bankIndices.push(start, start + 1, start + 2);
            }
            target.indices.push(add(target, map, a, wet), add(target, map, b, wet), add(target, map, c, wet));
        }
    };
    // Terrace cliffs sit on cell boundaries (half-integers). Samples .03 inside each boundary keep
    // the whole owner footprint (probes reach .46) flat right up to a cliff or stair.
    const offsets = [0, .03, TERRACE_BANK, .3, .5, .7, 1 - TERRACE_BANK, .97];
    const axis = (from: number, units: number) => [...Array.from({ length: units }, (_, u) => offsets.map(o => stable(from + u + o))).flat(), from + units];
    const uniform = (from: number, count: number) => Array.from({ length: count + 1 }, (_, i) => from + i / detail);
    const xs = plan ? axis(minX - margin - .5, Math.round(maxX - minX + margin * 2) + 1) : uniform(minX - margin, Math.round((maxX - minX + margin * 2) * detail));
    const zs = plan ? axis(minZ - margin - .5, Math.round(maxZ - minZ + margin * 2) + 1) : uniform(minZ - margin, Math.round((maxZ - minZ + margin * 2) * detail));
    const nx = xs.length - 1, nz = zs.length - 1;
    const samples: Sample[] = [];
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
        const cell = { x: xs[x], z: zs[z] };
        samples.push({ ...cell, y: surfaceHeight(cell) });
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
        const a = samples[z * (nx + 1) + x], b = samples[z * (nx + 1) + x + 1];
        const c = samples[(z + 1) * (nx + 1) + x], d = samples[(z + 1) * (nx + 1) + x + 1];
        for (const triangle of [[a, c, b], [b, c, d]]) { clippedTriangle(triangle, false); clippedTriangle(triangle, true); }
    }
    const floors: WorldFloor[] = [floor, ...source.floors.filter(f => f.kind === 'deck'), ...(water.indices.length ? [water] : [])];
    const sites: WorldSite[] = source.sites.map(site => ({ ...site, anchorPoint: original.anchorAt(site.cell)! }));
    const surfaces: WorldSurface[] = bankIndices.length ? [{ id: 'editable-underwater-bank', kind: 'bank', vertices: bankVertices, indices: bankIndices,
        material: { color: '#d4c79f', roughness: .96, metalness: 0 } }] : [];
    const definition: WorldDefinition = { version: 1, id: original.id, revision,
        districts: [{ ...source, floors, anchorFloors: source.floors, sites, surfaces }], edges: [] };
    // Half-cell waypoints let a resident skirt a sculpted shore without granting new planting cells.
    const siteKeys = new Set(sites.map(site => key(site.cell)));
    for (let z = 0; z <= (bounds.depth - 1) * 2; z++) for (let x = bounds.minX * 2; x <= bounds.maxX * 2; x++) {
        const cell = { x: x / 2, z: z / 2 }, id = key(cell);
        if (siteKeys.has(id) || surfaceHeight(cell) < TERRAIN_DRY_LEVEL) continue;
        sites.push({ id, cell, floorId: floor.id, placement: false }); siteKeys.add(id);
    }
    const geometry = compileWorldDefinition(definition);
    const edges: WorldDefinition['edges'][number][] = [];
    const addEdge = (a: WorldSite, b: WorldSite) => {
        const allows: ('walk' | 'join' | 'water')[] = [];
        const supported = geometry.isWalkEdgeSupported(a.cell, b.cell) && editableTerrainSegmentSupported(geometry, a.cell, b.cell);
        // Two steps up or down between neighbouring cells: a resident jumps it (spec 52 §1.5).
        const jump = !supported && Boolean(plan && terraceJump(plan, a.cell, b.cell));
        if (supported || jump) allows.push('walk');
        if (a.placement && b.placement && supported) allows.push('join', 'water');
        if (allows.length) edges.push({ from: { districtId, siteId: a.id }, to: { districtId, siteId: b.id }, allows, ...(jump ? { jump: true as const } : {}) });
    };
    const byCell = new Map(sites.map(site => [key(site.cell), site]));
    for (const site of sites) for (const d of [{ x: .5, z: 0 }, { x: 0, z: .5 }, { x: 1, z: 0 }, { x: 0, z: 1 }]) {
        const other = byCell.get(key({ x: site.cell.x + d.x, z: site.cell.z + d.z }));
        const existingBridge = state.bridge && site.cell.x === state.bridge.x && other?.cell.x === state.bridge.x
            && site.cell.z >= bounds.depth - 1;
        if (other && (d.x + d.z === .5 || site.placement && other.placement || existingBridge)) addEdge(site, other);
    }
    // The passages were measured on these very floors; attach them without compiling the floors twice.
    const world = geometry.withEdges(edges);
    if (plan) terraces.set(world, plan);
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(revision, world); return world;
}

/** Two neighbouring dry cells exactly a jump apart, with no stair between them. */
export function terraceJump(plan: TerracePlan, from: Cell, to: Cell) {
    if (![from.x, from.z, to.x, to.z].every(Number.isInteger) || Math.abs(from.x - to.x) + Math.abs(from.z - to.z) !== 1) return false;
    const a = key(from), b = key(to);
    if (!plan.dry.has(a) || !plan.dry.has(b)) return false;
    if (plan.stairs.some(s => key(s.lower) === a || key(s.lower) === b)) return false;
    return Math.abs((plan.levels.get(a) ?? 0) - (plan.levels.get(b) ?? 0)) === JUMP_RISE;
}

/** Tests the actual corridor beneath a moving body, including its width and slope.
 * This also covers the first short connection from a stopped fractional position
 * to a graph waypoint after an edit; a nearest waypoint alone proves no passage. */
export function editableTerrainSegmentSupported(world: IslandWorld, from: Cell, to: Cell, radius = .18): boolean {
    if (![from.x, from.z, to.x, to.z, radius].every(Number.isFinite) || radius < 0) return false;
    const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
    if (length > 1024) return false;
    const steps = Math.max(1, Math.ceil(length / .08)), nx = length ? -dz / length : 1, nz = length ? dx / length : 0;
    const bridgeDecks = new Set(world.floors.filter(floor => floor.kind === 'deck' && JSON.parse(floor.id)[1] === 'existing-lookout-bridge').map(floor => floor.id));
    const grounds = new Set(world.floors.filter(floor => floor.kind === 'ground').map(floor => floor.id));
    let previous: ReturnType<IslandWorld['floorAt']>;
    for (let i = 0; i <= steps; i++) {
        const cell = { x: from.x + dx * i / steps, z: from.z + dz * i / steps };
        const sample = world.floorAt(cell), center = sample?.point; if (!sample || !center) return false;
        for (const side of [-radius, radius]) {
            const edge = world.floorAt({ x: cell.x + nx * side, z: cell.z + nz * side })?.point;
            if (!edge || Math.abs(edge.y - center.y) > Math.hypot(edge.x - center.x, edge.z - center.z) * .8 + .04) return false;
        }
        if (previous) {
            const rise = Math.abs(center.y - previous.point.y), run = Math.hypot(center.x - previous.point.x, center.z - previous.point.z);
            // The acquired lookout has a real .1525 plank lip. Preserve only that
            // original ground/deck junction, never a sculpted cliff or another deck.
            const bridgeLip = previous.floorId !== sample.floorId && rise <= .16 && run > 0
                && (bridgeDecks.has(previous.floorId) && grounds.has(sample.floorId) || bridgeDecks.has(sample.floorId) && grounds.has(previous.floorId));
            if (rise > run * .8 + 1e-8 && !bridgeLip) return false;
        }
        previous = sample;
    }
    return true;
}
