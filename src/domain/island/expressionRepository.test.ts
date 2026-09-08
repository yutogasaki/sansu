import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { getIslandCustomization } from './customization';
import { customizeIsland } from './customizationRepository';
import { getIslandExperience, previewIslandLayout, type IslandExperienceAction } from './experience';
import { saveIslandExperience } from './experienceRepository';
import { getIslandExpression, getIslandExpressionEligibility, previewIslandExpression, type IslandExpressionAction, type IslandExpressionState } from './expression';
import { saveIslandExpression } from './expressionRepository';
import { recordIslandDiscovery } from './growthRepository';
import { photoInput } from './photos.testSupport';
import { loadIslandPhotoBlobs, saveIslandPhoto } from './photosRepository';
import { IslandConflict, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import type { IslandSavedSceneStyleV2 } from './sceneStyle';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';
import { WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, workshopLayoutKey, type IslandWorkshopAction } from './workshop';
import { saveIslandWorkshop } from './workshopRepository';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const act = async (d: SansuDatabase, action: IslandExpressionAction) => saveIslandExpression('child', (await current(d)).revision, action, d);
const experience = async (d: SansuDatabase, action: IslandExperienceAction) => saveIslandExperience('child', (await current(d)).revision, action, d);
async function setup(points?: number) {
    const d = new SansuDatabase(`expression-${crypto.randomUUID()}`, options); databases.push(d);
    const child = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(child); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child } });
    await openIsland('child', d); await startIslandPlan('child', d);
    // Wallet-only fixture for failure cases; the first test earns its money through ordinary answers.
    if (points !== undefined) {
        const island = await current(d); island.customization = { ...getIslandCustomization(island), points, desiredItemId: 'candy-complete' };
        await d.islands.put(island);
    }
    return d;
}
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase) {
    let plan = await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
}
/** Compare photo bytes as well as metadata, rather than treating opaque Blob objects as equal. */
async function normalize(value: unknown): Promise<unknown> {
    if (value instanceof Blob) return { mime: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())] };
    if (value instanceof Date) return { date: value.toISOString() };
    if (Array.isArray(value)) return Promise.all(value.map(normalize));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, entry]) => [key, await normalize(entry)])));
    return value;
}
async function snapshot(d: SansuDatabase): Promise<Record<string, unknown>> {
    return Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await normalize(await table.toArray())])));
}
function expectOnlyExpressionWrite(before: Record<string, unknown>, after: Record<string, unknown>, saved: IslandRecord,
    initialRevision: number, action: IslandExpressionAction) {
    for (const name of Object.keys(before)) if (name !== 'islands' && name !== 'islandEvents') expect(after[name], name).toEqual(before[name]);
    expect(after.islands).toEqual((before.islands as IslandRecord[]).map(island => island.profileId === saved.profileId ? saved : island));
    const previous = before.islandEvents as IslandEvent[], events = after.islandEvents as IslandEvent[];
    expect(events).toHaveLength(previous.length + 1);
    for (const event of previous) expect(events.find(candidate => candidate.id === event.id)).toEqual(event);
    expect(events.filter(event => !previous.some(prior => prior.id === event.id))).toEqual([{
        id: JSON.stringify(['island-expression-v1', 'child', initialRevision]), profileId: 'child', type: 'expression_changed', timestamp: saved.updatedAt, action,
    }]);
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('expression ownership with the existing learning and photo stores', () => {
    it('earns ordinary stars without materializing expression, acquires separately, reloads and resumes the exact same learning plan', async () => {
        const d = await setup();
        while (getIslandCustomization(await current(d)).points < 25) {
            await finish(d); expect((await current(d)).expression).toBeUndefined();
        }
        const plan = await startIslandPlan('child', d), photo = await photoInput();
        await saveIslandPhoto('child', 0, photo.input, photo.blobs, d);
        const initial = await current(d), before = await snapshot(d), action = { type: 'acquire', itemId: 'raincoat' } as const;
        const saved = await saveIslandExpression('child', initial.revision, action, d);
        expectOnlyExpressionWrite(before, await snapshot(d), saved, initial.revision, action);
        expect(saved.customization).toEqual({ ...initial.customization, points: initial.customization!.points - 25 });
        expect(saved.expression).toEqual({ ...getIslandExpression(initial), ownedItemIds: ['raincoat'] });
        expect(saved.growth).toEqual(initial.growth); expect(saved.items).toEqual(initial.items); expect(saved.pendingPlanId).toBe(plan.id);
        const beforeEquip = await snapshot(d), equip = { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' } as const;
        const dressed = await saveIslandExpression('child', saved.revision, equip, d);
        expectOnlyExpressionWrite(beforeEquip, await snapshot(d), dressed, saved.revision, equip);
        expect(dressed.customization).toEqual(saved.customization); expect((await d.islandPlans.get(plan.id))).toEqual(plan);
        d.close(); await d.open(); expect(await openIsland('child', d)).toEqual(dressed);
        expect(await startIslandPlan('child', d)).toEqual(plan);
        const blobs = await loadIslandPhotoBlobs('child', photo.input.id, d);
        expect(await blobs!.image.arrayBuffer()).toEqual(await photo.blobs.image.arrayBuffer());
        expect(await blobs!.thumbnail.arrayBuffer()).toEqual(await photo.blobs.thumbnail.arrayBuffer());
        const continued = await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d);
        expect(continued.plan.cursor).toBe(plan.cursor + 1); expect(continued.island.expression).toEqual(dressed.expression);
    });
    it('old saved butterfly observations qualify both products without auto-granting or rewriting learning and photographs', async () => {
        const d = await setup();
        // Normal domain learning reaches the discovery condition; this test supplies only the renderer's saved-observation notification.
        while ((await current(d)).growth!.progress.garden < 3) await finish(d);
        const eligible = await current(d), observed = await recordIslandDiscovery('child', 'ribbon-butterfly', eligible.items.find(item => item.kind === 'flower')!.id, d);
        expect(observed.expression).toBeUndefined();
        d.close(); await d.open(); const beforeRead = await snapshot(d);
        expect(getIslandExpressionEligibility(await current(d), 'butterfly-stamp').eligible).toBe(true);
        expect(await snapshot(d)).toEqual(beforeRead);
        for (const itemId of ['butterfly-stitch', 'butterfly-stamp'] as const) {
            const initial = await current(d), before = await snapshot(d), action = { type: 'acquire', itemId } as const;
            const saved = await saveIslandExpression('child', initial.revision, action, d);
            expectOnlyExpressionWrite(before, await snapshot(d), saved, initial.revision, action);
            expect(saved.growth).toEqual(initial.growth); expect(saved.customization).toEqual(initial.customization);
        }
        expect((await current(d)).expression!.selection).toEqual(getIslandExpression({}).selection);
    });
    it('accepts a persisted bell result while sound is off, but never a merely completed draft or failed observation transaction', async () => {
        const d = await setup(); await finish(d);
        const workshop = async (action: IslandWorkshopAction) => saveIslandWorkshop('child', (await current(d)).revision, action, d);
        for (const specimenId of WORKSHOP_SPECIMEN_IDS) {
            for (let section = 0; section < 6; section++) await workshop({ type: 'brush', specimenId, section });
            for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) await workshop({ type: 'observe-specimen', specimenId, result, cleanedMask: 63 });
        }
        for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
            await workshop({ type: 'edit-draft', edit: { type: 'assemble', partId } });
            await workshop({ type: 'edit-draft', edit: { type: 'move', partId, position: { col, row: 1 } } });
        }
        const before = await snapshot(d), state = await current(d);
        expect(getIslandExperience(state).ambience).toBe('off');
        await expect(act(d, { type: 'acquire', itemId: 'shell-three-notes' })).rejects.toMatchObject({ code: 'not-eligible' });
        expect(await snapshot(d)).toEqual(before);
        const observe = { type: 'observe-creation', partId: 'bell', layoutKey: workshopLayoutKey(state.workshop!.draftCheckpoint.draft.layout) } as const;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => { if (event.type === 'workshop_changed') transaction.idbtrans.abort(); };
        d.islandEvents.hook('creating', abort);
        await expect(workshop(observe)).rejects.toThrow(); d.islandEvents.hook('creating').unsubscribe(abort);
        expect(await snapshot(d)).toEqual(before); expect(getIslandExpressionEligibility(await current(d), 'shell-three-notes').eligible).toBe(false);
        await workshop(observe); d.close(); await d.open();
        const observed = await current(d), granted = await act(d, { type: 'acquire', itemId: 'shell-three-notes' });
        expect(granted.expression!.ownedItemIds).toEqual(['shell-three-notes']); expect(granted.expression!.selection.soundscape).toBeNull();
        expect(granted.customization).toEqual(observed.customization); expect(granted.workshop).toEqual(observed.workshop);
    });
    it('rejects invalid saved versions through both expression and ordinary writers, without dropping the damaged extension', async () => {
        const d = await setup(100), original = await current(d), plan = await startIslandPlan('child', d);
        for (const expression of [null, { ...getIslandExpression(original), version: 9 }, { ...getIslandExpression(original), extra: true },
            { ...getIslandExpression(original), ownedItemIds: ['raincoat', 'raincoat'] }]) {
            await d.islands.put({ ...original, expression: expression as unknown as IslandExpressionState }); const before = await snapshot(d);
            await expect(openIsland('child', d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(act(d, { type: 'period', period: 'morning' })).rejects.toBeInstanceOf(IslandConflict);
            await expect(experience(d, { type: 'resident-look', residentId: 'otter', look: 'cap' })).rejects.toBeInstanceOf(IslandConflict);
            await expect(commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
        }
    });
});

describe('native atomicity, CAS, exact receipts and owner boundaries', () => {
    it('rolls back all tables after the island write and before the receipt, then retries the same purchase once', async () => {
        const d = await setup(100), initial = await current(d), before = await snapshot(d), action = { type: 'acquire', itemId: 'raincoat' } as const;
        let nativeAborts = 0;
        let observeAbort!: () => void;
        const nativeAborted = new Promise<void>(resolve => { observeAbort = resolve; });
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'expression_changed') {
                transaction.idbtrans.addEventListener('abort', () => { nativeAborts++; observeAbort(); }); transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandExpression('child', initial.revision, action, d)).rejects.toThrow(); d.islandEvents.hook('creating').unsubscribe(abort);
        await nativeAborted;
        expect(nativeAborts).toBe(1); expect(await snapshot(d)).toEqual(before);
        const saved = await saveIslandExpression('child', initial.revision, action, d);
        expect(saved.customization!.points).toBe(75); expect(saved.customization!.desiredItemId).toBe('candy-complete');
        expectOnlyExpressionWrite(before, await snapshot(d), saved, initial.revision, action);
    });
    it('after native commit and lost completion returns the newest island without recharging or replaying later equipment', async () => {
        const d = await setup(100), initial = await current(d), action = { type: 'acquire', itemId: 'raincoat' } as const; let commits = 0;
        const observeCommit = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'expression_changed') transaction.idbtrans.addEventListener('complete', () => commits++);
        };
        d.islandEvents.hook('creating', observeCommit);
        await expect(saveIslandExpression('child', initial.revision, action, d).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        d.islandEvents.hook('creating').unsubscribe(observeCommit); expect(commits).toBe(1);
        await act(d, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' });
        const latest = await act(d, { type: 'season', season: 'winter' }), before = await snapshot(d);
        expect(await saveIslandExpression('child', initial.revision, { itemId: 'raincoat', type: 'acquire' }, d)).toEqual(latest);
        expect(await snapshot(d)).toEqual(before);
        await expect(saveIslandExpression('child', initial.revision, { type: 'acquire', itemId: 'star-beret' }, d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(act(d, action)).rejects.toMatchObject({ code: 'already-owned' }); expect(await snapshot(d)).toEqual(before);
    });
    it('an old free-look receipt does not erase an outfit acquired and equipped after it, including legacy combined actions', async () => {
        const d = await setup(100);
        for (const free of [{ type: 'resident-look', residentId: 'otter', look: 'cap' },
            { type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'cap' }] as const) {
            const old = await current(d); await saveIslandExperience('child', old.revision, free, d);
            if (!getIslandExpression(await current(d)).ownedItemIds.includes('raincoat')) await act(d, { type: 'acquire', itemId: 'raincoat' });
            const latest = await act(d, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }), before = await snapshot(d);
            expect(await saveIslandExperience('child', old.revision, free, d)).toEqual(latest); expect(await snapshot(d)).toEqual(before);
            expect((await current(d)).expression!.selection.residents.otter.outfit).toBe('raincoat');
        }
    });
    it('keeps the free-look change and override removal atomic on abort', async () => {
        const d = await setup(100); await act(d, { type: 'acquire', itemId: 'raincoat' });
        await act(d, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' });
        const initial = await current(d), before = await snapshot(d), action = { type: 'resident-look', residentId: 'otter', look: 'cap' } as const;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => { if (event.type === 'experience_changed') transaction.idbtrans.abort(); };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandExperience('child', initial.revision, action, d)).rejects.toThrow(); d.islandEvents.hook('creating').unsubscribe(abort);
        expect(await snapshot(d)).toEqual(before);
        const saved = await saveIslandExperience('child', initial.revision, action, d);
        expect(saved.expression!.selection.residents.otter.outfit).toBeNull(); expect(saved.experience!.residents.otter.look).toBe('cap');
        expect(saved.customization).toEqual(initial.customization); expect(saved.expression!.ownedItemIds).toEqual(['raincoat']);
    });
    it('deduplicates two connections using the same receipt and serializes a competing existing cosmetic purchase', async () => {
        const d = await setup(100), initial = await current(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            const same = { type: 'acquire', itemId: 'raincoat' } as const;
            const [a, b] = await Promise.all([saveIslandExpression('child', initial.revision, same, d), saveIslandExpression('child', initial.revision, same, second)]);
            expect(a).toEqual(b); expect(a.customization!.points).toBe(75);
            expect(await d.islandEvents.where('type').equals('expression_changed').count()).toBe(1);
            const next = { type: 'acquire', itemId: 'star-beret' } as const;
            const results = await Promise.allSettled([saveIslandExpression('child', a.revision, next, d),
                customizeIsland('child', a.revision, { type: 'purchase', itemId: 'starry-water' }, second)]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: expect.any(IslandConflict) });
            const state = await current(d), stale = await snapshot(d);
            if (results[0].status === 'rejected') {
                await expect(saveIslandExpression('child', a.revision, next, d)).rejects.toBeInstanceOf(IslandConflict);
                expect(await snapshot(d)).toEqual(stale); await saveIslandExpression('child', state.revision, next, d);
            } else await customizeIsland('child', state.revision, { type: 'purchase', itemId: 'starry-water' }, d);
            expect((await current(d)).customization!.points).toBe(45);
            expect((await current(d)).expression!.ownedItemIds).toEqual(['raincoat', 'star-beret']);
        } finally { second.close(); }
    });
    it('does not cross an inactive owner, manufacture a missing island, or alter state for invalid, unqualified or unaffordable input', async () => {
        const d = await setup(20), initial = await current(d), before = await snapshot(d);
        await expect(act(d, { type: 'acquire', itemId: 'raincoat' })).rejects.toMatchObject({ code: 'insufficient-stars' });
        await expect(act(d, { type: 'acquire', itemId: 'butterfly-stamp' })).rejects.toMatchObject({ code: 'not-eligible' });
        await expect(act(d, { type: 'equip-outfit', residentId: 'fox', itemId: 'raincoat' })).rejects.toMatchObject({ code: 'not-owned' });
        await expect(act(d, { type: 'acquire', itemId: 'raincoat', points: 0 } as unknown as IslandExpressionAction)).rejects.toMatchObject({ code: 'unknown-action' });
        expect(await snapshot(d)).toEqual(before);
        const saved = await act(d, { type: 'acquire', itemId: 'star-beret' });
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } }); await openIsland('other', d);
        const switched = await snapshot(d);
        await expect(saveIslandExpression('child', initial.revision, { type: 'acquire', itemId: 'star-beret' }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(switched); expect((await d.islands.get('other'))!.expression).toBeUndefined();
        expect((await d.islands.get('child'))!.expression).toEqual(saved.expression);
        await d.appData.put(app); await d.islands.delete('child'); const deleted = await snapshot(d);
        await expect(saveIslandExpression('child', initial.revision, { type: 'acquire', itemId: 'star-beret' }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(deleted);
    });
});

describe('full scene receipts capture confirmed selection exactly once', () => {
    it('retains the original capture after a lost response and later appearance/pose changes, then restores selection with immutable photos', async () => {
        const d = await setup(100); await act(d, { type: 'acquire', itemId: 'raincoat' });
        await act(d, { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }); await act(d, { type: 'season', season: 'autumn' });
        const initial = await current(d), action = { type: 'save-layout', layoutId: 'slot-1', name: 'あきの しま' } as const;
        const trial = previewIslandExpression(initial, { type: 'equip-outfit', residentId: 'otter', itemId: 'star-beret' });
        expect(trial.selection.residents.otter.outfit).toBe('star-beret');
        await expect(saveIslandExperience('child', initial.revision, action, d).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        const captured = structuredClone((await current(d)).experience!.layouts[0]);
        expect((captured.sceneStyle as IslandSavedSceneStyleV2).expression.residents.otter.outfit).toBe('raincoat');
        await experience(d, { type: 'resident-name', residentId: 'otter', name: 'かわちゃん' });
        await experience(d, { type: 'resident-look', residentId: 'otter', look: 'scarf' }); await act(d, { type: 'season', season: 'winter' });
        let latest = await current(d); latest = await saveIslandEdit('child', latest.revision, { type: 'store', itemId: latest.items[0].id }, d);
        const photo = await photoInput(); await saveIslandPhoto('child', 0, photo.input, photo.blobs, d);
        const before = await snapshot(d);
        expect(await saveIslandExperience('child', initial.revision, action, d)).toEqual(latest); expect(await snapshot(d)).toEqual(before);
        expect((await current(d)).experience!.layouts[0]).toEqual(captured);
        const preview = previewIslandLayout(latest, 'slot-1'); expect(await snapshot(d)).toEqual(before);
        const applied = await experience(d, { type: 'apply-layout', layoutId: 'slot-1' });
        expect(applied).toEqual({ ...preview, revision: latest.revision + 1, updatedAt: applied.updatedAt });
        expect(applied.expression!.selection.environment.season).toBe('autumn'); expect(applied.expression!.selection.residents.otter.outfit).toBe('raincoat');
        expect(applied.experience!.residents.otter.name).toBe('かわちゃん');
        expect(applied.customization).toEqual({ ...latest.customization, ...captured.cosmetics });
        for (const table of ['islandPhotoAlbums', 'islandPhotos', 'islandPhotoBlobs']) expect((await snapshot(d))[table]).toEqual(before[table]);
        expect(await (await loadIslandPhotoBlobs('child', photo.input.id, d))!.image.arrayBuffer()).toEqual(await photo.blobs.image.arrayBuffer());
        const beforeFailure = await snapshot(d), invalid = { ...action, sceneStyle: trial.selection } as unknown as IslandExperienceAction;
        await expect(experience(d, invalid)).rejects.toThrow(); expect(await snapshot(d)).toEqual(beforeFailure);
    });
});
