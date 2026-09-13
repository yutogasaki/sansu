import { describe, expect, it } from 'vitest';
import { newLife, learningDay, type LifeState } from './model';
import { commandLife, replayLife, arrangeVisits } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { pathToActivity } from './space';
import { createDiscoveryScene } from './discoveryJournal';
import { discoveryParticipants, discoveryTitle } from './discoveryRecall';
import { benchRelation } from './discovery';
async function source() {
    const old = newLife('picnic', 0); old.credits = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    return prepareTourMigration(await prepareEconomyMigration(old, []));
}
describe('picnic ownership and opposing seat reservations', () => {
    it('keeps historical receipts and refuses missing receipts or an older reader version', async () => {
        let record = commandLife(await source(), { type: 'buy', kind: 'water-bowl', cell: { x: 4, z: 2 } }, 'water', 0);
        const old = structuredClone(record.actions[0]);
        record = commandLife(record, { type: 'buy', kind: 'picnic-table', cell: { x: 1, z: 2 } }, 'table', 0);
        expect(record.version).toBe(7); expect(record.actions[0]).toEqual(old);
        expect(record.actions[1].purchaseReceipt).toMatchObject({ priceVersion: 'life-v3-picnic-v1', actualPaidDrops: 8 });
        expect(replayLife(record).drops).toBe(28);
        expect(commandLife(record, { type: 'buy', kind: 'picnic-table', cell: { x: 1, z: 2 } }, 'table', 1)).toBe(record);
        expect(() => replayLife({ ...record, version: 6 })).toThrow();
        const missing = structuredClone(record); delete missing.actions[1].purchaseReceipt; expect(() => replayLife(missing)).toThrow();
        const wrong = structuredClone(record); wrong.actions[1].purchaseReceipt!.actualPaidDrops = 4; expect(() => replayLife(wrong)).toThrow();
        const removed = commandLife(record, { type: 'remove', itemId: 'table' }, 'remove', 0);
        expect(removed.version).toBe(7); expect(replayLife(removed).drops).toBe(32);
    });
    it.each([false, true])('retains land receipts before or after the table purchase (land first=%s)', async landFirst => {
        let record = await source();
        if (landFirst) record = commandLife(record, { type: 'expand', side: 'east' }, 'land', 0);
        record = commandLife(record, { type: 'buy', kind: 'picnic-table', cell: { x: 1, z: 2 } }, 'table', 0);
        if (!landFirst) record = commandLife(record, { type: 'expand', side: 'east' }, 'land', 0);
        expect(record.version).toBe(7); expect(replayLife(record).expanded).toBe('east'); expect(replayLife(record).drops).toBe(20);
        expect(record.actions.find(a => a.id === 'land')?.landReceipt?.actualPaidDrops).toBe(12);
    });
    it('reserves two different opposing approaches, rejects a third and falls back to one usable side', async () => {
        const record = commandLife(await source(), { type: 'buy', kind: 'picnic-table', cell: { x: 1, z: 2 } }, 'table', 0);
        const state = replayLife(record), visitors = state.residents.filter(r => r.visit?.itemId === 'table');
        expect(visitors).toHaveLength(2);
        expect(visitors.map(r => r.visit!.path.at(-1)!.z).sort()).toEqual([1, 3]);
        const table = state.items[0]; expect(pathToActivity(state, { x: 2, z: 1 }, table, [{ x: 1, z: 1 }, { x: 1, z: 3 }])).toBeUndefined();
        const single: LifeState = { ...state, residents: replayLife(newLife('single', 0)).residents, items: [...state.items, { id: 'block', kind: 'lantern', growth: 0, style: 'original', cell: { x: 1, z: 1 } }] };
        single.activityVersion = 1; arrangeVisits(single); expect(single.residents.filter(r => r.visit?.itemId === 'table')).toHaveLength(1);
    });
    it('uses one mature tree for R2, without requiring a grove', async () => {
        const state = replayLife(commandLife(await source(), { type: 'buy', kind: 'picnic-table', cell: { x: 0, z: 2 } }, 'table', 0));
        state.items.push({ id: 'tree', kind: 'sapling', cell: { x: 2, z: 2 }, growth: 6, style: 'original' });
        expect(benchRelation(state, 'p', 'table')).toBeUndefined(); state.items[1].growth = 18;
        const rule = benchRelation(state, 'p', 'table')!; expect(rule.ruleId).toBe('R2');
        const event = await createDiscoveryScene('p', state, rule, 'live', 'r2', 0);
        expect(discoveryParticipants(event).map(i => i.id)).toEqual(['table', 'tree']); expect(discoveryTitle(event)).toBe('木かげの テーブル');
        state.items[1].cell = { x: 5, z: 4 };
        expect(benchRelation(state, 'p', 'table')).toBeUndefined();
    });
});
