import { afterEach, describe, expect, it, vi } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import type { GrowingRecord } from '../../../domain/growingIsland/repository';
import { RoomSaveSession, type RoomSaveSnapshot } from './roomSaveSession';

function record(revision = 0, rug = 0, applied: string[] = [], islandId = 'main'): GrowingRecord {
    return { profileId: 'kid', islandId, version: 5, revision, createdAt: 0, updatedAt: revision,
        state: { ...newIsland('kid', 0), applied, room: { pattern: 'dots', rug, hidden: [] } } };
}
function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function setup() {
    let snapshot: RoomSaveSnapshot = { status: 'loading', busy: false };
    const read = vi.fn(async (): Promise<GrowingRecord | undefined> => record());
    const write = vi.fn(async (intent: { id: string }): Promise<{ record: GrowingRecord }> => ({ record: record(1, 1, [intent.id]) }));
    const session = new RoomSaveSession('kid', { read, write }, value => { snapshot = value; });
    return { session, read, write, snapshot: () => snapshot };
}
afterEach(() => vi.useRealTimers());

describe('house save ownership and recovery', () => {
    it('recovers from a loading error after a successful read', async () => {
        const t = setup(); t.session.failLoading(); expect(t.snapshot().status).toBe('error');
        await t.session.retry(); expect(t.snapshot()).toMatchObject({ status: 'ready', error: undefined }); t.session.dispose();
    });
    it('never rolls the room or mastery back through observer or failed-write readback', async () => {
        const t = setup(); await t.session.observe(record());
        await t.session.decorate({ type: 'decorate', rug: 1 });
        await t.session.observe(record(0, 0));
        expect(t.snapshot().record?.state.room?.rug).toBe(1);
        t.write.mockRejectedValueOnce(new Error('abort')); t.read.mockResolvedValueOnce(record(0, 0));
        await t.session.decorate({ type: 'decorate', rug: 2 });
        expect(t.snapshot().record?.revision).toBe(1);
        expect(t.snapshot().record?.state.room?.rug).toBe(1);
        t.session.dispose();
    });
    it('treats 8 seconds as unknown; a same-revision receipt confirms without unlocking a pending writer', async () => {
        vi.useFakeTimers(); const t = setup(), pending = deferred<{ record: GrowingRecord }>();
        t.write.mockReturnValueOnce(pending.promise); await t.session.observe(record());
        const saving = t.session.decorate({ type: 'decorate', rug: 1 });
        await vi.advanceTimersByTimeAsync(8000); expect(t.snapshot().status).toBe('unknown');
        const id = t.write.mock.calls[0][0].id, saved = record(1, 1, [id]);
        await t.session.observe(saved); t.read.mockResolvedValue(saved); await t.session.retry();
        expect(t.snapshot()).toMatchObject({ status: 'saved', busy: true });
        await t.session.decorate({ type: 'decorate', rug: 2 }); expect(t.write).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(8000); expect(t.snapshot().status).toBe('saved');
        pending.resolve({ record: saved }); await saving;
        expect(t.snapshot()).toMatchObject({ status: 'saved', busy: false }); t.session.dispose();
    });
    it('does not resend a pending request with no receipt, including failed inquiries', async () => {
        vi.useFakeTimers(); const t = setup(), pending = deferred<{ record: GrowingRecord }>();
        t.write.mockReturnValueOnce(pending.promise); await t.session.observe(record());
        const saving = t.session.decorate({ type: 'decorate', rug: 1 });
        await vi.advanceTimersByTimeAsync(8000); await t.session.retry();
        t.read.mockRejectedValueOnce(new Error('read unavailable')); await t.session.retry();
        expect(t.snapshot()).toMatchObject({ status: 'unknown', busy: true }); expect(t.write).toHaveBeenCalledTimes(1);
        pending.reject(new Error('abort')); await saving; t.session.dispose();
    });
    it('retries a settled failure with the same id and preserves newer attributes', async () => {
        const t = setup(); await t.session.observe(record());
        t.write.mockRejectedValueOnce(new Error('abort')); await t.session.decorate({ type: 'decorate', rug: 1 });
        expect(t.snapshot()).toMatchObject({ status: 'error', busy: false });
        const id = t.write.mock.calls[0][0].id;
        const latest = record(2, 0); latest.state.room!.hidden = ['food']; t.read.mockResolvedValue(latest);
        t.write.mockImplementationOnce(async () => ({ record: { ...latest, revision: 3, state: { ...latest.state, applied: [id], room: { ...latest.state.room!, rug: 1 } } } }));
        await t.session.retry(); expect(t.write.mock.calls[1][0].id).toBe(id);
        expect(t.snapshot().record?.state.room).toMatchObject({ rug: 1, hidden: ['food'] }); t.session.dispose();
    });
    it('does not replay when 500 commands could have evicted the receipt', async () => {
        const t = setup(); await t.session.observe(record());
        t.write.mockRejectedValueOnce(new Error('lost result')); t.read.mockResolvedValue(record(500));
        await t.session.decorate({ type: 'decorate', rug: 1 }); await t.session.retry();
        expect(t.snapshot().status).toBe('ready'); expect(t.write).toHaveBeenCalledTimes(1);
        t.write.mockImplementationOnce(async intent => ({ record: record(501, 2, [intent.id]) }));
        await t.session.decorate({ type: 'decorate', rug: 2 });
        expect(t.write.mock.calls[1][0].id).not.toBe(t.write.mock.calls[0][0].id);
        expect(t.snapshot().status).toBe('saved'); t.session.dispose();
    });
    it('keeps a confirmed result when an older in-flight inquiry arrives later', async () => {
        const t = setup(), pending = deferred<{ record: GrowingRecord }>(), inquiry = deferred<GrowingRecord | undefined>();
        await t.session.observe(record()); t.write.mockReturnValueOnce(pending.promise);
        const saving = t.session.decorate({ type: 'decorate', rug: 1 });
        t.read.mockReturnValueOnce(inquiry.promise); const checking = t.session.retry();
        const id = t.write.mock.calls[0][0].id; const saved = record(1, 1, [id]);
        await t.session.observe(saved); inquiry.resolve(record()); await checking;
        expect(t.snapshot()).toMatchObject({ status: 'saved', busy: true });
        pending.resolve({ record: saved }); await saving; t.session.dispose();
    });
    it('confirms an island transition from current storage, ignoring old replies and finally', async () => {
        const t = setup(), pending = deferred<{ record: GrowingRecord }>(); await t.session.observe(record(10));
        t.write.mockReturnValueOnce(pending.promise); const oldWrite = t.session.decorate({ type: 'decorate', rug: 1 });
        const next = record(0, 2, [], 'next'); t.read.mockResolvedValue(next); await t.session.observe(next);
        const nextPending = deferred<{ record: GrowingRecord }>(); t.write.mockReturnValueOnce(nextPending.promise);
        const nextWrite = t.session.decorate({ type: 'decorate', rug: 3 });
        pending.resolve({ record: record(11, 1, [t.write.mock.calls[0][0].id]) }); await oldWrite;
        expect(t.snapshot()).toMatchObject({ status: 'saving', busy: true }); expect(t.snapshot().record?.islandId).toBe('next');
        await t.session.observe(record(12)); expect(t.snapshot().record?.islandId).toBe('next');
        nextPending.resolve({ record: record(1, 3, [t.write.mock.calls[1][0].id], 'next') }); await nextWrite;
        expect(t.snapshot()).toMatchObject({ status: 'saved', busy: false }); t.session.dispose();
    });
    it('drops stale cross-island refreshes when a newer notification arrives', async () => {
        const t = setup(), inquiry = deferred<GrowingRecord | undefined>(); await t.session.observe(record(10));
        t.read.mockReturnValueOnce(inquiry.promise); const old = t.session.observe(record(1, 3, [], 'old'));
        await t.session.observe(record(11, 2)); inquiry.resolve(record(2, 3, [], 'old')); await old;
        expect(t.snapshot().record?.state.room?.rug).toBe(2); t.session.dispose();
    });
    it('does not publish an old owner after disposal or accept a different profile', async () => {
        const t = setup(); await t.session.observe(record());
        const before = t.snapshot(); await t.session.observe({ ...record(2), profileId: 'another' }); expect(t.snapshot()).toBe(before);
        const pending = deferred<{ record: GrowingRecord }>(); t.write.mockReturnValueOnce(pending.promise);
        const saving = t.session.decorate({ type: 'decorate', rug: 1 }); t.session.dispose(); const final = t.snapshot();
        pending.resolve({ record: record(1, 1, [t.write.mock.calls[0][0].id]) }); await saving; expect(t.snapshot()).toBe(final);
    });
});
