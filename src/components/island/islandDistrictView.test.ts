import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { islandDistrictForPosition, islandHomeDistrict } from './islandDistrictView';
const at = (level: 0 | 1 | 2) => { const island = createIsland('p', 1); island.growth!.expansionLevel = level; island.completedSets = 1000; return island; };
describe('an expanding island stays readable', () => {
    it('keeps the same home view from loading through both earned expansions', () => {
        expect([undefined, at(0), at(1), at(2)].map(island => islandHomeDistrict(island)))
            .toEqual(['home', 'home', 'home', 'home']);
    });
    it('respects an explicit overview or home view at every loading and growth stage', () => {
        for (const island of [undefined, at(0), at(1), at(2)]) {
            expect(islandHomeDistrict(island, 'all')).toBe('all');
            expect(islandHomeDistrict(island, 'home')).toBe('home');
        }
    });
    it('preserves each explicitly selected district once its land is earned', () => {
        expect(islandHomeDistrict(at(1), 'east')).toBe('east');
        expect(islandHomeDistrict(at(2), 'east')).toBe('east');
        expect(islandHomeDistrict(at(2), 'west')).toBe('west');
    });
    it('falls back home for unavailable land even when the learning count is high', () => {
        for (const district of ['east', 'west'] as const) {
            expect(islandHomeDistrict(undefined, district)).toBe('home');
            expect(islandHomeDistrict(at(0), district)).toBe('home');
        }
        expect(islandHomeDistrict(at(1), 'west')).toBe('home');
    });
    it('opens the district containing a possession without offering unavailable land', () => {
        expect(islandDistrictForPosition(at(2), { x: -8, z: 1 })).toBe('west');
        expect(islandDistrictForPosition(at(1), { x: 8, z: -1 })).toBe('east');
        expect(islandDistrictForPosition(at(0), { x: 1, z: 2 })).toBe('home');
    });
});
