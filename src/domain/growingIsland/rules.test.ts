import { describe, expect, it } from 'vitest';
import type { LifeState } from '../islandLife/model';
import { applyIntent } from './commands';
import { comfort, foodSupport, housing, islandLevel } from './community';
import { islandCharacter, styleAt } from './environment';
import { fromLife, ingestCompletions, newIsland, waitingSeeds } from './island';
import { advanceNature, treeAge } from './nature';
import { boatInterval, boatProgress, docked, rareChance, rollVisitor } from './pier';
import { openTown } from './town';
import type { Cell, Command, GrowingState } from './types';

const T0 = Date.UTC(2026, 8, 29, 9);
const HOUR = 3_600_000;
let intentId = 0;
function act(state: GrowingState, command: Command) { return applyIntent(state, { id: `i${intentId++}`, command }); }
function learn(state: GrowingState, count: number, at = state.enrolledAt + 1) {
    const offset = state.learned.length;
    return ingestCompletions(state, Array.from({ length: count }, (_, i) => ({ id: `c${offset + i}`, at: at + i }))).state;
}
function started() {
    // Finish the first-home tutorial so the ordinary rules apply.
    const { state } = act(newIsland('kid-a', T0), { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });
    return state;
}
const at = (x: number, z: number): Cell => ({ x, z });

describe('a new island', () => {
    it('starts with a bloomed flower, a bench, and a first friend waiting on the pier', () => {
        const state = newIsland('kid-a', T0);
        expect(state.landmarks.map(l => l.kind)).toEqual(['flower', 'bench']);
        expect(['rabbit', 'otter']).toContain(state.pier.visitor.species);
        expect(state.villagers).toEqual([]);
        expect(state.unlocked).toEqual(expect.arrayContaining(['seed:home', 'seed:wild', 'landmark:flower']));
        expect(state.unlocked).not.toContain('seed:farm');
    });

    it('lets the first free home show the whole loop without learning', () => {
        const before = newIsland('kid-a', T0), friend = before.pier.visitor;
        const { state, events } = act(before, { type: 'plant', kind: 'home', cell: at(1, 3) });
        expect(state.drops).toBe(0);
        expect(state.plots[0]).toMatchObject({ kind: 'home', stage: 1 });
        expect(state.villagers[0]).toMatchObject({ species: friend.species, home: state.plots[0].id });
        expect(state.unopened).toEqual([state.plots[0].id]);
        expect(state.arrivals).toEqual([state.villagers[0].id]);
        expect(state.pier.visitor).toEqual(before.pier.next);
        expect(state.tutorial).toBe('done');
        expect(events.map(e => e.type)).toEqual(['built', 'arrived', 'unlocked']);
        expect(state.unlocked).toContain('seed:farm');
    });

    it('is the same island for the same child every time', () => {
        expect(newIsland('kid-a', T0).pier).toEqual(newIsland('kid-a', T0).pier);
    });
});

describe('learning', () => {
    it('adds two drops and two town hours per completion, once', () => {
        const state = started(), facts = [{ id: 'x', at: T0 + 1 }, { id: 'y', at: T0 + 2 }];
        const once = ingestCompletions(state, facts).state;
        expect(once.drops).toBe(4);
        expect(once.town.bank).toBe(4);
        expect(ingestCompletions(once, facts)).toEqual({ state: once, added: 0 });
    });

    it('ignores completions from before the island joined (already counted in migrated drops)', () => {
        const state = started();
        expect(ingestCompletions(state, [{ id: 'old', at: T0 - 1 }]).added).toBe(0);
    });
});

describe('seeds and building', () => {
    it('uses banked time to build a newly planted seed after six town hours', () => {
        let state = learn(started(), 6);
        const planted = act(state, { type: 'plant', kind: 'wild', cell: at(4, 2) });
        state = planted.state;
        expect(waitingSeeds(state)).toBe(0);
        const events = planted.events;
        expect(events).toContainEqual({ type: 'built', plotId: state.plots[1].id });
        expect(state.plots[1].stage).toBe(1);
        expect(state.town).toEqual({ clock: 12, bank: 0 });
    });

    it('waits without a bank of town time', () => {
        const prepared = learn(started(), 10);
        prepared.town.bank = 0;
        const state = act(prepared, { type: 'plant', kind: 'wild', cell: at(4, 2) }).state;
        openTown(state);
        expect(state.plots[1].stage).toBe(0);
    });

    it('does not build where nobody can walk, and says why', () => {
        let state = learn(started(), 40);
        // Fence in the far corner, then plant inside it.
        for (const cell of [at(4, 3), at(5, 3), at(4, 4)]) state = act(state, { type: 'place', kind: 'bench', cell }).state;
        state = act(state, { type: 'plant', kind: 'wild', cell: at(5, 4) }).state;
        state.town.bank = 12;
        const events = openTown(state);
        const plot = state.plots.find(p => p.cell?.x === 5 && p.cell.z === 4)!;
        expect(plot.stage).toBe(0);
        expect(events).toContainEqual({ type: 'blocked', reason: 'unreachable', plotId: plot.id });
    });

    it('takes the form of what is nearby when it is built', () => {
        let state = learn(started(), 10);
        state = act(state, { type: 'place', kind: 'water-bowl', cell: at(4, 2) }).state;
        expect(styleAt(state, at(4, 3))).toBe('water');
        expect(styleAt(state, at(0, 0))).toBe('plain');
    });

    it('refunds an unbuilt seed and keeps a built home with people in it', () => {
        let state = learn(started(), 5);
        state.town.bank = 0; // This test cancels a seed before any time is available.
        const before = state.drops;
        state = act(state, { type: 'plant', kind: 'wild', cell: at(4, 2) }).state;
        state = act(state, { type: 'store', id: state.plots[1].id }).state;
        expect(state.drops).toBe(before);
        expect(() => act(state, { type: 'store', id: state.plots[0].id })).toThrow('すんでいる');
    });

    it('applies the same tap only once', () => {
        const state = learn(started(), 5);
        const first = applyIntent(state, { id: 'tap', command: { type: 'plant', kind: 'wild', cell: at(4, 2) } }).state;
        const again = applyIntent(first, { id: 'tap', command: { type: 'plant', kind: 'wild', cell: at(4, 2) } });
        expect(again.state).toBe(first);
        expect(first.plots).toHaveLength(2);
    });
});

describe('moving in', () => {
    it('sails the next boat in with town time, then waits on the pier for a free home', () => {
        const state = learn(started(), 6);
        const first = openTown(state);
        expect(first).toContainEqual({ type: 'boat', hoursLeft: state.pier.dockAt - state.town.clock });
        expect(boatProgress(state)).toBeGreaterThan(0);
        expect(boatProgress(state)).toBeLessThan(.3);
        state.town.bank = state.pier.dockAt - state.town.clock;
        const second = openTown(state);
        expect(docked(state)).toBe(true);
        expect(state.villagers).toHaveLength(1);
        expect(second).toContainEqual({ type: 'blocked', reason: 'full' });
    });

    it('takes longer for each boat as the village grows', () => {
        expect(boatInterval(10)).toBeGreaterThan(boatInterval(2));
    });

    it('lets the second friend in on Pokomoko\'s basket, then needs farms for more', () => {
        let state = learn(started(), 60);
        state = act(state, { type: 'plant', kind: 'home', cell: at(0, 3) }).state;
        state = act(state, { type: 'plant', kind: 'home', cell: at(0, 4) }).state;
        openTown(state);
        expect(state.villagers).toHaveLength(2);
        expect(foodSupport(state)).toBe(2);
        // Well-liked tents also grow into huts, so there is room but not enough food.
        expect(housing(state).vacancy).toBeGreaterThanOrEqual(1);
        state.town.bank = 24;
        expect(openTown(state)).toContainEqual({ type: 'blocked', reason: 'food' });
        state = act(state, { type: 'plant', kind: 'farm', cell: at(5, 2) }).state;
        state.town.bank = 30;
        openTown(state);
        // One farm feeds two more friends: they arrive on the next dawns, no more than the food allows.
        expect(state.villagers.length).toBeGreaterThan(2);
        expect(state.villagers.length).toBeLessThanOrEqual(foodSupport(state));
    });

    it('does not let more learning draw more luck: the visitor for each boat is fixed', () => {
        const a = learn(started(), 6), b = learn(started(), 60);
        expect(a.pier).toEqual(b.pier);
        expect(rollVisitor(a, 7)).toEqual(rollVisitor(b, 7));
        expect(rareChance(a)).toBe(rareChance(b));
    });

    it('favors friends who match the island', () => {
        let state = learn(started(), 60);
        for (const cell of [at(4, 2), at(5, 2), at(4, 4), at(0, 1)]) state = act(state, { type: 'place', kind: 'water-bowl', cell }).state;
        expect(islandCharacter(state)).toBe('water');
        const species = Array.from({ length: 200 }, (_, i) => rollVisitor(state, i + 10).species);
        const watery = species.filter(s => s === 'otter' || s === 'duck').length;
        expect(watery / species.length).toBeGreaterThan(.4);
    });
});

describe('comfort and island genki', () => {
    it('gives a star for a liked thing, food and play near home', () => {
        const state = started(), friend = state.villagers[0];
        const stars = comfort(state, friend);
        expect(stars).toBeGreaterThanOrEqual(1);
        expect(stars).toBeLessThanOrEqual(3);
    });

    it('keeps the best level even when stars go down', () => {
        const state = learn(started(), 6);
        state.genki.best = 20;
        openTown(state);
        expect(islandLevel(state)).toBe(4);
    });
});

describe('nature', () => {
    it('grows a flower in real time and caps an absence at seven days', () => {
        let state = learn(started(), 10);
        state = act(state, { type: 'place', kind: 'flower', cell: at(4, 2) }).state;
        state.nature.realAt = T0;
        advanceNature(state, T0 + 3 * HOUR);
        const flower = state.landmarks.find(l => l.cell?.x === 4)!;
        expect(flower.growth).toBeGreaterThan(2.9);
        advanceNature(state, T0 + 400 * 24 * HOUR);
        expect(state.nature.hours).toBeCloseTo(3 + 168, 5);
    });

    it('treats a clock moved backwards as no time', () => {
        const state = started();
        const hours = state.nature.hours;
        advanceNature(state, T0 - 10 * HOUR);
        expect(state.nature.hours).toBe(hours);
    });

    it('ages a mature tree into a big tree and a lord tree', () => {
        let state = learn(started(), 10);
        state = act(state, { type: 'place', kind: 'sapling', cell: at(4, 2) }).state;
        const id = state.landmarks.find(l => l.kind === 'sapling')!.id;
        const events = [...advanceNature(state, T0 + 20 * HOUR)];
        expect(treeAge(state, id)).toBe('mature');
        for (let day = 1; day <= 31; day++) events.push(...advanceNature(state, T0 + (20 + day * 24) * HOUR));
        expect(events.map(e => e.type)).toEqual(expect.arrayContaining(['matured', 'big-tree', 'lord-tree']));
        expect(treeAge(state, id)).toBe('lord');
    });

    it('spreads wild flowers on damp soil, never past the share limit, the same way every time', () => {
        const grow = () => {
            let state = learn(started(), 20);
            state = act(state, { type: 'place', kind: 'water-bowl', cell: at(4, 2) }).state;
            state = act(state, { type: 'plant', kind: 'wild', cell: at(4, 3) }).state;
            // The longer crossing uses the first learning batch; learn enough to build this new seed.
            state = learn(state, 3); openTown(state);
            expect(state.plots.find(p => p.kind === 'wild')?.stage).toBe(1);
            for (let day = 1; day <= 30; day++) advanceNature(state, T0 + day * 24 * HOUR);
            return state;
        };
        const a = grow(), b = grow();
        const wild = a.plots.filter(p => p.kind === 'wild');
        expect(wild.length).toBeGreaterThan(1);
        expect(wild.length).toBeLessThanOrEqual(Math.floor(30 * .4));
        expect(a.plots).toEqual(b.plots);
    });
});

describe('land', () => {
    it('charges 120/240/480 for new land and opens capes with the island level', () => {
        let state = started();
        state.drops = 2000;
        state = act(state, { type: 'expand', side: 'east' }).state;
        state = act(state, { type: 'expand', side: 'west' }).state;
        state = act(state, { type: 'expand', side: 'south' }).state;
        expect(state.drops).toBe(2000 - 120 - 240 - 480);
        expect(() => act(state, { type: 'expand', side: 'east' })).toThrow();
        state.genki.best = 25;
        state = act(state, { type: 'expand', side: 'east' }).state;
        expect(state.land.capes).toEqual(['east']);
    });
});

describe('moving from the current island', () => {
    it('copies land, items, drops and friends without changing them', () => {
        const life = {
            drops: 17, light: 5, expanded: 'east', extraLand: ['west'], soilMoisture: { '1,1': .4 },
            items: [{ id: 'old-flower', kind: 'flower', cell: { x: 4, z: 3 }, growth: 6, style: 'original' },
                { id: 'old-tree', kind: 'sapling', cell: { x: 6, z: 2 }, growth: 18, style: 'original' },
                { id: 'stored-swing', kind: 'swing', growth: 0, style: 'original' }],
            residents: [{ id: 'pokomoko' }, { id: 'rabbit' }, { id: 'otter' }],
        } as unknown as LifeState;
        const state = fromLife(life, 'kid-b', T0);
        expect(state.drops).toBe(17);
        expect(state.legacyLight).toBe(5);
        expect(state.land).toEqual({ expanded: 'east', extra: ['west'], capes: [] });
        expect(state.landmarks.map(l => [l.id, l.cell])).toEqual([['old-flower', { x: 4, z: 3 }], ['old-tree', { x: 6, z: 2 }], ['stored-swing', undefined]]);
        expect(state.villagers.map(v => [v.species, v.home])).toEqual([['rabbit', 'pokomoko'], ['otter', 'pokomoko']]);
        expect(housing(state)).toEqual({ capacity: 0, housed: 0, vacancy: 0 });
        expect(state.soil['1,1']).toBe(.4);
        expect(state.tutorial).toBe('done');
        expect(treeAge(state, 'old-tree')).toBe('mature');
    });
});
