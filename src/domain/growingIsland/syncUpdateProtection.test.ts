import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { newLife, type LifeState } from '../islandLife/model';
import { replayLife } from '../islandLife/simulation';
import { GrowingIslandDatabase, syncGrowingIsland } from './repository';

const guard = vi.hoisted(() => ({ count: 0, replay: vi.fn() }));
vi.mock('../../pwa', () => ({ holdPwaUpdateForCriticalPersistence: () => {
    guard.count++; return () => { guard.count--; };
} }));
vi.mock('./lifeMigrationClient', () => ({ replayLifeMigrationResponsive: guard.replay }));
const stores: (GrowingIslandDatabase | IslandLifeDatabase)[] = [];
afterEach(async () => { expect(guard.count).toBe(0); await Promise.all(stores.splice(0).map(d => d.delete())); vi.restoreAllMocks(); });
const fixture = () => {
    const db = new GrowingIslandDatabase(`sync-update-${crypto.randomUUID()}`);
    const old = new IslandLifeDatabase(`sync-old-${crypto.randomUUID()}`);
    stores.push(db, old); return { db, old };
};

it('allows an app update during a stalled read-only replay, then guards the real save', async () => {
    const { db, old } = fixture(), record = newLife('kid', 1000);
    await old.worlds.put(record);
    let finish!: (state: LifeState) => void;
    guard.replay.mockReturnValue(new Promise<LifeState>(resolve => { finish = resolve; }));
    const originalPut = db.islands.put.bind(db.islands);
    vi.spyOn(db.islands, 'put').mockImplementation(value => {
        expect(guard.count).toBe(1); return originalPut(value);
    });
    const sync = syncGrowingIsland('kid', [], 1000, db, old);
    await vi.waitFor(() => expect(guard.replay).toHaveBeenCalled());
    expect(guard.count).toBe(0);
    expect(await db.islands.get('kid')).toBeUndefined();
    finish(replayLife(record));
    await sync;
    expect(guard.count).toBe(0);
    expect(await old.worlds.get('kid')).toEqual(record);
    expect(await db.islands.get('kid')).toBeDefined();
});

it('releases protection after an aborted save and lets the unchanged island retry', async () => {
    const { db, old } = fixture();
    const saved = (await syncGrowingIsland('kid', [], 1000, db, old)).record;
    vi.spyOn(db.islands, 'put').mockImplementationOnce(() => {
        expect(guard.count).toBe(1); throw new Error('disk-full');
    });
    const facts = [{ id: 'completed', at: 2000 }];
    await expect(syncGrowingIsland('kid', facts, 2000, db, old)).rejects.toThrow('disk-full');
    expect(guard.count).toBe(0);
    expect(await db.islands.get('kid')).toEqual(saved);
    const retried = await syncGrowingIsland('kid', facts, 2000, db, old);
    expect(retried.learned).toBe(1);
});
