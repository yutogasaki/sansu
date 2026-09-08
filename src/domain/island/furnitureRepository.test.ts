import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { findAvailablePosition, isValidIslandPlacement } from './catalog';
import { getIslandCustomization } from './customization';
import { customizeIsland } from './customizationRepository';
import { IslandExperienceConflict, previewIslandLayout } from './experience';
import { saveIslandExperience } from './experienceRepository';
import { getOwnedIslandFurniture, islandFurnitureItemId, type IslandFurnitureAction } from './furniture';
import { acquireIslandFurniture } from './furnitureRepository';
import { assertIsland, assertIslandPlan, claimIslandReward, IslandConflict, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import { photoInput } from './photos.testSupport';
import { loadIslandPhotoBlobs, saveIslandPhoto } from './photosRepository';
import { isValidSharedDisplayPlacement, reduceIslandSharedMemories, resolveSharedTarget } from './sharedMemories';
import type { IslandBasicItemKind, IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
const acquire: IslandFurnitureAction = { type: 'acquire-furniture', kind: 'telescope' };
async function setup(points?: number) {
    const d = new SansuDatabase(`furniture-${crypto.randomUUID()}`, options); databases.push(d);
    const child = { ...createInitialProfile('child', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(child); await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child } });
    await openIsland('child', d); await startIslandPlan('child', d);
    // Explicit wallet-only fixture for storage failures; the first test earns its balance through real learning.
    if (points !== undefined) {
        const island = await current(d); island.customization = { ...getIslandCustomization(island), points, desiredItemId: 'candy-complete' };
        await d.islands.put(island);
    }
    return d;
}
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function untouched(d: SansuDatabase) {
    const data = await snapshot(d); delete data.islands;
    data.islandEvents = (data.islandEvents as IslandEvent[]).filter(event => !['furniture_acquired', 'item_edited', 'experience_changed', 'customization_changed'].includes(event.type));
    return data;
}
function correct(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, plan: IslandPlan) {
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, correct(plan), d)).plan;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('atomic optional furniture acquisition', () => {
    it.each([['telescope', 30], ['hammock', 25], ['tea-table', 40]] as const)(
        'earns stars through ordinary answers, acquires %s, reloads and resumes the same learning reservation', async (kind, price) => {
        const d = await setup();
        // Exercise each real purchase at its first affordable section. The pure
        // wallet test separately covers collecting all three for a total of 95.
        while (getIslandCustomization(await current(d)).points < price) {
            await finish(d, await startIslandPlan('child', d)); await startIslandPlan('child', d);
        }
        const initial = await current(d), plan = await startIslandPlan('child', d), before = await untouched(d);
        const photo = await photoInput(); await saveIslandPhoto('child', 0, photo.input, photo.blobs, d);
        const photoState = await untouched(d);
        const bought = await acquireIslandFurniture('child', initial.revision, { type: 'acquire-furniture', kind }, d);
        expect(bought.customization!.points).toBe(initial.customization!.points - price);
        expect(bought.items.slice(initial.items.length)).toEqual([{ id: `optional-${kind}`, kind, rotation: 0 }]);
        expect(bought.growth).toEqual(initial.growth); expect(bought.pendingPlanId).toBe(plan.id);
        expect(await untouched(d)).toEqual(photoState);
        expect((await d.islandPlans.get(plan.id))).toEqual(plan);
        d.close(); await d.open(); expect(await openIsland('child', d)).toEqual(bought);
        const bytes = await loadIslandPhotoBlobs('child', photo.input.id, d);
        expect(await bytes!.image.arrayBuffer()).toEqual(await photo.blobs.image.arrayBuffer());
        const continued = await commitIslandLearning('child', plan.id, plan.revision, correct(plan), d);
        expect(continued.plan.cursor).toBeGreaterThan(plan.cursor);
        expect(continued.island.items).toEqual(bought.items);
        expect((before.islandPlans as IslandPlan[]).find(row => row.id === plan.id)).toEqual(plan);
    });
    it('rolls back a native transaction abort after the island write, then accepts exactly the original intent', async () => {
        const d = await setup(100), initial = await current(d), before = await snapshot(d); let aborted = false;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'furniture_acquired') { aborted = true; transaction.idbtrans.abort(); }
        };
        d.islandEvents.hook('creating', abort);
        await expect(acquireIslandFurniture('child', initial.revision, acquire, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        expect(aborted).toBe(true); expect(await snapshot(d)).toEqual(before);
        const saved = await acquireIslandFurniture('child', initial.revision, acquire, d);
        expect(saved.customization!.points).toBe(70); expect(saved.customization!.desiredItemId).toBe('candy-complete');
        expect(await d.islandEvents.where('type').equals('furniture_acquired').count()).toBe(1);
    });
    it('replays a lost completion before ownership or price checks without reverting later placement, storage or cosmetic choices', async () => {
        const d = await setup(100), initial = await current(d);
        await expect(acquireIslandFurniture('child', initial.revision, acquire, d).then(() => { throw new Error('completion lost'); })).rejects.toThrow('completion lost');
        let latest = await current(d); const id = islandFurnitureItemId('telescope'), position = findAvailablePosition(latest, 'telescope', id)!;
        expect(position).toBeDefined();
        latest = await saveIslandEdit('child', latest.revision, { type: 'place', itemId: id, position, rotation: .7 }, d);
        latest = await customizeIsland('child', latest.revision, { type: 'purchase', itemId: 'starry-water' }, d);
        const before = await snapshot(d);
        expect(await acquireIslandFurniture('child', initial.revision, { kind: 'telescope', type: 'acquire-furniture' }, d)).toEqual(latest);
        expect(await snapshot(d)).toEqual(before);
        await expect(acquireIslandFurniture('child', initial.revision, { type: 'acquire-furniture', kind: 'hammock' }, d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(acquireIslandFurniture('child', latest.revision, acquire, d)).rejects.toMatchObject({ code: 'already-owned' });
        latest = await saveIslandEdit('child', latest.revision, { type: 'store', itemId: id }, d);
        expect(await acquireIslandFurniture('child', initial.revision, acquire, d)).toEqual(latest);
        expect(getOwnedIslandFurniture(latest, 'telescope')!.position).toBeUndefined();
    });
    it('serializes a furniture purchase against a cosmetic purchase and charges each only after an explicit new revision', async () => {
        const d = await setup(100), initial = await current(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.allSettled([acquireIslandFurniture('child', initial.revision, acquire, d),
                customizeIsland('child', initial.revision, { type: 'purchase', itemId: 'starry-water' }, second)]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: expect.any(IslandConflict) });
            const latest = await current(d);
            const completed = results[0].status === 'rejected' ? await acquireIslandFurniture('child', latest.revision, acquire, d)
                : await customizeIsland('child', latest.revision, { type: 'purchase', itemId: 'starry-water' }, d);
            expect(completed.customization!.points).toBe(60);
            expect(completed.items.filter(item => item.kind === 'telescope')).toHaveLength(1);
            expect(await d.islandEvents.where('type').equals('furniture_acquired').count()).toBe(1);
        } finally { second.close(); }
    });
    it('coalesces the same receipt across two DB connections without granting duplicate ownership', async () => {
        const d = await setup(100), initial = await current(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            const [a, b] = await Promise.all([acquireIslandFurniture('child', initial.revision, acquire, d), acquireIslandFurniture('child', initial.revision, acquire, second)]);
            expect(a).toEqual(b); expect(a.customization!.points).toBe(70); expect(a.items.filter(item => item.kind === 'telescope')).toHaveLength(1);
            expect(await d.islandEvents.where('type').equals('furniture_acquired').count()).toBe(1);
        } finally { second.close(); }
    });
    it('keeps owner and insufficient-balance failures atomic, including an old receipt retried while another profile is active', async () => {
        const d = await setup(25), initial = await current(d), before = await snapshot(d);
        await expect(acquireIslandFurniture('child', initial.revision, acquire, d)).rejects.toMatchObject({ code: 'insufficient' });
        expect(await snapshot(d)).toEqual(before);
        await acquireIslandFurniture('child', initial.revision, { type: 'acquire-furniture', kind: 'hammock' }, d);
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } }); await openIsland('other', d);
        const switched = await snapshot(d);
        await expect(acquireIslandFurniture('child', initial.revision, { type: 'acquire-furniture', kind: 'hammock' }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(switched);
        expect((await d.islands.get('other'))!.items.some(item => item.kind === 'hammock')).toBe(false);
    });
    it('never accepts a paid kind through an old free reward, including corrupted persisted choices or plan choices', async () => {
        const d = await setup(100), initial = await current(d), before = await snapshot(d);
        await expect(claimIslandReward('child', initial.revision, 'old-reward', 'telescope' as IslandBasicItemKind, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
        const corrupted: IslandRecord = { ...initial, pendingRewards: [{ id: 'old', planId: 'old', earnedAt: 1,
            choices: ['telescope' as IslandBasicItemKind, 'flower', 'bench'] }] };
        expect(() => assertIsland(corrupted)).toThrow();
        const plan = await startIslandPlan('child', d);
        expect(() => assertIslandPlan({ ...plan, rewardChoices: ['hammock' as IslandBasicItemKind] }, 'child')).toThrow();
        await d.islands.put(corrupted); const corruptBefore = await snapshot(d);
        await expect(acquireIslandFurniture('child', initial.revision, acquire, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(corruptBefore);
    });
});

describe('optional furniture in old layouts and shared occupied land', () => {
    it('retains a later possession when applying an old layout, captures its storage state in a new layout, and rejects a merged collision atomically', async () => {
        const d = await setup(100); let state = await current(d);
        state = await saveIslandExperience('child', state.revision, { type: 'save-layout', layoutId: 'slot-1', name: 'まえの にわ' }, d);
        const old = structuredClone(state.experience!.layouts[0]);
        state = await acquireIslandFurniture('child', state.revision, acquire, d);
        const id = islandFurnitureItemId('telescope');
        state = await saveIslandExperience('child', state.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d);
        expect(getOwnedIslandFurniture(state, 'telescope')).toEqual({ id, kind: 'telescope', rotation: 0 });
        expect(state.experience!.layouts[0]).toEqual(old);
        state = await saveIslandExperience('child', state.revision, { type: 'save-layout', layoutId: 'slot-2', name: 'どうぐを のこす' }, d);
        expect(state.experience!.layouts[1].poses.find(pose => pose.id === id)).toEqual({ id, rotation: 0 });
        const oldFlower = state.items.find(item => item.id === 'starter-flower')!;
        state = await saveIslandEdit('child', state.revision, { type: 'store', itemId: oldFlower.id }, d);
        expect(isValidIslandPlacement(state, id, oldFlower.position!, 0)).toBe(true);
        state = await saveIslandEdit('child', state.revision, { type: 'place', itemId: id, position: oldFlower.position!, rotation: 0 }, d);
        const before = await snapshot(d);
        expect(() => previewIslandLayout(state, 'slot-1')).toThrow(IslandExperienceConflict);
        await expect(saveIslandExperience('child', state.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d)).rejects.toMatchObject({ code: 'layout-collision' });
        expect(await snapshot(d)).toEqual(before);
    });
    it('shares one radius contract with exhibit placement in both directions', async () => {
        const d = await setup(100); await finish(d, await startIslandPlan('child', d)); let state = await current(d);
        state = await acquireIslandFurniture('child', state.revision, { type: 'acquire-furniture', kind: 'tea-table' }, d);
        const id = islandFurnitureItemId('tea-table'), position = findAvailablePosition(state, 'tea-table', id)!;
        expect(position).toBeDefined(); state = await saveIslandEdit('child', state.revision, { type: 'place', itemId: id, position, rotation: .4 }, d);
        const target = resolveSharedTarget(state, { kind: 'specimen', specimenId: 'driftwood' });
        expect(isValidSharedDisplayPlacement(state, 'display-1', target, position)).toBe(false);
        state = await saveIslandEdit('child', state.revision, { type: 'store', itemId: id }, d);
        state = reduceIslandSharedMemories(state, { type: 'place-display', displayId: 'display-1', target: { kind: 'specimen', specimenId: 'driftwood' },
            expectedDisplayKey: null, position, rotation: 0 }, 10).island;
        await d.islands.put(state); const before = await snapshot(d);
        await expect(saveIslandEdit('child', state.revision, { type: 'place', itemId: id, position, rotation: 0 }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });
});
