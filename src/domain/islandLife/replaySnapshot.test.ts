import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { HOUR } from './model';
import { IslandLifeDatabase, updateLife } from './repository';
import { clearLifeReplayCache } from './replayCache';
import { restoreLifeSnapshot } from './replaySnapshot';
import { replayLife } from './simulation';

describe('persistent replay acceleration', () => {
    it('survives cold reopen and matches full replay after 1 and 7 days, purchases and new facts', async () => {
        const db = new IslandLifeDatabase(`snapshot-${crypto.randomUUID()}`);
        try {
            let record = await updateLife('owner', [], undefined, 100, db);
            const facts = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 100 }));
            record = await updateLife('owner', facts, { id: 'flower', revision: record.revision,
                command: { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } } }, 100, db);
            for (const at of [100 + HOUR * 24, 100 + HOUR * 24 * 7, 101 + HOUR * 24 * 7]) {
                clearLifeReplayCache();
                const saved = (await db.worlds.get('owner'))!;
                expect(await restoreLifeSnapshot(saved)).toBe(true);
                record = await updateLife('owner', facts, undefined, at, db);
                const accelerated = replayLife(record);
                clearLifeReplayCache();
                const fullStart = performance.now();
                const full = replayLife({ ...record, replaySnapshot: undefined });
                const fullMs = performance.now() - fullStart;
                expect(full).toEqual(accelerated);
                clearLifeReplayCache();
                const restoreStart = performance.now();
                expect(await restoreLifeSnapshot(record)).toBe(true);
                expect(replayLife(record)).toEqual(full);
                console.info('snapshot benchmark', JSON.stringify({ hours: (record.now - 100) / HOUR,
                    fullMs, restoreMs: performance.now() - restoreStart,
                    snapshotBytes: new TextEncoder().encode(JSON.stringify(record.replaySnapshot)).length }));
            }
            facts.push({ id: 'new-learning', at: record.realAt });
            clearLifeReplayCache();
            record = await updateLife('owner', facts, { id: 'move', revision: record.revision,
                command: { type: 'move', itemId: 'flower', cell: { x: 4, z: 3 } } }, record.realAt, db);
            const accelerated = replayLife(record); clearLifeReplayCache();
            expect(replayLife({ ...record, replaySnapshot: undefined })).toEqual(accelerated);
        } finally { await db.delete(); clearLifeReplayCache(); }
    }, 120000);
    it('rejects corruption, foreign owners, changed history, clock and build; rebuilds missing snapshots', async () => {
        const db = new IslandLifeDatabase(`snapshot-${crypto.randomUUID()}`);
        try {
            const record = await updateLife('owner', [], undefined, 100, db);
            for (const mutate of [
                (r: typeof record) => { r.replaySnapshot!.state.light++; },
                (r: typeof record) => { r.profileId = 'foreign'; },
                (r: typeof record) => { r.credits.push({ id: 'late', at: 100, day: '2026-09-20' }); },
                (r: typeof record) => { r.now--; },
                (r: typeof record) => { r.replaySnapshot!.build = 'old-build'; },
                (r: typeof record) => { r.replaySnapshot = undefined; },
            ]) {
                const changed = structuredClone(record); mutate(changed); clearLifeReplayCache();
                expect(await restoreLifeSnapshot(changed)).toBe(false);
            }
            const broken = structuredClone(record); broken.replaySnapshot!.state.light = 999;
            await db.worlds.put(broken); clearLifeReplayCache();
            const recovered = await updateLife('owner', [], undefined, 101, db);
            const actual = replayLife(recovered); clearLifeReplayCache();
            expect(actual).toEqual(replayLife({ ...recovered, replaySnapshot: undefined }));
            expect(await restoreLifeSnapshot(recovered)).toBe(true);
            const earlier = replayLife(recovered, 100); clearLifeReplayCache();
            expect(replayLife({ ...recovered, replaySnapshot: undefined }, 100)).toEqual(earlier);
            const fail = () => { throw new Error('disk failure'); };
            db.worlds.hook('updating', fail);
            await expect(updateLife('owner', [], undefined, 102, db)).rejects.toThrow('disk failure');
            db.worlds.hook('updating').unsubscribe(fail);
            expect(await db.worlds.get('owner')).toEqual(recovered);
        } finally { await db.delete(); clearLifeReplayCache(); }
    }, 15000);
});
