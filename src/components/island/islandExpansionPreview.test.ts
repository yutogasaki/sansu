import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { islandCompletionExpansion, islandExpansionPreview } from './islandExpansionPreview';
import type { IslandPlan } from '../../domain/island/types';

describe('completion earns the next island expansion', () => {
    it('waits until the reserved short section can actually finish the final growth mark', () => {
        const island = createIsland('p', 0);
        island.growth!.progress.garden = 5;
        island.growth!.pendingAnswers = { garden: 12, waterside: 0, grove: 0, village: 0 };
        const plan = { status: 'active', growthTarget: 'garden', rewardPacing: 'answers-v1', slots: Array(3).fill({}) } as IslandPlan;
        expect(islandExpansionPreview(island, plan)).toBeUndefined();
        island.growth!.pendingAnswers.garden = 15;
        expect(islandExpansionPreview(island, plan)).toBe('east');
        island.growth!.pendingAnswers.garden = 0;
        delete plan.rewardPacing;
        expect(islandExpansionPreview(island, plan)).toBe('east');
    });

    it('offers the first expansion through either initially available place, not a locked place', () => {
        const island = createIsland('p', 0);
        expect(islandCompletionExpansion(island, 'garden')).toBe('east');
        expect(islandCompletionExpansion(island, 'village')).toBe('east');
        expect(islandCompletionExpansion(island, 'waterside')).toBeUndefined();
        expect(islandExpansionPreview(island)).toBeUndefined();
        island.growth!.progress.garden = 5;
        expect(islandExpansionPreview(island)).toBe('east');
    });

    it('does not promise already inherited land for the first maturity', () => {
        const island = createIsland('p', 0);
        island.completedSets = 9;
        delete island.growth!.expansionLevel;
        island.growth!.progress.garden = 5;
        expect(islandCompletionExpansion(island, 'garden')).toBeUndefined();
        expect(islandExpansionPreview(island)).toBeUndefined();
        island.growth!.progress.garden = 6;
        island.growth!.focus = 'village';
        island.growth!.progress.village = 5;
        expect(islandExpansionPreview(island)).toBe('west');
    });

    it('never advertises another expansion after both lands are earned or the place is complete', () => {
        const island = createIsland('p', 0);
        island.growth!.expansionLevel = 2;
        island.growth!.progress.garden = 5;
        expect(islandCompletionExpansion(island, 'garden')).toBeUndefined();
        expect(islandExpansionPreview(island)).toBeUndefined();
        island.growth!.expansionLevel = 0;
        island.growth!.progress.garden = 6;
        expect(islandCompletionExpansion(island, 'garden')).toBeUndefined();
    });
});
