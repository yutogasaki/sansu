import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOUR, newLife } from '../islandLife/model';
import { replayLifeForMigration } from './lifeMigration';

const mocks = vi.hoisted(() => ({ restore: vi.fn(), replay: vi.fn() }));
vi.mock('../islandLife/replaySnapshot', () => ({ restoreLifeSnapshot: mocks.restore }));
vi.mock('../islandLife/simulation', () => ({ replayLife: mocks.replay }));
afterEach(() => vi.resetAllMocks());

describe('read-only Life migration replay', () => {
    it.each([
        ['normal absence', 5 * HOUR, 5 * HOUR],
        ['long absence', 365 * 24 * HOUR, 7 * 24 * HOUR],
        ['clock rollback', -24 * HOUR, 0],
    ])('uses the saved logical clock for %s', async (_label, elapsed, expected) => {
        const record = newLife('kid', 1000);
        record.now += 40 * HOUR; // A saved virtual-clock offset must survive the cutover.
        const original = structuredClone(record);
        mocks.restore.mockResolvedValue(false);
        const state = { now: record.now + expected }; mocks.replay.mockReturnValue(state);
        expect(await replayLifeForMigration(record, record.realAt + elapsed)).toBe(state);
        expect(mocks.restore).toHaveBeenCalledWith(record);
        expect(mocks.replay).toHaveBeenCalledWith(record, record.now + expected);
        expect(record).toEqual(original);
    });

    it('finishes snapshot verification before replay, without requiring a valid cache', async () => {
        const record = newLife('kid', 1000);
        let restored!: (valid: boolean) => void;
        mocks.restore.mockReturnValue(new Promise<boolean>(resolve => { restored = resolve; }));
        const result = replayLifeForMigration(record, 1000);
        expect(mocks.replay).not.toHaveBeenCalled();
        restored(true); await result;
        expect(mocks.replay).toHaveBeenCalledOnce();
    });
});
