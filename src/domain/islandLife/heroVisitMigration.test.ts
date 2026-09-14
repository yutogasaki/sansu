import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { prepareHeroVisitMigration, verifyHeroVisitCutover } from './heroVisitMigration';
import { prepareCadenceMigration } from './cadenceMigration';
import { preparePlacementMigration } from './placementMigration';
import { prepareRelationMigration } from './relationMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareEconomyMigration } from './economyMigration';
import { IslandLifeDatabase, updateLife } from './repository';
import { newLife, learningDay } from './model';
import { commandLife, replayLife, residentCell } from './simulation';
import { clearLifeReplayCache } from './replayCache';
async function source() {
    const old = newLife('hero-owner', 100);
    old.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
    let record = await prepareCadenceMigration(await preparePlacementMigration(await prepareRelationMigration(await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(old, []))))));
    record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 200);
    record = commandLife(record, { type: 'visit', itemId: 'flower' }, 'call', 400);
    return { ...record, now: 60000, realAt: 60000 };
}
describe('one-shot hero visit cutover', () => {
    it('preserves old history, positions, pending use and ownership; a previously pinned hero is released', async () => {
        const old = await source(), before = replayLife(old); expect(old.version).toBe(16); expect(before.target).toBe('flower');
        expect(before.residents[0].visit!.end - before.now).toBeGreaterThan(20000);
        const next = await prepareHeroVisitMigration(old), after = replayLife(next);
        expect(next.version).toBe(17); expect(after.heroVisitVersion).toBe(1);
        expect(after.items).toEqual(before.items); expect(after.light).toBe(before.light); expect(after.drops).toBe(before.drops);
        expect(after.residents.map(r => residentCell(r, after.now, true))).toEqual(before.residents.map(r => residentCell(r, before.now, true)));
        expect(after.residents.slice(1)).toEqual(before.residents.slice(1));
        expect(after.residents[0].cadence!.useMs.flower).toBeGreaterThan(before.residents[0].cadence?.useMs.flower ?? 0);
        expect(next.actions).toEqual(old.actions); expect(next.economyCheckpoint).toEqual(old.economyCheckpoint);
        expect(replayLife(next, 59000)).toEqual(replayLife(old, 59000)); expect(await prepareHeroVisitMigration(next)).toBe(next);
        expect(replayLife(next, after.residents[0].visit!.end).target).toBeUndefined();
    });
    it('keeps same-time new calls after the cutover and rejects corrupt or downgraded records', async () => {
        const next = await prepareHeroVisitMigration(await source());
        const called = commandLife(next, { type: 'visit', itemId: 'flower' }, 'same-time', next.now);
        expect(called.version).toBe(17); expect(replayLife(called).target).toBe('flower'); await verifyHeroVisitCutover(called);
        expect(() => replayLife({ ...called, version: 16 })).toThrow();
        expect(() => replayLife({ ...called, heroVisitCutover: undefined })).toThrow();
        const bad = structuredClone(next); bad.heroVisitCutover!.validationHash = 'bad';
        await expect(prepareHeroVisitMigration(bad)).rejects.toThrow();
        const changed = structuredClone(next); changed.actions[0].at++;
        expect(() => replayLife(changed)).toThrow();
    });
    it('does not renew the call or pay twice on save/retry/reload, with or without cached replay', async () => {
        const db = new IslandLifeDatabase(`hero-${crypto.randomUUID()}`);
        try {
            const old = await source(); await db.worlds.put(old);
            const migrated = await updateLife(old.profileId, [], undefined, 60000, db);
            const intent = { id: 'call-again', revision: migrated.revision, command: { type: 'visit' as const, itemId: 'flower' } };
            const first = await updateLife(old.profileId, [], intent, 61000, db);
            expect(await updateLife(old.profileId, [], intent, 65000, db)).toEqual(first);
            const after = await updateLife(old.profileId, [], undefined, 81000, db);
            const expected = replayLife(after); expect(expected.target).toBeUndefined();
            clearLifeReplayCache(); expect(replayLife((await db.worlds.get(old.profileId))!)).toEqual(expected);
            expect(after.heroVisitCutover).toEqual(migrated.heroVisitCutover);
            expect(expected.light).toBe(replayLife(migrated).light);
        } finally { await db.delete(); }
    });
});
