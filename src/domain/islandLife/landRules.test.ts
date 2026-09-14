import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { learningDay, newLife, type LandSide } from './model';
import { commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { landBounds, landQuote } from './landRules';
import { homeCell, landCells, pathToActivity, usablePlacement } from './space';
import { IslandLifeDatabase, updateLife } from './repository';
function legacy() {
    const record = newLife('land-owner', 0);
    record.credits = Array.from({ length: 60 }, (_, i) => ({ id: `credit-${i}`, at: 0, day: learningDay(0) }));
    return record;
}
async function modern() { return prepareTourMigration(await prepareEconomyMigration(legacy(), [])); }
describe('receipted land expansion', () => {
    it.each(['east', 'west'] as const)('expands %s, opposite, south for 12/24/48 without changing historical views', async first => {
        let record = await modern(); const original = replayLife(record);
        const directions: LandSide[] = [first, first === 'east' ? 'west' : 'east', 'south'];
        for (let i = 0; i < directions.length; i++) {
            const before = record;
            record = commandLife(record, { type: 'expand', side: directions[i] }, `expand-${i}`, i + 1);
            expect(record.version).toBe(5); expect(record.actions[i].landReceipt?.actualPaidDrops).toBe([12, 24, 48][i]);
            expect(landCells(replayLife(record))).toHaveLength([45, 60, 96][i]);
            expect(replayLife(record, i)).toEqual(replayLife(before, i));
            expect(commandLife(record, { type: 'expand', side: directions[i] }, `expand-${i}`, 99)).toBe(record);
        }
        const state = replayLife(record);
        expect(state.drops).toBe(original.drops - 84); expect(landQuote(state)).toBeUndefined();
        expect(landBounds(state)).toEqual({ minX: -3, maxX: 8, depth: 8 });
        expect(record.economyCheckpoint).toEqual((await modern()).economyCheckpoint);
        expect(await prepareTourMigration(record)).toBe(record);
        expect(() => commandLife(record, { type: 'expand', side: 'south' }, 'fourth', 4)).toThrow();
    });
    it('keeps an old first expansion unreceipted and preserves the old 12 drop payment', async () => {
        const old = commandLife(legacy(), { type: 'expand', side: 'west' }, 'old-west', 0);
        const before = replayLife(old), migrated = await prepareTourMigration(await prepareEconomyMigration(old, []));
        const next = commandLife(migrated, { type: 'expand', side: 'east' }, 'new-east', 1);
        expect(next.actions[0]).toEqual(old.actions[0]); expect(next.actions[0].landReceipt).toBeUndefined();
        expect(replayLife(next).drops).toBe(before.drops - 24);
        expect(() => commandLife(old, { type: 'expand', side: 'east' }, 'illegal-old-second', 1)).toThrow();
    });
    it('rejects wrong directions, insufficient funds, forged receipts and downgraded records', async () => {
        const source = await modern();
        expect(() => commandLife(source, { type: 'expand', side: 'south' }, 'bad', 1)).toThrow();
        const first = commandLife(source, { type: 'expand', side: 'east' }, 'east', 1);
        expect(() => commandLife(first, { type: 'expand', side: 'east' }, 'again', 2)).toThrow();
        for (const patch of [{ actualPaidDrops: 0 }, { actionId: 'other' }, { committedAt: 9 }, { step: 3 }, { side: 'south' }]) {
            const bad = structuredClone(first); Object.assign(bad.actions[0].landReceipt!, patch);
            expect(() => replayLife(bad)).toThrow();
        }
        expect(() => replayLife({ ...first, version: 4 })).toThrow();
        const empty = await prepareTourMigration(await prepareEconomyMigration(newLife('empty', 0), []));
        expect(() => commandLife(empty, { type: 'expand', side: 'west' }, 'poor', 1)).toThrow();
    });
    it('allows the new corner cells while retaining the front approach and home route checks', async () => {
        let record = await modern();
        for (const side of ['west', 'east', 'south'] as const) record = commandLife(record, { type: 'expand', side }, side, 1);
        for (const [index, cell] of [{ x: -3, z: 7 }, { x: 8, z: 7 }, { x: -3, z: 0 }, { x: 8, z: 0 }].entries()) record = commandLife(record, { type: 'buy', kind: 'flower', cell }, `flower-${index}`, 1);
        const state = replayLife(record);
        expect(state.items.every(item => pathToActivity(state, homeCell, item))).toBe(true);
        expect(usablePlacement(state, 'flower-0', { x: 9, z: 7 })).toBe(false);
        expect(() => commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 7 } }, 'blocked-front', 1)).toThrow();
        expect(usablePlacement(state, 'flower-0', homeCell)).toBe(false);
    });
    it('rolls back failed purchases and retries an intent once in the owner transaction', async () => {
        const db = new IslandLifeDatabase(`land-test-${Math.random()}`);
        try {
            await db.worlds.put(await modern());
            const current = (await db.worlds.get('land-owner'))!;
            const intent = { id: 'atomic-east', revision: current.revision, command: { type: 'expand' as const, side: 'east' as const } };
            db.worlds.hook('creating', () => { throw new Error('unexpected creation'); });
            const fail = () => { throw new Error('write failed'); }; db.worlds.hook('updating', fail);
            await expect(updateLife('land-owner', [], intent, 1, db)).rejects.toThrow('write failed');
            expect(await db.worlds.get('land-owner')).toEqual(current);
            db.worlds.hook('updating').unsubscribe(fail);
            const saved = await updateLife('land-owner', [], intent, 1, db);
            expect(saved.version).toBe(17); expect(await updateLife('land-owner', [], intent, 2, db)).toEqual(saved);
            const resumed = await updateLife('land-owner', [], undefined, 3, db);
            expect(replayLife(resumed).drops).toBe(replayLife(current).drops - 12);
        } finally { await db.delete(); }
    });
});
