import { describe, expect, it } from 'vitest';
import type { IslandGrowthMemory, IslandHabitatId } from '../../domain/island/types';
import { islandAlbumMemories, islandAlbumMemoryTitle, islandComparisonMemory } from './islandAlbumMemory';

const memory = (completedSets: number, habitatId?: IslandHabitatId, level?: number): IslandGrowthMemory => ({
    id: `memory-${completedSets}`, kind: completedSets === 0 ? 'initial' : habitatId ? 'upgrade' : 'expansion',
    capturedAt: completedSets, completedSets, habitatId, level, items: [], focus: 'garden',
    progress: { garden: Math.min(6, completedSets), waterside: Math.min(6, Math.max(0, completedSets - 6)),
        grove: Math.min(6, Math.max(0, completedSets - 12)), village: Math.min(6, Math.max(0, completedSets - 18)) },
});
const legacy = () => [memory(0), memory(1, 'garden', 1), memory(2), memory(3, 'garden', 2), memory(6, 'garden', 3),
    memory(7, 'waterside', 1), memory(9, 'waterside', 2), memory(12, 'waterside', 3), memory(13, 'grove', 1),
    memory(15, 'grove', 2), memory(18, 'grove', 3), memory(19, 'village', 1), memory(21, 'village', 2), memory(24, 'village', 3)];

describe('major growth album history', () => {
    it('presents the same major moments for old detailed histories and new sparse histories without rewriting either', () => {
        const memories = legacy(), before = structuredClone(memories);
        const major = islandAlbumMemories(memories, 'all');
        expect(major.map(entry => entry.completedSets)).toEqual([0, 2, 6, 12, 18, 24]);
        expect(islandAlbumMemories(major, 'all')).toEqual(major);
        expect(memories).toEqual(before);
        expect(major[1]).toBe(memories[2]);
    });

    it('shows each place baseline and maturity without unrelated or unchanged district records', () => {
        const memories = legacy();
        const expected = { garden: [0, 6], waterside: [2, 12], grove: [12, 18], village: [0, 24] };
        for (const habitat of Object.keys(expected) as IslandHabitatId[]) {
            expect(islandAlbumMemories(memories, habitat).map(entry => entry.completedSets)).toEqual(expected[habitat]);
            expect(islandComparisonMemory(memories, habitat)?.completedSets).toBe(expected[habitat][0]);
        }
        expect(islandComparisonMemory(memories, 'all')).toBe(memories[0]);
    });

    it('describes both major changes in a combined record, and only the relevant change within each place', () => {
        const memories = legacy(), combined = memories.find(entry => entry.completedSets === 12)!;
        expect(islandAlbumMemoryTitle(memories, combined, 'all')).toBe('みずべが にぎやかに なった・にしへ はしが つながった');
        expect(islandAlbumMemoryTitle(memories, combined, 'waterside')).toBe('みずべが にぎやかに なった');
        expect(islandAlbumMemoryTitle(memories, combined, 'grove')).toBe('にしへ はしが つながった');
        expect(islandAlbumMemoryTitle(memories, memories[0], 'garden')).toBe('はじめの にわ');
    });

    it('does not claim retrospective expansion or maturity for a migrated initial island', () => {
        const initial = { ...memory(20), kind: 'initial' as const, progress: { garden: 0, waterside: 0, grove: 0, village: 0 } };
        const minor = { ...initial, id: 'minor', kind: 'upgrade' as const, completedSets: 21, habitatId: 'garden' as const,
            level: 1, progress: { ...initial.progress, garden: 1 } };
        expect(islandAlbumMemories([initial, minor], 'all')).toEqual([initial]);
        expect(islandComparisonMemory([initial, minor], 'grove')).toBe(initial);
        expect(islandAlbumMemoryTitle([initial, minor], initial, 'grove')).toBe('はじめの 木かげ');
    });

    it('does not fabricate a baseline before a place exists or replace a missing snapshot', () => {
        expect(islandComparisonMemory([memory(0)], 'grove')).toBeUndefined();
        expect(islandComparisonMemory([], 'garden')).toBeUndefined();
    });

    it('uses each new snapshot’s saved land instead of its completed-set count', () => {
        const memories = [0, 2, 6, 12, 18, 24].map(sets => ({ ...memory(sets),
            expansionLevel: (sets < 6 ? 0 : sets < 12 ? 1 : 2) as 0 | 1 | 2 }));
        expect(islandAlbumMemories(memories, 'all').map(entry => entry.completedSets)).toEqual([0, 6, 12, 18, 24]);
        expect(islandComparisonMemory(memories, 'waterside')?.completedSets).toBe(6);
        expect(islandAlbumMemoryTitle(memories, memories[2], 'all')).toBe('おはなが いっぱいに なった・ひがしへ はしが つながった');
    });

    it('keeps an old eastern snapshot as the baseline after a new-format completion', () => {
        const memories = [memory(0), memory(2), { ...memory(6, 'garden', 3), expansionLevel: 1 as const }];
        const before = structuredClone(memories);
        expect(islandComparisonMemory(memories, 'waterside')).toBe(memories[1]);
        expect(islandAlbumMemoryTitle(memories, memories[2], 'all')).toBe('おはなが いっぱいに なった');
        expect(memories).toEqual(before);
    });
});
