import { describe, expect, it, vi } from 'vitest';
import { findAuthoredShoreEntries, isAuthoredShoreEntrySupported } from './authoredWorldAccess';
import { clipPolygon, intersectPolygons, mapTrianglePoint, polygonBounds, polygonHasArea, protectionRectangle, subtractPolygon } from './authoredWaterGeometry';
import * as geometry from './authoredWaterGeometry';
import { compileWorldDefinition } from './worldDefinition';
import type { CompiledWorldFloor, CompiledWorldSite, WorldFloorSample } from './worldDefinition';
import type { Cell } from './types';
import type { WorldDefinition, WorldFloor, WorldSiteRef } from './worldTypes';

// Frozen pre-optimization oracle, SHA256 456b83acaced5b32aab0c7db6243388ad3c0a70d037efd064f890833c5c04b89.
// Keep the .65-bin visitation and every original subtraction/area threshold.
const AUTHORED_WALK_HALF_WIDTH = .12;
const cellKey = (cell: Cell) => `${cell.x},${cell.z}`;
interface ShoreGeometry {
    floors: readonly CompiledWorldFloor[];
    walkSites: readonly CompiledWorldSite[];
    floorAt: (cell: Cell) => WorldFloorSample | undefined;
    anchorFloorAt: (cell: Cell) => WorldFloorSample | undefined;
}
interface ShoreTriangle { floorId: string; water: boolean; points: readonly { x: number; y: number; z: number }[]; box: ReturnType<typeof polygonBounds> }
const shoreIndexes = new WeakMap<readonly CompiledWorldFloor[], Map<string, ShoreTriangle[]>>();
const SHORE_DISTANCE = .65;
function shoreIndex(floors: readonly CompiledWorldFloor[]) {
    const existing = shoreIndexes.get(floors); if (existing) return existing;
    const buckets = new Map<string, ShoreTriangle[]>();
    for (const floor of floors) for (let i = 0; i < floor.indices.length; i += 3) {
        const points = floor.indices.slice(i, i + 3).map(id => floor.vertices[id].point), box = polygonBounds(points);
        const triangle = { floorId: floor.id, water: floor.kind === 'water', points, box };
        for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
            const id = cellKey({ x, z }), list = buckets.get(id) ?? []; list.push(triangle); buckets.set(id, list);
        }
    }
    shoreIndexes.set(floors, buckets); return buckets;
}
function shoreTriangles(world: ShoreGeometry, point: Cell, radius: number) {
    const index = shoreIndex(world.floors), triangles = new Set<ShoreTriangle>();
    for (let z = Math.floor(point.z - radius); z <= Math.floor(point.z + radius); z++) for (let x = Math.floor(point.x - radius); x <= Math.floor(point.x + radius); x++)
        for (const triangle of index.get(cellKey({ x, z })) ?? []) if (triangle.box.minX <= point.x + radius && triangle.box.maxX >= point.x - radius
            && triangle.box.minZ <= point.z + radius && triangle.box.maxZ >= point.z - radius) triangles.add(triangle);
    return [...triangles];
}
function waterDistance(point: Cell, triangle: ShoreTriangle) {
    const crosses = triangle.points.map((a, i) => {
        const b = triangle.points[(i + 1) % triangle.points.length];
        return (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
    });
    if (crosses.every(value => value >= -1e-12) || crosses.every(value => value <= 1e-12)) return 0;
    return Math.min(...triangle.points.map((a, i) => {
        const b = triangle.points[(i + 1) % triangle.points.length], dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
    }));
}
function shoreHeight(triangle: ShoreTriangle, point: Cell) {
    return mapTrianglePoint(point, triangle.points, triangle.points.map(p => ({ x: p.y, z: 0 }))).x;
}

/** A real, original graph ref outside the water, with its whole physical foot
 * square supported. It grants neither a new site nor a route to the bank. */
function legacyIsAuthoredShoreEntrySupported(world: ShoreGeometry, cell: Cell, waterFloorIds: readonly string[]): boolean {
    if (!world.walkSites.some(site => cellKey(site.cell) === cellKey(cell))) return false;
    const support = world.floorAt(cell), original = world.anchorFloorAt(cell);
    if (!support || !original || Math.hypot(support.point.x - original.point.x, support.point.z - original.point.z) > .00001
        || Math.abs(support.point.y - original.point.y) > .28) return false;
    if (!waterFloorIds.length || waterFloorIds.some(id => !world.floors.some(floor => floor.id === id && floor.kind === 'water'))) return false;
    const triangles = shoreTriangles(world, support.point, SHORE_DISTANCE), ids = new Set(waterFloorIds);
    const distance = Math.min(...triangles.filter(triangle => triangle.water && ids.has(triangle.floorId)).map(triangle => waterDistance(support.point, triangle)));
    if (!(distance > AUTHORED_WALK_HALF_WIDTH * Math.SQRT2 && distance <= SHORE_DISTANCE)) return false;
    const square = protectionRectangle(support.point, AUTHORED_WALK_HALF_WIDTH);
    let uncovered: Cell[][] = [square];
    for (const triangle of triangles) {
        const overlap = intersectPolygons(square, triangle.points); if (!polygonHasArea(overlap)) continue;
        if (triangle.water || polygonHasArea(clipPolygon(overlap, p => shoreHeight(triangle, p) - support.point.y - .25 - 1e-7))) return false;
        let cover = clipPolygon(overlap, p => shoreHeight(triangle, p) - support.point.y + .25 + 1e-7);
        cover = clipPolygon(cover, p => support.point.y + .25 + 1e-7 - shoreHeight(triangle, p));
        if (polygonHasArea(cover)) uncovered = uncovered.flatMap(piece => subtractPolygon(piece, cover));
    }
    return !uncovered.length;
}

/** Discover existing dry refs beside actual water; owner distance is not a shore proxy. */
function legacyFindAuthoredShoreEntries(world: ShoreGeometry, waterFloorIds: readonly string[]): WorldSiteRef[] {
    const water = world.floors.filter(floor => waterFloorIds.includes(floor.id) && floor.kind === 'water');
    if (!water.length) return [];
    const bounds = water.map(floor => polygonBounds(floor.vertices.map(vertex => vertex.point)));
    return world.walkSites.filter(site => bounds.some(box => site.support!.point.x >= box.minX - SHORE_DISTANCE && site.support!.point.x <= box.maxX + SHORE_DISTANCE
        && site.support!.point.z >= box.minZ - SHORE_DISTANCE && site.support!.point.z <= box.maxZ + SHORE_DISTANCE)
        && legacyIsAuthoredShoreEntrySupported(world, site.cell, waterFloorIds)).sort((a, b) => a.cell.z - b.cell.z || a.cell.x - b.cell.x).map(site => ({ ...site.ref }));
}

const id = (floor: string) => JSON.stringify(['district', floor]);
const rectangle = (name: string, x0: number, x1: number, z0: number, z1: number, y = 1, kind: WorldFloor['kind'] = 'ground'): WorldFloor => ({
    id: name, kind, color: '#aabbcc', vertices: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => ({ cell: { x, z }, point: { x, y, z } })), indices: [0, 1, 2, 0, 2, 3],
});
function worldWith(floors: WorldFloor[], turned = false) {
    const original = rectangle('original', -1.1, 1.1, -.6, 1.1), sites = [];
    for (let z = -.5; z <= 1; z += .25) for (let x = -1; x <= 1; x += .25) sites.push({
        id: `${x},${z}`, cell: { x, z }, anchorPoint: { x, y: 1, z }, floorId: 'original', placement: Number.isInteger(x) && Number.isInteger(z),
    });
    const definition: WorldDefinition = { version: 1, id: 'shore-parity', districts: [{ id: 'district', templateId: 'source',
        logicalOrigin: { x: turned ? -3 : 0, z: turned ? -4 : 0 }, worldOrigin: { x: turned ? .9 : 0, y: turned ? 2 : 0, z: turned ? .9 : 0 }, turn: turned ? 1 : 0,
        floors, anchorFloors: [original], sites, ports: [] }], edges: [] };
    return compileWorldDefinition(definition);
}
const original = () => rectangle('original', -1.1, 1.1, -.6, 1.1);
const water = () => rectangle('water', -.9, .9, -.5, 0, 1.025, 'water');
function denseGround(divisions = 16) {
    const vertices: WorldFloor['vertices'][number][] = [], indices: number[] = [];
    for (let z = 0; z < divisions; z++) for (let x = 0; x < divisions; x++) {
        const quad = rectangle('tile', -1 + x * 2 / divisions, -1 + (x + 1) * 2 / divisions, -.5 + z * 1.5 / divisions, -.5 + (z + 1) * 1.5 / divisions);
        const offset = vertices.length; vertices.push(...quad.vertices); indices.push(...quad.indices.map(i => i + offset));
    }
    return { id: 'dense-ground', kind: 'ground' as const, color: '#aabbcc', vertices, indices };
}
function expectParity(world: ReturnType<typeof worldWith>, ids: string[]) {
    const expected = legacyFindAuthoredShoreEntries(world, ids), actual = findAuthoredShoreEntries(world, ids);
    expect(actual).toEqual(expected);
    for (const site of world.walkSites) expect(isAuthoredShoreEntrySupported(world, site.cell, ids)).toBe(legacyIsAuthoredShoreEntrySupported(world, site.cell, ids));
}

describe('shore query preserves the former whole-foot predicate', () => {
    it('keeps ordered refs across dense tiles, turned districts and distinct water subsets', () => {
        for (const turned of [false, true]) {
            const world = worldWith([denseGround(), water(), rectangle('other-water', .55, .9, .5, .9, 1.01, 'water')], turned);
            for (const ids of [[id('water')], [id('other-water')], [id('water'), id('other-water')], [id('water'), id('water')], [id('unknown')], []]) expectParity(world, ids);
        }
    });

    it('rejects later wet/high interiors even when earlier dry triangles cover the square', () => {
        const cell = { x: 0, z: .25 };
        for (const hazard of [rectangle('interior-water', .025, .055, .21, .29, 1.02, 'water'), rectangle('interior-high', .025, .055, .21, .29, 1.4, 'deck')]) {
            for (const floors of [[original(), water(), hazard], [hazard, water(), original()]]) {
                const world = worldWith(floors);
                expect(world.floorAt(cell)?.point.y).toBe(1);
                expect(legacyIsAuthoredShoreEntrySupported(world, cell, [id('water')])).toBe(false);
                expect(isAuthoredShoreEntrySupported(world, cell, [id('water')])).toBe(false);
                expectParity(world, [id('water')]);
            }
        }
        const wetAndDeck = worldWith([original(), water(), rectangle('interior-water', .025, .055, .21, .29, 1.02, 'water'), rectangle('cover-deck', .015, .065, .2, .3, 1.2, 'deck')]);
        expect(isAuthoredShoreEntrySupported(wetAndDeck, cell, [id('water')])).toBe(false);
        expectParity(wetAndDeck, [id('water')]);
    });

    it('retains thin-hole and height-band thresholds and overlap order', () => {
        const cell = { x: 0, z: .25 };
        for (const gap of [1e-4, 1e-8, 1e-11, 1e-12, 1e-13]) for (const reverse of [false, true]) {
            const floors = [rectangle('left', -1.1, .1, -.6, 1.1), rectangle('right', .1 + gap, 1.1, -.6, 1.1), water()];
            const world = worldWith(reverse ? floors.reverse() : floors);
            const expected = legacyIsAuthoredShoreEntrySupported(world, cell, [id('water')]);
            expect(isAuthoredShoreEntrySupported(world, cell, [id('water')])).toBe(expected);
            if (gap === 1e-4) expect(expected).toBe(false);
        }
        for (const y of [.7499998, .7499999, .75, 1.25, 1.2500001, 1.2500002]) {
            const world = worldWith([original(), rectangle('interior', .02, .06, .2, .3, y, 'deck'), water()]);
            expectParity(world, [id('water')]);
        }
    });

    it('retains shoreline distance, source support, unknown-ref and unsupported-height rejection', () => {
        const world = worldWith([original(), water()]), cell = { x: 0, z: .25 };
        for (const delta of [0, .1697056274847714, .65, .6500000001]) {
            const current = { ...world, floorAt: () => ({ ...world.floorAt(cell)!, point: { x: 0, y: 1, z: delta } }), anchorFloorAt: () => ({ ...world.anchorFloorAt(cell)!, point: { x: 0, y: 1, z: delta } }) };
            expect(isAuthoredShoreEntrySupported(current, cell, [id('water')])).toBe(legacyIsAuthoredShoreEntrySupported(current, cell, [id('water')]));
        }
        for (const change of [{ x: 100, y: 0 }, { x: 0, y: 10 }]) {
            const current = { ...world, floorAt: () => ({ ...world.floorAt(cell)!, point: { x: change.x, y: 1 + change.y, z: .25 } }) };
            expect(isAuthoredShoreEntrySupported(current, cell, [id('water')])).toBe(false);
        }
        expect(isAuthoredShoreEntrySupported(world, { x: .01, z: .25 }, [id('water')])).toBe(false);
    });

    it('reuses owner-independent foot proofs without sharing across geometry or support height', () => {
        const world = worldWith([denseGround(), water(), rectangle('other-water', .55, .9, .5, .9, 1.01, 'water')]), cell = { x: 0, z: .25 };
        const intersections = vi.spyOn(geometry, 'intersectPolygons');
        try {
            expect(isAuthoredShoreEntrySupported(world, cell, [id('water')])).toBe(true);
            expect(intersections.mock.calls.length).toBeGreaterThan(0);
            // The 512 dry triangles are narrowed to the actual .12 foot box;
            // measuring work avoids an unstable wall-clock budget in CI.
            expect(intersections.mock.calls.length).toBeLessThan(40); intersections.mockClear();
            expect(isAuthoredShoreEntrySupported(world, cell, [id('water'), id('other-water')])).toBe(true);
            expect(intersections).not.toHaveBeenCalled();
            const raised = { ...world, floorAt: (at: Cell) => { const sample = world.floorAt(at); return sample && { ...sample, point: { ...sample.point, y: sample.point.y + .2 } }; } };
            expect(isAuthoredShoreEntrySupported(raised, cell, [id('water')])).toBe(true);
            expect(intersections.mock.calls.length).toBeGreaterThan(0); intersections.mockClear();
            const hole = worldWith([rectangle('left', -1.1, .02, -.6, 1.1), rectangle('right', .06, 1.1, -.6, 1.1), water()]);
            expect(isAuthoredShoreEntrySupported(hole, cell, [id('water')])).toBe(false);
            expect(intersections.mock.calls.length).toBeGreaterThan(0);
            const first = findAuthoredShoreEntries(world, [id('water')]); first[0].siteId = 'modified-result';
            expect(findAuthoredShoreEntries(world, [id('water')])).toEqual(legacyFindAuthoredShoreEntries(world, [id('water')]));
        } finally { intersections.mockRestore(); }
    });
});
