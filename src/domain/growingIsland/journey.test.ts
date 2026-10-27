import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { starterStep } from './guidance';
import { editableTerracePlan } from './editableTerrainWorld';
import { newIsland } from './island';
import { adoptSpecies, chooseTheme, confirmedMathLevel, confirmedVocabLevel, passedLevel, grantRoutes, neighbors, nextIsland, noteJourney, noteLevels, placeOf, secondSpeciesReady, shoalStage, themesLeft, THEMES, type ThemeId } from './journey';
import { GrowingIslandDatabase, sailGrowingIsland, type GrowingRecord } from './repository';
import { setTerrainForm } from './terraceTerrain';
import { carrySharedResources, makeVoyageIsland } from './voyages';
import { THEME_INFO } from './journey';
const THEME_INFO_FIRST = (theme: ThemeId) => THEME_INFO[theme].first;
import { readable } from './syncProjection';
import { confirmedKokugoLevel, unitConfirmed } from '../kokugo/levels';
import { itemsForUnit } from '../kokugo/catalog';
import { emptyProgress } from '../kokugo/evaluation';
import type { GrowingState } from './types';

const now = 1_800_000_000_000;
const dbs: Dexie[] = [];
afterEach(async () => { setTerrainForm('continuous'); await Promise.all(dbs.splice(0).map(db => db.delete())); });
const welcomed = (state: GrowingState) => { state.villagers.push({ ...state.pier.visitor, id: 'v1', arrivedAt: 0 } as never); state.arrivals = []; return state; };

describe('confirmed learning levels (read only)', () => {
    it('counts only levels passed by the official level-up test, never a level set in settings', () => {
        const pass = (subject: string, level: number, passed = true) => ({ kind: 'finish', subject, level, passed });
        expect(passedLevel(undefined, 'math')).toBe(0);
        expect(passedLevel([pass('math', 8), pass('math', 9, false), { kind: 'periodic', subject: 'math', level: 20, passed: true }, pass('vocab', 3)], 'math')).toBe(8);
        // Math Lv5 ends at internal level 8; passing 8 confirms Lv1–5.
        expect(confirmedMathLevel(8)).toBe(5);
        expect(confirmedMathLevel(7)).toBe(4);
        // Starting high, the first passed level-up covers everything below it for the routes.
        expect(confirmedMathLevel(14)).toBe(9);
        expect(confirmedMathLevel(28)).toBe(20);
        expect(confirmedVocabLevel(passedLevel([pass('vocab', 2)], 'vocab'))).toBe(2);
    });

    it('kokugo confirms a Lv only when every form of every unit in it is confirmed', () => {
        const confirmedRow = (unitId: string) => [...new Map(itemsForUnit(unitId).map(item => [`${item.target}:${item.form}:${item.mode}`, item])).values()]
            .map(item => ({ ...emptyProgress('child', item), independentItems: ['a', 'b', 'c'], independentFamilies: ['x', 'y'], independentConditions: ['基本例', '動き', '様子', '名前'] }));
        expect(confirmedKokugoLevel([])).toBe(0);
        const k01 = confirmedRow('K01');
        expect(unitConfirmed('K01', k01)).toBe(true);
        expect(confirmedKokugoLevel(k01)).toBe(0);
        expect(confirmedKokugoLevel([...k01, ...confirmedRow('V01')])).toBe(1);
        // One form short of a unit is not the unit.
        expect(unitConfirmed('K01', k01.slice(1))).toBe(false);
    });
});

const friends = (state: GrowingState, n: number) => { for (let i = 0; i < n; i++) state.villagers.push({ ...state.pier.visitor, id: `f${i}`, arrivedAt: 0 } as never); state.arrivals = []; return state; };
const widened = (state: GrowingState) => { state.land.expanded = 'west'; state.land.extra = ['east', 'south']; return state; };
const grove = (state: GrowingState, n = 3) => { for (let i = 0; i < n; i++) state.landmarks.push({ id: `t${i}`, kind: 'sapling', cell: { x: i, z: 4 }, growth: 99 }); return state; };
const grown = (state: GrowingState) => grove(widened(friends(state, 5)));

describe('the shoal and the next island (island-journey.md §3.6)', () => {
    it('grows one step for each of learning, land and life, and becomes an island only with all three', () => {
        const state = welcomed(newIsland('child', now));
        // The first friend no longer opens a route.
        expect(grantRoutes(state, undefined, now)).toEqual([]);
        expect(shoalStage(state)).toBe(0);
        expect(grantRoutes(state, { math: 2, vocab: 0, kokugo: 0 }, now)).toEqual([]);
        noteLevels(state, { math: 2, vocab: 0, kokugo: 0 });
        expect(shoalStage(state)).toBe(1);
        expect(state.journey!.shoal!.at).toBeDefined();
        widened(state);
        expect(grantRoutes(state, undefined, now)).toEqual([]);
        expect(shoalStage(state)).toBe(2);
        friends(grove(state), 5);
        expect(grantRoutes(state, undefined, now)).toEqual([{ type: 'route', slot: 1 }]);
        expect(shoalStage(state)).toBe(3);
        expect(state.journey!.routes.map(route => route.reason)).toEqual(['math:2']);
        expect(nextIsland(state)).not.toBe('shiokaze');
        expect(grantRoutes(state, undefined, now)).toEqual([]);
    });

    it('counts land and life only on the newest island, and keeps them once met', () => {
        const state = grown(welcomed(newIsland('child', now)));
        noteLevels(state, { math: 13, vocab: 0, kokugo: 0 });
        grantRoutes(state, undefined, now);
        const first = nextIsland(state)!;
        chooseTheme(state, first, 'one');
        expect(state.journey!.shoal).toBeUndefined();
        // Home is big and lively, but the newest island is now the special one: only learning counts here.
        grantRoutes(state, undefined, now);
        expect(shoalStage(state)).toBe(1);
        const there = { ...structuredClone(state), theme: first, land: { extra: [], capes: [] }, villagers: [], landmarks: [] } as GrowingState;
        grantRoutes(widened(there), undefined, now);
        expect(shoalStage(there)).toBe(2);
        there.land = { extra: [], capes: [] };
        grantRoutes(there, undefined, now);
        expect(shoalStage(there)).toBe(2);
    });

    it('becomes the island the newest island grew toward; ties follow the child\'s own order', () => {
        const trees = grown(welcomed(newIsland('child', now)));
        grove(trees, 8);
        noteLevels(trees, { math: 2, vocab: 0, kokugo: 0 });
        grantRoutes(trees, undefined, now);
        expect(nextIsland(trees)).toBe('kodama');
        const picks = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(seed => {
            const state = welcomed(newIsland(seed, now)); state.seed = seed;
            state.journey = { routes: [{ slot: 1, reason: 'math:2', at: now }], chosen: [], species: [] };
            return nextIsland(state);
        }));
        expect(picks.size).toBeGreaterThan(1);
    });

    it('turns an old open slot into a ready shoal, never brings the shiokaze island, and brings five at most', () => {
        const state = welcomed(newIsland('child', now));
        state.journey = { routes: [{ slot: 0, reason: 'first-friend', at: now }], chosen: [], species: [] };
        expect(shoalStage(state)).toBe(3);
        expect(() => chooseTheme(state, 'shiokaze', 'x')).toThrow();
        const made: ThemeId[] = [];
        noteLevels(state, { math: 20, vocab: 0, kokugo: 0 });
        for (let i = 0; i < 5; i++) {
            const theme = nextIsland(state) ?? (grantRoutes(grown(state), undefined, now), nextIsland(state))!;
            chooseTheme(state, theme, `i${i}`); made.push(theme);
            state.theme = theme; state.land = { extra: [], capes: [] }; state.villagers = []; state.landmarks = [];
        }
        expect(new Set(made).size).toBe(5);
        expect(made).not.toContain('shiokaze');
        expect(themesLeft(state)).toEqual([]);
        expect(shoalStage(state)).toBeUndefined();
        // Wherever the shoals grew, the islands never sit on each other.
        const places = [placeOf(state, 'home'), ...made.map(theme => placeOf(state, theme))];
        for (const [i, a] of places.entries()) for (const b of places.slice(i + 1)) expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(14);
        expect(neighbors(state, 'home').map(n => n.key)).toEqual(made);
    });

    it('keeps an island made before: the shiokaze island stays, in its old place', () => {
        const state = welcomed(newIsland('child', now));
        state.journey = { routes: [{ slot: 0, reason: 'first-friend', at: now }], chosen: [{ slot: 0, theme: 'shiokaze', islandId: 'sea' }], species: [] };
        expect(placeOf(state, 'shiokaze')).toEqual([50, 87]);
        expect(neighbors(state, 'home').map(n => [n.key, n.mode])).toEqual([['shiokaze', 'made']]);
        noteLevels(state, { math: 2, vocab: 0, kokugo: 0 });
        expect(shoalStage(state)).toBe(1);
    });
});

describe('special islands and their species', () => {
    const record = (state: GrowingState): GrowingRecord => ({ profileId: 'child', version: 5, revision: 1, createdAt: now, updatedAt: now, state });

    it('every theme starts on walkable ground with its first species placed', () => {
        setTerrainForm('terrace');
        for (const theme of THEMES) {
            const island = makeVoyageIsland(record(newIsland('child', now)), theme, 'x', theme, now);
            expect(editableTerracePlan(island.state)!.stranded).toBe(0);
            expect(() => readable(island)).not.toThrow();
            expect(island.state.theme).toBe(theme);
            expect(island.state.keepsakes.filter(k => k.unitId.startsWith('species:') && k.cell)).toHaveLength(1);
            expect(island.state.journey!.species).toHaveLength(1);
        }
    });

    it('a new island keeps the child\'s first steps and firsts', () => {
        const home = welcomed(newIsland('child', now));
        home.guidance!.starter.steps = { S1: { source: 'test' }, S2: { source: 'test' }, S3: { source: 'test' } } as never;
        home.guidance!.achievements.A1 = { source: 'test' } as never;
        home.guidance!.firstFlower = { id: 'f1', seen: false };
        const island = makeVoyageIsland(record(home), 'kodama', 'x', 'kodama', now).state;
        expect(starterStep(island)).toBe('S4');
        expect(island.guidance!.achievements.A1).toBeDefined();
        expect(island.guidance!.firstFlower).toBeUndefined();
    });

    it('on the shiokaze island, the shell flower beside dug water brings the leaf crab', () => {
        setTerrainForm('terrace');
        let state = makeVoyageIsland(record(newIsland('child', now)), 'shiokaze', 'x', 'shiokaze', now).state;
        state.tutorial = 'done';
        expect(secondSpeciesReady(state)).toBe(false);
        const flower = state.keepsakes.find(k => k.unitId === 'species:shell-flower')!;
        state = applyIntent(state, { id: 'move', command: { type: 'move', id: flower.id, cell: { x: 2, z: 4 } } }).state;
        expect(state.journey!.species).toContain('leaf-crab');
        expect(state.keepsakes.find(k => k.unitId === 'species:leaf-crab')?.cell).toBeDefined();
        expect(state.discoveries).toContain('species:leaf-crab');
        expect(noteJourney(state, now)).toEqual([]);
    });

    it('found species travel with the child and can be brought to each island once', () => {
        const home = newIsland('child', now);
        home.journey = { routes: [], chosen: [], species: ['shell-flower'] };
        adoptSpecies(home, 'shell-flower');
        expect(home.keepsakes.filter(k => k.unitId === 'species:shell-flower')).toHaveLength(1);
        expect(() => adoptSpecies(home, 'shell-flower')).toThrow();
        expect(() => adoptSpecies(home, 'leaf-crab')).toThrow();
        const other = carrySharedResources(record(home), record(newIsland('child', now)));
        expect(other.state.journey!.species).toEqual(['shell-flower']);
    });

    it('sailing to a special island needs the ready shoal, and only as the island it became', async () => {
        const db = new GrowingIslandDatabase(`journey-${crypto.randomUUID()}`); dbs.push(db);
        const state = grown(welcomed(newIsland('child', now)));
        await db.islands.put(record(state));
        await expect(sailGrowingIsland('child', 'main', { id: 'forest', create: { name: 'もり', start: 'kodama' } }, now, db)).rejects.toThrow();
        noteLevels(state, { math: 2, vocab: 0, kokugo: 0 }); grantRoutes(state, undefined, now);
        await db.islands.put(record(state));
        const theme = nextIsland(state)!, other = THEMES.find(t => t !== theme && t !== 'shiokaze')!;
        await expect(sailGrowingIsland('child', 'main', { id: 'wrong', create: { name: 'x', start: other } }, now, db)).rejects.toThrow();
        const there = await sailGrowingIsland('child', 'main', { id: 'new', create: { name: 'x', start: theme } }, now, db);
        expect(there.state.journey!.chosen).toEqual([{ slot: 1, theme, islandId: 'new', at: state.journey!.shoal!.at }]);
        expect(there.state.journey!.here).toBe('new');
        expect(there.state.theme).toBe(theme);
        const back = await sailGrowingIsland('child', 'new', { id: 'main' }, now, db);
        expect(back.state.journey!.chosen).toHaveLength(1);
        expect(back.state.journey!.here).toBe('main');
        expect(back.state.journey!.species).toEqual([THEME_INFO_FIRST(theme)]);
    });
});
