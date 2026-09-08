import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { saveIslandExperience } from './experienceRepository';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import { getIslandWorkshop, IslandWorkshopConflict, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, workshopLayoutKey,
    type IslandWorkshopAction, type IslandWorkshopState, type WorkshopSpecimenId } from './workshop';
import { saveIslandWorkshop } from './workshopRepository';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const stableIsland = (island: IslandRecord) => Object.fromEntries(Object.entries(island).filter(([key]) => !['workshop', 'revision', 'updatedAt'].includes(key)));
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function learningSnapshot(d: SansuDatabase) {
    const all = await snapshot(d); delete all.islands;
    all.islandEvents = (all.islandEvents as IslandEvent[]).filter(event => event.type !== 'workshop_changed');
    return all;
}
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase) {
    let plan = await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
}
async function setup(earned = true) {
    const d = new SansuDatabase(`island-workshop-${crypto.randomUUID()}`, options); databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d); if (earned) await finish(d);
    return d;
}
const change = async (d: SansuDatabase, action: IslandWorkshopAction) => saveIslandWorkshop('child', (await current(d)).revision, action, d);
async function identify(d: SansuDatabase, specimenId: WorkshopSpecimenId) {
    for (let section = 0; section < 6; section++) await change(d, { type: 'brush', specimenId, section });
    for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) await change(d, { type: 'observe-specimen', specimenId, result, cleanedMask: 63 });
}
async function assembleA(d: SansuDatabase) {
    for (const specimenId of WORKSHOP_SPECIMEN_IDS) await identify(d, specimenId);
    for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
        await change(d, { type: 'edit-draft', edit: { type: 'assemble', partId } });
        await change(d, { type: 'edit-draft', edit: { type: 'move', partId, position: { col, row: 1 } } });
    }
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('optional workshop ownership and unchanged learning', () => {
    it('keeps old workshop absent through normal planning and real learning, and rejects workshop entry until the first earned section', async () => {
        const d = await setup(false), island = await current(d), before = await snapshot(d);
        getIslandWorkshop(island);
        await expect(saveIslandWorkshop('child', island.revision, { type: 'brush', specimenId: 'seaglass', section: 0 }, d))
            .rejects.toMatchObject({ code: 'workshop-locked' });
        expect(await snapshot(d)).toEqual(before);
        await finish(d); expect((await current(d)).workshop).toBeUndefined();
        const next = await startIslandPlan('child', d);
        await commitIslandLearning('child', next.id, next.revision, answer(next), d);
        expect((await current(d)).workshop).toBeUndefined();
    });

    it('reloads partial cleaning, first observations, names, shelves, both works and checkpoint history without changing any learning table, stars or growth', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d), initial = await current(d), learning = await learningSnapshot(d);
        await change(d, { type: 'brush', specimenId: 'driftwood', section: 4 });
        await change(d, { type: 'brush', specimenId: 'driftwood', section: 1 });
        d.close(); await d.open();
        expect((await openIsland('child', d)).workshop!.specimens.driftwood.cleanedMask).toBe(18);
        await assembleA(d);
        await change(d, { type: 'name-specimen', specimenId: 'seaglass', name: 'きらり' });
        await change(d, { type: 'shelve', specimenId: 'seaglass', shelfId: 'shelf-2' });
        await change(d, { type: 'save-work', workId: 'work-1', name: 'まっすぐの さくひん' });
        await change(d, { type: 'save-work', workId: 'work-2', name: 'もうひとつ' });
        const key = workshopLayoutKey((await current(d)).workshop!.draftCheckpoint.draft.layout);
        await change(d, { type: 'observe-creation', partId: 'wheel', layoutKey: key });
        await change(d, { type: 'observe-creation', partId: 'bell', layoutKey: key });
        await change(d, { type: 'edit-draft', edit: { type: 'remove', partId: 'straight' } });
        await change(d, { type: 'edit-draft', edit: { type: 'undo' } });
        const saved = await current(d);
        expect(stableIsland(saved)).toEqual(stableIsland(initial)); expect(await learningSnapshot(d)).toEqual(learning);
        expect(saved.workshop!.draftCheckpoint.draft.redo).toHaveLength(1);
        expect(saved.workshop!.creations).toHaveLength(2);
        d.close(); await d.open();
        expect(await openIsland('child', d)).toEqual(saved);
        expect(await startIslandPlan('child', d)).toEqual(plan);
        expect(await learningSnapshot(d)).toEqual(learning);
        // Continuing the reserved ordinary question does not materialize/reset any workshop default.
        await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d);
        expect((await current(d)).workshop).toEqual(saved.workshop);
        expect((await d.islandPlans.get(plan.id))!.cursor).toBe(plan.cursor + 1);
    });

    it('never replaces unknown, damaged or foreign workshop state on read, normal learning or an expression write', async () => {
        const d = await setup(), island = await current(d), plan = await startIslandPlan('child', d);
        const defaults = getIslandWorkshop(island), foreign = getIslandWorkshop({ ...island, profileId: 'other' });
        const invalids: unknown[] = [null, { ...defaults, version: 9 }, { ...defaults, futureData: [1] }, foreign];
        const damaged = structuredClone(defaults); damaged.specimens.seaglass.cleanedMask = -1; invalids.push(damaged);
        for (const workshop of invalids) {
            await d.islands.put({ ...island, workshop: workshop as IslandWorkshopState });
            const before = await snapshot(d);
            await expect(openIsland('child', d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(saveIslandWorkshop('child', island.revision, { type: 'cancel-draft' }, d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(saveIslandExperience('child', island.revision, { type: 'emblem', emblem: 'wave' }, d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
        }
    });
});

describe('canonical CAS receipts and failure recovery', () => {
    it('deduplicates identical canonical requests from two tabs and retries an uncertain successful request without recapturing a newer work', async () => {
        const d = await setup(), island = await current(d), other = new SansuDatabase(d.name, options); await other.open();
        try {
            const result = await Promise.all([
                saveIslandWorkshop('child', island.revision, { type: 'name-specimen', specimenId: 'seaglass', name: ' か\u3099らす ' }, d),
                saveIslandWorkshop('child', island.revision, { name: 'がらす', specimenId: 'seaglass', type: 'name-specimen' }, other),
            ]);
            expect(result[0]).toEqual(result[1]);
            expect(await d.islandEvents.where('type').equals('workshop_changed').count()).toBe(1);
            await change(d, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 0, row: 1 } } });
            const beforeSave = await current(d), intent = { type: 'save-work' as const, workId: 'work-1' as const, name: 'おためし' };
            const lostReply = async () => { await saveIslandWorkshop('child', beforeSave.revision, intent, d); throw new Error('response lost after committed transaction'); };
            await expect(lostReply()).rejects.toThrow('response lost');
            await change(d, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 3, row: 2 } } });
            const beforeRetry = await snapshot(d), newest = await current(d);
            expect(await saveIslandWorkshop('child', beforeSave.revision, intent, other)).toEqual(newest);
            expect(await snapshot(d)).toEqual(beforeRetry);
            expect(newest.workshop!.works['work-1']!.layout.parts.straight.position).toEqual({ col: 0, row: 1 });
            expect(newest.workshop!.draftCheckpoint.draft.layout.parts.straight.position).toEqual({ col: 3, row: 2 });
        } finally { other.close(); }
    });

    it('rejects simultaneous different intents and stale draft edits, then rebases the narrow gesture without erasing newer observations', async () => {
        const d = await setup(), island = await current(d), other = new SansuDatabase(d.name, options); await other.open();
        try {
            const results = await Promise.allSettled([
                saveIslandWorkshop('child', island.revision, { type: 'brush', specimenId: 'driftwood', section: 0 }, d),
                saveIslandWorkshop('child', island.revision, { type: 'brush', specimenId: 'seaglass', section: 0 }, other),
            ]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
            const old = await current(d), gesture = { type: 'edit-draft' as const, edit: { type: 'move' as const, partId: 'straight' as const, position: { col: 0, row: 1 } } };
            await change(d, { type: 'observe-specimen', specimenId: 'driftwood', result: 'float', cleanedMask: old.workshop!.specimens.driftwood.cleanedMask });
            const observed = await current(d), before = await snapshot(d);
            await expect(saveIslandWorkshop('child', old.revision, gesture, other)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
            const rebased = await saveIslandWorkshop('child', observed.revision, gesture, other);
            expect(rebased.workshop!.specimens).toEqual(observed.workshop!.specimens);
            expect(rebased.workshop!.draftCheckpoint.draft.layout.parts.straight.position).toEqual({ col: 0, row: 1 });
        } finally { other.close(); }
    });

    it('checks the current profile before replay and never applies an old request or saved slot to another child', async () => {
        const d = await setup(), island = await current(d);
        await change(d, { type: 'name-specimen', specimenId: 'seaglass', name: 'わたしの きらり' });
        await change(d, { type: 'save-work', workId: 'work-1', name: 'わたしの さくひん' });
        const app = (await d.appData.get('app'))!, profile = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(profile); await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other: profile } });
        const otherIsland = await openIsland('other', d), before = await snapshot(d);
        await expect(saveIslandWorkshop('child', island.revision, { type: 'name-specimen', specimenId: 'seaglass', name: 'わたしの きらり' }, d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(saveIslandWorkshop('other', otherIsland.revision, { type: 'load-work', workId: 'work-1' }, d)).rejects.toMatchObject({ code: 'workshop-locked' });
        expect(await snapshot(d)).toEqual(before);
        expect(getIslandWorkshop(otherIsland).specimens.seaglass.name).toBeUndefined();
        expect(getIslandWorkshop(otherIsland).specimens.seaglass.id).not.toBe((await current(d)).workshop!.specimens.seaglass.id);
    });

    it('rolls back a real native abort after the island write, and accepts the exact same intent and revision afterward', async () => {
        const d = await setup(); await identify(d, 'driftwood');
        const island = await current(d), before = await snapshot(d), intent = { type: 'edit-draft' as const, edit: { type: 'assemble' as const, partId: 'straight' as const } };
        let calls = 0, abortEvents = 0, aborted: Promise<void> | undefined;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'workshop_changed') {
                calls++; aborted = new Promise(resolve => transaction.idbtrans.addEventListener('abort', () => { abortEvents++; resolve(); }));
                transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandWorkshop('child', island.revision, intent, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        expect(calls).toBe(1); await aborted; expect(abortEvents).toBe(1); expect(await snapshot(d)).toEqual(before);
        const recovered = await saveIslandWorkshop('child', island.revision, intent, d);
        expect(recovered.workshop!.draftCheckpoint.draft.layout.parts.straight.assembled).toBe(true);
        expect(recovered.workshop!.draftCheckpoint.draft.undo).toHaveLength(1);
        const saved = await snapshot(d);
        await saveIslandWorkshop('child', island.revision, intent, d);
        expect(await snapshot(d)).toEqual(saved);
    });

    it('rolls back an unknown receipt-write failure without recording a phantom observation or first identity', async () => {
        const d = await setup();
        for (let section = 0; section < 6; section++) await change(d, { type: 'brush', specimenId: 'seaglass', section });
        await change(d, { type: 'observe-specimen', specimenId: 'seaglass', result: 'clean', cleanedMask: 63 });
        const island = await current(d), before = await snapshot(d), intent = { type: 'observe-specimen' as const, specimenId: 'seaglass' as const, result: 'transmit' as const, cleanedMask: 63 };
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'workshop_changed') throw new Error('disk unavailable'); };
        d.islandEvents.hook('creating', fail);
        await expect(saveIslandWorkshop('child', island.revision, intent, d)).rejects.toThrow('disk unavailable');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        const recovered = await saveIslandWorkshop('child', island.revision, intent, d);
        expect(recovered.workshop!.specimens.seaglass.observations).toHaveLength(2);
        expect(recovered.workshop!.specimens.seaglass.identity).toMatchObject({ order: 3 });
    });

    it('rejects injected snapshots, invalid physical outcomes, occupied shelves and a stale rendered layout without any table change', async () => {
        const d = await setup(); await assembleA(d);
        await change(d, { type: 'shelve', specimenId: 'seaglass', shelfId: 'shelf-1' });
        const island = await current(d), before = await snapshot(d);
        for (const intent of [
            { type: 'observe-specimen', specimenId: 'seaglass', result: 'float', cleanedMask: 63 },
            { type: 'shelve', specimenId: 'driftwood', shelfId: 'shelf-1' },
            { type: 'save-work', workId: 'work-1', name: 'さくひん', draft: island.workshop!.draftCheckpoint.draft },
            { type: 'load-work', workId: 'work-2' },
            { type: 'observe-creation', partId: 'bell', layoutKey: workshopLayoutKey(getIslandWorkshop({ ...island, workshop: undefined }).draftCheckpoint.draft.layout) },
        ]) await expect(saveIslandWorkshop('child', island.revision, intent as IslandWorkshopAction, d)).rejects.toBeInstanceOf(IslandWorkshopConflict);
        expect(await snapshot(d)).toEqual(before);
    });
});
