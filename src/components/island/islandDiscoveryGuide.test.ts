import { describe, expect, it } from 'vitest';
import { createIsland } from '../../domain/island/catalog';
import { growIslandAfterCompletedSet, ISLAND_DISCOVERIES } from '../../domain/island/growth';
import { ISLAND_HABITAT_IDS } from '../../domain/island/types';
import { firstIslandDiscovery, islandDiscoveryGuide, ISLAND_DISCOVERY_HINTS } from './islandDiscoveryHints';

function grownIsland() {
    let island = createIsland('guide-child', 1);
    for (const habitat of ISLAND_HABITAT_IDS) for (let step = 0; step < 6; step++) {
        island = growIslandAfterCompletedSet({ ...island, completedSets: island.completedSets + 1 }, habitat, 10 + island.completedSets);
    }
    return island;
}

describe('discovery guide keeps hints separate from observations', () => {
    it('covers every runtime discovery with a physical question and hint', () => {
        expect(Object.keys(ISLAND_DISCOVERY_HINTS).sort()).toEqual(ISLAND_DISCOVERIES.map(entry => entry.id).sort());
        expect(islandDiscoveryGuide(createIsland('child', 1), 'flower-scent')?.status).toBe('grow');
    });
    it('does not turn mature prerequisites or guide reads into discoveries or earnings', () => {
        const island = grownIsland(), before = structuredClone(island);
        for (const entry of ISLAND_DISCOVERIES) {
            const guide = islandDiscoveryGuide(island, entry.id);
            expect(guide?.seen).toBeUndefined();
            expect(guide?.status).not.toBe('grow');
        }
        expect(island).toEqual(before);
    });
    it('distinguishes a stored observed object from missing growth', () => {
        const island = grownIsland();
        const flower = island.items.find(item => item.kind === 'flower')!;
        flower.position = undefined;
        island.growth!.discoveries.push({ id: 'flower-scent', itemId: flower.id, discoveredAt: 50 });
        expect(islandDiscoveryGuide(island, 'flower-scent')).toMatchObject({ status: 'place', seen: { id: 'flower-scent' } });
        expect(firstIslandDiscovery(island, 'garden')).toBe('butterfly-visit');
    });
    it('predicts a real combination only when its supporting fountain is close enough', () => {
        const island = grownIsland();
        const flower = island.items.find(item => item.kind === 'flower')!;
        const fountain = island.items.find(item => item.kind === 'fountain')!;
        flower.position = { x: 0, z: 0 }; fountain.position = { x: 7, z: 0 };
        expect(islandDiscoveryGuide(island, 'petal-ripple')?.status).toBe('arrange');
        fountain.position = { x: 2.5, z: 0 };
        expect(islandDiscoveryGuide(island, 'petal-ripple')?.status).toBe('try');
    });
    it('keeps a first rare visit pending between offers and lets an observed one replay', () => {
        const island = grownIsland();
        const statuses = Array.from({ length: 4 }, (_, index) => islandDiscoveryGuide({ ...island, completedSets: 24 + index }, 'ribbon-butterfly')?.status);
        expect(statuses.filter(status => status === 'try')).toHaveLength(1);
        expect(statuses.filter(status => status === 'visit')).toHaveLength(3);
        const flower = island.items.find(item => item.kind === 'flower')!;
        island.growth!.discoveries.push({ id: 'ribbon-butterfly', itemId: flower.id, discoveredAt: 100 });
        for (let count = 24; count < 28; count++) expect(islandDiscoveryGuide({ ...island, completedSets: count }, 'ribbon-butterfly')?.status).toBe('try');
    });
    it('guides the same facing pair as the real sharing action, instead of promising an absent partner', () => {
        const island = grownIsland();
        const flower = island.items.find(item => item.kind === 'flower')!;
        const bench = island.items.find(item => item.kind === 'bench')!;
        flower.position = { x: 0, z: 0 }; bench.position = undefined;
        expect(islandDiscoveryGuide(island, 'flower-sharing')?.status).toBe('arrange');
        bench.position = { x: 0, z: -2 }; bench.rotation = Math.PI;
        expect(islandDiscoveryGuide(island, 'flower-sharing')?.status).toBe('arrange');
        bench.rotation = 0;
        expect(islandDiscoveryGuide(island, 'flower-sharing')?.status).toBe('try');
    });
    it('distinguishes future land from a place that can already grow', () => {
        let island = createIsland('guide-child', 1);
        island = growIslandAfterCompletedSet({ ...island, completedSets: 1 }, 'garden', 10);
        expect(islandDiscoveryGuide(island, 'butterfly-visit')).toMatchObject({ status: 'grow', unlocked: true });
        expect(islandDiscoveryGuide(island, 'leaf-boat')).toMatchObject({ status: 'grow', unlocked: false });
    });
});
