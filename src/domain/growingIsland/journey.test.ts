import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { applyIntent } from './commands';
import { starterStep } from './guidance';
import { editableTerracePlan } from './editableTerrainWorld';
import { newIsland } from './island';
import { adoptSpecies, chooseTheme, confirmedMathLevel, confirmedVocabLevel, passedLevel, freeSlots, grantRoutes, noteJourney, noteLevels, secondSpeciesReady, slotForTheme, THEMES } from './journey';
import { GrowingIslandDatabase, sailGrowingIsland, type GrowingRecord } from './repository';
import { setTerrainForm } from './terraceTerrain';
import { carrySharedResources, makeVoyageIsland } from './voyages';
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

describe('route slots', () => {
    it('slot 0 opens with the first friend; each learning slot waits for the previous island', () => {
        const state = newIsland('child', now), levels = { math: 5, vocab: 0, kokugo: 0 };
        expect(grantRoutes(state, levels, now)).toEqual([]);
        welcomed(state);
        expect(grantRoutes(state, levels, now)).toEqual([{ type: 'route', slot: 0 }]);
        // Lv2 and Lv5 are met, but nothing more opens until slot 0 becomes an island.
        expect(grantRoutes(state, levels, now)).toEqual([]);
        chooseTheme(state, 'shiokaze', 'a');
        expect(grantRoutes(state, levels, now)).toEqual([{ type: 'route', slot: 1 }]);
        expect(grantRoutes(state, levels, now)).toEqual([]);
        chooseTheme(state, 'kodama', 'b');
        expect(grantRoutes(state, { math: 5, vocab: 5, kokugo: 2 }, now)).toEqual([{ type: 'route', slot: 2 }]);
        expect(state.journey!.routes.map(route => route.reason)).toEqual(['first-friend', 'math:2', 'math:5']);
        // Levels never close a slot, and Lv9 is not met yet.
        chooseTheme(state, 'hoshi', 'c');
        expect(grantRoutes(state, { math: 0, vocab: 0, kokugo: 0 }, now)).toEqual([]);
        expect(freeSlots(state)).toEqual([]);
    });

    it('a child who started high gets the routes one island at a time, from the kept levels', () => {
        const state = welcomed(newIsland('child', now));
        grantRoutes(state, undefined, now); noteLevels(state, { math: 13, vocab: 0, kokugo: 0 });
        expect(freeSlots(state)).toEqual([0]);
        for (const [theme, slot] of [['shiokaze', 1], ['kodama', 2], ['hikari', 3], ['watagumo', 4]] as const) {
            chooseTheme(state, theme, theme);
            expect(grantRoutes(state, undefined, now)).toEqual([{ type: 'route', slot }]);
        }
        chooseTheme(state, 'karakuri', 'k');
        expect(grantRoutes(state, undefined, now)).toEqual([]);
        expect(state.discoveries).toContain('learn:math:13');
    });

    it('a theme takes one free slot and is chosen once', () => {
        const state = welcomed(newIsland('child', now));
        grantRoutes(state, undefined, now);
        expect(slotForTheme(state, 'kodama')).toBeUndefined();
        expect(chooseTheme(state, 'shiokaze', 'a')).toBe(0);
        expect(() => chooseTheme(state, 'shiokaze', 'b')).toThrow();
        expect(() => chooseTheme(state, 'kodama', 'd')).toThrow();
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

    it('sailing to a special island needs an open slot and spends it once', async () => {
        const db = new GrowingIslandDatabase(`journey-${crypto.randomUUID()}`); dbs.push(db);
        const state = welcomed(newIsland('child', now));
        await db.islands.put(record(state));
        await expect(sailGrowingIsland('child', 'main', { id: 'forest', create: { name: 'もり', start: 'kodama' } }, now, db)).rejects.toThrow();
        const shiokaze = await sailGrowingIsland('child', 'main', { id: 'sea', create: { name: 'しおかぜ', start: 'shiokaze' } }, now, db);
        expect(shiokaze.state.journey!.chosen).toEqual([{ slot: 0, theme: 'shiokaze', islandId: 'sea' }]);
        expect(shiokaze.state.theme).toBe('shiokaze');
        const back = await sailGrowingIsland('child', 'sea', { id: 'main' }, now, db);
        expect(back.state.journey!.chosen).toHaveLength(1);
        expect(back.state.journey!.species).toEqual(['shell-flower']);
        expect(back.state.discoveries).toContain('species:shell-flower');
    });
});
