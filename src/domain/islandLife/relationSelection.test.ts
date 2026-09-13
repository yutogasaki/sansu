import { createDiscoveryScene } from './discoveryJournal';
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { activityRelation, benchRelation } from './discovery';
import { observationVisit } from './observationVisit';
import { beginBenchTrip } from './facilityTrips';
import { HOUR, learningDay, newLife, type LifeState } from './model';
import { advanceLifeState, applyCommand, commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareRelationMigration, verifyRelationCutover } from './relationMigration';
import { IslandLifeDatabase, updateLife } from './repository';

function fixture(): LifeState {
    const s = replayLife(newLife('relations', 0));
    Object.assign(s, { expanded: 'east', facilityTripVersion: 1, relationSelectionVersion: 1, target: 'bench' });
    s.items = [
        { id: 'library', kind: 'library', cell: { x: 0, z: 0 }, style: 'original', growth: 0 },
        { id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, access: 'front', style: 'original', growth: 0 },
        { id: 'flower', kind: 'flower', cell: { x: 7, z: 2 }, access: 'front', style: 'original', growth: 0 },
    ];
    s.residents = s.residents.slice(0, 1); s.residents[0].visit = undefined;
    s.residents[0].cell = { x: 3, z: 3 };
    return s;
}
async function oldRecord() {
    const r = newLife('relations', 0); r.credits = Array.from({ length: 100 }, (_, i) => ({ id: `q${i}`, at: 0, day: learningDay(0) }));
    let next = await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(r, [])));
    next = commandLife(next, { type: 'buy', kind: 'library', cell: { x: 0, z: 0 } }, 'library', 100);
    return commandLife(next, { type: 'buy', kind: 'bench', cell: { x: 3, z: 2 } }, 'bench', 100);
}
describe('relation selection at activity start', () => {
    it('prefers distance before R5 priority, and explicit real targets before automatic choice', () => {
        const s = fixture();
        expect(activityRelation(s, '', 'bench')).toMatchObject({ ruleId: 'R5', distance: 4 });
        expect(activityRelation(s, '', 'bench', 'flower')).toMatchObject({ ruleId: 'R1', distance: 4 });
        expect(activityRelation(s, '', 'bench', 'missing')).toBeUndefined();
        expect(benchRelation(s, '', 'bench')).toBeUndefined(); // a head turn is not transport
        s.items[2].cell = { x: 5, z: 2 };
        expect(activityRelation(s, '', 'bench')).toMatchObject({ ruleId: 'R1', distance: 2 });
        advanceLifeState(s, 0); expect(s.residents[0].visit?.itemId).toBe('bench'); expect(s.residents[0].facilityTrip).toBeUndefined();
    });
    it('uses the fixed relation order and then actual partner IDs for equal distances', () => {
        const s = fixture(); s.items[2].id = 'z-flower'; s.items[2].cell = { x: 5, z: 2 };
        s.items.push({ ...s.items[2], id: 'a-flower', cell: { x: 1, z: 2 } });
        expect(activityRelation(s, '', 'bench')?.participantIds).toContain('a-flower');
        s.items[3].kind = 'water-bowl'; expect(activityRelation(s, '', 'bench')?.ruleId).toBe('R1');
        s.items[2].kind = 'swing'; expect(activityRelation(s, '', 'bench')?.ruleId).toBe('R4');
        s.items[3].cell = undefined; expect(activityRelation(s, '', 'bench')?.ruleId).toBe('R3');
    });
    it('walks from a chosen bench to the library and back with the same resident and reserved seat', () => {
        const s = fixture(); advanceLifeState(s, 0); const hero = s.residents[0];
        expect(hero.facilityTrip).toMatchObject({ facilityId: 'library', targetId: 'bench', phase: 'collect' });
        expect(hero.visit?.itemId).toBe('library'); expect(hero.visit?.path[0]).toEqual({ x: 3, z: 3 });
        expect(hero.visit?.path.at(-1)).toEqual({ x: 0, z: 2 });
        advanceLifeState(s, hero.visit!.end);
        expect(hero.id).toBe('pokomoko'); expect(hero.visit?.itemId).toBe('bench'); expect(hero.visit?.from).toEqual({ x: 0, z: 2 });
        expect(hero.visit?.path.at(-1)).toEqual({ x: 3, z: 3 }); expect(hero.visit?.relationSelectionVersion).toBe(1); expect(hero.enjoyed).toBe(0);
        applyCommand(s, { id: 'store', at: s.now, command: { type: 'store', itemId: 'library' } });
        expect(hero.facilityTrip).toBeUndefined(); expect(s.light).toBe(0);
    });
    it('never evicts the library user or adds a book to the fallback bench', () => {
        const s = fixture(); const busy = { id: 'rabbit' as const, cell: { x: 0, z: 2 }, enjoyed: 0, enjoyedBy: {}, visit: { itemId: 'library', from: { x: 0, z: 2 }, path: [{ x: 0, z: 2 }], start: 0, end: HOUR } };
        s.residents.push(busy); advanceLifeState(s, 0);
        expect(s.residents[0].visit?.itemId).toBe('bench'); expect(s.residents[0].facilityTrip).toBeUndefined(); expect(busy.visit.end).toBe(HOUR);
    });
    it('preserves old bench behavior and observation provenance', () => {
        const s = fixture(); delete s.relationSelectionVersion; advanceLifeState(s, 0);
        expect(s.residents[0].visit?.itemId).toBe('bench'); expect(benchRelation(s, '', 'bench')?.ruleId).toBe('R1');
        s.relationSelectionVersion = 1;
        expect(benchRelation(s, '', 'bench')?.ruleId).toBe('R1'); // ongoing old visit keeps its old gaze
        s.residents[0].visit!.observationTest = true;
        beginBenchTrip(s, s.residents[0], s.items[1]); advanceLifeState(s, s.residents[0].visit!.end);
        expect(s.residents[0].visit?.observationTest).toBe(true);
    });
    it('uses the same idle resident for a free bench-to-library observation with no reward', () => {
        const s = fixture(); s.target = undefined;
        expect(observationVisit(s, 'bench')).toMatchObject({ kind: 'ready', residentId: 'pokomoko', duration: 15000 });
        applyCommand(s, { id: 'observe', at: 0, command: { type: 'observe', itemId: 'bench' } });
        expect(observationVisit(s, 'bench')).toMatchObject({ kind: 'existing', residentId: 'pokomoko' });
        const end = s.residents[0].facilityTrip!.end;
        advanceLifeState(s, 13000); expect(s.residents[0].visit).toMatchObject({ itemId: 'bench', observationTest: true });
        advanceLifeState(s, end); expect(s.residents[0].enjoyed).toBe(0); expect(s.light).toBe(0);
    });
    it('keeps old captured relation selection while new snapshots carry the scheduling marker', async () => {
        const s = fixture(); delete s.relationSelectionVersion;
        const old = await createDiscoveryScene('relations', s, benchRelation(s, 'relations', 'bench')!, 'current-context-test', 'old', 0);
        expect(old.snapshot.scene.relationSelectionVersion).toBeUndefined();
        s.relationSelectionVersion = 1; advanceLifeState(s, 13000);
        const current = await createDiscoveryScene('relations', s, activityRelation(s, 'relations', 'bench')!, 'current-context-test', 'new', 13000, ['pokomoko']);
        expect(current.snapshot.scene.relationSelectionVersion).toBe(1);
        expect(old.ruleId).toBe('R1'); expect(current.ruleId).toBe('R5');
        // The snapshot itself, not a merge with a modern marker, defines replay.
        expect(benchRelation({ ...old.snapshot.scene, drops: 0, light: 0, styles: [], days: {} }, '', 'bench')?.ruleId).toBe('R1');
    });
    it('has stable split-time projection through both routes and the single reward boundary', () => {
        const full = fixture(), split = structuredClone(full); advanceLifeState(full, HOUR);
        for (const at of [0, 1000, 6800, 9000, 1800000, HOUR]) advanceLifeState(split, at);
        expect(split).toEqual(full);
    });
});
describe('relation scheduler cutover', () => {
    it('preserves the old prefix and ongoing visits, then applies same-time later bench selection', async () => {
        const old = await oldRecord(), next = await prepareRelationMigration(old);
        const { relationSelectionVersion, ...after } = replayLife(next);
        expect(relationSelectionVersion).toBe(1); expect(after).toEqual(replayLife(old)); expect(next.actions).toEqual(old.actions);
        expect(replayLife(next, 99)).toEqual(replayLife(old, 99)); expect(await prepareRelationMigration(next)).toBe(next);
        const selected = commandLife(next, { type: 'visit', itemId: 'bench' }, 'call-bench', 100);
        expect(selected.version).toBe(13); expect(replayLife(selected).relationSelectionVersion).toBe(1);
        const land = commandLife(selected, { type: 'expand', side: 'east' }, 'land', 100);
        expect(land.version).toBe(13); expect(() => replayLife(land)).not.toThrow();
    });
    it('rejects missing, downgraded, foreign, changed-prefix and corrupted-hash records', async () => {
        const next = await prepareRelationMigration(await oldRecord());
        expect(() => replayLife({ ...next, relationCutover: undefined })).toThrow();
        expect(() => replayLife({ ...next, version: 12 })).toThrow();
        const changed = structuredClone(next); changed.actions[0].at = 99; expect(() => replayLife(changed)).toThrow();
        const corrupt = structuredClone(next); corrupt.relationCutover!.validationHash = 'wrong'; await expect(verifyRelationCutover(corrupt)).rejects.toThrow();
        const foreign = structuredClone(next); foreign.relationCutover!.profileId = 'other'; await expect(verifyRelationCutover(foreign)).rejects.toThrow();
    });
    it('rolls back a failed owner write and retries atomically without migrating twice', async () => {
        const db = new IslandLifeDatabase(`relation-${crypto.randomUUID()}`);
        try {
            const old = await oldRecord(); await db.worlds.put(old); const fail = () => { throw new Error('disk failure'); }; db.worlds.hook('updating', fail);
            await expect(updateLife(old.profileId, [], undefined, 100, db)).rejects.toThrow('disk failure'); expect(await db.worlds.get(old.profileId)).toEqual(old);
            db.worlds.hook('updating').unsubscribe(fail);
            const next = await updateLife(old.profileId, [], undefined, 100, db); expect(next.version).toBe(15); expect(next.revision).toBe(old.revision + 1);
            await verifyRelationCutover(next);
            const intent = { id: 'call', revision: next.revision, command: { type: 'visit' as const, itemId: 'bench' } };
            const called = await updateLife(old.profileId, [], intent, 101, db);
            expect(await updateLife(old.profileId, [], intent, 102, db)).toEqual(called); expect(called.relationCutover).toEqual(next.relationCutover);
        } finally { await db.delete(); }
    });
});
