import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IslandLifeDatabase, updateLife } from './repository';
import { HOUR, learningDay, newLife } from './model';
import { commandLife, replayLife } from './simulation';
import { verifyEconomyCheckpoint } from './economyMigration';
const stores: IslandLifeDatabase[] = [];
const fresh = () => { const database = new IslandLifeDatabase(`economy-cutover-${crypto.randomUUID()}`); stores.push(database); return database; };
afterEach(async () => { await Promise.all(stores.splice(0).map(database => database.delete())); });
function legacy() {
    let record = newLife('p', 0);
    record.credits = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'f', 0); return record;
}
describe('atomic v3 economy cutover', () => {
    it('rolls back an interrupted cutover and retries the same checkpoint without losing the legacy row', async () => {
        const database = fresh(), old = legacy(); await database.worlds.put(old);
        const fail = () => { throw new Error('interrupted disk write'); };
        database.worlds.hook('updating', fail);
        await expect(updateLife('p', [], undefined, HOUR, database)).rejects.toThrow('interrupted');
        expect(await database.worlds.get('p')).toEqual(old);
        database.worlds.hook('updating').unsubscribe(fail);
        const migrated = await updateLife('p', [], undefined, HOUR, database);
        expect(migrated.economyCheckpoint!.originalRecord).toEqual(old);
        expect(migrated.version).toBe(18); expect(migrated.economyCheckpoint!.checkpointId).toBe(JSON.stringify(['p', 'life-v3.0-rc1']));
        expect(migrated.economyCheckpoint!.sourceRecord.actions).toEqual(old.actions);
        await verifyEconomyCheckpoint(migrated.economyCheckpoint!);
        const repeat = await updateLife('p', [], undefined, 2 * HOUR, database);
        expect(repeat.economyCheckpoint).toEqual(migrated.economyCheckpoint);
    });
    it('includes the read fact watermark and reconciles a completion committed after that read', async () => {
        const database = fresh(), old = legacy(); await database.worlds.put(old);
        const watermark = old.credits.map(({ id, at }) => ({ id, at }));
        const migrated = await updateLife('p', watermark, undefined, 4 * HOUR, database);
        expect(migrated.economyCheckpoint!.sourceFactWatermark).toEqual(watermark);
        const delayed = Array.from({ length: 3 }, (_, i) => ({ id: `late${i}`, at: HOUR }));
        const corrected = await updateLife('p', [...watermark, ...delayed], undefined, 5 * HOUR, database);
        expect(corrected.economyCheckpoint!.legacyCorrections.map(credit => credit.id)).toEqual(delayed.map(fact => fact.id));
        expect(replayLife(corrected).items[0].growth).toBeCloseTo(4.25);
        expect(replayLife(corrected).drops).toBe(10);
        const repeat = await updateLife('p', [...watermark, ...delayed], undefined, 5 * HOUR, database);
        expect(replayLife(repeat)).toEqual(replayLife(corrected));
        expect(repeat.economyCheckpoint).toEqual(corrected.economyCheckpoint);
        expect(corrected.economyCheckpoint!.sourceRecord).toEqual(migrated.economyCheckpoint!.sourceRecord);
    });
    it('serializes racing purchases over the migration and treats a committed resend as the same purchase', async () => {
        const database = fresh(), old = legacy(); await database.worlds.put(old);
        const intent = { id: 'new', revision: old.revision, command: { type: 'buy' as const, kind: 'flower' as const, cell: { x: 1, z: 2 } } };
        const results = await Promise.allSettled([updateLife('p', [], intent, HOUR, database), updateLife('p', [], { ...intent, id: 'other' }, HOUR, database)]);
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        const saved = (await database.worlds.get('p'))!, action = saved.actions.at(-1)!;
        const again = await updateLife('p', [], { ...intent, id: action.id }, 2 * HOUR, database);
        expect(again).toEqual(saved); expect(saved.actions).toHaveLength(2);
        expect(saved.economyCheckpoint!.actionCount).toBe(1); expect(saved.economyCheckpoint!.sourceRecord.actions).toHaveLength(1);
        expect(replayLife(saved).items.map(item => item.id)).toEqual(['f', action.id]);
    });
    it('keeps owner worlds separate and refuses a corrupt checkpoint without partially merging new learning', async () => {
        const database = fresh(); await database.worlds.put(legacy());
        const a = await updateLife('p', [], undefined, HOUR, database);
        const b = await updateLife('other', [], undefined, HOUR, database);
        expect(b.economyCheckpoint!.sourceRecord.profileId).toBe('other'); expect(replayLife(b).items).toEqual([]);
        const corrupt = structuredClone(a); corrupt.economyCheckpoint!.state.drops++;
        await database.worlds.put(corrupt);
        await expect(updateLife('p', [{ id: 'fresh', at: HOUR + 1 }], undefined, HOUR + 2, database)).rejects.toThrow('切替記録');
        expect(await database.worlds.get('p')).toEqual(corrupt); expect(await database.worlds.get('other')).toEqual(b);
    });
    it('retains a high legacy balance and never replenishes it during a diagnostic time jump', async () => {
        const database = fresh(), old = legacy(); await database.worlds.put(old);
        const migrated = await updateLife('p', [], undefined, 7 * 24 * HOUR, database);
        const balance = replayLife(migrated).light; expect(balance).toBeGreaterThan(8);
        expect(migrated.economyCheckpoint!.initialLightRemainingBudget).toBe(0);
        const advanced = await updateLife('p', [], { id: 'day', revision: migrated.revision, advanceHours: 24 }, 7 * 24 * HOUR, database);
        expect(replayLife(advanced).light).toBe(balance);
        expect((await updateLife('p', [], { id: 'day', revision: migrated.revision, advanceHours: 24 }, 8 * 24 * HOUR, database))).toEqual(advanced);
    });
});
