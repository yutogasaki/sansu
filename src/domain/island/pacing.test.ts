import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { CUSTOMIZATION_CATALOG } from './customization';
import { getIslandGrowthMilestone, getIslandGrowthTarget, getIslandHabitatLevel, growIslandAfterCompletedSet, isIslandGrowthComplete } from './growth';
import { advanceIslandGrowth, islandGrowthStep } from './pacing';
import { assertIsland, assertIslandPlan } from './repository';
import type { IslandPlan, IslandRecord } from './types';

function complete(island: IslandRecord, answers: number) {
    return growIslandAfterCompletedSet({ ...island, completedSets: island.completedSets + 1 }, getIslandGrowthTarget(island), 1, answers);
}

describe('whole-problem island balance', () => {
    it('retains a quick first change, then spreads major stages and shopping beyond the opening', () => {
        let island = createIsland('child', 0);
        const milestones: number[] = [];
        for (let set = 1; set <= 45; set++) {
            const before = island;
            island = complete(island, set === 1 ? 3 : 6);
            assertIsland(island);
            if (getIslandGrowthMilestone(before, island)) milestones.push(set);
            if (set === 1) {
                expect(island.growth?.progress.garden).toBe(1);
                expect(island.items).toHaveLength(3);
            }
            if (set === 3) {
                expect(getIslandHabitatLevel(island, 'garden')).toBe(1);
                expect(islandGrowthStep(island, 'garden')).toMatchObject({ progress: 2, pending: 6, remaining: 3 });
            }
            if (set === 10) expect(island.growth?.expansionLevel).toBe(0);
            if (set === 11) expect(island.growth?.expansionLevel).toBe(1);
            if (set === 21) expect(island.growth?.expansionLevel).toBe(1);
            if (set === 22) expect(island.growth?.expansionLevel).toBe(2);
        }
        expect(milestones).toEqual([11, 22, 33, 44]);
        expect(isIslandGrowthComplete(island)).toBe(true);
        expect(island.items).toHaveLength(7);
        expect(island.growth?.memories).toHaveLength(5);
        expect(island.growth?.pendingAnswers).toEqual({ garden: 0, waterside: 0, grove: 0, village: 0 });
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'accent').map(item => item.price)).toEqual([15, 20, 25]);
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'theme').map(item => item.price)).toEqual([0, 60, 100, 150]);
        // Bundles and their components are alternative purchase paths, not additive costs.
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'theme' || item.kind === 'accent')
            .reduce((sum, item) => sum + item.price, 0)).toBe(370);
        expect(CUSTOMIZATION_CATALOG.filter(item => item.kind === 'part' || item.kind === 'accent')
            .reduce((sum, item) => sum + item.price, 0)).toBe(370);
    });

    it('counts equivalent completed problems equally across short and long sections', () => {
        let short = complete(createIsland('short', 0), 3), long = complete(createIsland('long', 0), 3);
        for (let questions = 6; questions <= 60; questions += 6) {
            short = complete(complete(short, 3), 3);
            long = complete(long, 6);
            expect(islandGrowthStep(short, 'garden')).toEqual(islandGrowthStep(long, 'garden'));
        }
        expect(short.growth?.progress.garden).toBe(6);
        expect(short.completedSets).toBe(21);
        expect(long.completedSets).toBe(11);
    });

    it('preserves partial effort across target changes without granting a mark just for switching', () => {
        let island = complete(complete(createIsland('child', 0), 3), 3);
        const before = structuredClone(island);
        island.growth!.focus = 'village';
        island = complete(island, 3);
        expect(islandGrowthStep(island, 'garden')).toEqual(islandGrowthStep(before, 'garden'));
        island.growth!.focus = 'garden';
        island = complete(island, 3);
        expect(islandGrowthStep(island, 'garden')).toMatchObject({ progress: 2, pending: 0 });
        expect(island.growth?.progress.village).toBe(1);
    });

    it('keeps old earned growth, land, appearance and album when future growth slows down', () => {
        let island = createIsland('child', 0);
        for (let set = 1; set <= 5; set++) island = growIslandAfterCompletedSet({ ...island, completedSets: set }, 'garden', set);
        island.growth!.expansionLevel = 2;
        island.items[0].appearanceLevel = 0;
        const before = structuredClone(island);
        island = complete(island, 6);
        expect(island.growth?.progress.garden).toBe(5);
        expect(island.growth?.pendingAnswers?.garden).toBe(6);
        expect(island.growth?.expansionLevel).toBe(2);
        expect(island.items[0].appearanceLevel).toBe(0);
        expect(island.growth?.memories).toEqual(before.growth?.memories);
        island = complete(complete(island, 6), 6);
        expect(island.growth?.progress.garden).toBe(6);
        expect(island.growth?.pendingAnswers?.garden).toBe(0);
        assertIsland(island);
    });

    it('rejects corrupted partial progress and unknown pacing instead of resetting saved effort', () => {
        const island = complete(createIsland('child', 0), 3);
        for (const pending of [-1, 1.5, 6, Infinity]) {
            const invalid = structuredClone(island);
            invalid.growth!.pendingAnswers!.garden = pending;
            expect(() => assertIsland(invalid)).toThrow('Invalid island');
        }
        expect(() => assertIslandPlan({ rewardPacing: 'future' } as unknown as IslandPlan, 'child')).toThrow('Invalid learning plan');
        for (const answers of [0, -1, 1.5, 7, Infinity]) expect(() => advanceIslandGrowth(0, 0, answers)).toThrow('Invalid island completion size');
    });
});
