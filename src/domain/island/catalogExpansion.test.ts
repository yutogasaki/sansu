import { describe, expect, it } from 'vitest';
import { createIsland, getIslandLandAccess, getIslandLands, isValidIslandPlacement, islandPlacementCandidates } from './catalog';

describe('earned land access and placement', () => {
    it('lets the starter possessions reach unlocked connecting floor by the existing quarter-step controls', () => {
        const initial = createIsland('connected-arrow-placement', 0);
        const island = { ...initial, growth: { ...initial.growth!, expansionLevel: 2 as const } };
        for (const route of [
            { id: 'starter-flower', forward: 3, horizontal: 11, dx: .25, target: { x: 4.25, z: 1.55 } },
            { id: 'starter-lantern', forward: 6, horizontal: 21, dx: .25, target: { x: 4.25, z: 1.75 } },
            { id: 'starter-lantern', forward: 6, horizontal: 13, dx: -.25, target: { x: -4.25, z: 1.75 } },
        ]) {
            let point = { ...island.items.find(item => item.id === route.id)!.position! };
            for (let step = 0; step < route.forward; step++) {
                point = { ...point, z: point.z + .25 };
                expect(isValidIslandPlacement(island, route.id, point), JSON.stringify(point)).toBe(true);
            }
            for (let step = 0; step < route.horizontal; step++) {
                point = { ...point, x: point.x + route.dx };
                expect(isValidIslandPlacement(island, route.id, point), JSON.stringify(point)).toBe(true);
            }
            expect(point.x).toBeCloseTo(route.target.x, 12);
            expect(point.z).toBeCloseTo(route.target.z, 12);
        }
        expect(island.items).toEqual(initial.items);
    });

    it('permits furniture on unlocked connecting floor while keeping reservations and collisions', () => {
        const island = { ...createIsland('connected-placement', 0), completedSets: 12 };
        const original = structuredClone(island), item = island.items[0];
        for (const expansionLevel of [0, 1, 2] as const) {
            const layout = { ...island, growth: { ...island.growth!, expansionLevel } };
            for (const sign of [1, -1]) {
                const point = { x: sign * 4.25, z: 1.5 };
                expect(isValidIslandPlacement(layout, item.id, point)).toBe(expansionLevel >= (sign > 0 ? 1 : 2));
                expect(isValidIslandPlacement(layout, item.id, { x: sign * 4.75, z: 0 })).toBe(false);
                expect(isValidIslandPlacement({ ...layout, items: [...layout.items,
                    { ...item, id: 'occupied-neck', position: point }] }, item.id, point)).toBe(false);
            }
            expect(getIslandLands(getIslandLandAccess(layout))).toHaveLength(expansionLevel + 1);
        }
        expect(island).toEqual(original);
    });

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
