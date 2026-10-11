import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compileWorldDefinition, type IslandWorld, type WorldFloorSample } from './worldDefinition';
import { legacyWorldDefinition } from './legacyWorldDefinition';
import { newIsland } from './island';
import { inletWorldDefinition } from './worldDefinition.fixture';
import type { Cell } from './types';
import type { WorldDefinition, WorldFloor, WorldPoint } from './worldTypes';

const EPS = 1e-7;
const stable = (value: number) => Math.round(value * 1e9) / 1e9 || 0;
const key = (point: Cell) => `${point.x},${point.z}`;

/** The original integer-bin sampler, including its neighbour visit order. */
function referenceSampler(world: IslandWorld) {
    const triangles = world.floors.flatMap(floor => Array.from({ length: floor.indices.length / 3 }, (_, i) => {
        const vertices = floor.indices.slice(i * 3, i * 3 + 3).map(index => floor.vertices[index]);
        return { floorId: floor.id, kind: floor.kind, cells: vertices.map(v => v.cell), points: vertices.map(v => v.point) };
    }));
    const bins = [false, true].map(physical => {
        const buckets = new Map<string, number[]>();
        triangles.forEach((triangle, index) => {
            const points = physical ? triangle.points : triangle.cells;
            const x0 = Math.floor(Math.min(...points.map(p => p.x))), x1 = Math.floor(Math.max(...points.map(p => p.x)));
            const z0 = Math.floor(Math.min(...points.map(p => p.z))), z1 = Math.floor(Math.max(...points.map(p => p.z)));
            for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
                const id = key({ x, z }), list = buckets.get(id) ?? []; list.push(index); buckets.set(id, list);
            }
        });
        return buckets;
    });
    return (at: Cell & Partial<Pick<WorldPoint, 'y'>>, physical = false, floorId?: string): WorldFloorSample | undefined => {
        if (!Number.isFinite(at.x) || !Number.isFinite(at.z) || 'y' in at && !Number.isFinite(at.y)) return;
        const candidates = new Set<number>(), water: WorldPoint[] = [];
        for (const dx of [0, -EPS, EPS]) for (const dz of [0, -EPS, EPS])
            for (const index of bins[Number(physical)].get(key({ x: Math.floor(at.x + dx), z: Math.floor(at.z + dz) })) ?? []) candidates.add(index);
        let best: WorldFloorSample | undefined;
        for (const index of candidates) {
            const triangle = triangles[index]; if (floorId && triangle.floorId !== floorId && triangle.kind !== 'water') continue;
            const [a, b, c] = physical ? triangle.points : triangle.cells;
            const determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
            if (Math.abs(determinant) <= 1e-12) continue;
            const u = ((b.z - c.z) * (at.x - c.x) + (c.x - b.x) * (at.z - c.z)) / determinant;
            const v = ((c.z - a.z) * (at.x - c.x) + (a.x - c.x) * (at.z - c.z)) / determinant, w = 1 - u - v;
            if (!(u >= -EPS && v >= -EPS && w >= -EPS)) continue;
            const weights = [u, v, w];
            const point = { x: stable(triangle.points.reduce((sum, p, i) => sum + p.x * weights[i], 0)),
                y: stable(triangle.points.reduce((sum, p, i) => sum + p.y * weights[i], 0)),
                z: stable(triangle.points.reduce((sum, p, i) => sum + p.z * weights[i], 0)) };
            if (triangle.kind === 'water') { water.push(point); continue; }
            const cell = { x: stable(triangle.cells.reduce((sum, p, i) => sum + p.x * weights[i], 0)),
                z: stable(triangle.cells.reduce((sum, p, i) => sum + p.z * weights[i], 0)) };
            if (!best || (at.y === undefined || !physical ? point.y > best.point.y + EPS
                : Math.abs(point.y - at.y) < Math.abs(best.point.y - at.y) - EPS)) best = { cell, point, floorId: triangle.floorId, triangle: index };
        }
        return best && water.some(p => Math.hypot(p.x - best!.point.x, p.z - best!.point.z) < .00001 && p.y > best!.point.y + EPS) ? undefined : best;
    };
}

function tiledFloor(id: string, kind: WorldFloor['kind'], height: number, x0 = 0, x1 = 1): WorldFloor {
    const vertices: WorldFloor['vertices'][number][] = [], indices: number[] = [];
    for (let z = 0; z <= 8; z++) for (let x = 0; x <= 8; x++) {
        const cell = { x: x0 + (x1 - x0) * x / 8, z: z / 8 };
        vertices.push({ cell, point: { x: cell.x + cell.z * .08, y: height, z: cell.z + cell.x * .03 } });
    }
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        const a = z * 9 + x; indices.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
    }
    return { id, kind, color: '#aabbcc', vertices, indices };
}
function floorsWorld(floors: WorldFloor[]): WorldDefinition {
    return { version: 1, id: 'index-equivalence', edges: [], districts: [{ id: 'test', templateId: 'test', turn: 0,
        logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, floors, sites: [], ports: [] }] };
}
function compare(world: IslandWorld, queries: Cell[]) {
    const reference = referenceSampler(world);
    for (const at of queries) {
        expect(world.floorAt(at), `logical ${key(at)}`).toEqual(reference(at));
        const floor = reference(at);
        const point = floor?.point ?? { ...at, y: 0 };
        for (const y of [undefined, point.y - .25, point.y, point.y + .25]) {
            const physical = { x: point.x, z: point.z, ...(y === undefined ? {} : { y }) };
            expect(world.logicalAt(physical), `physical ${key(physical)} y=${y}`).toEqual(reference(physical, true)?.cell);
        }
    }
    return reference;
}

describe('fine floor index matches the original ordered sampler', () => {
    it('retains dense native05 floors, triangle identity, all sites and nearby physical inverses', () => {
        const definition: WorldDefinition = JSON.parse(gunzipSync(readFileSync('docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz')).toString());
        const world = compileWorldDefinition(definition), queries = world.sites.map(site => site.cell);
        expect(world.floors.reduce((sum, floor) => sum + floor.indices.length / 3, 0)).toBe(89488);
        let rng = 38183;
        const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
        for (let i = 0; i < 384; i++) queries.push({ x: -1 + random() * 17, z: -11 + random() * 15 });
        for (const site of world.sites.filter(site => site.placement)) for (const shift of [-EPS * 1.01, -EPS * .99, EPS * .99, EPS * 1.01])
            queries.push({ x: site.cell.x + shift, z: site.cell.z - shift });
        compare(world, queries);
    }, 30000);

    it('preserves highest and nearest-y floors, floor filters and water masking in dense overlapping tiles', () => {
        const world = compileWorldDefinition(floorsWorld([tiledFloor('ground', 'ground', 0), tiledFloor('deck', 'deck', 1),
            tiledFloor('near-tie', 'deck', 1 + EPS / 2), tiledFloor('water', 'water', .4, .5, 1)]));
        const queries: Cell[] = [];
        for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) for (const shift of [0, -EPS * .99, EPS * 1.01, -EPS * .125 * .99, EPS * .125 * 1.01])
            queries.push({ x: i / 16 + shift, z: j / 16 - shift });
        const reference = compare(world, queries);
        for (const at of queries) for (const floor of world.floors) expect(world.floorAt(at, floor.id)).toEqual(reference(at, false, floor.id));
        expect(world.floorAt({ x: .75, z: .5 }, world.floors[0].id)).toBeUndefined();
        expect(world.floorAt({ x: .75, z: .5 })?.floorId).toBe(world.floors[1].id);
        const point = world.floorAt({ x: .25, z: .5 }, world.floors[0].id)!.point;
        expect(world.logicalAt(point)).toEqual({ x: .25, z: .5 });
        expect(world.floorAt({ x: .25, z: .5 })?.floorId).toBe(world.floors[1].id);
    });

    it('retains coarse-bucket priority where an EPS seam contains two equal-height materials', () => {
        const west = tiledFloor('west', 'ground', 0, -1, -EPS / 10), east = tiledFloor('east', 'ground', 0);
        const world = compileWorldDefinition(floorsWorld([west, east])), reference = referenceSampler(world);
        for (const x of [-EPS * 1.01, -EPS * .99, -EPS / 10, 0, EPS / 10, EPS * .99, EPS * 1.01])
            for (const z of [0, .0625, .125, .5, 1]) expect(world.floorAt({ x, z })).toEqual(reference({ x, z }));
        expect(world.floorAt({ x: 0, z: .5 })?.floorId).toBe(world.floors[1].id);
    });

    it('keeps a numerically thin floor eligible within a densely subdivided bucket', () => {
        const cells = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1e-9 }];
        const thin: WorldFloor = { id: 'thin-deck', kind: 'deck', color: '#ddccbb', indices: [0, 1, 2],
            vertices: cells.map(cell => ({ cell, point: { ...cell, y: 2 } })) };
        const world = compileWorldDefinition(floorsWorld([tiledFloor('ground', 'ground', 0), thin]));
        compare(world, [0, .0625, .125, .5, .875, 1].flatMap(x => [-1e-16, 0, 1e-10, 1e-9, 1e-9 + 1e-16].map(z => ({ x, z }))));
        expect(world.floorAt({ x: .5, z: 1e-10 })?.floorId).toBe(world.floors[1].id);
    });

    it('preserves legacy curved/linear bridges and small inlet/water/district edges', () => {
        for (const curved of [false, true]) {
            const state = newIsland('indexed-legacy', 0); state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'], districts: ['south'] }; state.bridge = { x: 3, builtAt: 0 };
            const world = compileWorldDefinition(legacyWorldDefinition(state, curved)), queries: Cell[] = [];
            for (let z = -.5; z <= 16; z += .25) for (let x = -6.5; x <= 11.5; x += .5) queries.push({ x, z });
            compare(world, queries);
        }
        const definition = inletWorldDefinition(), district = definition.districts[0];
        definition.districts = [{ ...district, turn: 1, logicalOrigin: { x: -2, z: -3 }, worldOrigin: { x: -12, y: .7, z: -4 } }];
        compare(compileWorldDefinition(definition), Array.from({ length: 100 }, (_, i) => ({ x: -3.5 + i % 10 / 4, z: -3.5 + Math.floor(i / 10) / 4 })));
    });

    it('keeps non-finite rejection, bounded triangle validation and mutable query answers independent', () => {
        const input = floorsWorld([tiledFloor('ground', 'ground', 0)]), snapshot = structuredClone(input), world = compileWorldDefinition(input), at = { x: .25, z: .5 };
        const expected = world.floorAt(at)!, changed = world.floorAt(at)!;
        changed.cell.x = 999; changed.point.y = 999; changed.triangle = -1;
        const logical = world.logicalAt(expected.point)!; logical.x = 999;
        expect(world.floorAt(at)).toEqual(expected); expect(world.logicalAt(expected.point)).toEqual(expected.cell);
        for (const invalid of [NaN, Infinity, -Infinity]) {
            expect(world.floorAt({ x: invalid, z: .5 })).toBeUndefined();
            expect(world.logicalAt({ x: .5, z: invalid })).toBeUndefined();
            expect(world.logicalAt({ x: .5, y: invalid, z: .5 })).toBeUndefined();
        }
        const huge = tiledFloor('huge', 'ground', 0, 0, 1e6);
        expect(() => compileWorldDefinition(floorsWorld([huge]))).toThrow('excessive search area');
        expect(input).toEqual(snapshot); expect(Object.isFrozen(world.floors[0].vertices[0].point)).toBe(true);
    });
});
