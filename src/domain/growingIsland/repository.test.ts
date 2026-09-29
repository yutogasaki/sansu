import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { commandLife } from '../islandLife/simulation';
import { learningDay, newLife } from '../islandLife/model';
import { GrowingIslandDatabase, commandGrowingIsland, syncGrowingIsland } from './repository';

const stores: (GrowingIslandDatabase | IslandLifeDatabase)[] = [];
const growing = () => { const d = new GrowingIslandDatabase(`growing-test-${crypto.randomUUID()}`); stores.push(d); return d; };
const life = () => { const d = new IslandLifeDatabase(`life-test-${crypto.randomUUID()}`); stores.push(d); return d; };
afterEach(async () => { await Promise.all(stores.splice(0).map(d => d.delete())); });
const T0 = Date.UTC(2026, 8, 29, 9), HOUR = 3_600_000;

describe('growing island persistence', () => {
    it('creates a new island for a new child and saves it once', async () => {
        const db = growing(), old = life();
        const first = await syncGrowingIsland('new-kid', [], T0, db, old);
        expect(first.record.revision).toBe(0);
        expect(first.record.state.tutorial).toBe('first-home');
        expect(first.record.migratedFrom).toBeUndefined();
        const again = await syncGrowingIsland('new-kid', [], T0, db, old);
        expect(again.record.revision).toBe(0);
    });

    it('copies the current island once and leaves its record untouched', async () => {
        const db = growing(), old = life();
        let record = newLife('kid', T0 - 10 * HOUR);
        record.credits = [{ id: 'past', at: T0 - 9 * HOUR, day: learningDay(T0 - 9 * HOUR) }];
        record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 4, z: 3 } }, 'buy-flower', T0 - 8 * HOUR);
        await old.worlds.put(record);
        const before = structuredClone(await old.worlds.get('kid'));
        const result = await syncGrowingIsland('kid', [{ id: 'past', at: T0 - 9 * HOUR }], T0, db, old);
        expect(result.record.migratedFrom).toMatchObject({ lifeVersion: record.version, lifeRevision: record.revision });
        expect(result.record.state.landmarks.some(l => l.kind === 'flower' && l.cell?.x === 4)).toBe(true);
        expect(result.learned).toBe(0);
        expect(await old.worlds.get('kid')).toEqual(before);
    });

    it('adds learning once and opens the banked town time in the same save', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old);
        const facts = [1, 2, 3].map(n => ({ id: `done-${n}`, at: T0 + n }));
        const opened = await syncGrowingIsland('kid', facts, T0 + 10, db, old);
        expect(opened.learned).toBe(3);
        expect(opened.record.state.drops).toBe(6);
        expect(opened.record.state.town).toEqual({ clock: 12, bank: 0 });
        const again = await syncGrowingIsland('kid', facts, T0 + 20, db, old);
        expect(again.learned).toBe(0);
        expect(again.record.state.drops).toBe(6);
    });

    it('applies an action once, even after a background refresh saved first', async () => {
        const db = growing(), old = life();
        await syncGrowingIsland('kid', [], T0, db, old);
        await syncGrowingIsland('kid', [{ id: 'one', at: T0 + 5 }], T0 + 6, db, old);
        const intent = { id: 'plant-1', command: { type: 'plant' as const, kind: 'home' as const, cell: { x: 1, z: 3 } } };
        const planted = await commandGrowingIsland('kid', intent, T0 + 7, db);
        expect(planted.record.state.villagers).toHaveLength(1);
        const repeated = await commandGrowingIsland('kid', intent, T0 + 8, db);
        expect(repeated.record.revision).toBe(planted.record.revision);
    });
});
