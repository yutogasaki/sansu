import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newLife, learningDay, HOUR } from './model';
import { commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration, verifyTourCutover } from './tourMigration';
import { IslandLifeDatabase, updateLife } from './repository';
const databases: IslandLifeDatabase[] = [];
afterEach(async () => { await Promise.all(databases.splice(0).map(db => db.delete())); });
async function source() {
    let record = newLife('p', 0); record.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    record = await prepareEconomyMigration(record, []);
    for (let x = 0; x < 3; x++) record = commandLife(record, { type: 'buy', kind: 'swing', cell: { x, z: 2 } }, `s${x}`, 100);
    return record;
}
describe('tour cutover keeps old visits and same-time history intact', () => {
    it('adds only the new rule marker at cutover, preserving earlier views and all old actions', async () => {
        const old = await source(), before = replayLife(old), next = await prepareTourMigration(old);
        const { tourVersion, roamRound, ...after } = replayLife(next);
        expect(tourVersion).toBe(1); expect(roamRound).toBe(0); expect(after).toEqual(before);
        expect(next.actions).toEqual(old.actions); expect(next.economyCheckpoint).toEqual(old.economyCheckpoint);
        expect(replayLife(next, 99)).toEqual(replayLife(old, 99));
        expect(replayLife(next).residents.every(r => !r.playTour)).toBe(true);
        expect(replayLife(next, HOUR).residents.some(r => r.playTour)).toBe(true);
        expect(await prepareTourMigration(next)).toBe(next); await verifyTourCutover(next);
    });
    it('runs later actions at exactly the cutover time under the new rule', async () => {
        const old = await source(), next = await prepareTourMigration(old);
        const moved = commandLife(next, { type: 'move', itemId: 's0', cell: { x: 0, z: 2 } }, 'after-switch', next.now);
        expect(moved.version).toBe(4); expect(moved.tourCutover!.actionCount).toBe(3);
        expect(replayLife(moved).residents.some(r => r.playTour)).toBe(true);
        expect(replayLife(next).residents.every(r => !r.playTour)).toBe(true);
    });
    it('rejects absent, altered or backdated migration history', async () => {
        const next = await prepareTourMigration(await source());
        expect(() => replayLife({ ...next, tourCutover: undefined })).toThrow();
        const changed = structuredClone(next); changed.actions[0].command = { type: 'store', itemId: 's1' };
        expect(() => replayLife(changed)).toThrow();
        const hash = structuredClone(next); hash.tourCutover!.validationHash = 'bad'; await expect(verifyTourCutover(hash)).rejects.toThrow();
        expect(() => commandLife(next, { type: 'store', itemId: 's0' }, 'past', 99)).toThrow();
    });
    it('rolls back a failed owner write and reuses the committed cutover on retry', async () => {
        const db = new IslandLifeDatabase(`tours-${crypto.randomUUID()}`); databases.push(db);
        const old = await source(); await db.worlds.put(old);
        const fail = () => { throw new Error('disk failure'); }; db.worlds.hook('updating', fail);
        await expect(updateLife('p', [], undefined, 100, db)).rejects.toThrow('disk failure');
        expect(await db.worlds.get('p')).toEqual(old); db.worlds.hook('updating').unsubscribe(fail);
        const first = await updateLife('p', [], undefined, 100, db), repeat = await updateLife('p', [], undefined, 200, db);
        expect(first.version).toBe(15); expect(repeat.tourCutover).toEqual(first.tourCutover);
        const intent = { id: 'store', revision: repeat.revision, command: { type: 'store' as const, itemId: 's0' } };
        const stored = await updateLife('p', [], intent, 200, db);
        expect(await updateLife('p', [], intent, 300, db)).toEqual(stored);
    });
    it('rejects a copied cutover from another owner', async () => {
        const next = await prepareTourMigration(await source());
        const changed = structuredClone(next); changed.tourCutover!.profileId = 'other';
        await expect(verifyTourCutover(changed)).rejects.toThrow();
    });
});
