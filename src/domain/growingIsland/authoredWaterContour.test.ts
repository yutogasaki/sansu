import { describe, expect, it } from 'vitest';
import { adaptWaterContour, decomposeWaterOutline, outlineArea, pointInWaterOutline, subtractWaterConvexPieces, waterRayExit, waterSegmentIntervals } from './authoredWaterContour';
import source from './nativeWaterSource.json';

describe('native water contour decomposition', () => {
    it('retains all 72 source points and concave notches with bounded, area-equivalent convex pieces', () => {
        for (const pool of source.pools) {
            const outline = pool.outline.map(p => ({ ...p, y: 0 })), saved = structuredClone(outline);
            const pieces = decomposeWaterOutline(outline);
            expect(outline).toHaveLength(72); expect(pieces.length).toBeGreaterThan(1); expect(pieces.length).toBeLessThan(16);
            expect(pieces.reduce((sum, piece) => sum + outlineArea(piece), 0)).toBeCloseTo(Math.abs(outlineArea(outline)), 8);
            for (const piece of pieces) for (let i = 0; i < piece.length; i++) {
                const a = piece[i], b = piece[(i + 1) % piece.length], c = piece[(i + 2) % piece.length];
                expect((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)).toBeGreaterThanOrEqual(-1e-9);
            }
            for (let z = -.8; z <= .8; z += .04) for (let x = -.8; x <= .8; x += .04) {
                const p = { x, y: 0, z }; expect(pieces.some(piece => pointInWaterOutline(p, piece))).toBe(pointInWaterOutline(p, outline));
            }
            expect(outline).toEqual(saved);
        }
    });
    it('fits four directions separately while keeping the owner anchor and source concavities', () => {
        const center = { x: 8, y: 1.95, z: -9 }, outline = adaptWaterContour(source.pools[0].outline, center, .35, .6, Math.PI / 2, .55, .3);
        expect(Math.max(...outline.map(p => p.x))).toBeCloseTo(8.3, 8);
        expect(Math.min(...outline.map(p => p.x))).toBeCloseTo(7.4, 8);
        expect(Math.max(...outline.map(p => p.z))).toBeCloseTo(-8.65, 8);
        expect(Math.min(...outline.map(p => p.z))).toBeCloseTo(-9.55, 8);
        expect(pointInWaterOutline(center, outline)).toBe(true); expect(outline.every(p => p.y === center.y)).toBe(true);
        expect(decomposeWaterOutline(outline).length).toBeGreaterThan(1);
    });
    it('uses true concave ray and segment crossings rather than the enclosing hull', () => {
        const polygon = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3]].map(([x, z]) => ({ x, y: 0, z }));
        expect(waterRayExit({ x: .5, y: 0, z: 2 }, 1, 0, polygon)).toBeCloseTo(.5);
        expect(waterRayExit({ x: 1.5, y: 0, z: 2 }, 1, 0, polygon)).toBeUndefined();
        expect(waterSegmentIntervals({ x: -.5, y: 0, z: 2 }, { x: 3.5, y: 0, z: 2 }, polygon)).toEqual([[.125, .375], [.625, .875]]);
        expect(decomposeWaterOutline(Array.from({ length: 129 }, () => ({ x: 0, y: 0, z: 0 })))).toEqual([]);
    });
    it('cuts actual sloping triangles without moving their remaining vertices off the source plane', () => {
        const triangle = [[0, 0], [2, 0], [0, 2]].map(([x, z]) => ({ x, y: 1 + x * .2 + z * .3, z }));
        const mouth = [[.5, -.1], [3, -.1], [3, 3], [.5, 3]].map(([x, z]) => ({ x, y: 0, z }));
        const remaining = subtractWaterConvexPieces(triangle, [mouth]);
        expect(remaining.reduce((sum, polygon) => sum + Math.abs(outlineArea(polygon)), 0)).toBeCloseTo(.875, 10);
        for (const p of remaining.flat()) expect(p.y).toBeCloseTo(1 + p.x * .2 + p.z * .3, 10);
        expect(subtractWaterConvexPieces(triangle, [])).toEqual([triangle]);
    });
});
