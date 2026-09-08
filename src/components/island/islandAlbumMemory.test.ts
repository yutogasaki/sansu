import { describe, expect, it } from 'vitest';
import type { IslandGrowthMemory } from '../../domain/island/types';
import { islandComparisonMemory } from './islandAlbumMemory';

const memory = (completedSets: number): IslandGrowthMemory => ({ id: `memory-${completedSets}`, kind: completedSets === 0 ? 'initial' : 'expansion',
    capturedAt: completedSets, completedSets, items: [], focus: 'garden', progress: { garden: 0, waterside: 0, grove: 0, village: 0 } });
describe('album comparison starting memory', () => {
    it('uses the first existing east/west place, while garden, home and whole-island keep the selected history', () => {
        const memories = [memory(0), memory(2), memory(6), memory(12), memory(18)];
        expect(islandComparisonMemory(memories, memories[0], 'waterside')).toBe(memories[1]);
        expect(islandComparisonMemory(memories, memories[0], 'grove')).toBe(memories[3]);
        for (const place of ['garden', 'village', 'all'] as const) expect(islandComparisonMemory(memories, memories[0], place)).toBe(memories[0]);
        expect(islandComparisonMemory(memories, memories[4], 'grove')).toBe(memories[4]);
        expect(memories.map(entry => entry.completedSets)).toEqual([0, 2, 6, 12, 18]);
    });
    it('does not fabricate a snapshot when no historical place exists', () => {
        const initial = memory(0);
        expect(islandComparisonMemory([initial], initial, 'grove')).toBe(initial);
        expect(islandComparisonMemory([], undefined, 'waterside')).toBeUndefined();
    });
});
