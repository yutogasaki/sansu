import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { HOUR, learningDay } from './model';
import { IslandLifeDatabase, updateLife, mergeFacts } from './repository';
import { cacheAppendedCredits, commandLife, replayLife } from './simulation';
import { clearLifeReplayCache, cachedLifeState, cadenceReplayKey } from './replayCache';
import { restoreLifeSnapshot } from './replaySnapshot';

it('reuses the persisted prefix for new learning after seven days with identical cold replay', async () => {
    const db = new IslandLifeDatabase(`credit-performance-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [], undefined, 100, db);
        record = await updateLife('owner', [], undefined, 100 + 7 * 24 * HOUR, db);
        clearLifeReplayCache();
        expect(await restoreLifeSnapshot(record)).toBe(true);
        const next = mergeFacts(record, [{ id: 'new', at: record.realAt }]);
        const start = performance.now();
        expect(cacheAppendedCredits(record, next)).toBe(true);
        const warm = cachedLifeState(cadenceReplayKey(next, next.now), next.now);
        expect(warm).toBeDefined();
        console.info('seven-day incremental credit ms', performance.now() - start);
        clearLifeReplayCache();
        const coldStart = performance.now();
        expect(replayLife(next)).toEqual(warm);
        console.info('seven-day cold credit ms', performance.now() - coldStart);
        clearLifeReplayCache();
        const saved = await updateLife('owner', [{ id: 'new', at: record.realAt }], undefined, record.realAt, db);
        expect(replayLife(saved)).toEqual(warm);
        expect(await db.worlds.get('owner')).toEqual(saved);
        expect((await updateLife('owner', [{ id: 'new', at: record.realAt }], undefined, record.realAt, db)).credits).toHaveLength(1);
    } finally { await db.delete(); clearLifeReplayCache(); }
}, 120000);

it('keeps rewards, growth, same-time credits, daily goal and later purchases equal to full replay', async () => {
    const db = new IslandLifeDatabase(`credit-equality-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [{ id: 'first', at: 100 }], undefined, 100, db);
        record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 101);
        record = { ...record, now: 200, realAt: 200 };
        replayLife(record);
        const facts = Array.from({ length: 12 }, (_, i) => ({ id: `learn-${i}`, at: 300 + (i % 3) * HOUR }));
        const next = mergeFacts({ ...record, now: 4 * HOUR, realAt: 4 * HOUR }, facts);
        expect(cacheAppendedCredits(record, next)).toBe(true);
        const warm = replayLife(next);
        const bought = commandLife(next, { type: 'buy', kind: 'bench', cell: { x: 0, z: 4 } }, 'bench', next.now);
        const purchased = replayLife(bought);
        clearLifeReplayCache();
        expect(replayLife(next)).toEqual(warm);
        expect(replayLife(bought)).toEqual(purchased);
    } finally { await db.delete(); clearLifeReplayCache(); }
});

it('falls back for late facts, simultaneous prior events, changed logs, cutovers and missing cache', async () => {
    const db = new IslandLifeDatabase(`credit-fallback-${crypto.randomUUID()}`);
    try {
        let record = await updateLife('owner', [{ id: 'first', at: 100 }], undefined, 100, db);
        expect(cacheAppendedCredits(record, mergeFacts(record, [{ id: 'cutover', at: 100 }]))).toBe(false);
        record = await updateLife('owner', [], undefined, 1000, db);
        for (const at of [999, 1000]) {
            const base = at === 1000 ? commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', at) : record;
            expect(cacheAppendedCredits(base, mergeFacts(base, [{ id: 'late', at }]))).toBe(false);
        }
        const next = mergeFacts(record, [{ id: 'new', at: 1000 }]);
        const changed = structuredClone(next); changed.credits[0].day = 'bad';
        expect(cacheAppendedCredits(record, changed)).toBe(false);
        expect(cacheAppendedCredits(record, { ...next, profileId: 'other' })).toBe(false);
        expect(cacheAppendedCredits(record, { ...next, credits: [...next.credits, { id: 'new', at: 1000, day: learningDay(1000) }] })).toBe(false);
        clearLifeReplayCache(); expect(cacheAppendedCredits(record, next)).toBe(false);
    } finally { await db.delete(); clearLifeReplayCache(); }
});
