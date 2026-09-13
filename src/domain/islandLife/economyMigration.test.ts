import { describe, expect, it } from 'vitest';
import { HOUR, learningDay, newLife, type LifeRecord } from './model';
import { commandLife, replayLife } from './simulation';
import { prepareEconomyMigration, reconcileLegacyCredits, verifyEconomyCheckpoint } from './economyMigration';
const credits = (count: number, at: number, prefix = 'c') => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i}`, at, day: learningDay(at) }));
function legacy() {
    let record = newLife('p', 0); record.credits = credits(3, 0);
    record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'f', 0);
    return { ...record, now: HOUR, realAt: HOUR };
}
describe('legacy economy checkpoint', () => {
    it('preserves the original record and exact cutover world, then grows only the new interval at the new rate', async () => {
        const record = legacy(), before = structuredClone(record), previousState = replayLife(record);
        const next = await prepareEconomyMigration(record, record.credits.map(({ id, at }) => ({ id, at })));
        expect(record).toEqual(before); expect(next.economyCheckpoint!.sourceRecord).toEqual(before);
        expect(next.version).toBe(3); await verifyEconomyCheckpoint(next.economyCheckpoint!);
        const { economy, ...same } = replayLife(next); expect(same).toEqual(previousState);
        expect(economy!.completionTimes).toEqual([0, 0, 0]);
        expect(replayLife(next, 2 * HOUR).items[0].growth).toBeCloseTo(previousState.items[0].growth + .75);
        expect(replayLife(next, HOUR / 2)).toEqual(replayLife(record, HOUR / 2));
        expect(await prepareEconomyMigration(next, [])).toBe(next);
    });
    it('preserves purchases, storage, expansion, styles and mature growth across the boundary', async () => {
        let record = legacy(); record.credits = credits(20, 0); record.now = 24 * HOUR;
        record = commandLife(record, { type: 'expand', side: 'east' }, 'land', record.now);
        record = commandLife(record, { type: 'style', style: 'sunshine', itemId: 'f' }, 'color', record.now);
        record = commandLife(record, { type: 'store', itemId: 'f' }, 'store', record.now);
        const before = replayLife(record), migrated = await prepareEconomyMigration(record, []);
        const later = replayLife(migrated, 48 * HOUR);
        expect(later.items).toEqual(before.items); expect(later.styles).toEqual(before.styles); expect(later.expanded).toBe('east');
        expect(later.light).toBe(before.light); expect(later.drops).toBe(before.drops);
        const restored = commandLife(migrated, { type: 'move', itemId: 'f', cell: { x: 0, z: 2 } }, 'restore', record.now);
        const removed = commandLife(restored, { type: 'remove', itemId: 'f' }, 'remove', record.now);
        expect(replayLife(removed).drops).toBe(before.drops + 1);
    });
    it('corrects a late pre-cutover completion using old growth and does not replay old purchases at new prices', async () => {
        const old = { ...legacy(), now: 4 * HOUR, realAt: 4 * HOUR };
        const migrated = await prepareEconomyMigration(old, []), extra = credits(3, HOUR, 'late');
        let next: LifeRecord = { ...migrated, now: 5 * HOUR, credits: [...migrated.credits, ...extra] };
        expect(() => replayLife(next)).toThrow('以前の学習');
        next = await reconcileLegacyCredits(next);
        const oldCorrected = replayLife({ ...old, credits: [...old.credits, ...extra] });
        expect(next.economyCheckpoint!.state.items).toEqual(oldCorrected.items);
        expect(replayLife(next).items[0].growth).toBeCloseTo(oldCorrected.items[0].growth + 1);
        expect(replayLife(next).drops).toBe(replayLife(migrated).drops + 6);
        expect(next.actions).toEqual(old.actions); expect(next.economyCheckpoint!.sourceRecord).toEqual(old);
        expect(next.economyCheckpoint!.checkpointId).toBe(migrated.economyCheckpoint!.checkpointId);
        expect(next.economyCheckpoint!.initialLightRemainingBudget).toBe(migrated.economyCheckpoint!.initialLightRemainingBudget);
        expect(await reconcileLegacyCredits(next)).toBe(next);
    });
    it('bounds future activity light once, even after a color purchase', async () => {
        const old = legacy(); old.now = 0; old.realAt = 0;
        let next = await prepareEconomyMigration(old, []);
        expect(next.economyCheckpoint!.initialLightRemainingBudget).toBe(8);
        const rich = replayLife(next, 12 * HOUR); expect(rich.light).toBe(8); expect(rich.economy!.lightRemainingBudget).toBe(0);
        next = commandLife(next, { type: 'style', style: 'sunshine' }, 'sun', 12 * HOUR);
        expect(next.version).toBe(3); expect(replayLife(next, 48 * HOUR).light).toBe(4);
    });
    it('rejects tampered backup or projection instead of accepting a completed label', async () => {
        const next = await prepareEconomyMigration(legacy(), []), corrupt = structuredClone(next.economyCheckpoint!);
        corrupt.state.drops++;
        await expect(verifyEconomyCheckpoint(corrupt)).rejects.toThrow();
        const badBackup = structuredClone(next.economyCheckpoint!); badBackup.sourceRecord.credits[0].at++;
        await expect(verifyEconomyCheckpoint(badBackup)).rejects.toThrow();
        expect(() => replayLife({ ...legacy(), version: 3 })).toThrow();
    });
    it('retains a future-dated stored completion and deduplicates legacy ids for growth', async () => {
        const old = legacy(); old.credits = [old.credits[0], old.credits[0], ...credits(1, 2 * HOUR, 'future')];
        const migrated = await prepareEconomyMigration(old, []);
        expect(migrated.economyCheckpoint!.state.economy!.completionTimes).toEqual([0]);
        expect(replayLife(migrated, 3 * HOUR).drops).toBe(2);
        expect(replayLife(migrated, 3 * HOUR).economy!.completionTimes).toEqual([0, 2 * HOUR]);
    });
    it('rejects rewritten pre-cutover actions and credits in the active row', async () => {
        const next = await prepareEconomyMigration(legacy(), []), edited = structuredClone(next);
        edited.actions[0].at++;
        expect(() => replayLife(edited)).toThrow('履歴');
        const credit = structuredClone(next); credit.credits[0].at++;
        await expect(reconcileLegacyCredits(credit)).rejects.toThrow('履歴');
    });

});
