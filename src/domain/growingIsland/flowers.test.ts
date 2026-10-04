import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { mixOf, recipeFor } from './flowers';
import { newIsland } from './island';
import { advanceNature } from './nature';
import type { GrowingState } from './types';

const T0 = Date.UTC(2026, 9, 1, 9), HOUR = 3_600_000;
let n = 0;
const act = (state: GrowingState, command: Parameters<typeof applyIntent>[1]['command']) => applyIntent(state, { id: `fl${n++}`, command }).state;

describe('flowers that mix', () => {
    it('follow a fixed recipe, and two mixed colours can make the polka-dot wonder flower', () => {
        expect(mixOf('red', 'yellow')).toBe('orange');
        expect(mixOf('yellow', 'red')).toBe('orange');
        expect(mixOf('red', 'red')).toBeUndefined();
        expect(mixOf('orange', 'purple')).toBe('wonder');
        expect(recipeFor('pink')).toEqual([['red', 'white']]);
    });

    it('lets children plant base colours only, and remembers each colour in the flower book', () => {
        let state = newIsland('kid-fl', T0);
        state.drops = 40;
        state = act(state, { type: 'place', kind: 'flower', cell: { x: 0, z: 3 }, color: 'yellow' });
        expect(state.landmarks.at(-1)).toMatchObject({ kind: 'flower', color: 'yellow' });
        expect(state.flowerBook).toEqual(['yellow']);
        expect(() => act(state, { type: 'place', kind: 'flower', cell: { x: 1, z: 4 }, color: 'orange' })).toThrow('まだ');
        expect(() => act(state, { type: 'place', kind: 'flower', cell: { x: 1, z: 4 }, color: 'blue' })).toThrow('まだ');
    });

    it('seeds a new colour between two bloomed flowers over the days, the same way every time', () => {
        const grow = () => {
            const state = newIsland('kid-fl', T0);
            state.landmarks.push({ id: 'r', kind: 'flower', cell: { x: 0, z: 4 }, growth: 6, color: 'red' },
                { id: 'y', kind: 'flower', cell: { x: 2, z: 4 }, growth: 6, color: 'yellow' });
            const events = [];
            for (let day = 1; day <= 7; day++) events.push(...advanceNature(state, T0 + day * 24 * HOUR));
            return { state, events };
        };
        const { state, events } = grow();
        const child = state.landmarks.find(l => l.color === 'orange');
        expect(child).toBeDefined();
        expect(events).toEqual(expect.arrayContaining([{ type: 'new-color', color: 'orange' }]));
        expect(state.flowerBook).toContain('orange');
        expect(grow().state.landmarks).toEqual(state.landmarks);
    });
});

describe('the bandstand', () => {
    it('opens at island level 2, takes one cell and counts as play', () => {
        let state = act(newIsland('kid-b', T0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });
        state.drops = 40;
        expect(() => act(state, { type: 'place', kind: 'bandstand', cell: { x: 4, z: 3 } })).toThrow('まだ');
        state.genki.best = 3; state.unlocked.push('landmark:bandstand');
        state = act(state, { type: 'place', kind: 'bandstand', cell: { x: 4, z: 3 } });
        expect(state.landmarks.at(-1)).toMatchObject({ kind: 'bandstand', cell: { x: 4, z: 3 } });
        expect(state.drops).toBe(10);
    });
});
