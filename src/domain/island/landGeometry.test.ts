import { describe, expect, it } from 'vitest';
import { getIslandFloorAreas, getIslandFloorBounds, islandFloorContains,
    ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND } from './landGeometry';

describe('connected physical floor', () => {
    it('retains the entire old ellipses and their inset footprints at every unlocked level', () => {
        const districts = [ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND];
        for (const level of [0, 1, 2] as const) {
            for (const area of districts.slice(0, level + 1)) for (const clearance of [0, .35, .42, .65, .8, 1.2]) {
                for (const radius of [0, .5, .999999]) for (let sample = 0; sample < 64; sample++) {
                    const angle = sample / 64 * Math.PI * 2;
                    const point = { x: area.x + Math.cos(angle) * (area.radiusX - clearance) * radius,
                        z: area.z + Math.sin(angle) * (area.radiusZ - clearance) * radius };
                    expect(islandFloorContains(point, clearance, level), JSON.stringify({ level, point, clearance })).toBe(true);
                }
            }
        }
    });

    it('opens connecting floor with its own district, without extending the old outer search bounds', () => {
        for (const level of [0, 1, 2] as const) {
            for (const sign of [1, -1]) {
                const point = { x: sign * 4.25, z: 1.5 }, clearance = .72;
                const oldFloor = [ISLAND_MAIN_LAND, ISLAND_EAST_LAND, ISLAND_WEST_LAND].some(area =>
                    ((point.x - area.x) / (area.radiusX - clearance)) ** 2 + (point.z / (area.radiusZ - clearance)) ** 2 <= 1);
                expect(oldFloor).toBe(false);
                expect(islandFloorContains(point, clearance, level)).toBe(level >= (sign > 0 ? 1 : 2));
            }
            const bounds = getIslandFloorBounds(level);
            expect(bounds).toEqual({ minX: level === 2 ? -10.3 : -4.8, maxX: level >= 1 ? 10.3 : 4.8, minZ: -3.6, maxZ: 3.6 });
        }
    });

    it('does not let a renderer alter the shared physical floor or accept invalid footprints', () => {
        const before = structuredClone(getIslandFloorAreas(2));
        expect(() => { Object.assign(getIslandFloorAreas(2)[2], { radiusZ: 2.25 }); }).toThrow();
        expect(getIslandFloorAreas(2)).toEqual(before);
        for (const point of [{ x: Infinity, z: 0 }, { x: 0, z: NaN }, { x: 50, z: 0 }]) expect(islandFloorContains(point, 0, 2)).toBe(false);
        for (const radius of [-1, NaN, Infinity, 100]) expect(islandFloorContains({ x: 0, z: 0 }, radius, 2)).toBe(false);
    });
});
