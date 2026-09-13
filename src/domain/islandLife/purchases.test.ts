import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOG, HOUR, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
import { IslandLifeDatabase, updateLife } from './repository';
import { removalRefund } from './purchases';

const databases: IslandLifeDatabase[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())); });
function funded() {
    const record = newLife('owner', 100);
    record.credits = Array.from({ length: 10 }, (_, i) => ({ id: `credit-${i}`, at: 100, day: learningDay(100) }));
    return record;
}
const buy = { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } } as const;

describe('purchase history survives future pricing and retries', () => {
    it('replays receipts and legacy events with historical prices after the live catalog changes', () => {
        const record = commandLife(funded(), buy, 'flower', 100);
        expect(record.actions[0].purchaseReceipt).toMatchObject({ actualPaidDrops: 2, priceVersion: 'life-48-v1', itemInstanceId: 'flower', committedAt: 100 });
        const legacy = structuredClone(record); delete legacy.actions[0].purchaseReceipt;
        const expected = replayLife(record);
        const price = CATALOG.flower.price;
        try {
            CATALOG.flower.price = 90;
            for (const source of [record, legacy]) {
                expect(replayLife(source)).toEqual(expected);
                const removed = commandLife(source, { type: 'remove', itemId: 'flower' }, 'remove', 100);
                expect(replayLife(removed).drops).toBe(19);
            }
            expect(() => commandLife(funded(), buy, 'new', 100)).toThrow('価格');
        } finally { CATALOG.flower.price = price; }
    });

    it('preserves the paid amount, identity, growth and style during free storage and replacement', () => {
        let record = commandLife(funded(), buy, 'flower', 100);
        record = commandLife(record, { type: 'store', itemId: 'flower' }, 'store', 100 + HOUR);
        const stored = replayLife(record);
        record = commandLife(record, { type: 'move', itemId: 'flower', cell: { x: 1, z: 3 } }, 'replace', 100 + 5 * HOUR);
        expect(replayLife(record).items[0]).toEqual({ ...stored.items[0], cell: { x: 1, z: 3 } });
        expect(replayLife(record).drops).toBe(stored.drops);
        expect(removalRefund(replayLife(record).items[0])).toBe(1);
        expect(removalRefund({ kind: 'flower', paidDrops: 0 })).toBe(0);
    });

    it('rejects unverifiable receipts instead of rewriting history', () => {
        const record = commandLife(funded(), buy, 'flower', 100);
        record.actions[0].purchaseReceipt!.actualPaidDrops = 0;
        expect(() => replayLife(record)).toThrow('購入の記録');
    });

    it('returns identical retries before stale revision checks but rejects a different payload atomically', async () => {
        const db = new IslandLifeDatabase(`purchase-${crypto.randomUUID()}`); databases.push(db);
        const record = funded(); await db.worlds.put(record);
        const intent = { id: 'purchase', revision: 0, command: buy };
        const saved = await updateLife('owner', [], intent, 100, db);
        const reordered = { cell: { z: 2, x: 0 }, kind: 'flower', type: 'buy' } as const;
        expect(await updateLife('owner', [], { ...intent, command: reordered }, 200, db)).toEqual(saved);
        await expect(updateLife('owner', [], { ...intent, command: { ...buy, cell: { x: 1, z: 3 } } }, 200, db)).rejects.toThrow('内容');
        await expect(updateLife('owner', [], { id: intent.id, revision: 0, advanceHours: 6 }, 200, db)).rejects.toThrow('内容');
        expect(await db.worlds.get('owner')).toEqual(saved);
        expect(() => commandLife(saved, { type: 'remove', itemId: 'purchase' }, intent.id, 200)).toThrow('内容');
    });

    it('rejects command/time ambiguity and changed time intents without changing the owner', async () => {
        const db = new IslandLifeDatabase(`purchase-${crypto.randomUUID()}`); databases.push(db);
        const record = funded(); await db.worlds.put(record);
        await expect(updateLife('owner', [], { id: 'both', revision: 0, command: buy, advanceHours: 6 }, 100, db)).rejects.toThrow('intent');
        const saved = await updateLife('owner', [], { id: 'clock', revision: 0, advanceHours: 6 }, 100, db);
        await expect(updateLife('owner', [], { id: 'clock', revision: 0, advanceHours: 24 }, 100, db)).rejects.toThrow('内容');
        expect(await db.worlds.get('owner')).toEqual(saved);
    });
});
