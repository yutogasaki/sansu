import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { lifeEnabled } from './model';
import { IslandLifeDatabase, lifeDatabaseName, updateLife } from './repository';
import { replayLife } from './simulation';
afterEach(() => vi.unstubAllEnvs());
it('requires an explicit production flag and isolates preview ownership', () => {
    vi.stubEnv('DEV', false); vi.stubEnv('VITE_ISLAND_LIFE_PREVIEW', 'true');
    vi.stubEnv('VITE_ISLAND_LIFE_ENABLED', 'false'); expect(lifeEnabled()).toBe(false);
    vi.stubEnv('VITE_ISLAND_LIFE_ENABLED', 'true'); expect(lifeEnabled()).toBe(true);
    expect(lifeDatabaseName()).toBe('SansuIslandLifeV1');
    vi.stubEnv('DEV', true); expect(lifeDatabaseName()).toBe('SansuIslandLifePreviewV1');
});
it('rejects production time advance before any write, retaining earned ownership', async () => {
    vi.stubEnv('DEV', false);
    const d = new IslandLifeDatabase(`production-${crypto.randomUUID()}`);
    try {
        const first = await updateLife('child', [{ id: 'old', at: 99 }], undefined, 100, d);
        expect(replayLife(first).drops).toBe(0);
        const earned = await updateLife('child', [{ id: 'new', at: 101 }], undefined, 101, d);
        expect(replayLife(earned).drops).toBe(2);
        await expect(updateLife('child', [], { id: 'clock', revision: earned.revision, advanceHours: 24 }, 102, d)).rejects.toThrow('unavailable');
        expect(await d.worlds.get('child')).toEqual(earned);
    } finally { await d.delete(); }
});
