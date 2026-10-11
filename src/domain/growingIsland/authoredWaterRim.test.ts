import { describe, expect, it } from 'vitest';
import { buildWaterRim } from './authoredWaterRim';
import source from './nativeWaterSource.json';
import { outlineArea, subtractWaterConvexPieces } from './authoredWaterContour';
import type { WorldSurface } from './worldTypes';

describe('source water terrace profile', () => {
    const center = { x: 0, y: 1, z: 0 }, outline = source.pools[0].outline.map(p => ({ ...p, y: 1 }));
    const options = { id: 'rim', outline, center, waterY: 1, rings: source.rim.rings, groundAt: (p: { x: number; z: number }) => 1 + p.x * .15,
        mouths: [], body: source.rim.body, lip: source.rim.lip };
    it('joins actual outer ground and inner water/bed levels with three coloured sloping bands', () => {
        const result = buildWaterRim(options)!;
        expect(result).toHaveLength(3); expect(result.every(surface => surface.kind === 'bank')).toBe(true);
        expect(result[1].material.color).toBe('#ad9bc9'); expect(result[0].material.color).toBe('#8295ba');
        const outer = result[0].vertices.filter(p => Math.abs(p.y - 1.04275) > 1e-8);
        expect(outer.length).toBeGreaterThan(10);
        for (const point of outer) expect(point.y).toBeCloseTo(options.groundAt(point), 8);
        expect(Math.min(...result[2].vertices.map(p => p.y))).toBeCloseTo(.892, 8);
        expect(Math.max(...result[0].vertices.map(p => Math.hypot(p.x, p.z)))).toBeGreaterThan(.65);
    });
    it('leaves an actual stream mouth open in every band and refuses a missing-ground outer base', () => {
        const mouth = [[.3, -.14], [1, -.14], [1, .14], [.3, .14]].map(([x, z]) => ({ x, y: 1, z }));
        const closed = buildWaterRim(options)!, open = buildWaterRim({ ...options, mouths: [mouth] })!;
        const triangles = (surface: WorldSurface) => Array.from({ length: surface.indices.length / 3 }, (_, i) => surface.indices.slice(i * 3, i * 3 + 3).map(index => surface.vertices[index]));
        const area = (surface: WorldSurface) => triangles(surface).reduce((sum, triangle) => sum + Math.abs(outlineArea(triangle)), 0);
        for (let i = 0; i < 3; i++) {
            expect(area(open[i])).toBeLessThan(area(closed[i]));
            for (const triangle of triangles(open[i])) {
                const remaining = subtractWaterConvexPieces(triangle, [mouth]);
                expect(remaining.reduce((sum, piece) => sum + Math.abs(outlineArea(piece)), 0)).toBeCloseTo(Math.abs(outlineArea(triangle)), 10);
            }
        }
        expect(buildWaterRim({ ...options, groundAt: p => p.x > .5 ? undefined : 1 })).toBeUndefined();
    });
});
