import { describe, expect, it, vi } from 'vitest';
import { newIsland } from './island';
import { placeGalleryRoute, terrainHeightAt } from './placeTerrain';

describe('shared owned terrain', () => {
    it('keeps the original home garden level, rolls expanded forest into a low bay and keeps coordinates stable', () => {
        const state = newIsland('shared-terrain', 1000);
        state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
        for (let x = 0; x <= 5; x++) for (let z = 0; z <= 4; z++) expect(terrainHeightAt(state, { x, z })).toBe(0);
        expect(terrainHeightAt(state, { x: 9, z: 2 })).toBeGreaterThan(1.0);
        expect(terrainHeightAt(state, { x: 9, z: 7 })).toBeLessThan(terrainHeightAt(state, { x: 9, z: 2 }) * .70);
        expect(terrainHeightAt(state, { x: 3, z: 7 })).toBeLessThan(.15);
        const height = terrainHeightAt(state, { x: 8.3, z: 4.6 });
        state.land.districts = ['east', 'south', 'south'];
        expect(terrainHeightAt(state, { x: 8.3, z: 4.6 })).toBe(height);
        const pools = [7, 9, 11].map(x => terrainHeightAt(state, { x, z: 2 }));
        expect(pools[1] - pools[0]).toBeGreaterThan(.2); expect(pools[2] - pools[1]).toBeGreaterThan(.2);
    });
    it('keeps every cell slope gentle across many later districts and fractional triangle samples', () => {
        const state = newIsland('far-terrain', 1000); state.land.expanded = 'east';
        state.land.districts = Array.from({ length: 32 }, () => 'south');
        for (let x = -110; x <= 110; x++) for (let z = 0; z <= 102; z++) {
            const a = terrainHeightAt(state, { x, z });
            expect(Number.isFinite(a)).toBe(true); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(2.3);
            for (const next of [{ x: x + 1, z }, { x, z: z + 1 }]) expect(Math.abs(a - terrainHeightAt(state, next))).toBeLessThan(.45);
        }
        const a = terrainHeightAt(state, { x: 8, z: 6 }), b = terrainHeightAt(state, { x: 9, z: 6 }), c = terrainHeightAt(state, { x: 8, z: 7 });
        expect(terrainHeightAt(state, { x: 8.2, z: 6.3 })).toBeCloseTo(a + .2 * (b - a) + .3 * (c - a), 8);
    });
    it('keeps physical and saved coordinates identical when engine transcendental results differ in their last bit', () => {
        const state = newIsland('engine-terrain', 1000); state.land.expanded = 'east';
        const footprint = [{ x: 7, z: 2 }, { x: 8, z: 2 }, { x: 9, z: 2 }];
        const place = { footprint, entrances: [footprint[0]] };
        const before = { heights: footprint.map(cell => terrainHeightAt(state, cell)), route: placeGalleryRoute(state, place, footprint[0]) };
        const originals = { exp: Math.exp, sin: Math.sin, cos: Math.cos };
        try {
            for (const name of ['exp', 'sin', 'cos'] as const) vi.spyOn(Math, name).mockImplementation(value => {
                const result = originals[name](value); return result + Number.EPSILON * result;
            });
            expect({ heights: footprint.map(cell => terrainHeightAt(state, cell)), route: placeGalleryRoute(state, place, footprint[0]) }).toEqual(before);
        } finally { vi.restoreAllMocks(); }
    });
});
