import { describe, expect, it } from 'vitest';
import { createIsland, getIslandLandAccess, getIslandLands, isValidIslandPlacement, islandPlacementCandidates } from './catalog';

describe('earned land access and placement', () => {
    it('gates new placement by earned chapters while keeping old saved shores and possessions', () => {
        const island = { ...createIsland('chapter-placement', 0), completedSets: 12 };
        const item = island.items[0], original = structuredClone(island);
        for (const expansionLevel of [0, 1, 2] as const) {
            const layout = { ...island, growth: { ...island.growth!, expansionLevel } };
            const access = getIslandLandAccess(layout);
            expect(getIslandLands(access)).toHaveLength(expansionLevel + 1);
            expect(isValidIslandPlacement(layout, item.id, { x: 6.2, z: 0 })).toBe(expansionLevel >= 1);
            expect(isValidIslandPlacement(layout, item.id, { x: -6.2, z: 0 })).toBe(expansionLevel >= 2);
            expect(islandPlacementCandidates(access).some(position => position.x > 4.8)).toBe(expansionLevel >= 1);
            expect(islandPlacementCandidates(access).some(position => position.x < -4.8)).toBe(expansionLevel >= 2);
        }
        const legacy = { ...island, growth: { ...island.growth!, expansionLevel: undefined } };
        expect(isValidIslandPlacement({ ...legacy, completedSets: 2 }, item.id, { x: 6.2, z: 0 })).toBe(true);
        expect(isValidIslandPlacement(legacy, item.id, { x: -6.2, z: 0 })).toBe(true);
        expect(island).toEqual(original);
    });
});
