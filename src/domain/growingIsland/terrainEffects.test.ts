import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { dugWater, islandScores, soilTargetAt, sunnyHill } from './environment';
import { newIsland } from './island';
import { advanceNature } from './nature';
import { setTerrainForm } from './terraceTerrain';
import type { GrowingState } from './types';

afterEach(() => setTerrainForm('continuous'));

describe('what shaped ground does for the island', () => {
    const island = () => {
        setTerrainForm('terrace');
        const state = newIsland('effects', 0);
        state.tutorial = 'done';
        return state;
    };
    const stroke = (state: GrowingState, cells: { x: number; z: number }[], to: 'up' | 'sea', id: string) =>
        applyIntent(state, { id, command: { type: 'terrain-stroke', cells, to } }).state;

    it('dug water waters the soil nearby and counts as the island\'s water', () => {
        const before = island(), cell = { x: 1, z: 3 };
        const dry = soilTargetAt(before, cell), waterBefore = islandScores(before).water;
        const after = stroke(before, [{ x: 0, z: 4 }, { x: 1, z: 4 }], 'sea', 'cove');
        expect(dugWater(after)).toHaveLength(2);
        expect(soilTargetAt(after, cell)).toBeGreaterThan(dry);
        expect(islandScores(after).water).toBeGreaterThan(waterBefore);
    });

    it('a tree on a hill grows faster than one on the meadow', () => {
        let state = island();
        state = stroke(state, [{ x: 0, z: 1 }], 'up', 'hill');
        state.landmarks = [{ id: 'up', kind: 'sapling', cell: { x: 0, z: 1 }, growth: 0 }, { id: 'down', kind: 'sapling', cell: { x: 4, z: 2 }, growth: 0 }];
        expect(sunnyHill(state, { x: 0, z: 1 })).toBe(true);
        expect(sunnyHill(state, { x: 4, z: 2 })).toBe(false);
        advanceNature(state, state.nature.realAt + 6 * 3_600_000);
        const [up, down] = ['up', 'down'].map(id => state.landmarks.find(l => l.id === id)!.growth);
        expect(up).toBeGreaterThan(down);
    });
});
