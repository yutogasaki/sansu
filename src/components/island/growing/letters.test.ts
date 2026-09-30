import { describe, expect, it } from 'vitest';
import { applyIntent, newIsland } from '../../../domain/growingIsland';
import { islandLetters } from './letters';

describe('letters from island friends', () => {
    it('arrive from what happened on the island, newest first, without saving anything new', () => {
        const state = applyIntent(newIsland('kid-l', 0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
        state.villagers.push({ id: 'ema', species: 'girl', name: 'えま', variant: { color: 0, accessory: 0, sparkle: false }, trait: 'lively', home: state.plots[0].id, arrivedAt: 30 });
        state.keepsakes.push({ id: 'k1', unitId: 'math:9' });
        state.landmarks.push({ id: 'g', kind: 'flower', cell: { x: 4, z: 4 }, growth: 6, from: 'はるか' });
        const letters = islandLetters(state);
        expect(letters.map(l => l.from)).toEqual(['はるか', 'ぽこもこ', 'えま', state.villagers[0].name]);
        expect(letters.find(l => l.from === 'えま')?.text).toContain('いっぱい あそぼうね');
        expect(letters.find(l => l.from === 'ぽこもこ')?.text).toContain('けいさんの ふんすい');
    });
});
