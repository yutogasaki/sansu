import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../../domain/user/profile';
import { photoInput } from '../../domain/island/photos.testSupport';
import type { IslandPhotoAlbumSnapshot, IslandPhotoInput, IslandPhotoBlobPair, IslandPhotoWriteResult } from '../../domain/island/photos';

// Deliberately controlled hook commits leave React paint and liveQuery behind a
// real receipt result. This reproduces the captured-browser race without a DOM.
const hooks = vi.hoisted(() => {
    type Cell = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
    const cells: Cell[] = []; let cursor = 0;
    const effects: (() => void)[] = [];
    const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index])));
    return { cells, effects, query: undefined as unknown, save: vi.fn(), remove: vi.fn(), prepare: vi.fn(),
        reset() { cells.length = 0; effects.length = 0; cursor = 0; this.query = undefined; },
        begin() { cursor = 0; },
        useState(initial?: unknown) {
            const index = cursor++; if (!cells[index]) cells[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [cells[index].value, (next: unknown) => { cells[index].value = typeof next === 'function' ? next(cells[index].value) : next; }];
        },
        useRef(value?: unknown) { const index = cursor++; if (!cells[index]) cells[index] = { value: { current: value } }; return cells[index].value; },
        useCallback(callback: unknown, deps: unknown[]) {
            const index = cursor++; if (!cells[index] || !same(cells[index].deps, deps)) cells[index] = { value: callback, deps }; return cells[index].value;
        },
        effect(callback: () => void | (() => void), deps?: unknown[]) {
            const index = cursor++, previous = cells[index];
            if (!previous || !same(previous.deps, deps)) {
                cells[index] = { deps, cleanup: previous?.cleanup };
                effects.push(() => { cells[index].cleanup?.(); cells[index].cleanup = callback() || undefined; });
            }
        },
        commit() { for (const effect of effects.splice(0)) effect(); },
        unmount() { for (const cell of cells) cell.cleanup?.(); },
    };
});
vi.mock('react', () => ({ useState: hooks.useState, useRef: hooks.useRef, useCallback: hooks.useCallback, useEffect: hooks.effect, useLayoutEffect: hooks.effect }));
vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => hooks.query }));
vi.mock('../../domain/island/photosRepository', async importOriginal => ({ ...await importOriginal<object>(), saveIslandPhoto: hooks.save, deleteIslandPhoto: hooks.remove }));
vi.mock('./islandPhotoCapture', () => ({ prepareIslandPhoto: hooks.prepare }));
import { useIslandPhotos } from './useIslandPhotos';

const actual = await vi.importActual<typeof import('../../domain/island/photosRepository')>('../../domain/island/photosRepository');
const databases: SansuDatabase[] = [];
const subject = { composition: 'island' as const, islandName: 'わたしの しま' };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
beforeEach(() => { hooks.reset(); hooks.save.mockReset(); hooks.remove.mockReset(); hooks.prepare.mockReset(); });
afterEach(async () => {
    hooks.unmount(); vi.unstubAllGlobals();
    for (const d of databases.splice(0)) { d.close(); await d.delete(); }
});
async function harness() {
    const d = new SansuDatabase(`photo-hook-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const child = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child' }, other = { ...child, id: 'other' };
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child, other } });
    const shot = await photoInput(), prepared = { image: shot.input.image, thumbnail: shot.input.thumbnail, blobs: shot.blobs };
    hooks.prepare.mockResolvedValue(prepared);
    hooks.save.mockImplementation((id: string, revision: number, input: IslandPhotoInput, blobs: IslandPhotoBlobPair) => actual.saveIslandPhoto(id, revision, input, blobs, d));
    hooks.remove.mockImplementation((id: string, revision: number, photoId: string) => actual.deleteIslandPhoto(id, revision, photoId, d));
    const doc = Object.assign(new EventTarget(), { hidden: false }); vi.stubGlobal('document', doc);
    let owner = 'child', enabled = true;
    const operations: Promise<unknown>[] = [];
    const run = <T,>(action: () => Promise<T>) => {
        const operation = action(); operations.push(operation); return operation;
    };
    let api!: ReturnType<typeof useIslandPhotos>;
    const RenderPhotoHook = (id = owner, active = enabled) => { owner = id; enabled = active; hooks.begin(); api = useIslandPhotos(owner, enabled, run); hooks.commit(); return api; };
    const render = RenderPhotoHook;
    const observe = (snapshot: IslandPhotoAlbumSnapshot) => { hooks.query = { owner: snapshot.album.profileId, snapshot }; return render(); };
    observe(await actual.readIslandPhotoAlbum(owner, d)); render();
    const shoot = () => { api.capture(subject); render(); const id = api.requestId!; expect(id).toBeDefined(); api.consume(id, 'actual encoded frame supplied by capture adapter'); return id; };
    const waitStatus = async (status: string, photoId?: string) => vi.waitFor(() => {
        render(); expect(api.status).toBe(status);
        if (photoId) expect(api.savedPhotoId).toBe(photoId);
    }, { timeout: 2000, interval: 1 });
    const finishOperation = async (index: number) => {
        await vi.waitFor(() => expect(operations[index]).toBeDefined(), { timeout: 2000, interval: 1 });
        // execute already awaits this exact Promise before our waiter subscribes.
        // Its synchronous receipt/ref adoption therefore finishes before this await
        // resumes, without requiring a React commit or a guessed number of timers.
        await operations[index];
    };
    const switchOwner = async (id: string) => {
        const app = (await d.appData.get('app'))!; await d.appData.put({ ...app, activeProfileId: id });
        hooks.query = undefined; render(id, true); observe(await actual.readIslandPhotoAlbum(id, d)); render();
    };
    return { d, prepared, render, observe, shoot, waitStatus, finishOperation, switchOwner, get api() { return api; },
        hidden() { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); }, unmount: hooks.unmount };
}

describe('photo hook adopts real receipt results independently of liveQuery and paint', () => {
    it('recovers an unknown committed save, keeps the same intent/Blob retry, then accepts a new shutter before React repaints', async () => {
        const h = await harness(), gate = deferred<IslandPhotoWriteResult>(); let replayed: IslandPhotoWriteResult | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, input, blobs) => { await actual.saveIslandPhoto(id, revision, input, blobs, h.d); throw new Error('completion lost'); });
        hooks.save.mockImplementationOnce(async (id, revision, input, blobs) => { replayed = await actual.saveIslandPhoto(id, revision, input, blobs, h.d); return gate.promise; });
        const first = h.shoot(); await h.finishOperation(0); await h.waitStatus('error');
        expect(h.api.snapshot!.album.revision).toBe(0); expect((await actual.readIslandPhotoAlbum('child', h.d)).album.revision).toBe(1);
        const staleHandler = h.api; staleHandler.retry();
        await vi.waitFor(() => expect(replayed).toBeDefined());
        // A committed DB row alone does not release the shared save operation.
        // Explicitly hold delivery: early gestures must be rejected, then the same
        // stale callback must work immediately after receipt adoption.
        staleHandler.capture(subject); h.render(); expect(h.api.requestId).toBeUndefined();
        expect(await staleHandler.remove(first)).toBe(false); expect(hooks.remove).not.toHaveBeenCalled();
        gate.resolve(replayed!); await h.finishOperation(1);
        expect(hooks.save).toHaveBeenCalledTimes(2);
        expect(hooks.save.mock.calls[1][1]).toBe(0); expect(hooks.save.mock.calls[1][2]).toBe(hooks.save.mock.calls[0][2]); expect(hooks.save.mock.calls[1][3]).toBe(hooks.save.mock.calls[0][3]);
        // No render has happened since retry completion: this callback still closes over query revision 0.
        staleHandler.capture(subject); h.render(); const second = h.api.requestId!; expect(second).toBeDefined(); expect(second).not.toBe(first);
        h.api.consume(second, 'next actual frame'); await h.finishOperation(2); await h.waitStatus('saved', second);
        expect(hooks.save).toHaveBeenCalledTimes(3);
        expect(hooks.save.mock.calls[2][1]).toBe(1); expect(h.api.snapshot!.album.revision).toBe(2);
        expect((await actual.readIslandPhotoAlbum('child', h.d)).photos.map(photo => photo.id).sort()).toEqual([first, second].sort());
    });
    it('ignores later stale liveQuery snapshots and uses a newer committed query for the next save', async () => {
        const h = await harness(), zero = h.api.snapshot!;
        const first = h.shoot(); await h.finishOperation(0); await h.waitStatus('saved', first); const one = await actual.readIslandPhotoAlbum('child', h.d);
        const extra = await photoInput(); await actual.saveIslandPhoto('child', 1, extra.input, extra.blobs, h.d); const two = await actual.readIslandPhotoAlbum('child', h.d);
        h.observe(two); h.render(); expect(h.api.snapshot!.album.revision).toBe(2);
        h.observe(zero); h.observe(one); expect(h.api.snapshot!.album.revision).toBe(2);
        const next = h.shoot(); await h.finishOperation(1); await h.waitStatus('saved', next); expect(hooks.save.mock.calls.at(-1)![1]).toBe(2); expect(h.api.snapshot!.album.revision).toBe(3);
    });
    it('publishes deletion after an old-save replay and a following capture cannot resurrect the removed image', async () => {
        const h = await harness();
        hooks.save.mockImplementationOnce(async (id, revision, input, blobs) => { await actual.saveIslandPhoto(id, revision, input, blobs, h.d); throw new Error('completion lost'); });
        const removedId = h.shoot(); await h.finishOperation(0); await h.waitStatus('error'); await actual.deleteIslandPhoto('child', 1, removedId, h.d);
        h.api.retry(); await h.finishOperation(1); h.render(); expect(h.api.status).toBe('error'); expect(h.api.error).toContain('はずされている'); expect(h.api.canRetry).toBe(false);
        expect(h.api.snapshot!.album.revision).toBe(2); expect(h.api.snapshot!.photos).toEqual([]);
        const next = h.shoot(); await h.finishOperation(2); await h.waitStatus('saved', next); expect(hooks.save.mock.calls.at(-1)![1]).toBe(2);
        expect((await actual.readIslandPhotoAlbum('child', h.d)).photos.map(photo => photo.id)).toEqual([next]);
    });
    it('does not regress a newer deletion query when an older successful write result arrives late', async () => {
        const h = await harness(), gate = deferred<IslandPhotoWriteResult>(); let result: IslandPhotoWriteResult | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, input, blobs) => { result = await actual.saveIslandPhoto(id, revision, input, blobs, h.d); return gate.promise; });
        const id = h.shoot(); await vi.waitFor(() => expect(result).toBeDefined());
        await actual.deleteIslandPhoto('child', 1, id, h.d); h.observe(await actual.readIslandPhotoAlbum('child', h.d)); gate.resolve(result!); await h.finishOperation(0); h.render();
        expect(h.api.snapshot!.album.revision).toBe(2); expect(h.api.snapshot!.photos).toEqual([]); expect(h.api.error).toContain('はずされている');
        const next = h.shoot(); await h.finishOperation(1); await h.waitStatus('saved', next); expect(hooks.save.mock.calls.at(-1)![1]).toBe(2);
    });
    it('uses the synchronously adopted save result for a following delete through an older callback', async () => {
        const h = await harness(), stale = h.api, id = h.shoot(); await h.finishOperation(0);
        expect(await stale.remove(id)).toBe(true); h.render(); expect(hooks.remove).toHaveBeenCalledTimes(1); expect(hooks.remove.mock.calls[0][1]).toBe(1);
        expect(h.api.snapshot!.album.revision).toBe(2); expect(h.api.snapshot!.photos).toEqual([]);
    });
});

describe('photo result adoption stays within profile and view ownership', () => {
    it('ignores a former profile write result after switching, and the new owner starts from its own album revision', async () => {
        const h = await harness(), gate = deferred<IslandPhotoWriteResult>(); let result: IslandPhotoWriteResult | undefined;
        hooks.save.mockImplementationOnce(async (id, revision, input, blobs) => { result = await actual.saveIslandPhoto(id, revision, input, blobs, h.d); return gate.promise; });
        const oldApi = h.api; h.shoot(); await vi.waitFor(() => expect(result).toBeDefined()); await h.switchOwner('other');
        gate.resolve(result!); await h.finishOperation(0); h.render(); expect(h.api.snapshot!.album.profileId).toBe('other'); expect(h.api.snapshot!.album.revision).toBe(0);
        oldApi.capture(subject); h.render(); expect(h.api.requestId).toBeUndefined();
        const next = h.shoot(); await h.finishOperation(1); await h.waitStatus('saved', next); expect(hooks.save.mock.calls.at(-1)![0]).toBe('other'); expect(hooks.save.mock.calls.at(-1)![1]).toBe(0);
    });
    it.each(['disabled', 'hidden', 'unmounted', 'profile'] as const)('does not start a writer when a held conversion returns after %s', async boundary => {
        const h = await harness(), gate = deferred<typeof h.prepared>(); hooks.prepare.mockReturnValueOnce(gate.promise);
        h.shoot();
        if (boundary === 'disabled') h.render('child', false);
        else if (boundary === 'hidden') h.hidden();
        else if (boundary === 'unmounted') h.unmount();
        else await h.switchOwner('other');
        gate.resolve(h.prepared); await gate.promise;
        // consume subscribed to this conversion before the test; its cancellation
        // check has now returned. No timer or render is needed to flush a writer.
        expect(hooks.save).not.toHaveBeenCalled(); expect(await h.d.islandPhotos.count()).toBe(0);
    });
});
