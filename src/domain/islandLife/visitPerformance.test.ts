import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { HOUR } from './model';
import { IslandLifeDatabase, updateLife } from './repository';
import { cachedLifeState, cadenceReplayKey, clearLifeReplayCache } from './replayCache';
import { restoreLifeSnapshot } from './replaySnapshot';
import { commandLife, replayLife } from './simulation';

it('reuses the applied visit without replaying a day of history, with identical saved state', async () => {
    const db = new IslandLifeDatabase(`visit-performance-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [], undefined, 100, db);
        record = await updateLife('owner', [{ id: 'credit', at: 100 }], {
            id: 'flower', revision: record.revision, command: { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } },
        }, 100, db);
        // Explicit long-lived fixture: 1,000 prior calls spread over a day.
        record = { ...record, actions: [...record.actions, ...Array.from({ length: 1000 }, (_, i) => ({
            id: `prior-call-${i}`, at: 101 + i * 60000,
            command: { type: 'visit' as const, itemId: 'flower' },
        }))], now: 100 + 24 * HOUR, realAt: 100 + 24 * HOUR, replaySnapshot: undefined };
        await db.worlds.put(record);
        record = await updateLife('owner', [], undefined, record.realAt, db);
        clearLifeReplayCache();
        expect(await restoreLifeSnapshot(record)).toBe(true);
        const intent = { id: 'call', revision: record.revision, command: { type: 'visit' as const, itemId: 'flower' } };
        const start = performance.now();
        const next = commandLife(record, intent.command, intent.id, record.now);
        const applied = cachedLifeState(cadenceReplayKey(next, next.now), next.now);
        const state = replayLife(next);
        console.info('visit warm command + replay ms', performance.now() - start);
        clearLifeReplayCache();
        const coldStart = performance.now();
        expect(replayLife(next)).toEqual(state);
        console.info('visit cold replay ms', performance.now() - coldStart);
        expect(applied).toEqual(state);
        expect(state.target).toBe('flower');
        expect(() => replayLife({ ...next, actions: [...next.actions.slice(0, -1), {
            ...next.actions.at(-1)!, command: { type: 'visit', itemId: 'missing' },
        }] })).toThrow();
        const saved = await updateLife('owner', [], intent, record.realAt, db);
        expect(saved.revision).toBe(record.revision + 2);
        expect(await db.worlds.get('owner')).toEqual(saved);
        expect(replayLife(saved)).toEqual(state);
        expect(await updateLife('owner', [], intent, record.realAt, db)).toEqual(saved);
        clearLifeReplayCache();
        expect(await restoreLifeSnapshot(saved)).toBe(true);
        expect(replayLife(saved)).toEqual(state);
    } finally { await db.delete(); clearLifeReplayCache(); }
}, 120000);
