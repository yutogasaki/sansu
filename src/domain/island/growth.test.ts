import { describe, expect, it } from 'vitest';
import { createIsland, isValidIslandPlacement } from './catalog';
import { getIslandGrowthTarget, getIslandHabitatLevel, growIslandAfterCompletedSet, initializeIslandGrowth,
    isIslandGrowthComplete, isIslandHabitatUnlocked } from './growth';
import { assertIsland } from './repository';
import { ISLAND_HABITAT_IDS, type IslandRecord } from './types';

const next = (island: IslandRecord) => growIslandAfterCompletedSet({ ...island, completedSets: island.completedSets + 1 },
    getIslandGrowthTarget(island), island.completedSets + 1);

describe('finite living island growth', () => {
    it('grows all four places through 1/3/6 sets, changes district size and stops issuing objects when mature', () => {
        let island = createIsland('child', 0);
        expect(island.items).toHaveLength(2);
        expect(island.growth?.memories).toHaveLength(1);
        for (let completed = 1; completed <= 36; completed++) {
            const before = structuredClone(island);
            const target = getIslandGrowthTarget(island);
            island = next(island);
            expect(island.completedSets).toBe(completed);
            expect(island.pendingRewards).toEqual([]);
            expect(island.growth!.progress[target]).toBe(Math.min(6, before.growth!.progress[target] + 1));
            expect(island.growth!.discoveries).toEqual([]);
            expect(island.growth!.memories.slice(0, before.growth!.memories.length)).toEqual(before.growth!.memories);
            expect(island.items).toHaveLength(completed >= 12 ? 7 : completed >= 2 ? 5 : 3);
            expect(() => assertIsland(island)).not.toThrow();
            for (const item of island.items) expect(isValidIslandPlacement(island, item.id, item.position!, item.rotation)).toBe(true);
            if (completed === 1) expect(getIslandHabitatLevel(island, 'garden')).toBe(1);
            if (completed === 2) expect(getIslandHabitatLevel(island, 'garden')).toBe(1);
            if (completed === 3) expect(getIslandHabitatLevel(island, 'garden')).toBe(2);
            if (completed === 6) expect(getIslandGrowthTarget(island)).toBe('waterside');
            if (completed === 12) expect(getIslandGrowthTarget(island)).toBe('grove');
            if (completed === 18) expect(getIslandGrowthTarget(island)).toBe('village');
        }
        expect(isIslandGrowthComplete(island)).toBe(true);
        expect(ISLAND_HABITAT_IDS.every(id => getIslandHabitatLevel(island, id) === 3)).toBe(true);
        expect(island.growth?.memories.filter(memory => memory.kind === 'upgrade')).toHaveLength(12);
        expect(island.growth?.memories.at(-1)?.completedSets).toBe(24);
    });

    it('keeps stored objects, edited positions and old appearances while upgrading earned uses', () => {
        let island = next(createIsland('child', 0));
        const memories = structuredClone(island.growth!.memories);
        island.items = island.items.map(item => item.id === 'starter-flower'
            ? { ...item, position: undefined, appearanceLevel: 0, rotation: Math.PI }
            : item.id === 'living-bench' ? { ...item, position: { x: -.1, z: 1.2 }, rotation: .45 } : item);
        while (island.completedSets < 12) island = next(island);
        expect(island.items.find(item => item.id === 'starter-flower')).toMatchObject({ position: undefined, growthLevel: 3, appearanceLevel: 0, rotation: Math.PI });
        expect(island.items.find(item => item.id === 'living-bench')).toMatchObject({ position: { x: -.1, z: 1.2 }, rotation: .45, growthLevel: 3 });
        expect(island.growth!.memories.slice(0, memories.length)).toEqual(memories);
        expect(island.completedSets).toBe(12);
        expect(isIslandHabitatUnlocked(island, 'grove')).toBe(true);
    });

    it('migrates legacy ownership additively without granting retrospective credit or moving any object', () => {
        const legacy = createIsland('child', 0);
        delete legacy.growth;
        legacy.completedSets = 20;
        legacy.items = [{ id: 'old-flower', kind: 'flower', rotation: 1 }, { id: 'old-seat', kind: 'bench', position: { x: 0, z: 2 }, rotation: 2 }];
        legacy.pendingRewards = [{ id: 'old-gift', planId: 'old', choices: ['flower', 'bench', 'lantern'], earnedAt: 1 }];
        const before = structuredClone(legacy);
        const initialized = initializeIslandGrowth(legacy, 21);
        expect(legacy).toEqual(before);
        expect(initialized.items.map(({ id, kind, position, rotation }) => ({ id, kind, position, rotation })))
            .toEqual(before.items.map(({ id, kind, position, rotation }) => ({ id, kind, position, rotation })));
        expect(initialized.growth!.progress).toEqual({ garden: 0, waterside: 0, grove: 0, village: 0 });
        const grown = next(initialized);
        expect(grown.pendingRewards).toEqual(before.pendingRewards);
        expect(grown.items.filter(item => item.kind === 'flower')).toHaveLength(1);
        expect(grown.items.filter(item => item.kind === 'bench')).toHaveLength(1);
        expect(grown.items.find(item => item.id === 'old-flower')?.position).toBeUndefined();
        expect(grown.items.find(item => item.id === 'old-seat')?.position).toEqual({ x: 0, z: 2 });
    });

    it('saves growth and a stored placeable anchor when old possessions leave no empty ground', () => {
        const island = createIsland('child', 0);
        for (let x = -4; x <= 4; x += .5) for (let z = -3; z <= 3; z += .5) {
            island.items.push({ id: `old-${x}-${z}`, kind: 'flower', position: { x, z }, rotation: 0 });
        }
        const before = structuredClone(island.items);
        const grown = next(island);
        expect(grown.growth?.progress.garden).toBe(1);
        expect(grown.items.slice(0, before.length)).toEqual(before.map(item => item.id === 'starter-flower'
            ? { ...item, growthLevel: 1 } : item));
        expect(grown.items.at(-1)).toMatchObject({ id: 'living-bench', growthLevel: 1, autoPlacementBlocked: true });
        expect(grown.items.at(-1)?.position).toBeUndefined();
        expect(next(grown).items.find(item => item.id === 'living-bench')?.position).toBeUndefined();
    });

    it('rejects malformed progress, future appearances, duplicate memories and unknown discoveries', () => {
        const island = next(createIsland('child', 0));
        for (const mutate of [
            (value: IslandRecord) => { value.growth!.progress.garden = 7; },
            (value: IslandRecord) => { value.items[0].appearanceLevel = 2; },
            (value: IslandRecord) => { value.growth!.memories.push(value.growth!.memories[0]); },
            (value: IslandRecord) => { value.growth!.discoveries.push({ id: 'fake', itemId: 'starter-flower', discoveredAt: 2 }); },
        ]) {
            const invalid = structuredClone(island); mutate(invalid);
            expect(() => assertIsland(invalid)).toThrow('Invalid island');
        }
        expect(isValidIslandPlacement({ ...island, completedSets: 11 }, island.items[0].id, { x: -6.2, z: 0 })).toBe(false);
        expect(isValidIslandPlacement({ ...island, completedSets: 12 }, island.items[0].id, { x: -6.2, z: 0 })).toBe(true);
    });
});
