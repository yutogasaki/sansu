import { describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { ingestCompletions, newIsland } from './island';
import type { GrowingState } from './types';

const facts = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `answer-${i}`, at: i + 1 }));
const started = () => applyIntent(newIsland('economy-kid', 0), {
    id: 'starter', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } },
}).state;
const buyHome = (state: GrowingState) => applyIntent(state, {
    id: 'paid-home', command: { type: 'plant', kind: 'home', cell: { x: 4, z: 3 } },
}).state;

describe('twenty-question daily economy', () => {
    it('lets five answers buy a flower but requires twenty to add a home', () => {
        const five = ingestCompletions(started(), facts(5)).state;
        const decorated = applyIntent(five, { id: 'flower', command: { type: 'place', kind: 'flower', cell: { x: 4, z: 2 } } }).state;
        expect(decorated.drops).toBe(0);
        for (const count of [6, 10, 19]) {
            const state = ingestCompletions(started(), facts(count)).state;
            const snapshot = structuredClone(state);
            expect(() => buyHome(state)).toThrow('しずく');
            expect(state).toEqual(snapshot);
        }
        const twenty = ingestCompletions(started(), facts(20)).state;
        expect(twenty.drops).toBe(40);
        expect(twenty.town.clock + twenty.town.bank).toBe(40);
        expect(buyHome(twenty).drops).toBe(0);
    });

    it('retains old banked hours and pays only new completions at the new rate', () => {
        const state = started();
        state.drops = 123; state.town = { clock: 80, bank: 336 }; state.learned = ['answer-0'];
        const snapshot = structuredClone(state);
        expect(ingestCompletions(state, facts(1))).toEqual({ state, added: 0 });
        const updated = ingestCompletions(state, facts(2));
        expect(updated.added).toBe(1);
        expect(updated.state.drops).toBe(125);
        expect(updated.state.town).toEqual({ clock: 80, bank: 338 });
        expect(updated.state.plots).toEqual(state.plots);
        expect(updated.state.villagers).toEqual(state.villagers);
        expect(state).toEqual(snapshot);
    });

    it('refunds an old unbuilt home at its paid price and a new one at forty', () => {
        const old = started(); old.drops = 0;
        old.plots.push({ id: 'old-paid-home', kind: 'home', stage: 0, growth: 0, origin: 'seed', paid: 4,
            plantedAt: 0, cell: { x: 4, z: 3 } });
        expect(applyIntent(old, { id: 'cancel-old', command: { type: 'store', id: 'old-paid-home' } }).state.drops).toBe(4);
        const state = started(); state.drops = 40; state.town.bank = 0;
        const bought = buyHome(state), home = bought.plots.at(-1)!;
        expect(home.stage).toBe(0);
        expect(applyIntent(bought, { id: 'cancel-new', command: { type: 'store', id: home.id } }).state.drops).toBe(40);
    });
});
