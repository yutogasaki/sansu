import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IslandLifeDatabase, updateLife } from './repository';
import { newLife, learningDay, ROAM_VISIT_PREFIX } from './model';
import { homeCell, pathToActivity } from './space';
import { commandLife, replayLife } from './simulation';
import { prepareEconomyMigration } from './economyMigration';
import { prepareTourMigration } from './tourMigration';
import { prepareFacilityMigration } from './facilityMigration';
import { prepareRelationMigration } from './relationMigration';
import { preparePlacementMigration, verifyPlacementCutover } from './placementMigration';

async function source() {
    const legacy = newLife('placement', 0);
    legacy.credits = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, at: 0, day: learningDay(0) }));
    let record = await prepareRelationMigration(await prepareFacilityMigration(await prepareTourMigration(await prepareEconomyMigration(legacy, []))));
    record = commandLife(record, { type: 'buy', kind: 'bench', cell: { x: 0, z: 2 } }, 'bench', 100);
    return commandLife(record, { type: 'visit', itemId: 'bench' }, 'visit', 100);
}
describe('placement cutover', () => {
    it('preserves balances, ownership, ongoing trips and historical replay, and is idempotent', async () => {
        const old = await source(), before = replayLife(old), next = await preparePlacementMigration(old);
        const { placementVersion, ...after } = replayLife(next);
        expect(placementVersion).toBe(1); expect(after).toEqual(before);
        expect(next.actions).toEqual(old.actions); expect(next.economyCheckpoint).toEqual(old.economyCheckpoint);
        expect(replayLife(next, 99)).toEqual(replayLife(old, 99));
        expect(await preparePlacementMigration(next)).toBe(next);
        const moved = commandLife(next, { type: 'move', itemId: 'bench', cell: { x: 0, z: 2 } }, 'move', 100);
        expect(moved.version).toBe(15); expect(replayLife(moved).placementVersion).toBe(1);
        await verifyPlacementCutover(moved);
    });
    it('keeps idle residents idle at the cutover even when new paths become available', async () => {
        const old = await source();
        // Explicit historical checkpoint fixture: both old flower approaches are reserved.
        old.actions = []; old.economyCheckpoint!.sourceRecord.actions = [];
        old.economyCheckpoint!.actionCount = 0;
        const state = old.economyCheckpoint!.state;
        state.items = [{ id: 'flower', kind: 'flower', cell: { x: 0, z: 4 }, growth: 0, style: 'original' }];
        state.target = 'flower';
        state.residents[0].visit = undefined;
        state.residents[1].visit = { itemId: 'flower', from: { x: 1, z: 4 }, path: [{ x: 1, z: 4 }], start: 0, end: 10000 };
        state.residents[2].visit = { itemId: `${ROAM_VISIT_PREFIX}otter`, from: { x: 0, z: 3 }, path: [{ x: 0, z: 3 }], start: 0, end: 10000 };
        const before = replayLife(old);
        expect(before.residents[0].visit).toBeUndefined();
        const next = await preparePlacementMigration(old);
        const { placementVersion, ...after } = replayLife(next);
        expect(placementVersion).toBe(1); expect(after).toEqual(before);
        expect(replayLife(next, next.now + 1).residents[0].visit?.itemId).toBe('flower');
        const edited = commandLife(next, { type: 'move', itemId: 'flower', cell: { x: 0, z: 4 } }, 'same-time-edit', next.now);
        expect(replayLife(edited).residents[0].visit?.itemId).toBe('flower');
    });
    it('persists and retries an isolated placement with the same cutover and no duplicate charge', async () => {
        const database = new IslandLifeDatabase(`placement-${crypto.randomUUID()}`);
        try {
            const old = await source(); await database.worlds.put(old);
            const current = await updateLife(old.profileId, [], undefined, old.now, database);
            const intent = { id: 'blocked-bench', revision: current.revision,
                command: { type: 'buy' as const, kind: 'bench' as const, cell: { x: 1, z: 4 } } };
            const saved = await updateLife(old.profileId, [], intent, current.realAt, database);
            const state = replayLife(saved);
            const isolated = state.items.find(item => item.id === intent.id)!;
            expect(isolated.cell).toEqual({ x: 1, z: 4 });
            expect(pathToActivity(state, homeCell, isolated)).toBeUndefined();
            expect(await database.worlds.get(old.profileId)).toEqual(saved);
            expect(await updateLife(old.profileId, [], intent, current.realAt + 1, database)).toEqual(saved);
            expect(saved.placementCutover).toEqual(current.placementCutover);
            expect(replayLife((await database.worlds.get(old.profileId))!)).toEqual(state);
        } finally { await database.delete(); }
    });
    it('rejects missing, downgraded, changed-prefix and corrupt cutovers', async () => {
        const next = await preparePlacementMigration(await source());
        expect(() => replayLife({ ...next, placementCutover: undefined })).toThrow();
        expect(() => replayLife({ ...next, version: 14 })).toThrow();
        const changed = structuredClone(next); changed.actions[0].at = 99;
        expect(() => replayLife(changed)).toThrow();
        const hash = structuredClone(next); hash.placementCutover!.validationHash = 'bad';
        await expect(preparePlacementMigration(hash)).rejects.toThrow();
        const foreign = structuredClone(next); foreign.placementCutover!.profileId = 'other';
        await expect(verifyPlacementCutover(foreign)).rejects.toThrow();
    });
});
