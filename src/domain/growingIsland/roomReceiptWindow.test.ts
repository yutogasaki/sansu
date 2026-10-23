import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { commandGrowingIsland, GrowingIslandDatabase, type GrowingRecord } from './repository';
import { newIsland } from './island';

describe('the finite house receipt window inside the actual transaction', () => {
    it('rejects a missing receipt after another tab advances 500 revisions, but accepts an existing receipt', async () => {
        const database = new GrowingIslandDatabase('room-window-' + crypto.randomUUID());
        const record: GrowingRecord = { profileId: 'kid', version: 5, revision: 500, createdAt: 0, updatedAt: 0, state: newIsland('kid', 0) };
        try {
            await database.islands.put(record);
            const intent = { id: 'retry', command: { type: 'decorate' as const, rug: 2 } };
            await expect(commandGrowingIsland('kid', intent, 0, database, 0)).rejects.toThrow('えらびなおせる');
            expect((await database.islands.get('kid'))?.revision).toBe(500);
            record.state.applied = ['retry']; await database.islands.put(record);
            const result = await commandGrowingIsland('kid', intent, 0, database, 0);
            expect(result.record.revision).toBe(500); expect(result.record.state.room?.rug).not.toBe(2);
        } finally { database.close(); await database.delete(); }
    });
});
