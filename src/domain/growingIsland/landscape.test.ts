import { describe, expect, it } from 'vitest';
import { landscapeCell, landscapePoint, landscapeRise } from './landscape';

describe('continuous owned landscape', () => {
    it('preserves the initial cell centers and round-trips distant fractional hit and foot positions', () => {
        for (let x = 0; x <= 5; x++) for (let z = 0; z <= 4; z++) {
            expect(landscapePoint({ x, z })).toEqual({ x, z }); expect(landscapeRise({ x, z })).toBe(0);
        }
        for (let x = -120; x <= 120; x += 3) for (let z = 0; z <= 126; z += 3) {
            const cell = { x: x + .237, z: z + .713 }, actual = landscapeCell(landscapePoint(cell));
            expect(actual.x).toBeCloseTo(cell.x, 7); expect(actual.z).toBeCloseTo(cell.z, 7);
        }
    });
    it('never folds an acquired cell and leaves broad gentle hills between low gardens', () => {
        for (let x = -100; x <= 100; x += 2) for (let z = 0; z <= 110; z += 2) {
            const a = landscapePoint({ x, z }), b = landscapePoint({ x: x + 1, z }), c = landscapePoint({ x, z: z + 1 });
            const determinant = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
            expect(determinant).toBeGreaterThan(.65);
            expect(landscapeRise({ x, z })).toBeGreaterThanOrEqual(0);
            expect(Math.abs(landscapeRise({ x, z }) - landscapeRise({ x, z: z + 1 }))).toBeLessThan(.32);
        }
        expect(landscapeRise({ x: 3, z: 13 })).toBeGreaterThan(.7);
        expect(landscapeRise({ x: 3, z: 19 })).toBe(0);
        expect(landscapePoint({ x: 17, z: 3 }).z - 3).toBeGreaterThan(5);
    });
});
