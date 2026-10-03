import { describe, expect, it } from 'vitest';
import { applyIntent, newIsland } from '../../../domain/growingIsland';
import { placementName } from './placementName';

const T0 = Date.UTC(2026, 9, 4);

describe('placement confirmation item names', () => {
    it('tracks the current seed and colored flower without carrying an earlier choice forward', () => {
        const state = newIsland('placement-name', T0);
        expect(placementName(state, { mode: 'new', seed: true, kind: 'home' })).toBe('すむの たね');
        expect(placementName(state, { mode: 'new', seed: true, kind: 'farm' })).toBe('たべるの たね');
        expect(placementName(state, { mode: 'new', seed: true, kind: 'festival' })).toBe('おまつり ひろばの たね');
        expect(placementName(state, { mode: 'new', seed: true, kind: 'wonder' })).toBe('ふしぎの たね');
        expect(placementName(state, { mode: 'new', seed: false, kind: 'flower', color: 'red' })).toBe('あかの はな');
        expect(placementName(state, { mode: 'new', seed: false, kind: 'flower', color: 'blue' })).toBe('あおの はな');
    });

    it('names the actual owned object for free moves and restores', () => {
        const state = applyIntent(newIsland('placement-name', T0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
        const home = state.plots[0];
        expect(home.stage).toBe(1);
        expect(placementName(state, { mode: 'move', seed: true, kind: 'home', id: home.id })).toBe('テント');
        expect(placementName(state, { mode: 'move', seed: false, kind: 'bench', id: 'starter-bench' })).toBe('ベンチ');
        expect(placementName(state, { mode: 'unstore', seed: false, kind: 'bench', id: 'starter-bench' })).toBe('ベンチ');
        expect(placementName(state, { mode: 'unstore', seed: false, kind: 'flower', keepsake: 'math:1' })).toBe('かずの つみき');
        expect(placementName(state, { mode: 'new', seed: true, kind: 'farm' })).toBe('たべるの たね');
    });
});
