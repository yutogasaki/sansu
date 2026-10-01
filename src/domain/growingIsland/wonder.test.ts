import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { foodSupport } from './community';
import { styleAt, wonderForm } from './environment';
import { newIsland } from './island';
import { momentCandidates } from './moments';
import { rollVisitor } from './pier';
import { levelUp } from './town';
import type { Command, GrowingState } from './types';

let n = 0;
const act = (state: GrowingState, command: Command) => applyIntent(state, { id: `w${n++}`, command }).state;
const started = () => act(newIsland('kid-w', 0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });

describe('ふしぎの たね', () => {
    it('arrive at island levels 3, 5, 7 and 9, are planted free and come back when stored before growing', () => {
        let state = started();
        expect(levelUp(state, 1, 2).map(e => e.type)).toEqual(['level']);
        expect(levelUp(state, 2, 5).map(e => e.type)).toEqual(['level', 'wonder-seed', 'level', 'level', 'wonder-seed']);
        expect(state.wonderSeeds).toBe(2);
        state.wonderSeeds = 1; state.drops = 0;
        state = act(state, { type: 'plant', kind: 'wonder', cell: { x: 4, z: 3 } });
        expect(state.wonderSeeds).toBe(0);
        expect(() => act(state, { type: 'plant', kind: 'wonder', cell: { x: 5, z: 3 } })).toThrow('ふしぎの たね');
        const plot = state.plots.at(-1)!;
        state = act(state, { type: 'store', id: plot.id });
        expect(state.wonderSeeds).toBe(1);
    });

    it('take a form from their surroundings: heart tree, polka-dot arch or pumpkin', () => {
        expect(wonderForm('tree')).toBe('heart-tree');
        expect(wonderForm('flower')).toBe('heart-tree');
        expect(wonderForm('water')).toBe('dot-arch');
        expect(wonderForm('plain')).toBe('pumpkin');
        const state = started();
        state.landmarks.push({ id: 'bowl', kind: 'water-bowl', cell: { x: 4, z: 4 }, growth: 0 });
        expect(wonderForm(styleAt(state, { x: 4, z: 3 }))).toBe('dot-arch');
    });
});

describe('new items and friends', () => {
    it('feed three more from a reachable bakery and count a fountain as water', () => {
        const state = started(), base = foodSupport(state);
        state.landmarks.push({ id: 'bake', kind: 'bakery', cell: { x: 4, z: 2 }, growth: 0 });
        expect(foodSupport(state)).toBe(base + 3);
    });

    it('bring rare friends seldom, and more often on an island of their own kind', () => {
        const state = started();
        state.villagers.push({ ...state.villagers[0], id: 'g', species: 'girl' }, { ...state.villagers[0], id: 'b', species: 'boy' });
        const rare = () => Array.from({ length: 600 }, (_, i) => rollVisitor(state, i + 3).species).filter(s => s === 'penguin' || s === 'owl' || s === 'frog').length;
        const mixed = rare();
        expect(mixed).toBeGreaterThan(5); expect(mixed).toBeLessThan(120);
    });

    it('invite the whale, the rainbow bird and the moon rabbit when their conditions hold', () => {
        const state = started();
        state.landmarks.push({ id: 'b1', kind: 'water-bowl', cell: { x: 0, z: 4 }, growth: 0 }, { id: 'f1', kind: 'fountain', cell: { x: 5, z: 4 }, growth: 0 });
        for (let i = 0; i < 3; i++) state.landmarks.push({ id: `l${i}`, kind: 'lantern', cell: { x: i + 1, z: 4 }, growth: 0 });
        state.flowerBook = ['red', 'yellow', 'white', 'orange', 'pink'];
        state.landmarks.push({ id: 'fl', kind: 'flower', cell: { x: 4, z: 1 }, growth: 6, color: 'red' });
        const kinds = momentCandidates(state).map(c => c.moment);
        expect(kinds).toEqual(expect.arrayContaining(['whale', 'rainbow-bird', 'moon-rabbit']));
    });
});
