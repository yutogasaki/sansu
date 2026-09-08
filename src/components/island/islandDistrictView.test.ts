import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { islandDistrictForPosition, islandHomeDistrict } from './islandDistrictView';
const at = (level: 0 | 1 | 2) => { const island = createIsland('p', 1); island.growth!.expansionLevel = level; island.completedSets = 1000; return island; };
describe('an expanding island stays readable', () => {
    it('uses earned land rather than learning count and respects an explicit overview', () => {
        expect(islandHomeDistrict(at(0))).toBe('all');
        expect(islandHomeDistrict(at(2))).toBe('home');
        expect(islandHomeDistrict(at(2), 'all')).toBe('all');
        expect(islandHomeDistrict(at(1), 'west')).toBe('home');
    });
    it('opens the district containing a possession without offering unavailable land', () => {
        expect(islandDistrictForPosition(at(2), { x: -8, z: 1 })).toBe('west');
        expect(islandDistrictForPosition(at(1), { x: 8, z: -1 })).toBe('east');
        expect(islandDistrictForPosition(at(0), { x: 1, z: 2 })).toBe('home');
    });
});
