import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { getIslandLandAccess, islandPlacementCandidates } from './catalog';
import { commitIslandLearning } from './commit';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import { getIslandSharedMemories, isValidSharedDisplayPlacement, resolveSharedTarget, sharedDestinationKey, sharedDisplayKey,
    sharedFirstMemoryIdentity, sharedOperationIdentity, sharedRequestIdentity, sharedWorkCaptureKey,
    type IslandSharedMemoriesAction, type IslandSharedMemoriesState, type SharedTargetRef } from './sharedMemories';
import { saveIslandSharedMemories } from './sharedMemoriesRepository';
import { getIslandWorkshop, WORKSHOP_SPECIMENS, type IslandWorkshopAction, type WorkshopSpecimenId } from './workshop';
import { saveIslandWorkshop } from './workshopRepository';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const specimen: SharedTargetRef = { kind: 'specimen', specimenId: 'driftwood' };
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
const stableIsland = (island: IslandRecord) => Object.fromEntries(Object.entries(island).filter(([key]) => !['sharedMemories', 'revision', 'updatedAt'].includes(key)));
async function learningSnapshot(d: SansuDatabase) {
    const all = await snapshot(d); delete all.islands;
    all.islandEvents = (all.islandEvents as IslandEvent[]).filter(event => !['shared_memory_changed', 'shared_memory_first'].includes(event.type));
    return all;
}
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finishLearning(d: SansuDatabase) {
    let plan = await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
}
async function setup(earned = true) {
    const d = new SansuDatabase(`island-shared-${crypto.randomUUID()}`, options); databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d); if (earned) await finishLearning(d);
    return d;
}
const change = async (d: SansuDatabase, action: IslandSharedMemoriesAction) => saveIslandSharedMemories('child', (await current(d)).revision, action, d);
const workshop = async (d: SansuDatabase, action: IslandWorkshopAction) => saveIslandWorkshop('child', (await current(d)).revision, action, d);
async function identify(d: SansuDatabase, specimenId: WorkshopSpecimenId) {
    for (let section = 0; section < 6; section++) await workshop(d, { type: 'brush', specimenId, section });
    for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) await workshop(d, { type: 'observe-specimen', specimenId, result, cleanedMask: 63 });
}
async function createWork(d: SansuDatabase) {
    await identify(d, 'driftwood');
    await workshop(d, { type: 'edit-draft', edit: { type: 'assemble', partId: 'straight' } });
    await workshop(d, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 0, row: 1 } } });
    return workshop(d, { type: 'save-work', workId: 'work-1', name: 'さくひん A' });
}
function workRef(island: IslandRecord): SharedTargetRef {
    return { kind: 'work', workId: 'work-1', targetKey: sharedWorkCaptureKey(island.profileId, 'work-1', getIslandWorkshop(island).works['work-1']!) };
}
function prepareAction(island: IslandRecord, target: SharedTargetRef = specimen): Extract<IslandSharedMemoriesAction, { type: 'prepare-request' }> {
    const display = island.sharedMemories?.displays['display-1'], resolved = resolveSharedTarget(island, target);
    const point = display?.position ?? islandPlacementCandidates(getIslandLandAccess(island)).find(point => isValidSharedDisplayPlacement(island, 'display-1', resolved, point));
    if (!point) throw new Error('No display space for test');
    return { type: 'prepare-request', requestId: sharedRequestIdentity('child', crypto.randomUUID()), residentId: 'otter', jobId: 'carry', target,
        expectedRequestId: island.sharedMemories?.activeRequest?.requestId ?? null,
        destination: { displayId: 'display-1', position: point, rotation: 0, expectedDisplayKey: sharedDisplayKey(display) } };
}
function completeAction(island: IslandRecord): Extract<IslandSharedMemoriesAction, { type: 'complete-request' }> {
    const request = island.sharedMemories!.activeRequest!;
    return { type: 'complete-request', requestId: request.requestId, targetKey: request.target.targetKey, visualKey: request.visualKey,
        destinationKey: sharedDestinationKey(request.destination), result: { kind: 'placed' } };
}
async function completeJob(d: SansuDatabase, target: SharedTargetRef = specimen) {
    await change(d, prepareAction(await current(d), target));
    return change(d, completeAction(await current(d)));
}
afterEach(async () => { vi.restoreAllMocks(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('shared memory persistence and learning boundaries', () => {
    it('preserves legacy absence through real planning/answers and rejects new features before the first section', async () => {
        const d = await setup(false), island = await current(d), before = await snapshot(d);
        getIslandSharedMemories(island);
        await expect(saveIslandSharedMemories('child', island.revision, prepareAction(island), d)).rejects.toMatchObject({ code: 'locked' });
        expect(await snapshot(d)).toEqual(before); expect((await current(d)).sharedMemories).toBeUndefined();
        await finishLearning(d); const plan = await startIslandPlan('child', d);
        await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d);
        expect((await current(d)).sharedMemories).toBeUndefined();
    });

    it('reloads a prepared request and real result while preserving every learning table, frozen reservation, growth, stars and workshop state', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d), initial = await current(d), learning = await learningSnapshot(d);
        await change(d, prepareAction(initial));
        const prepared = await current(d);
        expect(prepared.sharedMemories!.displays).toEqual({}); expect(prepared.sharedMemories!.memories).toEqual([]);
        d.close(); await d.open(); expect(await openIsland('child', d)).toEqual(prepared);
        await change(d, completeAction(prepared));
        const saved = await current(d), memory = saved.sharedMemories!.memories[0];
        expect(saved.sharedMemories!.activeRequest!.status).toBe('result-seen');
        expect(await d.islandEvents.get(sharedFirstMemoryIdentity(memory.memoryKey))).toMatchObject({ type: 'shared_memory_first', sharedMemory: memory });
        expect(stableIsland(saved)).toEqual(stableIsland(initial)); expect(await learningSnapshot(d)).toEqual(learning);
        d.close(); await d.open(); expect(await startIslandPlan('child', d)).toEqual(plan);
        await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d);
        expect((await current(d)).sharedMemories).toEqual(saved.sharedMemories);
        expect((await d.islandPlans.get(plan.id))!.cursor).toBe(plan.cursor + 1);
    });

    it('retrieves first facts by primary key after curation, with no event scan and no extra registry in the island', async () => {
        const d = await setup(), first = await completeJob(d), memory = first.sharedMemories!.memories[0];
        await change(d, { type: 'remove-memory', memoryKey: memory.memoryKey });
        const spy = vi.spyOn(d.islandEvents, 'where').mockImplementation(() => { throw new Error('Full/index scan forbidden'); });
        const restored = await change(d, { type: 'remember-result', requestId: first.sharedMemories!.activeRequest!.requestId });
        expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
        expect(restored.sharedMemories!.memories).toEqual([memory]); expect(restored.sharedMemories!.nextMemoryOrder).toBe(2);
        await completeJob(d);
        expect((await current(d)).sharedMemories!.memories).toEqual([memory]);
        expect(await d.islandEvents.where('type').equals('shared_memory_first').count()).toBe(1);
        expect(Object.keys(restored.sharedMemories!).sort()).toEqual(['activeRequest', 'displays', 'memories', 'nextMemoryOrder', 'version']);
    });

    it('keeps the twelve-item shelf bounded while saving the full thirteenth result, then re-collects it without changing first time/order', async () => {
        const d = await setup(); await createWork(d);
        for (let i = 0; i < 13; i++) {
            await workshop(d, { type: 'save-work', workId: 'work-1', name: `さくひん ${i}` });
            await completeJob(d, workRef(await current(d)));
        }
        const full = await current(d), request = full.sharedMemories!.activeRequest!;
        expect(full.sharedMemories!.memories).toHaveLength(12); expect(request).toMatchObject({ memoryOutcome: 'not-stored-full' });
        if (request.status !== 'result-seen') throw new Error('Expected finished request');
        const receipt = (await d.islandEvents.get(sharedFirstMemoryIdentity(request.memoryKey)))!;
        expect(receipt.sharedMemory!.firstOrder).toBe(13);
        await change(d, { type: 'remove-memory', memoryKey: full.sharedMemories!.memories[0].memoryKey });
        const restored = await change(d, { type: 'remember-result', requestId: request.requestId });
        expect(restored.sharedMemories!.memories).toHaveLength(12); expect(restored.sharedMemories!.memories.at(-1)).toEqual(receipt.sharedMemory);
        expect(restored.sharedMemories!.nextMemoryOrder).toBe(14);
    });

    it('never resets foreign or damaged saved state or a malformed first receipt', async () => {
        const d = await setup(), saved = await completeJob(d), first = saved.sharedMemories!.memories[0], plan = await startIslandPlan('child', d);
        const foreign = structuredClone(saved.sharedMemories!); foreign.displays['display-1']!.target.targetKey = 'foreign';
        for (const sharedMemories of [null, { ...saved.sharedMemories!, version: 3 }, foreign]) {
            await d.islands.put({ ...saved, sharedMemories: sharedMemories as IslandSharedMemoriesState }); const before = await snapshot(d);
            await expect(openIsland('child', d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
        }
        await d.islands.put(saved);
        const id = sharedFirstMemoryIdentity(first.memoryKey), receipt = (await d.islandEvents.get(id))!;
        await d.islandEvents.put({ ...receipt, sharedMemory: { ...first, firstAt: first.firstAt + 1 } });
        const before = await snapshot(d);
        await expect(change(d, { type: 'remember-result', requestId: saved.sharedMemories!.activeRequest!.requestId })).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });
});

describe('atomic receipts, CAS, and uncertain failures', () => {
    it('deduplicates two-tab canonical requests and protects an old snapshot from a later work overwrite on uncertain retry', async () => {
        const d = await setup(); await createWork(d);
        const initial = await current(d), intent = prepareAction(initial, workRef(initial)), other = new SansuDatabase(d.name, options); await other.open();
        try {
            const both = await Promise.all([saveIslandSharedMemories('child', initial.revision, intent, d), saveIslandSharedMemories('child', initial.revision, intent, other)]);
            expect(both[0]).toEqual(both[1]);
            const prepared = await current(d), complete = completeAction(prepared);
            const loseReply = async () => { await saveIslandSharedMemories('child', prepared.revision, complete, d); throw new Error('Committed response lost'); };
            await expect(loseReply()).rejects.toThrow('response lost');
            const displayed = (await current(d)).sharedMemories!.displays['display-1']!;
            await workshop(d, { type: 'edit-draft', edit: { type: 'move', partId: 'straight', position: { col: 3, row: 2 } } });
            await workshop(d, { type: 'save-work', workId: 'work-1', name: 'さくひん B' });
            await workshop(d, { type: 'delete-work', workId: 'work-1' });
            const before = await snapshot(d), latest = await current(d);
            expect(await saveIslandSharedMemories('child', prepared.revision, complete, other)).toEqual(latest);
            expect(await snapshot(d)).toEqual(before); expect(latest.sharedMemories!.displays['display-1']).toEqual(displayed);
            expect(await d.islandEvents.where('type').equals('shared_memory_first').count()).toBe(1);
        } finally { other.close(); }
    });

    it('rejects different simultaneous intents, stale destinations, and reuse of a canceled request identity', async () => {
        const d = await setup(), initial = await current(d), a = prepareAction(initial), b = prepareAction(initial), other = new SansuDatabase(d.name, options); await other.open();
        try {
            const results = await Promise.allSettled([saveIslandSharedMemories('child', initial.revision, a, d), saveIslandSharedMemories('child', initial.revision, b, other)]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
            const prepared = await current(d), request = prepared.sharedMemories!.activeRequest!, completed = completeAction(prepared);
            await change(d, { type: 'place-display', ...request.destination, target: { kind: 'specimen', specimenId: 'seaglass' } });
            const before = await snapshot(d);
            await expect(change(d, completed)).rejects.toMatchObject({ code: 'target-changed' }); expect(await snapshot(d)).toEqual(before);
            await change(d, { type: 'cancel-request', requestId: request.requestId });
            const reused = { ...prepareAction(await current(d)), requestId: request.requestId };
            await expect(change(d, reused)).rejects.toBeInstanceOf(IslandConflict);
        } finally { other.close(); }
    });

    it('rolls back a native abort at first-fact persistence together with the exhibit, operation receipt and memory shelf', async () => {
        const d = await setup(); await change(d, prepareAction(await current(d)));
        const island = await current(d), intent = completeAction(island), before = await snapshot(d);
        let aborted: Promise<void> | undefined, nativeAborts = 0;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'shared_memory_first') {
                aborted = new Promise(resolve => transaction.idbtrans.addEventListener('abort', () => { nativeAborts++; resolve(); }));
                transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandSharedMemories('child', island.revision, intent, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        await aborted; expect(nativeAborts).toBe(1); expect(await snapshot(d)).toEqual(before);
        const saved = await saveIslandSharedMemories('child', island.revision, intent, d);
        expect(saved.sharedMemories!.memories).toHaveLength(1);
        expect(saved.sharedMemories!.activeRequest!.status).toBe('result-seen');
        const after = await snapshot(d); await saveIslandSharedMemories('child', island.revision, intent, d);
        expect(await snapshot(d)).toEqual(after);
    });

    it('retries an unknown write failure with the same revision and never lets another profile replay a successful receipt', async () => {
        const d = await setup(), island = await current(d), intent = prepareAction(island), before = await snapshot(d);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.id === sharedOperationIdentity('child', island.revision)) throw new Error('Disk unavailable'); };
        d.islandEvents.hook('creating', fail);
        await expect(saveIslandSharedMemories('child', island.revision, intent, d)).rejects.toThrow('Disk unavailable');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        await saveIslandSharedMemories('child', island.revision, intent, d);
        const app = (await d.appData.get('app'))!, profile = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(profile); await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other: profile } });
        await openIsland('other', d); const switched = await snapshot(d);
        await expect(saveIslandSharedMemories('child', island.revision, intent, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(switched); expect((await d.islands.get('other'))!.sharedMemories).toBeUndefined();
    });
});
