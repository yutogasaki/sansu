import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { activityRelation, visitRelation } from './discovery';
import { applyRelationObservation } from './relationObservation';
import { HOUR, newLife, learningDay, type LifeState } from './model';
import { advanceLifeState, commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareRelationMigration } from './relationMigration';
import { IslandLifeDatabase, updateLife } from './repository';
function fixture(hut = false): LifeState {
    const s = replayLife(newLife('observe-real', 0));
    Object.assign(s, { now: 10000, facilityTripVersion: 1, relationSelectionVersion: 1, target: hut ? 'facility' : 'bench' });
    s.items = [
        { id: 'facility', kind: hut ? 'garden-hut' : 'library', cell: { x: 0, z: 0 }, style: 'original', growth: 0 },
        { id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, access: 'front', style: 'original', growth: 0 },
        { id: 'flower', kind: 'flower', cell: { x: 5, z: 2 }, style: 'original', growth: 0 },
        { id: 'water', kind: 'water-bowl', cell: { x: 5, z: 0 }, style: 'original', growth: 0 },
        { id: 'lamp', kind: 'lantern', cell: { x: 0, z: 4 }, style: 'original', growth: 0 },
    ];
    if (hut) { s.items[1] = { ...s.items[1], id: 'near', kind: 'flower', cell: { x: 1, z: 3 }, access: undefined }; s.items[2].cell = { x: 3, z: 2 }; }
    const cell = hut ? { x: 0, z: 2 } : { x: 3, z: 3 };
    s.residents = [{ id: 'pokomoko', cell, enjoyed: 2, enjoyedBy: { bench: 2 }, visit: { itemId: s.target!, from: cell, path: [cell], start: 0, end: HOUR, relationSelectionVersion: 1 } }];
    return s;
}
describe('explicit current-world object trial', () => {
    it('overrides a nearer flower with water, keeps the same seat, and uses ordinary rest for an unrelated object', () => {
        const s = fixture(), before = structuredClone(s.residents[0]);
        expect(activityRelation(s, '', 'bench')?.ruleId).toBe('R1');
        applyRelationObservation(s, 'bench', 'pokomoko', 'water');
        const r = s.residents[0]; expect(r.id).toBe(before.id); expect(r.visit?.path).toEqual(before.visit!.path); expect(r.visit?.start).toBe(0);
        expect(visitRelation(s, '', r.visit!)?.ruleId).toBe('R4'); expect(r.visit?.observationTest).toBe(true);
        applyRelationObservation(s, 'bench', 'pokomoko', 'lamp'); expect(visitRelation(s, '', r.visit!)).toBeUndefined(); expect(r.facilityTrip).toBeUndefined();
        expect(r.visit?.path).toEqual(before.visit!.path); expect(r.enjoyedBy).toEqual(before.enjoyedBy);
        applyRelationObservation(s, 'bench', 'pokomoko'); expect(visitRelation(s, '', r.visit!)?.ruleId).toBe('R1');
    });
    it('takes the same resident along the real library route despite a nearer flower, then retains test provenance', () => {
        const s = fixture(); applyRelationObservation(s, 'bench', 'pokomoko', 'facility'); const r = s.residents[0];
        expect(r.facilityTrip).toMatchObject({ phase: 'collect', targetId: 'bench', facilityId: 'facility' }); expect(r.visit?.path[0]).toEqual({ x: 3, z: 3 });
        const end = r.facilityTrip!.end; advanceLifeState(s, r.visit!.end);
        expect(r.visit).toMatchObject({ itemId: 'bench', observationSubjectId: 'bench', relationTargetId: 'facility', observationTest: true });
        expect(r.visit?.from).toEqual({ x: 0, z: 2 }); expect(r.visit?.path.at(-1)).toEqual({ x: 3, z: 3 });
        advanceLifeState(s, end); expect(r.enjoyed).toBe(2); expect(s.light).toBe(0); expect(r.visit?.observationSubjectId).toBeUndefined();
    });
    it('selects the specified garden plant rather than the automatic nearest partner', () => {
        const s = fixture(true); expect(activityRelation(s, '', 'facility')?.participantIds).toContain('near');
        applyRelationObservation(s, 'facility', 'pokomoko', 'flower'); const r = s.residents[0];
        expect(r.facilityTrip?.targetId).toBe('flower'); advanceLifeState(s, r.visit!.end + 5000);
        expect(r.visit).toMatchObject({ itemId: 'flower', observationSubjectId: 'facility', relationTargetId: 'flower', observationTest: true });
        expect(r.visit?.from).toEqual({ x: 0, z: 2 }); expect(r.enjoyed).toBe(2);
    });
    it('shows entrance care for a distant plant rather than silently choosing a nearer one', () => {
        const s = fixture(true); s.items[2].cell = { x: 5, z: 3 };
        applyRelationObservation(s, 'facility', 'pokomoko', 'flower');
        expect(s.residents[0].visit).toMatchObject({ itemId: 'facility', relationTargetId: 'flower', start: 0 }); expect(s.residents[0].facilityTrip).toBeUndefined();
    });
    it('keeps ordinary entrance care when the explicit plant is occupied, without substituting a free plant', () => {
        const s = fixture(true), cell = { x: 3, z: 3 };
        s.residents.push({ id: 'rabbit', cell, enjoyed: 0, enjoyedBy: {}, visit: {
            itemId: 'flower', from: cell, path: [cell], start: 0, end: HOUR,
        } });
        const other = structuredClone(s.residents[1]);
        applyRelationObservation(s, 'facility', 'pokomoko', 'flower');
        expect(s.residents[0].visit).toMatchObject({ itemId: 'facility', relationTargetId: 'flower' });
        expect(s.residents[0].facilityTrip).toBeUndefined(); expect(s.residents[1]).toEqual(other);
    });
    it('retains the exact completed requested trip when the source has another user, but never evicts that user for a different trip', () => {
        const s = fixture(true); applyRelationObservation(s, 'facility', 'pokomoko', 'flower'); advanceLifeState(s, s.residents[0].visit!.end + 5000);
        const r = s.residents[0], visit = structuredClone(r.visit);
        s.residents.push({ id: 'rabbit', cell: { x: 0, z: 2 }, enjoyed: 0, enjoyedBy: {}, visit: { itemId: 'facility', from: { x: 0, z: 2 }, path: [{ x: 0, z: 2 }], start: 0, end: HOUR } });
        const other = structuredClone(s.residents[1]);
        applyRelationObservation(s, 'facility', 'pokomoko', 'flower');
        expect(r.visit?.path).toEqual(visit!.path); expect(r.visit?.from).toEqual(visit!.from); expect(r.visit?.start).toBe(visit!.start); expect(s.residents[1]).toEqual(other);
        const before = structuredClone(s); expect(() => applyRelationObservation(s, 'facility', 'pokomoko', 'near')).toThrow(); expect(s).toEqual(before);
    });
    it('does not borrow a different resident or redirect a walking resident', () => {
        for (const walking of [false, true]) {
            const s = fixture(); s.residents[0].visit!.itemId = walking ? 'bench' : 'flower';
            if (walking) { s.residents[0].visit!.start = s.now; s.residents[0].visit!.path = [{ x: 4, z: 3 }, { x: 3, z: 3 }]; }
            s.residents.push({ id: 'rabbit', cell: { x: 3, z: 3 }, enjoyed: 0, enjoyedBy: {} });
            const before = structuredClone(s); expect(() => applyRelationObservation(s, 'bench', 'pokomoko', 'water')).toThrow(); expect(s).toEqual(before);
        }
    });
    it('rejects stored/unknown/self targets without changing state', () => {
        for (const target of ['missing', 'bench', 'water']) {
            const s = fixture(); s.items[3].cell = undefined; const before = structuredClone(s);
            expect(() => applyRelationObservation(s, 'bench', 'pokomoko', target)).toThrow(); expect(s).toEqual(before);
        }
    });
    it('has identical split-time playback and no observation use award', () => {
        const full = fixture(true); applyRelationObservation(full, 'facility', 'pokomoko', 'flower'); const split = structuredClone(full);
        advanceLifeState(full, 40000); for (const at of [11000, 12000, 15000, 20000, 30000, 40000]) advanceLifeState(split, at);
        expect(split).toEqual(full); expect(full.residents[0].enjoyed).toBe(2); expect(full.light).toBe(0);
    });
});
async function record13() {
    const initial = newLife('observe-real', 0); initial.credits = Array.from({ length: 100 }, (_, i) => ({ id: `q${i}`, at: 0, day: learningDay(0) }));
    let r = await prepareRelationMigration(await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(initial, []))));
    r = commandLife(r, { type: 'buy', kind: 'bench', cell: { x: 3, z: 2 } }, 'bench', 100);
    r = commandLife(r, { type: 'visit', itemId: 'bench' }, 'call', 100);
    return commandLife(r, { type: 'buy', kind: 'flower', cell: { x: 5, z: 2 } }, 'flower', 100);
}
describe('versioned explicit observation intent', () => {
    it('requires version14, preserves all earlier actions and fingerprints both resident and target', async () => {
        const old = await record13(), command = { type: 'observe-relation' as const, itemId: 'bench', residentId: 'pokomoko' as const, targetId: 'flower' };
        const next = commandLife(old, command, 'trial', 10000);
        expect(next.version).toBe(14); expect(next.actions.slice(0, -1)).toEqual(old.actions); expect(next.relationCutover).toEqual(old.relationCutover);
        expect(() => replayLife({ ...next, version: 13 })).toThrow(); expect(commandLife(next, command, 'trial', 20000)).toBe(next);
        expect(() => commandLife(next, { ...command, targetId: undefined }, 'trial', 20000)).toThrow();
        expect(() => commandLife(next, { ...command, residentId: 'rabbit' }, 'trial', 20000)).toThrow();
        expect(await prepareRelationMigration(next)).toBe(next); expect(await prepareFacilityMigration(next)).toBe(next);
        const land = commandLife(next, { type: 'expand', side: 'east' }, 'land', 10000);
        const bought = commandLife(land, { type: 'buy', kind: 'flower', cell: { x: 6, z: 0 } }, 'new-flower', 10000);
        expect(bought.version).toBe(14); expect(() => replayLife(bought)).not.toThrow();
    });
    it('commits atomically and retries the same explicit intent without a second action', async () => {
        const db = new IslandLifeDatabase(`explicit-${crypto.randomUUID()}`);
        try {
            const old = await record13(); await db.worlds.put(old);
            const intent = { id: 'trial', revision: old.revision, command: { type: 'observe-relation' as const, itemId: 'bench', residentId: 'pokomoko' as const, targetId: 'flower' } };
            const fail = () => { throw new Error('disk failure'); }; db.worlds.hook('updating', fail);
            await expect(updateLife(old.profileId, [], intent, 10000, db)).rejects.toThrow('disk failure'); expect(await db.worlds.get(old.profileId)).toEqual(old);
            db.worlds.hook('updating').unsubscribe(fail);
            const next = await updateLife(old.profileId, [], intent, 10000, db); expect(next.version).toBe(14);
            expect(await updateLife(old.profileId, [], intent, 10001, db)).toEqual(next); expect(next.actions.filter(a => a.id === intent.id)).toHaveLength(1);
        } finally { await db.delete(); }
    });
});
