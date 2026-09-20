import { enableCadence } from './cadence';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { prepareHeroVisitMigration } from './heroVisitMigration';
import { prepareCadenceMigration } from './cadenceMigration';
import { preparePlacementMigration } from './placementMigration';
import { prepareRelationMigration } from './relationMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareEconomyMigration } from './economyMigration';
import { IslandLifeDatabase, updateLife } from './repository';
import { newLife, learningDay } from './model';
import { advanceLifeState, commandLife, replayLife } from './simulation';
import { clearLifeReplayCache } from './replayCache';
import { prepareDiagonalMigration, verifyDiagonalCutover } from './diagonalMigration';
import { diagonalRoamRoute } from './diagonalRoam';
import { canStand, routeDuration, sampleRoute } from './walkingSpace';
import { route } from './space';
async function source() {
    const old = newLife('hero-owner', 100);
    old.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 100, day: learningDay(100) }));
    let record = await prepareCadenceMigration(await preparePlacementMigration(await prepareRelationMigration(await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(old, []))))));
    record = commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 3 } }, 'flower', 200);
    record = commandLife(record, { type: 'visit', itemId: 'flower' }, 'call', 400);
    return prepareHeroVisitMigration({ ...record, now: 60000, realAt: 60000 });
}
describe('diagonal stroll cutover', () => {
    it('lets all three residents leave an empty island home and take repeated walks', () => {
        const state = { ...replayLife(newLife('empty', 0)), placementVersion: 1 as const, cadenceVersion: 1 as const, diagonalVersion: 1 as const };
        enableCadence(state);
        const seen = new Set<string>();
        for (let now = 1000; now <= 180000; now += 1000) {
            advanceLifeState(state, now);
            for (const resident of state.residents) if (resident.visit?.itemId.startsWith('roam:')) seen.add(resident.id);
        }
        expect([...seen].sort()).toEqual(['otter', 'pokomoko', 'rabbit']);
        expect(state.light).toBe(0);
    });
    it('keeps history, in-flight residents and saved ownership exactly across the boundary', async () => {
        const old = await source(), before = replayLife(old), next = await prepareDiagonalMigration(old);
        const after = replayLife(next); expect(next.version).toBe(18);
        expect(after).toEqual({ ...before, diagonalVersion: 1 });
        expect(next.actions).toEqual(old.actions); expect(next.discoveryJournal).toEqual(old.discoveryJournal);
        expect(replayLife(next, 59000)).toEqual(replayLife(old, 59000));
        expect(await prepareDiagonalMigration(next)).toBe(next);
        const called = commandLife(next, { type: 'visit', itemId: 'flower' }, 'again', next.now);
        expect(called.version).toBe(18); expect(replayLife(called).target).toBe('flower');
        await verifyDiagonalCutover(called);
        await expect(verifyDiagonalCutover({ ...next, diagonalCutover: { ...next.diagonalCutover!, validationHash: 'broken' } })).rejects.toThrow();
        expect(() => replayLife({ ...next, version: 17 })).toThrow();
        expect(() => replayLife({ ...next, diagonalCutover: undefined })).toThrow();
        const later = replayLife(next, next.now + 180000); clearLifeReplayCache();
        expect(replayLife(next, next.now + 180000)).toEqual(later);
        expect(later.light).toBe(before.light);
    });
    it('rolls back a failed migration write and preserves the cutover on retry', async () => {
        const db = new IslandLifeDatabase('diagonal-' + crypto.randomUUID());
        try {
            const old = await source(); await db.worlds.put(old);
            const fail = () => { throw Error('blocked write'); }; db.worlds.hook('updating', fail);
            await expect(updateLife(old.profileId, [], undefined, old.realAt, db)).rejects.toThrow('blocked write');
            expect(await db.worlds.get(old.profileId)).toEqual(old); db.worlds.hook('updating').unsubscribe(fail);
            const saved = await updateLife(old.profileId, [], undefined, old.realAt, db);
            const again = await updateLife(old.profileId, [], undefined, old.realAt + 1000, db);
            expect(saved.version).toBe(18); expect(again.diagonalCutover).toEqual(saved.diagonalCutover);
        } finally { await db.delete(); }
    });
    it('uses distance timing on open diagonals and skirts furniture and reserved positions', async () => {
        const state = replayLife(await source()); state.items = [];
        const from = { x: 0, z: 2 }, to = { x: 1, z: 3 };
        const diagonal = diagonalRoamRoute(state, from, to, [])!;
        expect(diagonal).toEqual([from, to]);
        const borrowed = diagonalRoamRoute(state, from, to, [])!; borrowed[0].x = 99;
        expect(diagonalRoamRoute(state, from, to, [])).toEqual(diagonal);
        expect(routeDuration(diagonal)).toBeCloseTo(Math.SQRT2 * 1200);
        expect(sampleRoute(diagonal, routeDuration(diagonal) / 2)).toEqual({ x: .5, z: 2.5 });
        expect(route(state, from, to)!.length).toBeGreaterThan(2);
        state.items = [{ id: 'block', kind: 'bench', cell: { x: 1, z: 2 }, growth: 0, style: 'original' }];
        const around = diagonalRoamRoute(state, from, to, [])!; expect(around.length).toBeGreaterThan(2);
        for (let t = 0; t <= routeDuration(around); t += 10) expect(canStand(state, sampleRoute(around, t))).toBe(true);
        state.items = [];
        const avoid = { x: .5, z: 2.5 }, reserved = diagonalRoamRoute(state, from, to, [avoid])!;
        expect(reserved.length).toBeGreaterThan(2);
        for (let t = 0; t <= routeDuration(reserved); t += 10) {
            const p = sampleRoute(reserved, t); expect(Math.hypot(p.x - avoid.x, p.z - avoid.z)).toBeGreaterThanOrEqual(.19);
        }
    });
});
