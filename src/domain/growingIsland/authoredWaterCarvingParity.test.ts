import { describe, expect, it } from 'vitest';
import { isAuthoredWaterCarvingSafe } from './authoredWaterCarving';
import { intersectPolygons, mapTrianglePoint, polygonBounds, polygonBoxesOverlap, polygonHasArea, protectionRectangle, subtractPolygon, triangulateWaterPolygon } from './authoredWaterGeometry';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { Cell } from './types';
import type { WorldFloor, WorldPoint } from './worldTypes';

const physical = (cells: readonly Cell[], y = 0): WorldPoint[] => cells.map(cell => ({ ...cell, y }));
const rectangle = (x0: number, x1: number, z0: number, z1: number) => physical([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
const floor = (id: string, polygon = rectangle(-2, 2, -2, 2)): WorldFloor => ({ id, kind: 'ground', color: '#aabbcc',
    vertices: polygon.map(point => ({ cell: { x: point.x, z: point.z }, point })), indices: [0, 1, 2, 0, 2, 3] });
function world(floors: readonly WorldFloor[], shiftedOrigin = false) {
    return compileWorldDefinition({ version: 1, id: 'parity', edges: [], districts: [{ id: 'district', templateId: 'parity', turn: 0,
        logicalOrigin: { x: shiftedOrigin ? 10 : 0, z: 0 }, worldOrigin: { x: shiftedOrigin ? 100 : 0, y: 0, z: 0 },
        floors, sites: [], ports: [], waterCarvingScopes: [{ id: 'scope', floorIds: floors.map(floor => floor.id), envelope: rectangle(-3, 13, -3, 3) }] }] });
}

/** Frozen pre-optimization algorithm, including its per-ear/fragment threshold
 * and coarse-bucket source visit order. It is intentionally a slow oracle. */
function reference(base: IslandWorld, outline: readonly WorldPoint[], protections: readonly { cell: Cell; half: number }[]) {
    const triangles = triangulateWaterPolygon(outline); if (!triangles) return false;
    type Cover = { cells: readonly Cell[]; points: readonly Cell[]; polygon: Cell[]; box: ReturnType<typeof polygonBounds>; logicalBox: ReturnType<typeof polygonBounds> };
    const district = base.definition.districts[0], buckets = new Map<string, Cover[]>();
    const regions = district.waterCarvingScopes!.map(scope => scope.envelope.map(p => ({ x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z })));
    for (const source of base.floors) for (let i = 0; i < source.indices.length; i += 3) {
        const vertices = source.indices.slice(i, i + 3).map(id => source.vertices[id]), cells = vertices.map(v => v.cell), points = vertices.map(v => v.point);
        for (const region of regions) {
            const logical = intersectPolygons(cells, region); if (!polygonHasArea(logical)) continue;
            const polygon = logical.map(cell => mapTrianglePoint(cell, cells, points)), box = polygonBounds(polygon), cover = { cells, points, polygon, box, logicalBox: polygonBounds(cells) };
            for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
                const id = `${x},${z}`, bucket = buckets.get(id) ?? []; bucket.push(cover); buckets.set(id, bucket);
            }
        }
    }
    const protectedRegions = protections.map(p => ({ polygon: protectionRectangle(p.cell, p.half), box: polygonBounds(protectionRectangle(p.cell, p.half)) }));
    for (const triangle of triangles) {
        const box = polygonBounds(triangle), candidates = new Set<Cover>();
        for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++)
            for (const source of buckets.get(`${x},${z}`) ?? []) if (polygonBoxesOverlap(box, source.box)) candidates.add(source);
        let uncovered: Cell[][] = [triangle];
        for (const source of candidates) {
            const overlap = intersectPolygons(triangle, source.polygon); if (!polygonHasArea(overlap)) continue;
            const logical = overlap.map(point => mapTrianglePoint(point, source.points, source.cells));
            if (protectedRegions.some(p => polygonBoxesOverlap(source.logicalBox, p.box) && polygonHasArea(intersectPolygons(logical, p.polygon)))) return false;
            uncovered = uncovered.flatMap(piece => subtractPolygon(piece, source.polygon));
        }
        if (uncovered.length) return false;
    }
    return true;
}

describe('carving optimization preserves the original exact predicate', () => {
    it('keeps overlapping nonidentity floors and both floor orders in the protection proof', () => {
        const a = floor('identity'), b = { ...floor('other-mapping'), vertices: a.vertices.map(vertex => ({ ...vertex, cell: { ...vertex.cell, x: vertex.cell.x + 10 } })) };
        for (const floors of [[a, b], [b, a]]) {
            const base = world(floors), outline = rectangle(.7, 1.3, -.3, .3), protection = [{ cell: { x: 11, z: 0 }, half: .1 }];
            expect(reference(base, outline, protection)).toBe(false);
            expect(isAuthoredWaterCarvingSafe(base, 'district', outline, protection)).toBe(false);
        }
    });

    it('uses global transformed vertices and retains tiny slits, shared boundaries and duplicate floors', () => {
        const shifted = world([floor('ground')], true), outline = rectangle(99.5, 100.5, -.5, .5), protection = [{ cell: { x: 10, z: 0 }, half: .1 }];
        expect(isAuthoredWaterCarvingSafe(shifted, 'district', outline, protection)).toBe(reference(shifted, outline, protection));
        expect(isAuthoredWaterCarvingSafe(shifted, 'district', outline, protection)).toBe(false);
        for (const gap of [0, 1e-6, 3e-12]) {
            const base = world([floor('left', rectangle(-2, -gap / 2, -2, 2)), floor('right', rectangle(gap / 2, 2, -2, 2))]);
            const outline = rectangle(-.3, .3, -.5, .5);
            expect(isAuthoredWaterCarvingSafe(base, 'district', outline, [])).toBe(reference(base, outline, []));
            if (gap === 1e-6) expect(isAuthoredWaterCarvingSafe(base, 'district', outline, [])).toBe(false);
        }
        const duplicate = world([floor('first'), floor('second')]);
        expect(isAuthoredWaterCarvingSafe(duplicate, 'district', rectangle(-1, 1, -1, 1), [])).toBe(true);
    });

    it('retains concave notches, malformed-outline rejection and per-ear area threshold behavior', () => {
        const base = world([floor('ground')]), notch = physical([{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: .2, z: 1 }, { x: .2, z: -.2 }, { x: -.2, z: -.2 }, { x: -.2, z: 1 }, { x: -1, z: 1 }]);
        for (const cell of [{ x: 0, z: 0 }, { x: .3, z: 0 }, { x: -.3, z: 0 }]) {
            const protection = [{ cell, half: .02 }];
            expect(isAuthoredWaterCarvingSafe(base, 'district', notch, protection)).toBe(reference(base, notch, protection));
        }
        expect(isAuthoredWaterCarvingSafe(base, 'district', notch, [{ cell: { x: 0, z: 0 }, half: .02 }])).toBe(true);
        const crossing = physical([{ x: -1, z: -1 }, { x: 1, z: 1 }, { x: 1, z: -1 }, { x: -1, z: 1 }]);
        expect(isAuthoredWaterCarvingSafe(base, 'district', crossing, [])).toBe(false);
        for (const half of [2e-7, 5e-7, 7e-7, 1e-6, 2e-6]) for (const x of [0, .5, 1]) {
            const outline = rectangle(0, 1, 0, 1), protection = [{ cell: { x, z: .5 }, half }];
            expect(isAuthoredWaterCarvingSafe(base, 'district', outline, protection)).toBe(reference(base, outline, protection));
        }
    });

    it('matches a deterministic varied corpus across identity, overlap and gap worlds', () => {
        const bases = [world([floor('ground')]), world([floor('first'), floor('second')]), world([floor('left', rectangle(-2, -.00001, -2, 2)), floor('right', rectangle(.00001, 2, -2, 2))])];
        let seed = 4521; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
        for (const base of bases) for (let i = 0; i < 80; i++) {
            const x = random() * 4 - 2, z = random() * 4 - 2, size = random() * .8 + .01;
            const outline = i % 2 ? rectangle(x - size, x + size, z - size, z + size) : physical(Array.from({ length: 12 }, (_, j) => {
                const radius = size * (j % 2 ? .65 : 1); return { x: x + Math.cos(j * Math.PI / 6) * radius, z: z + Math.sin(j * Math.PI / 6) * radius }; }));
            const protections = [{ cell: { x: random() * 4 - 2, z: random() * 4 - 2 }, half: random() * .4 + .01 }];
            expect(isAuthoredWaterCarvingSafe(base, 'district', outline, protections)).toBe(reference(base, outline, protections));
        }
    });

    it('keeps the original decisions around the per-fragment area cutoff', () => {
        for (const gap of [0, 1e-13, 5e-13, 1e-12, 3e-12, 1e-11]) {
            const base = world([floor('left', rectangle(-2, -gap / 2, -2, 2)), floor('right', rectangle(gap / 2, 2, -2, 2))]);
            for (const x of [0, .2, .7]) for (const z of [0, .1, .4]) {
                const outline = rectangle(-1 + x, .5 + x, -.5 + z, .7 + z);
                expect(isAuthoredWaterCarvingSafe(base, 'district', outline, [])).toBe(reference(base, outline, []));
            }
        }
    });
});
