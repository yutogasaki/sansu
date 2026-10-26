import { describe, expect, it } from 'vitest';
import { newIsland } from './island';
import { constellations, gearChain, mechanismProgress, tideLevel, windAngle } from './mechanisms';
import type { GrowingState } from './types';

const island = (theme: GrowingState['theme']) => { const state = newIsland('m', 0); state.theme = theme; state.landmarks = []; return state; };

describe('その島だけの仕掛け', () => {
    it('the tide is a little later each day, so the same clock time sees a different tide', () => {
        const day = 86_400_000, seven = Date.UTC(2026, 9, 27, 10);
        expect(tideLevel(seven)).not.toBeCloseTo(tideLevel(seven + day), 2);
        expect(tideLevel(seven + (12 * 60 + 25) * 60_000)).toBeCloseTo(tideLevel(seven), 6);
    });

    it('the wind keeps one direction for the whole day', () => {
        const state = island('watagumo'), noon = Date.UTC(2026, 9, 27, 3);
        expect(windAngle(state, noon)).toBe(windAngle(state, noon + 3_600_000));
    });

    it('clockwork: power runs from a water channel through things joined by their sides', () => {
        const state = island('karakuri');
        state.landmarks.push({ id: 'w', kind: 'water-channel', cell: { x: 0, z: 2 }, growth: 0 });
        ['a', 'b', 'c'].forEach((id, i) => state.landmarks.push({ id, kind: 'bench', cell: { x: 1 + i, z: 2 }, growth: 0 }));
        state.landmarks.push({ id: 'far', kind: 'bench', cell: { x: 5, z: 4 }, growth: 0 });
        expect(gearChain(state)).toHaveLength(4);
        expect(mechanismProgress(state)).toMatchObject({ done: false, have: 4, need: 5 });
        state.landmarks.push({ id: 'd', kind: 'flower', cell: { x: 4, z: 2 }, growth: 0 });
        expect(mechanismProgress(state)?.done).toBe(true);
    });

    it('stars: lights within two cells make a constellation; three of them complete the island', () => {
        const state = island('hoshi');
        state.landmarks.push({ id: 'l1', kind: 'lantern', cell: { x: 0, z: 0 }, growth: 0 }, { id: 'l2', kind: 'lantern', cell: { x: 2, z: 0 }, growth: 0 });
        expect(constellations(state)).toHaveLength(1);
        expect(mechanismProgress(state)?.done).toBe(false);
        state.landmarks.push({ id: 'l3', kind: 'lantern', cell: { x: 2, z: 2 }, growth: 0 });
        expect(mechanismProgress(state)?.done).toBe(true);
    });

    it('every theme reports what to try next, and the home island has none', () => {
        for (const theme of ['shiokaze', 'kodama', 'hikari', 'watagumo', 'karakuri', 'hoshi'] as const) expect(mechanismProgress(island(theme))?.next).toBeTruthy();
        expect(mechanismProgress(island(undefined))).toBeUndefined();
    });
});
