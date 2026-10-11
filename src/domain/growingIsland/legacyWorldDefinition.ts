import { landBounds, landCells } from './space';
import { terrainHeightAt } from './placeTerrain';
import { landscapePoint, landscapeRise } from './landscape';
import type { Cell, GrowingState } from './types';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { WorldDefinition, WorldFloor, WorldFloorVertex, WorldSite } from './worldTypes';

type LegacyLand = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>;
const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;
const DELTAS = [{ x: 1, z: 0 }, { x: 0, z: 1 }];
const cache = new Map<string, IslandWorld>();

/** A read-only compatibility district. Every previously acquired cell remains
 * owned; the old floor's unit triangles and clipped shore are carried verbatim. */
export function legacyWorldDefinition(state: LegacyLand, curved = false): WorldDefinition {
    const bounds = landBounds(state), districtId = 'legacy-acquired-land';
    const x0 = bounds.minX - .5, x1 = bounds.maxX + .5, z0 = -.5, z1 = bounds.depth - .5;
    const vertices: WorldFloorVertex[] = [], indices: number[] = [], ids = new Map<string, number>();
    const groundHeight = (cell: Cell) => terrainHeightAt(state, cell) + (curved ? landscapeRise(cell) : 0);
    const vertex = (cell: Cell) => {
        const id = cellKey(cell), previous = ids.get(id); if (previous !== undefined) return previous;
        const p = curved ? landscapePoint(cell) : cell, index = vertices.length;
        vertices.push({ cell: { ...cell }, point: { x: p.x, y: groundHeight(cell), z: p.z } }); ids.set(id, index); return index;
    };
    const triangle = (points: Cell[]) => {
        let polygon = points;
        for (const [axis, bound, sign] of [['x', x0, 1], ['x', x1, -1], ['z', z0, 1], ['z', z1, -1]] as const) {
            const clipped: Cell[] = [];
            for (let i = 0; i < polygon.length; i++) {
                const a = polygon[i], b = polygon[(i + 1) % polygon.length];
                const insideA = (a[axis] - bound) * sign >= 0, insideB = (b[axis] - bound) * sign >= 0;
                if (insideA) clipped.push(a);
                if (insideA !== insideB) { const t = (bound - a[axis]) / (b[axis] - a[axis]); clipped.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }); }
            }
            polygon = clipped;
        }
        for (let i = 1; i + 1 < polygon.length; i++) {
            const [a, b, c] = [polygon[0], polygon[i], polygon[i + 1]];
            if (Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)) > 1e-10) indices.push(vertex(a), vertex(b), vertex(c));
        }
    };
    for (let z = -1; z < bounds.depth; z++) for (let x = bounds.minX - 1; x <= bounds.maxX; x++) {
        const a = { x, z }, b = { x: x + 1, z }, c = { x, z: z + 1 }, d = { x: x + 1, z: z + 1 };
        triangle([a, c, b]); triangle([b, c, d]);
    }
    const floors: WorldFloor[] = [{ id: 'acquired-floor', kind: 'ground', color: '#9dcc88', vertices, indices }];
    const sites: WorldSite[] = landCells(state).map(cell => ({ id: cellKey(cell), cell, floorId: 'acquired-floor', placement: true }));
    if (state.bridge) {
        const x = state.bridge.x, height = groundHeight({ x, z: bounds.depth - 1 }) + .1525;
        const deckVertices = [{ x: x - .36, z: bounds.depth - .695 }, { x: x + .36, z: bounds.depth - .695 },
            { x: x - .36, z: bounds.depth + 1.35 }, { x: x + .36, z: bounds.depth + 1.35 }].map(cell => {
            const p = curved ? landscapePoint(cell) : cell; return { cell, point: { x: p.x, y: height, z: p.z } };
        });
        floors.push({ id: 'existing-lookout-bridge', kind: 'deck', color: '#d4b48b', vertices: deckVertices, indices: [0, 2, 1, 1, 2, 3] });
        for (const z of [bounds.depth, bounds.depth + 1]) sites.push({ id: cellKey({ x, z }), cell: { x, z }, floorId: 'existing-lookout-bridge', placement: false });
    }
    const siteIds = new Map(sites.map(site => [site.id, site])), edges: WorldDefinition['edges'][number][] = [];
    for (const site of sites) for (const delta of DELTAS) {
        const id = cellKey({ x: site.cell.x + delta.x, z: site.cell.z + delta.z }); if (!siteIds.has(id)) continue;
        const plantingEdge = site.placement && siteIds.get(id)!.placement;
        edges.push({ from: { districtId, siteId: site.id }, to: { districtId, siteId: id }, allows: plantingEdge ? ['walk', 'join', 'water'] : ['walk'] });
    }
    return { version: 1, id: `legacy-world-v1:${bounds.minX},${bounds.maxX},${bounds.depth}:${curved ? 'curved-owned-v1' : 'linear'}:${state.bridge?.x ?? 'no-bridge'}`,
        districts: [{ id: districtId, templateId: 'existing-acquired-rectangle-v1', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 },
            turn: 0, floors, sites, ports: [] }], edges };
}

export function legacyIslandWorld(state: LegacyLand, curved = false): IslandWorld {
    const bounds = landBounds(state), id = `${bounds.minX},${bounds.maxX},${bounds.depth}:${curved}:${state.bridge?.x ?? ''}`;
    const previous = cache.get(id); if (previous) return previous;
    const world = compileWorldDefinition(legacyWorldDefinition(state, curved));
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(id, world); return world;
}
