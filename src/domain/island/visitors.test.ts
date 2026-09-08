import { describe, expect, it } from 'vitest';
import { availableIslandVisitorIds, ISLAND_VISITORS, islandVisitorAvailability } from './visitors';
import type { IslandLivingScene } from './livingSettings';

const island = (): IslandLivingScene => ({ completedSets: 24,
    items: [
        { id: 'flower', kind: 'flower', habitatId: 'garden', growthLevel: 2, position: { x: 1.5, z: .8 }, rotation: 0 },
        { id: 'fountain', kind: 'fountain', habitatId: 'waterside', growthLevel: 2, position: { x: 3.4, z: 1.3 }, rotation: 0 },
        { id: 'mushroom', kind: 'mushroom', habitatId: 'grove', growthLevel: 2, position: { x: -5.8, z: 1.3 }, rotation: 0 },
    ], growth: { version: 1, expansionLevel: 2, progress: { garden: 3, waterside: 3, grove: 3, village: 0 }, focus: 'garden', discoveries: [], memories: [] } });

describe('stable extra visitor opportunities', () => {
    it('offers every eligible visitor once per four saved counts, including block boundaries', () => {
        for (const visitor of ISLAND_VISITORS) for (let start = 24; start < 32; start++) {
            const state = island(), item = state.items.find(candidate => candidate.kind === visitor.kind)!;
            const opportunities = Array.from({ length: 4 }, (_, i) => islandVisitorAvailability({ ...state, completedSets: start + i }, visitor.id, item.id));
            expect(opportunities.filter(opportunity => opportunity.offered)).toHaveLength(1);
            expect(opportunities.every(opportunity => opportunity.nextInSets >= 0 && opportunity.nextInSets <= 3)).toBe(true);
        }
    });
    it('reloads and repeated observation checks do not reroll or record discoveries', () => {
        const state = island(), original = JSON.stringify(state), first = availableIslandVisitorIds(state);
        for (let i = 0; i < 50; i++) expect(availableIslandVisitorIds(JSON.parse(original))).toEqual(first);
        expect(JSON.stringify(state)).toBe(original);
        expect(state.growth!.discoveries).toEqual([]);
    });
    it('replays a discovered visitor at any section while keeping its real host conditions', () => {
        for (const visitor of ISLAND_VISITORS) {
            const state = island(), item = state.items.find(candidate => candidate.kind === visitor.kind)!;
            state.growth!.discoveries = [{ id: visitor.id, itemId: item.id, discoveredAt: 1 }];
            for (const completedSets of [24, 25, 26, 27]) expect(islandVisitorAvailability({ ...state, completedSets }, visitor.id, item.id).offered).toBe(true);
            expect(islandVisitorAvailability(state, visitor.id, 'unrelated')).toMatchObject({ eligible: false, offered: false });
            item.position = undefined;
            expect(islandVisitorAvailability(state, visitor.id, item.id).offered).toBe(false);
        }
    });
    it('requires both earned habitat stage and the correct placed host, including actual shade', () => {
        const state = island();
        state.growth!.discoveries = ISLAND_VISITORS.map(visitor => ({ id: visitor.id, itemId: 'old', discoveredAt: 1 }));
        expect(availableIslandVisitorIds(state)).toHaveLength(3);
        state.growth!.progress.garden = 1;
        state.items[1].growthLevel = 1;
        state.items[2].position = { x: 6, z: 0 };
        expect(availableIslandVisitorIds(state)).toEqual([]);
    });
});
