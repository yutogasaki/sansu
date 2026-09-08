import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { growIslandAfterCompletedSet, initializeIslandGrowth } from '../../domain/island/growth';
import { islandGrowthPreview } from './islandGrowthPreview';

describe('next growth is a render-only preview', () => {
    it('changes the earned-place silhouette without earning a section, item, land, memory or discovery', () => {
        const island = initializeIslandGrowth(createIsland('child', 1), 1);
        island.pendingPlanId = 'reserved';
        const before = structuredClone(island);
        const result = islandGrowthPreview(island, 'garden')!;
        expect(result.island.growth!.progress.garden).toBe(1);
        expect(result.island.items.find(item => item.kind === 'flower')?.growthLevel).toBe(1);
        expect(result.island.completedSets).toBe(island.completedSets);
        expect(result.island.revision).toBe(island.revision);
        expect(result.island.pendingPlanId).toBe('reserved');
        expect(result.island.items.map(item => item.id)).toEqual(island.items.map(item => item.id));
        expect(result.island.growth!.expansionLevel).toBe(island.growth!.expansionLevel);
        expect(result.island.growth!.memories).toEqual(island.growth!.memories);
        expect(result.island.growth!.discoveries).toEqual([]);
        expect(island).toEqual(before);
    });
    it('shows the next earned stage even when the child wears an old shape, then leaves their choice intact', () => {
        let island = initializeIslandGrowth(createIsland('child', 1), 1);
        island = growIslandAfterCompletedSet({ ...island, completedSets: 1 }, 'garden', 2);
        const flower = island.items.find(item => item.kind === 'flower')!;
        flower.appearanceLevel = 0;
        expect(islandGrowthPreview(island, 'garden')?.island.items.find(item => item.id === flower.id)).toMatchObject({ growthLevel: 2, appearanceLevel: undefined });
        expect(flower.appearanceLevel).toBe(0);
    });
    it('does not invent growth for unavailable or completed places', () => {
        let island = initializeIslandGrowth(createIsland('child', 1), 1);
        expect(islandGrowthPreview(island, 'waterside')).toBeUndefined();
        for (let i = 1; i <= 6; i++) island = growIslandAfterCompletedSet({ ...island, completedSets: i }, 'garden', i);
        expect(islandGrowthPreview(island, 'garden')).toBeUndefined();
    });
});
