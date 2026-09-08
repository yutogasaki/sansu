import { describe, expect, it } from 'vitest';
import { createIsland, getIslandLandAccess, isValidIslandPlacement } from '../../../domain/island/catalog';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from '../../../domain/island/growth';
import { findSafeResidentSpawn } from './navigation';
import { chooseReachableResident } from './residentInteraction';
import { chooseSharedActivity } from './sharedActivities';

describe('automatically grown places support real resident life', () => {
    it('keeps all seven anchor objects legal and reachable through the complete chapter', () => {
        let island = createIsland('growth-navigation', 1);
        for (let section = 1; section <= 24; section++) {
            const target = getIslandGrowthTarget(island);
            island = growIslandAfterCompletedSet({ ...island, completedSets: section }, target, section + 1);
            const access = getIslandLandAccess(island);
            const positions: { x: number; z: number }[] = [];
            for (const origin of [{ x: .1, z: 1.6 }, { x: 2.45, z: 1.45 }, ...(access.expansionLevel >= 1 && section >= 4 ? [{ x: 6.26, z: .83 }] : [])]) {
                const position = findSafeResidentSpawn(origin, island.items, access, positions);
                expect(position, `A resident needs a safe initial position at section ${section}`).toBeDefined();
                positions.push(position!);
            }
            const residents = positions.map(position => ({ position, visible: true }));
            for (const item of island.items) {
                expect(item.position, `Automatic ${item.id} placement at section ${section}`).toBeDefined();
                expect(isValidIslandPlacement(island, item.id, item.position!, item.rotation)).toBe(true);
                expect(chooseReachableResident(residents, item, island.items, access), `${item.id} must be usable at section ${section}`).toBeDefined();
            }
        }
        expect(island.items).toHaveLength(7);
    });

    it('makes the three authored sharing combinations possible without manual repair', () => {
        let island = createIsland('growth-sharing', 1);
        for (let section = 1; section <= 24; section++) {
            island = growIslandAfterCompletedSet({ ...island, completedSets: section }, getIslandGrowthTarget(island), section + 1);
        }
        const access = getIslandLandAccess(island);
        const positions: { x: number; z: number }[] = [];
        for (const origin of [{ x: .1, z: 1.6 }, { x: 2.45, z: 1.45 }, { x: 6.26, z: .83 }]) {
            positions.push(findSafeResidentSpawn(origin, island.items, access, positions)!);
        }
        const residents = positions.map(position => ({ position, visible: true }));
        for (const [id, kind] of [['starter-flower', 'flower'], ['living-fountain', 'bubble'], ['living-grove-lantern', 'star']]) {
            const plan = chooseSharedActivity(island.items, residents, access, id);
            expect(plan, `The automatic ${kind} pair must have three real routes`).toBeDefined();
            expect(plan!.kind).toBe(kind);
        }
    });
});
