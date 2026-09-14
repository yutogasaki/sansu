import { clearLifeReplayCache } from './replayCache';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { prepareCadenceMigration, verifyCadenceCutover } from './cadenceMigration';
import { preparePlacementMigration } from './placementMigration';
import { prepareRelationMigration } from './relationMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareEconomyMigration } from './economyMigration';
import { IslandLifeDatabase, updateLife } from './repository';
import { learningDay, newLife } from './model';
import { commandLife, replayLife, residentCell } from './simulation';

async function source() {
    const old = newLife('cadence-owner', 100);
    old.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
    const current = await preparePlacementMigration(await prepareRelationMigration(await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(old, [])))));
    return commandLife(current, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 200);
}
describe('cadence cutover', () => {
    it('preserves past replay, positions, wallet, ownership, receipts and migrates just once', async () => {
        const old = await source(), before = replayLife(old), next = await prepareCadenceMigration(old), after = replayLife(next);
        expect(next.version).toBe(16); expect(after.cadenceVersion).toBe(1);
        expect(after.light).toBe(before.light); expect(after.drops).toBe(before.drops); expect(after.items).toEqual(before.items);
        expect(after.residents.map(r => residentCell(r, after.now, true))).toEqual(before.residents.map(r => residentCell(r, before.now, true)));
        expect(next.actions).toEqual(old.actions); expect(next.economyCheckpoint).toEqual(old.economyCheckpoint);
        expect(replayLife(next, 199)).toEqual(replayLife(old, 199));
        expect(await prepareCadenceMigration(next)).toBe(next);
        const continued = commandLife(next, { type: 'visit', itemId: 'flower' }, 'visit', 300);
        expect(continued.version).toBe(16); await verifyCadenceCutover(continued);
    });
    it('matches uncached replay and isolates returned mutations, earlier clocks and new commands', async () => {
        const record = await prepareCadenceMigration(await source());
        const first = replayLife(record, 60000); first.residents[0].cell.x = 999; first.light = 999;
        const continued = replayLife({ ...record, now: 120000, realAt: 120000 }, 120000);
        clearLifeReplayCache();
        expect(replayLife(record, 120000)).toEqual(continued);
        const early = replayLife(record, 1000); clearLifeReplayCache(); expect(replayLife(record, 1000)).toEqual(early);
        const changed = commandLife(record, { type: 'visit', itemId: 'flower' }, 'new-command', 1000);
        const actual = replayLife(changed, 2000); clearLifeReplayCache(); expect(replayLife(changed, 2000)).toEqual(actual);
        const corrupt = structuredClone(record); corrupt.cadenceCutover!.profileId = 'other';
        expect(() => replayLife(corrupt, 120000)).toThrow();
    });
    it('rejects missing, downgraded, changed-prefix, foreign and corrupt cutovers', async () => {
        const next = await prepareCadenceMigration(await source());
        expect(() => replayLife({ ...next, cadenceCutover: undefined })).toThrow();
        expect(() => replayLife({ ...next, version: 15 })).toThrow();
        const changed = structuredClone(next); changed.actions[0].at = 199;
        expect(() => replayLife(changed)).toThrow();
        const foreign = structuredClone(next); foreign.cadenceCutover!.profileId = 'other';
        expect(() => replayLife(foreign)).toThrow();
        const corrupt = structuredClone(next); corrupt.cadenceCutover!.validationHash = 'bad';
        await expect(prepareCadenceMigration(corrupt)).rejects.toThrow();
    });
    it('persists a single cutover and retries without changing the same-time action or charge', async () => {
        const db = new IslandLifeDatabase(`cadence-${crypto.randomUUID()}`);
        try {
            const old = await source(); await db.worlds.put(old);
            const saved = await updateLife(old.profileId, [], undefined, 300, db);
            const intent = { id: 'visit', revision: saved.revision, command: { type: 'visit' as const, itemId: 'flower' } };
            const first = await updateLife(old.profileId, [], intent, 300, db);
            expect(await updateLife(old.profileId, [], intent, 301, db)).toEqual(first);
            const refreshed = await updateLife(old.profileId, [], undefined, 60300, db);
            expect(refreshed.cadenceCutover).toEqual(saved.cadenceCutover);
            expect(replayLife((await db.worlds.get(old.profileId))!)).toEqual(replayLife(refreshed));
            expect(replayLife(refreshed).drops).toBe(replayLife(first).drops);
        } finally { await db.delete(); }
    });
});
