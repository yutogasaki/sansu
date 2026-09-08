import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { getIslandCustomization } from './customization';
import { customizeIsland } from './customizationRepository';
import { getIslandExpression } from './expression';
import { saveIslandExpression } from './expressionRepository';
import { acquireIslandFurniture } from './furnitureRepository';
import { recordIslandDiscovery } from './growthRepository';
import { photoInput } from './photos.testSupport';
import { loadIslandPhotoBlobs, saveIslandPhoto } from './photosRepository';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import { getIslandRewardGoal, quoteIslandRewardGoal, type IslandRewardGoalAction, type IslandRewardGoalTarget } from './rewardGoal';
import { saveIslandRewardGoal } from './rewardGoalRepository';
import { WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, workshopLayoutKey, type IslandWorkshopAction } from './workshop';
import { saveIslandWorkshop } from './workshopRepository';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const telescope = { category: 'furniture', kind: 'telescope' } as const;
const raincoat = { category: 'expression', itemId: 'raincoat' } as const;
const accent = { category: 'customization', itemId: 'star-lanterns' } as const;
const current = async (database: SansuDatabase) => (await database.islands.get('child'))!;
async function setup(points?: number) {
    const database = new SansuDatabase(`reward-goal-${crypto.randomUUID()}`, options); databases.push(database);
    const child = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await database.profiles.put(child); await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child } });
    await openIsland('child', database); await startIslandPlan('child', database);
    // Wallet-only fixture for transaction fault/race cases. The learning test earns every star through the ordinary writer.
    if (points !== undefined) {
        const island = await current(database); await database.islands.put({ ...island, customization: { ...getIslandCustomization(island), points } });
    }
    return database;
}
async function normalize(value: unknown): Promise<unknown> {
    if (value instanceof Blob) return { mime: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())] };
    if (value instanceof Date) return { date: value.toISOString() };
    if (Array.isArray(value)) return Promise.all(value.map(normalize));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await normalize(item)])));
    return value;
}
async function snapshot(database: SansuDatabase): Promise<Record<string, unknown>> {
    return Object.fromEntries(await Promise.all(database.tables.map(async table => [table.name, await normalize(await table.toArray())])));
}
function expectExactWrite(before: Record<string, unknown>, after: Record<string, unknown>, expectedIsland: IslandRecord, event: IslandEvent) {
    const expected = structuredClone(before);
    expected.islands = (before.islands as IslandRecord[]).map(island => island.profileId === expectedIsland.profileId ? expectedIsland : island);
    expected.islandEvents = [...before.islandEvents as IslandEvent[], event].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    expect(after).toStrictEqual(expected);
}
const eventFor = (initial: IslandRecord, updated: IslandRecord, action: IslandRewardGoalAction): IslandEvent => ({
    id: JSON.stringify(['island-reward-goal-v1', initial.profileId, initial.revision]), profileId: initial.profileId,
    type: 'reward_goal_changed', timestamp: updated.updatedAt, action,
});
const choose = async (database: SansuDatabase, target: IslandRewardGoalTarget) => saveIslandRewardGoal('child', (await current(database)).revision, { type: 'choose', target }, database);
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(database: SansuDatabase) {
    let plan = await startIslandPlan('child', database);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), database)).plan;
}
async function acquire(database: SansuDatabase, island: IslandRecord, target: IslandRewardGoalTarget) {
    if (target.category === 'customization') return customizeIsland('child', island.revision, { type: 'purchase', itemId: target.itemId }, database);
    if (target.category === 'furniture') return acquireIslandFurniture('child', island.revision, { type: 'acquire-furniture', kind: target.kind }, database);
    return saveIslandExpression('child', island.revision, { type: 'acquire', itemId: target.itemId }, database);
}
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });

describe('reward goals and the real island storage boundary', () => {
    it('reads without migration, chooses an unqualified free item and clears with only a goal receipt and revision', async () => {
        const database = await setup(), initial = await current(database), before = await snapshot(database);
        const target = { category: 'expression', itemId: 'shell-three-notes' } as const;
        expect(getIslandRewardGoal(initial)).toBeNull();
        expect(quoteIslandRewardGoal(initial, target)).toMatchObject({ canChoose: true, canAcquire: false, price: 0, requirement: { id: 'bell', met: false } });
        expect(await snapshot(database)).toStrictEqual(before);
        const action = { type: 'choose', target } as const, selected = await saveIslandRewardGoal('child', initial.revision, action, database);
        expectExactWrite(before, await snapshot(database), { ...initial, rewardGoal: { version: 1, target },
            revision: initial.revision + 1, updatedAt: selected.updatedAt }, eventFor(initial, selected, action));
        const beforeClear = await snapshot(database), cleared = await saveIslandRewardGoal('child', selected.revision, { type: 'clear' }, database);
        expectExactWrite(beforeClear, await snapshot(database), { ...initial, revision: selected.revision + 1, updatedAt: cleared.updatedAt }, eventFor(selected, cleared, { type: 'clear' }));
        expect(cleared.customization).toBeUndefined(); expect(cleared.expression).toBeUndefined();
        database.close(); await database.open(); expect(await openIsland('child', database)).toStrictEqual(cleared);
    });
    it('earns the desired furniture through ordinary learning, preserves photographs and old memories, then resumes the same reservation', async () => {
        const database = await setup(), initial = await current(database), history = structuredClone(initial.growth!.memories);
        await choose(database, telescope);
        while (getIslandCustomization(await current(database)).points < 30) {
            await finish(database); expect(getIslandRewardGoal(await current(database))).toEqual(telescope);
        }
        const plan = await startIslandPlan('child', database), state = await current(database);
        const photo = await photoInput(); // Valid PNG storage fixture; it is not real camera/visual evidence.
        await saveIslandPhoto('child', 0, photo.input, photo.blobs, database);
        expect(await current(database)).toStrictEqual(state); // The photo writer must not change this goal/revision.
        const before = await snapshot(database), bought = await acquire(database, state, telescope);
        const expected = { ...state, items: [...state.items, { id: 'optional-telescope', kind: 'telescope' as const, rotation: 0 }],
            customization: { ...state.customization!, points: state.customization!.points - 30 }, revision: state.revision + 1, updatedAt: bought.updatedAt };
        delete expected.rewardGoal;
        expectExactWrite(before, await snapshot(database), expected, { id: JSON.stringify(['island-furniture-v1', 'child', state.revision]),
            profileId: 'child', type: 'furniture_acquired', timestamp: bought.updatedAt,
            action: { type: 'acquire-furniture', kind: 'telescope' }, itemId: 'optional-telescope', kind: 'telescope' });
        expect(bought.growth!.memories[0]).toStrictEqual(history[0]); expect(JSON.stringify(bought.growth!.memories)).not.toContain('rewardGoal');
        database.close(); await database.open(); expect(await startIslandPlan('child', database)).toStrictEqual(plan);
        const bytes = (await loadIslandPhotoBlobs('child', photo.input.id, database))!;
        expect(await bytes.image.arrayBuffer()).toEqual(await photo.blobs.image.arrayBuffer());
        expect(await bytes.thumbnail.arrayBuffer()).toEqual(await photo.blobs.thumbnail.arrayBuffer());
        const nextGoal = await choose(database, raincoat), continued = await commitIslandLearning('child', plan.id, plan.revision, answer(plan), database);
        expect(continued.plan.cursor).toBeGreaterThan(plan.cursor); expect(getIslandRewardGoal(continued.island)).toEqual(raincoat);
        expect(continued.island.items).toEqual(nextGoal.items);
    });
    it.each([accent, telescope, raincoat])('rolls back the acquisition and its goal clearing together after native abort: $category', async target => {
        const database = await setup(100), selected = await choose(database, target), before = await snapshot(database);
        let nativeAborts = 0, requested = false;
        let onAbort!: () => void;
        const nativeAborted = new Promise<void>(resolve => { onAbort = resolve; });
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (['customization_changed', 'furniture_acquired', 'expression_changed'].includes(event.type)) {
                requested = true; transaction.idbtrans.addEventListener('abort', () => { nativeAborts++; onAbort(); }); transaction.idbtrans.abort();
            }
        };
        database.islandEvents.hook('creating', abort);
        await expect(acquire(database, selected, target)).rejects.toThrow(); database.islandEvents.hook('creating').unsubscribe(abort);
        expect(requested).toBe(true); await nativeAborted;
        expect(nativeAborts).toBe(1); expect(await snapshot(database)).toStrictEqual(before); expect(getIslandRewardGoal(await current(database))).toEqual(target);
        const saved = await acquire(database, selected, target);
        expect(getIslandRewardGoal(saved)).toBeNull(); expect(quoteIslandRewardGoal(saved, target)).toMatchObject({ owned: true, canChoose: false });
        expect(saved.customization!.points).toBe(100 - quoteIslandRewardGoal(selected, target).price);
    });
    it('a native abort of replacement cannot clear the older category goal; exact same intent retries once', async () => {
        const database = await setup(), legacy = await customizeIsland('child', (await current(database)).revision, { type: 'desire', itemId: 'starry' }, database);
        const before = await snapshot(database), action = { type: 'choose', target: telescope } as const;
        let nativeAborts = 0, requested = false;
        let onAbort!: () => void;
        const nativeAborted = new Promise<void>(resolve => { onAbort = resolve; });
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'reward_goal_changed') {
                requested = true; transaction.idbtrans.addEventListener('abort', () => { nativeAborts++; onAbort(); }); transaction.idbtrans.abort();
            }
        };
        database.islandEvents.hook('creating', abort);
        await expect(saveIslandRewardGoal('child', legacy.revision, action, database)).rejects.toThrow(); database.islandEvents.hook('creating').unsubscribe(abort);
        expect(requested).toBe(true); await nativeAborted;
        expect(nativeAborts).toBe(1); expect(await snapshot(database)).toStrictEqual(before);
        const replaced = await saveIslandRewardGoal('child', legacy.revision, action, database);
        expectExactWrite(before, await snapshot(database), { ...legacy, customization: { ...legacy.customization!, desiredItemId: null },
            rewardGoal: { version: 1, target: telescope }, revision: legacy.revision + 1, updatedAt: replaced.updatedAt }, eventFor(legacy, replaced, action));
    });
    it('lost choose/clear completion and old desire receipts return the latest goal without reselecting or clearing it', async () => {
        const database = await setup(), initial = await current(database), original = { type: 'choose', target: telescope } as const;
        let nativeCommits = 0;
        const committed = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'reward_goal_changed') transaction.idbtrans.addEventListener('complete', () => nativeCommits++);
        };
        database.islandEvents.hook('creating', committed);
        await expect(saveIslandRewardGoal('child', initial.revision, original, database).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        database.islandEvents.hook('creating').unsubscribe(committed); expect(nativeCommits).toBe(1);
        const later = await choose(database, raincoat), beforeRetry = await snapshot(database);
        expect(await saveIslandRewardGoal('child', initial.revision, { target: { kind: 'telescope', category: 'furniture' }, type: 'choose' }, database)).toEqual(later);
        expect(await snapshot(database)).toStrictEqual(beforeRetry);
        await expect(saveIslandRewardGoal('child', initial.revision, { type: 'choose', target: raincoat }, database)).rejects.toBeInstanceOf(IslandConflict);
        await expect(saveIslandRewardGoal('child', later.revision, { type: 'clear' }, database).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        const chosen = await choose(database, telescope), beforeClearRetry = await snapshot(database);
        expect(await saveIslandRewardGoal('child', later.revision, { type: 'clear' }, database)).toEqual(chosen);
        expect(await snapshot(database)).toStrictEqual(beforeClearRetry);
        const legacy = await customizeIsland('child', chosen.revision, { type: 'desire', itemId: 'starry' }, database);
        const latest = await choose(database, raincoat), beforeOldRetry = await snapshot(database);
        expect(await customizeIsland('child', legacy.revision - 1, { type: 'desire', itemId: 'starry' }, database)).toEqual(latest);
        expect(await snapshot(database)).toStrictEqual(beforeOldRetry);
    });
    it.each([telescope, raincoat])('old acquisition retry cannot clear a later goal after ownership changes: $category', async target => {
        const database = await setup(100), selected = await choose(database, target);
        await expect(acquire(database, selected, target).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        const latest = await choose(database, { category: 'expression', itemId: 'butterfly-stamp' }), before = await snapshot(database);
        expect(await acquire(database, selected, target)).toEqual(latest); expect(await snapshot(database)).toStrictEqual(before);
        expect(getIslandRewardGoal(latest)).toEqual({ category: 'expression', itemId: 'butterfly-stamp' });
    });
    it('CAS serializes goal choice against a different purchase; clear with the stale revision cannot erase the winner', async () => {
        const database = await setup(100), initial = await current(database), second = new SansuDatabase(database.name, options); await second.open();
        try {
            const outcomes = await Promise.allSettled([saveIslandRewardGoal('child', initial.revision, { type: 'choose', target: telescope }, database),
                saveIslandExpression('child', initial.revision, { type: 'acquire', itemId: 'raincoat' }, second)]);
            expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
            expect(outcomes.find(outcome => outcome.status === 'rejected')).toMatchObject({ reason: expect.any(IslandConflict) });
            const beforeClear = await snapshot(database);
            await expect(saveIslandRewardGoal('child', initial.revision, { type: 'clear' }, database)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(database)).toStrictEqual(beforeClear);
            const latest = await current(database);
            if (outcomes[0].status === 'rejected') await saveIslandRewardGoal('child', latest.revision, { type: 'choose', target: telescope }, database);
            else await saveIslandExpression('child', latest.revision, { type: 'acquire', itemId: 'raincoat' }, database);
            const completed = await current(database); expect(getIslandRewardGoal(completed)).toEqual(telescope);
            expect(completed.customization!.points).toBe(75); expect(completed.expression!.ownedItemIds).toEqual(['raincoat']);
        } finally { second.close(); }
    });
    it('coalesces the same canonical choice across connections and keeps all other profiles isolated', async () => {
        const database = await setup(), initial = await current(database), second = new SansuDatabase(database.name, options); await second.open();
        const action = { type: 'choose', target: telescope } as const;
        try {
            const [a, b] = await Promise.all([saveIslandRewardGoal('child', initial.revision, action, database), saveIslandRewardGoal('child', initial.revision, action, second)]);
            expect(a).toEqual(b); expect(await database.islandEvents.where('type').equals('reward_goal_changed').count()).toBe(1);
            const app = (await database.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
            await database.profiles.put(other); await database.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } }); await openIsland('other', database);
            const before = await snapshot(database);
            await expect(saveIslandRewardGoal('child', initial.revision, action, database)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(database)).toStrictEqual(before);
            const otherBefore = (await database.islands.get('other'))!;
            await saveIslandRewardGoal('other', otherBefore.revision, { type: 'choose', target: raincoat }, database);
            expect(await current(database)).toStrictEqual(a); expect(getIslandRewardGoal((await database.islands.get('other'))!)).toEqual(raincoat);
        } finally { second.close(); }
    });
    it('ordinary writers reject corrupted or simultaneous goals without deleting them as recovery', async () => {
        const database = await setup(100), initial = await current(database), plan = await startIslandPlan('child', database);
        for (const fields of [
            { rewardGoal: null }, { rewardGoal: { version: 9, target: telescope } },
            { rewardGoal: { version: 1, target: { category: 'furniture', kind: 'bench' } } },
            { rewardGoal: { version: 1, target: telescope }, customization: { ...initial.customization!, desiredItemId: 'starry' } },
        ]) {
            await database.islands.put({ ...initial, ...fields } as IslandRecord); const before = await snapshot(database);
            await expect(openIsland('child', database)).rejects.toBeInstanceOf(IslandConflict);
            await expect(saveIslandRewardGoal('child', initial.revision, { type: 'clear' }, database)).rejects.toBeInstanceOf(IslandConflict);
            await expect(commitIslandLearning('child', plan.id, plan.revision, answer(plan), database)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(database)).toStrictEqual(before);
        }
    });
    it('a saved butterfly observation changes eligibility but not the goal or ownership, then only the selected acquisition clears it', async () => {
        const database = await setup(); await choose(database, { category: 'expression', itemId: 'butterfly-stamp' });
        while ((await current(database)).growth!.progress.garden < 3) await finish(database);
        const eligible = await current(database);
        // The normal growth writer reaches eligibility; this is the renderer observation notification, not a browser visibility proof.
        const observed = await recordIslandDiscovery('child', 'ribbon-butterfly', eligible.items.find(item => item.kind === 'flower')!.id, database);
        expect(getIslandRewardGoal(observed)).toEqual({ category: 'expression', itemId: 'butterfly-stamp' }); expect(observed.expression).toBeUndefined();
        expect(quoteIslandRewardGoal(observed, { category: 'expression', itemId: 'butterfly-stamp' })).toMatchObject({ requirement: { met: true }, canAcquire: true });
        const other = await saveIslandExpression('child', observed.revision, { type: 'acquire', itemId: 'butterfly-stitch' }, database);
        expect(getIslandRewardGoal(other)).toEqual(getIslandRewardGoal(observed));
        const before = await snapshot(database), saved = await saveIslandExpression('child', other.revision, { type: 'acquire', itemId: 'butterfly-stamp' }, database);
        const expected = { ...other, expression: { ...getIslandExpression(other), ownedItemIds: ['butterfly-stitch', 'butterfly-stamp'] as const }, revision: other.revision + 1, updatedAt: saved.updatedAt };
        delete expected.rewardGoal;
        expectExactWrite(before, await snapshot(database), { ...expected, expression: { ...expected.expression, ownedItemIds: [...expected.expression.ownedItemIds] } }, {
            id: JSON.stringify(['island-expression-v1', 'child', other.revision]), profileId: 'child', type: 'expression_changed',
            timestamp: saved.updatedAt, action: { type: 'acquire', itemId: 'butterfly-stamp' } });
    });
    it('bell construction alone is not qualification, and real saved observation with sound off preserves the target until acquisition', async () => {
        const database = await setup(); await finish(database);
        const target = { category: 'expression', itemId: 'shell-three-notes' } as const; await choose(database, target);
        const workshop = async (action: IslandWorkshopAction) => saveIslandWorkshop('child', (await current(database)).revision, action, database);
        for (const specimenId of WORKSHOP_SPECIMEN_IDS) {
            for (let section = 0; section < 6; section++) await workshop({ type: 'brush', specimenId, section });
            for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) await workshop({ type: 'observe-specimen', specimenId, result, cleanedMask: 63 });
        }
        for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
            await workshop({ type: 'edit-draft', edit: { type: 'assemble', partId } });
            await workshop({ type: 'edit-draft', edit: { type: 'move', partId, position: { col, row: 1 } } });
        }
        const built = await current(database), before = await snapshot(database);
        expect(quoteIslandRewardGoal(built, target)).toMatchObject({ price: 0, canAcquire: false });
        await expect(acquire(database, built, target)).rejects.toMatchObject({ code: 'not-eligible' }); expect(await snapshot(database)).toStrictEqual(before);
        await workshop({ type: 'observe-creation', partId: 'bell', layoutKey: workshopLayoutKey(built.workshop!.draftCheckpoint.draft.layout) });
        const observed = await current(database); expect(getIslandRewardGoal(observed)).toEqual(target);
        expect(quoteIslandRewardGoal(observed, target)).toMatchObject({ canAcquire: true, requirement: { kind: 'creation', id: 'bell', met: true } });
        const saved = await acquire(database, observed, target); expect(getIslandRewardGoal(saved)).toBeNull();
        expect(saved.customization).toEqual(observed.customization); expect(saved.workshop).toEqual(observed.workshop);
        expect(saved.expression!.selection.soundscape).toBeNull();
    });
});
