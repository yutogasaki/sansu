import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../../domain/user/profile';
import { createIsland } from '../../domain/island/catalog';
import { IslandConflict } from '../../domain/island/repository';
import type { IslandRecord } from '../../domain/island/types';
import { getIslandWorkshop, reduceIslandWorkshop, workshopLayoutKey, type IslandWorkshopAction } from '../../domain/island/workshop';
import { saveIslandWorkshop } from '../../domain/island/workshopRepository';
import { createIslandWorkshopQueue, type IslandWorkshopQueueContext, type IslandWorkshopQueueStatus } from './islandWorkshopQueue';
import type { IslandWorkshopRequest } from './islandWorkshopRequest';

const ready = (): IslandRecord => ({ ...createIsland('child', 0), completedSets: 1 });
const apply = (island: IslandRecord, action: IslandWorkshopAction) => reduceIslandWorkshop(island, action, 10);
const move = (col: number): IslandWorkshopAction => ({ type: 'edit-draft', edit: { type: 'move', partId: 'wheel', position: { col, row: 1 } } });
const brush = (section: number): IslandWorkshopAction => ({ type: 'brush', specimenId: 'driftwood', section });
const observation: IslandWorkshopAction = { type: 'observe-specimen', specimenId: 'driftwood', result: 'float', cleanedMask: 0 };
const name: IslandWorkshopAction = { type: 'name-specimen', specimenId: 'driftwood', name: 'ながれぼし' };
function movable() {
    let island = ready();
    for (let section = 0; section < 6; section++) island = apply(island, { type: 'brush', specimenId: 'seaglass', section });
    for (const result of ['clean', 'transmit'] as const) island = apply(island, { type: 'observe-specimen', specimenId: 'seaglass', result, cleanedMask: 63 });
    return apply(island, { type: 'edit-draft', edit: { type: 'assemble', partId: 'wheel' } });
}
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (cause: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function harness(initial = ready()) {
    let stored = initial, status: IslandWorkshopQueueStatus = { retry: false };
    const context: IslandWorkshopQueueContext = { island: initial, active: true, visible: true, busy: false };
    const persist = (action: IslandWorkshopAction) => {
        stored = { ...apply(stored, action), revision: stored.revision + 1 }; return stored;
    };
    const write = vi.fn(async (_profileId: string, request: IslandWorkshopRequest) => {
        if (request.revision !== stored.revision) throw new IslandConflict('changed');
        return persist(request.action);
    });
    const refresh = vi.fn(async () => stored);
    const run = vi.fn(async <T,>(action: () => Promise<T>): Promise<T | undefined> => action());
    const onSaved = vi.fn((island: IslandRecord) => { context.island = island; });
    const queue = createIslandWorkshopQueue({ profileId: 'child', context: () => context, run, write, refresh,
        onSaved, onStatus: next => { status = next; } });
    return { queue, context, run, write, refresh, onSaved, persist, get stored() { return stored; }, get status() { return status; } };
}
const databases: SansuDatabase[] = [];
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe('workshop gesture FIFO and visible result dedupe', () => {
    it('keeps move A -> B -> A, then saves the final A instead of coalescing it into B', async () => {
        const h = harness(movable()); h.context.busy = true;
        const a1 = h.queue.enqueue(move(0)), b = h.queue.enqueue(move(1)), a2 = h.queue.enqueue(move(0));
        const saved = h.queue.enqueue({ type: 'save-work', workId: 'work-1', name: 'さいごの かたち' });
        expect(h.write).not.toHaveBeenCalled(); h.context.busy = false; h.queue.wake();
        expect(await Promise.all([a1, b, a2, saved])).toEqual([true, true, true, true]);
        expect(h.write.mock.calls.map(call => call[1].action)).toEqual([move(0), move(1), move(0), { type: 'save-work', workId: 'work-1', name: 'さいごの かたち' }]);
        const state = getIslandWorkshop(h.stored);
        expect(state.draftCheckpoint.draft.layout.parts.wheel.position).toEqual({ col: 0, row: 1 });
        expect(state.works['work-1']!.layout.parts.wheel.position).toEqual({ col: 0, row: 1 });
        expect(state.draftCheckpoint.draft.undo.at(-1)!.parts.wheel.position).toEqual({ col: 1, row: 1 });
    });

    it('serializes every region of one stroke and records the final visible clean result only once', async () => {
        const h = harness(), gate = deferred<IslandRecord>();
        h.write.mockImplementationOnce(() => gate.promise);
        const first = h.queue.enqueue(brush(0));
        const rest = [1, 2, 3, 4, 5].map(section => h.queue.enqueue(brush(section)));
        const clean: IslandWorkshopAction = { type: 'observe-specimen', specimenId: 'driftwood', result: 'clean', cleanedMask: 63 };
        const seen = [h.queue.enqueue(clean), h.queue.enqueue(clean), h.queue.enqueue(clean)];
        expect(seen[0]).toBe(seen[1]); expect(seen[1]).toBe(seen[2]);
        expect(h.write).toHaveBeenCalledTimes(1); gate.resolve(h.persist(brush(0)));
        expect(await Promise.all([first, ...rest, ...seen])).toEqual(Array(9).fill(true));
        expect(h.write.mock.calls.map(call => call[1].revision)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(h.stored.workshop!.specimens.driftwood.cleanedMask).toBe(63);
        expect(h.stored.workshop!.specimens.driftwood.observations.map(entry => entry.result)).toEqual(['clean']);
    });

    it('detaches queued nested gestures from later pointer mutations', async () => {
        const h = harness(movable()), action = move(0); h.context.busy = true;
        const result = h.queue.enqueue(action);
        if (action.type === 'edit-draft' && action.edit.type === 'move') action.edit.position.col = 2;
        h.context.busy = false; h.queue.wake(); expect(await result).toBe(true);
        expect(h.stored.workshop!.draftCheckpoint.draft.layout.parts.wheel.position?.col).toBe(0);
    });
});

describe('obsolete observations cannot retain a failed writer', () => {
    it.each(['expired', 'observed'] as const)('retires an %s observation after CAS refresh and continues queued input', async mode => {
        const h = harness(), gate = deferred<IslandRecord>();
        h.write.mockImplementationOnce(() => gate.promise);
        const result = h.queue.enqueue(observation), next = h.queue.enqueue(name);
        h.persist(mode === 'expired' ? brush(0) : observation); gate.reject(new IslandConflict('other tab'));
        expect(await result).toBe(mode === 'observed'); expect(await next).toBe(true);
        expect(h.refresh).toHaveBeenCalledTimes(1);
        expect(h.write.mock.calls.map(call => call[1].action.type)).toEqual(['observe-specimen', 'name-specimen']);
        expect(h.status).toEqual({ cause: undefined, retry: false });
        expect(h.stored.workshop!.specimens.driftwood.name).toBe('ながれぼし');
    });

    it('drops an old layout observation after refresh instead of replaying it over a new connection', async () => {
        const h = harness(movable()), gate = deferred<IslandRecord>(); h.write.mockImplementationOnce(() => gate.promise);
        const result = h.queue.enqueue({ type: 'observe-creation', partId: 'wheel', layoutKey: workshopLayoutKey(getIslandWorkshop(h.stored).draftCheckpoint.draft.layout) });
        const next = h.queue.enqueue(name); h.persist(move(1)); gate.reject(new IslandConflict('changed layout'));
        expect(await result).toBe(false); expect(await next).toBe(true);
        expect(h.stored.workshop!.creations).toEqual([]); expect(h.write).toHaveBeenCalledTimes(2);
    });

    it('a new gesture recovers an unknown failed observation, then discards it after the confirmed refresh', async () => {
        const h = harness(); h.write.mockRejectedValueOnce(new Error('unknown IO'));
        expect(await h.queue.enqueue(observation)).toBe(false); expect(h.status.retry).toBe(true);
        const original = h.write.mock.calls[0][1]; h.persist(brush(0));
        // A/B/A all arrive while another shared writer is busy. No action can overtake the old receipt.
        h.context.busy = true;
        const actions = [name, brush(1), name], results = actions.map(action => h.queue.enqueue(action));
        h.context.busy = false; h.queue.wake(); expect(await Promise.all(results)).toEqual([true, true, true]);
        expect(h.write.mock.calls[1][1]).toBe(original);
        expect(h.write.mock.calls.slice(2).map(call => call[1].action)).toEqual(actions);
        expect(h.status.retry).toBe(false); expect(h.stored.workshop!.specimens.driftwood.cleanedMask).toBe(3);
    });

    it('retires a failed observation when a live update makes it obsolete, before checking the displayed error', async () => {
        const h = harness(); h.write.mockRejectedValueOnce(new Error('unknown IO'));
        expect(await h.queue.enqueue(observation)).toBe(false);
        h.context.island = h.persist(brush(0)); h.queue.wake();
        expect(h.status.retry).toBe(false); expect(h.status.cause).toBeUndefined();
        expect(await h.queue.enqueue(name)).toBe(true); expect(h.write).toHaveBeenCalledTimes(2);
    });

    it('discards a confirmed impossible visible result so it does not require endless retries', async () => {
        const h = harness(); h.context.busy = true;
        const impossible = h.queue.enqueue({ type: 'observe-specimen', specimenId: 'seaglass', result: 'transmit', cleanedMask: 0 });
        const next = h.queue.enqueue(brush(0)); h.context.busy = false; h.queue.wake();
        expect(await impossible).toBe(false); expect(await next).toBe(true);
        expect(h.status).toEqual({ cause: undefined, retry: false });
    });

    it('stops after a failed CAS refresh and retries only on an explicit recovery request', async () => {
        const h = harness(); h.persist(brush(0)); h.refresh.mockRejectedValueOnce(new Error('read unavailable'));
        expect(await h.queue.enqueue(observation)).toBe(false); expect(h.status.retry).toBe(true);
        for (let index = 0; index < 5; index++) h.queue.wake();
        expect(h.write).toHaveBeenCalledTimes(1); expect(h.refresh).toHaveBeenCalledTimes(1);
        expect(await h.queue.enqueue(name)).toBe(true); expect(h.refresh).toHaveBeenCalledTimes(2);
        expect(h.status.retry).toBe(false);
    });

    it('rebases a confirmed CAS gesture on retry and keeps the following UI action in order', async () => {
        const h = harness(movable()); h.persist(name);
        expect(await h.queue.enqueue(move(0))).toBe(false); expect(h.status.retry).toBe(true);
        const saved = h.queue.enqueue({ type: 'save-work', workId: 'work-1', name: 'つづき' });
        expect(await saved).toBe(true);
        expect(h.write.mock.calls.map(call => call[1].revision)).toEqual([0, 1, 2]);
        expect(h.stored.workshop!.works['work-1']!.layout.parts.wheel.position?.col).toBe(0);
    });

    it('removes a confirmed invalid gesture so a later valid correction can save', async () => {
        const h = harness();
        expect(await h.queue.enqueue({ type: 'load-work', workId: 'work-1' })).toBe(false);
        expect(h.status.retry).toBe(false); expect(h.status.cause).toBeDefined();
        expect(await h.queue.enqueue(name)).toBe(true);
        expect(h.write.mock.calls.map(call => call[1].action.type)).toEqual(['load-work', 'name-specimen']);
    });

    it('keeps a newer live revision when an earlier successful reply arrives later', async () => {
        const h = harness(), gate = deferred<IslandRecord>(); h.write.mockImplementationOnce(() => gate.promise);
        const first = h.queue.enqueue(brush(0)), second = h.queue.enqueue(brush(2));
        const saved = h.persist(brush(0)); h.context.island = h.persist(brush(1)); gate.resolve(saved);
        expect(await first).toBe(true); expect(await second).toBe(true);
        expect(h.write.mock.calls.map(call => call[1].revision)).toEqual([0, 2]);
        expect(h.stored.workshop!.specimens.driftwood.cleanedMask).toBe(7);
    });
});

describe('shared lock, learning, background and profile lifetimes', () => {
    it('waits when the shared run lock declines a callback, without dropping input or spinning', async () => {
        const h = harness(); h.run.mockResolvedValueOnce(undefined);
        const result = h.queue.enqueue(brush(0));
        await vi.waitFor(() => expect(h.run).toHaveBeenCalledTimes(1)); expect(h.write).not.toHaveBeenCalled();
        h.queue.wake(); expect(await result).toBe(true); expect(h.run).toHaveBeenCalledTimes(2);
    });

    it.each(['active', 'visible'] as const)('does not start a queued write while %s is false', async property => {
        const h = harness(), gate = deferred<IslandRecord>(); h.write.mockImplementationOnce(() => gate.promise);
        const first = h.queue.enqueue(brush(0)), second = h.queue.enqueue(brush(1)); h.context[property] = false;
        gate.resolve(h.persist(brush(0))); expect(await first).toBe(true);
        expect(await h.queue.enqueue(brush(2))).toBe(false); h.queue.wake();
        expect(h.write).toHaveBeenCalledTimes(1);
        h.context[property] = true; h.queue.wake(); expect(await second).toBe(true);
        expect(h.stored.workshop!.specimens.driftwood.cleanedMask).toBe(3);
    });

    it('checks the current learning gate again inside a deferred shared runner', async () => {
        const h = harness(), gate = deferred<void>();
        h.run.mockImplementationOnce(async action => { await gate.promise; return action(); });
        const result = h.queue.enqueue(brush(0)); h.context.active = false; gate.resolve();
        await vi.waitFor(() => expect(h.run).toHaveBeenCalledTimes(1));
        await Promise.resolve(); expect(h.write).not.toHaveBeenCalled();
        h.context.active = true; h.queue.wake(); expect(await result).toBe(true);
    });

    it('disposes queued UI promises and ignores an old response after profile unmount', async () => {
        const h = harness(), gate = deferred<IslandRecord>(); h.write.mockImplementationOnce(() => gate.promise);
        const first = h.queue.enqueue(brush(0)), second = h.queue.enqueue(name);
        h.queue.dispose(); h.context.island = { ...ready(), profileId: 'other' }; gate.resolve(h.persist(brush(0)));
        expect(await Promise.all([first, second])).toEqual([false, false]);
        await Promise.resolve(); h.queue.wake(); expect(h.write).toHaveBeenCalledTimes(1); expect(h.onSaved).not.toHaveBeenCalled();
        expect(await h.queue.retry()).toBe(false); expect(await h.queue.enqueue(brush(1))).toBe(false);
    });
});

describe('real IndexedDB receipts across unknown queue outcomes', () => {
    it.each(['undo', 'save-work'] as const)('retains the original %s receipt even after the live revision changes and new input arrives', async type => {
        // Explicit storage fixture. Learning acquisition is tested separately in workshopRepository.test.ts.
        const database = new SansuDatabase(`workshop-queue-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(database);
        const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child' };
        await database.profiles.put(profile); await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
        const initial = apply(apply(movable(), move(0)), move(1)); await database.islands.put(initial);
        const h = harness(initial), action: IslandWorkshopAction = type === 'undo'
            ? { type: 'edit-draft', edit: { type: 'undo' } } : { type: 'save-work', workId: 'work-1', name: 'そのときの かたち' };
        h.write.mockImplementation(async (id, request) => saveIslandWorkshop(id, request.revision, request.action, database));
        h.write.mockImplementationOnce(async (id, request) => {
            const committed = await saveIslandWorkshop(id, request.revision, request.action, database);
            h.context.island = committed; throw new Error('response lost after commit');
        });
        expect(await h.queue.enqueue(action)).toBe(false); const original = h.write.mock.calls[0][1];
        const latest = (await database.islands.get('child'))!;
        h.context.island = await saveIslandWorkshop('child', latest.revision, move(2), database);
        expect(await h.queue.enqueue(name)).toBe(true);
        expect(h.write.mock.calls[1][1]).toBe(original); expect(h.write.mock.calls.map(call => call[1].revision)).toEqual([0, 0, 2]);
        const after = (await database.islands.get('child'))!, state = getIslandWorkshop(after);
        expect(state.draftCheckpoint.draft.layout.parts.wheel.position).toEqual({ col: 2, row: 1 });
        if (type === 'save-work') expect(state.works['work-1']!.layout.parts.wheel.position).toEqual({ col: 1, row: 1 });
        expect(state.specimens.driftwood.name).toBe('ながれぼし');
        expect(await database.islandEvents.where('type').equals('workshop_changed').count()).toBe(3);
        expect(after.completedSets).toBe(initial.completedSets); expect(after.growth).toEqual(initial.growth);
        expect(await database.profiles.get('child')).toEqual(profile);
    });
});
