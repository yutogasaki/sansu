import { describe, expect, it } from 'vitest';
import { applyIntent, canReachHomePlacement, landQuote } from './commands';
import { comfort, housing, playSupport } from './community';
import { ingestCompletions, newIsland } from './island';
import { dayMoment, scheduleSurprise } from './moments';
import { advanceNature } from './nature';
import { landBounds, landCells } from './space';
import { openTown } from './town';
import type { Command, GrowingState } from './types';

const T0 = Date.UTC(2026, 8, 29, 7), DAY = 86_400_000;
let id = 0;
const act = (state: GrowingState, command: Command) => applyIntent(state, { id: `balance-${id++}`, command });
const started = () => act(newIsland('balance-kid', T0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } }).state;
const flowers = () => {
    const state = newIsland('batch', T0);
    state.landmarks = Array.from({ length: 6 }, (_, x) => ({ id: `flower-${x}`, kind: 'flower', cell: { x, z: 3 }, growth: 6 }));
    return state;
};
const blocked = () => {
    const state = newIsland('blocked', T0);
    state.tutorial = 'done';
    state.plots = [{ id: 'home', kind: 'home', cell: { x: 5, z: 4 }, stage: 1, plantedAt: 0, builtAt: 0, stagedAt: 0, growth: 0, origin: 'seed', paid: 4 }];
    state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 5, z: 3 }, growth: 0 },
        ...[1, 2, 3, 4].map(z => ({ id: `wall-${z}`, kind: 'fence' as const, cell: { x: 3, z }, growth: 0 }))];
    return state;
};

describe('continued island growth and retained learning', () => {
    it('extends all three sides after the existing five purchases without moving old objects', () => {
        let state = started();
        state.drops = 20000; state.genki.best = 40;
        const home = structuredClone(state.plots[0]);
        for (const side of ['east', 'west', 'south', 'east', 'west'] as const) state = act(state, { type: 'expand', side }).state;
        expect(landCells(state)).toHaveLength(144);
        state.genki.best = 0; // Further districts do not require an even higher level.
        for (const [index, side] of (['east', 'west', 'south', 'east'] as const).entries()) {
            expect(landQuote(state)).toEqual({ step: 6 + index, sides: ['east', 'west', 'south'], price: 1200 + 240 * index });
            state = act(state, { type: 'expand', side }).state;
        }
        expect(landBounds(state)).toEqual({ minX: -9, maxX: 17, depth: 11 });
        expect(state.plots[0]).toEqual(home);
        expect(state.land.districts).toEqual(['east', 'west', 'south', 'east']);
    });

    it('counts a repeated completion in one batch once, including a later replay', () => {
        const fact = { id: 'same', at: T0 };
        const first = ingestCompletions(newIsland('kid', T0), [fact, fact, { ...fact, at: T0 + 1 }]);
        expect(first.added).toBe(1);
        expect(first.state.drops).toBe(2);
        expect(first.state.town.bank).toBe(2);
        expect(ingestCompletions(first.state, [fact]).added).toBe(0);
    });

    it('retains a large batch, then uses it for seeds without another learning session', () => {
        const state = ingestCompletions(started(), Array.from({ length: 84 }, (_, i) => ({ id: `f-${i}`, at: T0 + i }))).state;
        openTown(state);
        const stopped = structuredClone(state.town);
        expect(stopped.bank).toBeGreaterThan(120);
        openTown(state);
        expect(state.town).toEqual(stopped);
        const planted = act(state, { type: 'plant', kind: 'home', cell: { x: 0, z: 3 } });
        expect(planted.state.plots[1].stage).toBeGreaterThan(0);
        expect(planted.state.villagers).toHaveLength(2);
        expect(planted.state.town.clock + planted.state.town.bank).toBe(168);
        const farm = act(planted.state, { type: 'plant', kind: 'farm', cell: { x: 4, z: 2 } });
        expect(farm.state.plots[2].stage).toBe(1);
        expect(farm.state.town.clock + farm.state.town.bank).toBe(168);
    });
});

describe('accessible homes and play', () => {
    it('keeps an unreachable home vacant, and welcomes after a path is restored with saved time', () => {
        let state = blocked(); state.town.bank = 100;
        expect(housing(state)).toEqual({ capacity: 1, housed: 0, vacancy: 0 });
        expect(playSupport(state)).toBe(2);
        openTown(state);
        expect(state.villagers).toHaveLength(0);
        expect(state.town).toEqual({ clock: 0, bank: 100 });
        state = act(state, { type: 'store', id: 'wall-2' }).state;
        expect(state.villagers).toHaveLength(1);
        expect(state.villagers[0].home).toBe('home');
    });

    it('keeps existing residents and unlocks when a home becomes isolated, but stops granting stars', () => {
        const state = blocked();
        state.villagers = [{ ...state.pier.visitor, id: 'resident', home: 'home', arrivedAt: 0 }];
        state.genki.best = 40;
        expect(comfort(state, state.villagers[0])).toBe(0);
        state.town.bank = 24; openTown(state);
        expect(state.villagers.map(v => v.id)).toEqual(['resident']);
        expect(state.genki.best).toBe(40);
    });

    it('rejects an inaccessible home placement before spending or moving it', () => {
        const state = blocked(); state.plots = []; state.drops = 20;
        const before = structuredClone(state);
        expect(canReachHomePlacement(state, { x: 5, z: 4 })).toBe(false);
        expect(() => act(state, { type: 'plant', kind: 'home', cell: { x: 5, z: 4 } })).toThrow('まわりを あけて');
        expect(state).toEqual(before);
    });
});

describe('one real-day surprise and durable pending presentation', () => {
    it('does not grant more draws for more learning or more openings', () => {
        const initial = flowers();
        const day = Array.from({ length: 30 }, (_, i) => i).find(i => dayMoment(initial, i))!;
        initial.nature.realAt = T0 + day * DAY;
        const first = scheduleSurprise(initial);
        expect(first).toHaveLength(1);
        for (let i = 0; i < 10; i++) {
            const learned = ingestCompletions(initial, [{ id: `more-${i}`, at: T0 + i }]).state;
            openTown(learned);
            expect(scheduleSurprise(learned)).toEqual(first);
        }
        const acknowledged = act(initial, { type: 'ack-moment', day }).state;
        expect(scheduleSurprise(acknowledged)).toEqual([]);
        expect(acknowledged.surprise?.day).toBe(day);
    });

    it('keeps unseen events through reload, later days and clock rollback, and checks the acknowledgement day', () => {
        const state = flowers();
        const day = Array.from({ length: 30 }, (_, i) => i).find(i => dayMoment(state, i))!;
        advanceNature(state, T0 + day * DAY);
        const event = scheduleSurprise(state);
        let loaded = structuredClone(state);
        advanceNature(loaded, T0 + 40 * DAY);
        expect(scheduleSurprise(loaded)).toEqual(event);
        loaded = act(loaded, { type: 'ack-moment', day: day + 1 }).state;
        expect(scheduleSurprise(loaded)).toEqual(event);
        loaded = act(loaded, { type: 'ack-moment', day }).state;
        advanceNature(loaded, T0 - DAY);
        scheduleSurprise(loaded);
        expect(loaded.surprise?.day).toBe(40);
        expect(loaded.surprise?.pending?.day ?? 40).toBe(40);
    });
});
