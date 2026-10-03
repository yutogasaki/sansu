import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IslandLifeDatabase } from '../islandLife/repository';
import { GrowingIslandDatabase, commandGrowingIsland, sendFlower, syncGrowingIsland } from './repository';
import { projectGrowingSync } from './syncProjection';

const worker = vi.hoisted(() => ({ project: vi.fn() }));
vi.mock('./syncProjectionClient', () => ({ projectGrowingSyncResponsive: worker.project }));
const stores: (GrowingIslandDatabase | IslandLifeDatabase)[] = [];
beforeEach(() => { worker.project.mockReset().mockImplementation(async request => projectGrowingSync(request)); });
afterEach(async () => { await Promise.all(stores.splice(0).map(d => d.delete())); });
async function fixture() {
    const db = new GrowingIslandDatabase(`projection-${crypto.randomUUID()}`), old = new IslandLifeDatabase(`projection-life-${crypto.randomUUID()}`);
    stores.push(db, old); await syncGrowingIsland('kid', [], 1000, db, old);
    worker.project.mockClear(); return { db, old };
}
const facts = [{ id: 'one-problem', at: 2000 }];

it('recalculates if another tab saves or a gift arrives, retaining both with one learning payment', async () => {
    const { db, old } = await fixture();
    worker.project.mockImplementationOnce(async request => {
        const result = projectGrowingSync(request);
        await commandGrowingIsland('kid', { id: 'other-tab', command: { type: 'name', target: 'island', name: 'みなと' } }, 1500, db);
        await sendFlower('sis', 'はる', 'kid', 1500, db);
        return result;
    });
    const result = await syncGrowingIsland('kid', facts, 2000, db, old);
    expect(worker.project).toHaveBeenCalledTimes(2);
    expect(result.record.state.islandName).toBe('みなと');
    expect(result.learned).toBe(1);
    expect(result.record.state.learned).toEqual(['one-problem']);
    expect(result.record.state.landmarks.filter(l => l.from === 'はる')).toHaveLength(1);
    expect(await db.gifts.count()).toBe(0);
    const again = await syncGrowingIsland('kid', facts, 2000, db, old);
    expect(again.learned).toBe(0);
    expect(again.record.state.drops).toBe(result.record.state.drops);
});

it('bounds repeated conflicts without overwriting another tab or paying learning early', async () => {
    const { db, old } = await fixture(); let count = 0;
    worker.project.mockImplementation(async request => {
        const result = projectGrowingSync(request); count++;
        await commandGrowingIsland('kid', { id: `edit-${count}`, command: { type: 'name', target: 'island', name: `しま${count}` } }, 1500, db);
        return result;
    });
    await expect(syncGrowingIsland('kid', facts, 2000, db, old)).rejects.toThrow('もういちど');
    expect(count).toBe(3);
    const saved = (await db.islands.get('kid'))!;
    expect(saved.state.islandName).toBe('しま3');
    expect(saved.state.learned).toEqual([]);
    expect(saved.state.drops).toBe(0);
});

it('does not consume gifts or change the island if its calculation worker fails', async () => {
    const { db, old } = await fixture(); await sendFlower('sis', 'はる', 'kid', 1500, db);
    const before = await db.islands.get('kid'), gifts = await db.gifts.toArray();
    worker.project.mockRejectedValueOnce(new Error('worker-error'));
    await expect(syncGrowingIsland('kid', facts, 2000, db, old)).rejects.toThrow('worker-error');
    expect(await db.islands.get('kid')).toEqual(before);
    expect(await db.gifts.toArray()).toEqual(gifts);
});
