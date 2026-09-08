import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { getIslandCustomization } from './customization';
import { createIslandAppearance } from './appearance';
import { customizeIsland } from './customizationRepository';
import { getIslandExperience, IslandExperienceConflict, previewIslandLayout, type IslandExperienceAction, type IslandExperienceState } from './experience';
import { saveIslandExperience } from './experienceRepository';
import { IslandConflict, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`island-experience-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d);
    return d;
}
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function learningSnapshot(d: SansuDatabase) {
    const state = await snapshot(d);
    delete state.islands;
    state.islandEvents = (state.islandEvents as IslandEvent[]).filter(event => event.type !== 'experience_changed' && event.type !== 'item_edited' && event.type !== 'customization_changed');
    return state;
}
const expression = async (d: SansuDatabase, action: IslandExperienceAction) => saveIslandExperience('child', (await current(d)).revision, action, d);
function correctAction(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, plan: IslandPlan) {
    let active = plan;
    while (active.status === 'active') active = (await commitIslandLearning('child', active.id, active.revision, correctAction(active), d)).plan;
    return active;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('owned atomic experience persistence', () => {
    it('persists independent expression settings and three named layouts across reload without changing a live learning plan or any learning table', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d);
        await commitIslandLearning('child', plan.id, plan.revision, { type: 'answer', answer: 'wrong' }, d);
        const learning = await learningSnapshot(d), initial = await current(d);
        for (const action of [
            { type: 'rename-island', name: 'ひかりの しま' }, { type: 'emblem', emblem: 'flower' }, { type: 'ambience', ambience: 'evening' },
            { type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'scarf' },
            { type: 'resident', residentId: 'rabbit', name: 'うーちゃん', look: 'cap' },
            { type: 'resident', residentId: 'fox', name: 'こん', look: 'original' },
            { type: 'save-layout', layoutId: 'slot-1', name: 'はじめの にわ' },
            { type: 'save-layout', layoutId: 'slot-2', name: 'おひるの にわ' },
            { type: 'save-layout', layoutId: 'slot-3', name: 'ゆうがたの にわ' },
        ] as const) await expression(d, action);
        const saved = await current(d);
        expect(saved.experience).toMatchObject({ version: 1, islandName: 'ひかりの しま', emblem: 'flower', ambience: 'evening', residents: { otter: { name: 'かわちゃん', look: 'scarf' } } });
        expect(saved.experience!.layouts).toHaveLength(3);
        expect(saved.revision).toBe(initial.revision + 9);
        expect(saved.customization).toEqual(initial.customization);
        expect(saved.items).toEqual(initial.items);
        expect(saved.growth).toEqual(initial.growth);
        expect(saved.pendingPlanId).toBe(initial.pendingPlanId);
        expect(await learningSnapshot(d)).toEqual(learning);
        d.close(); await d.open();
        expect(await openIsland('child', d)).toEqual(saved);
        expect(await startIslandPlan('child', d)).toEqual((await d.islandPlans.get(plan.id))!);
        expect(await learningSnapshot(d)).toEqual(learning);
    });

    it('deduplicates canonical identical requests across tabs and ignores an old successful retry after later changes', async () => {
        const d = await setup(), island = await current(d), second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const results = await Promise.all([
                saveIslandExperience('child', island.revision, { type: 'rename-island', name: ' か\u3099くの しま ' }, d),
                saveIslandExperience('child', island.revision, { name: 'がくの しま', type: 'rename-island' }, second),
            ]);
            expect(results[0]).toEqual(results[1]);
            expect((await current(d)).revision).toBe(island.revision + 1);
            expect(await d.islandEvents.where('type').equals('experience_changed').count()).toBe(1);
            const later = await expression(d, { type: 'rename-island', name: 'いまの しま' });
            const before = await snapshot(d);
            expect(await saveIslandExperience('child', island.revision, { type: 'rename-island', name: 'がくの しま' }, second)).toEqual(later);
            expect(await snapshot(d)).toEqual(before);
        } finally { second.close(); }
    });

    it('rejects competing payloads and stale revisions, then accepts a deliberate rebase at the current revision', async () => {
        const d = await setup(), island = await current(d), second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const results = await Promise.allSettled([
                saveIslandExperience('child', island.revision, { type: 'emblem', emblem: 'star' }, d),
                saveIslandExperience('child', island.revision, { type: 'emblem', emblem: 'wave' }, second),
            ]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
            const before = await snapshot(d);
            await expect(saveIslandExperience('child', island.revision, { type: 'ambience', ambience: 'breeze' }, d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(saveIslandExperience('child', island.revision - 1, { type: 'emblem', emblem: 'leaf' }, d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
            const rebased = await expression(d, { type: 'emblem', emblem: 'flower' });
            expect(rebased.experience!.emblem).toBe('flower');
            expect(rebased.revision).toBe(island.revision + 2);
        } finally { second.close(); }
    });

    it('rejects invalid actions and unknown state without any table writes or legacy/default overwrite', async () => {
        const d = await setup(), island = await current(d), before = await snapshot(d);
        for (const action of [{ type: 'rename-island', name: '　 ' }, { type: 'rename-island', name: 'あ'.repeat(17) },
            { type: 'ambience', ambience: 'unknown' }, { type: 'resident', residentId: 'fox', name: '\u202eこん', look: 'original' },
            { type: 'save-layout', layoutId: 'slot-1', name: 'にわ', poses: [] }, { type: 'delete-layout', layoutId: 'slot-1' },
        ]) await expect(saveIslandExperience('child', island.revision, action as IslandExperienceAction, d)).rejects.toBeInstanceOf(IslandExperienceConflict);
        expect(await snapshot(d)).toEqual(before);
        for (const experience of [null, { ...getIslandExperience(island), version: 2 }, { ...getIslandExperience(island), futureSettings: {} }]) {
            await d.islands.put({ ...island, experience: experience as unknown as IslandExperienceState });
            const invalid = await snapshot(d);
            await expect(saveIslandExperience('child', island.revision, { type: 'rename-island', name: 'しま' }, d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(invalid);
        }
    });

    it('checks active profile ownership before receipt replay and never crosses names or layout slots between children', async () => {
        const d = await setup(), island = await current(d);
        await expression(d, { type: 'rename-island', name: 'こどもの しま' });
        await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'こどもの にわ' });
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(other);
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        const otherIsland = await openIsland('other', d), before = await snapshot(d);
        await expect(saveIslandExperience('child', island.revision, { type: 'rename-island', name: 'こどもの しま' }, d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(saveIslandExperience('other', otherIsland.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d)).rejects.toMatchObject({ code: 'layout-missing' });
        expect(await snapshot(d)).toEqual(before);
        const savedOther = await saveIslandExperience('other', otherIsland.revision, { type: 'rename-island', name: 'べつの しま' }, d);
        expect(savedOther.experience!.islandName).toBe('べつの しま');
        expect((await current(d)).experience!.islandName).toBe('こどもの しま');
    });

    it('rolls back actual native transaction abort after the island write and allows the exact same retry', async () => {
        const d = await setup();
        const plan = await startIslandPlan('child', d);
        await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d);
        const island = await current(d), before = await snapshot(d), action = { type: 'save-layout' as const, layoutId: 'slot-1' as const, name: 'のこす にわ' };
        let nativeAborts = 0, nativeAbortEvents = 0;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'experience_changed') {
                nativeAborts++;
                transaction.idbtrans.addEventListener('abort', () => { nativeAbortEvents++; });
                transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        // The receipt request immediately after the native abort may surface InvalidStateError or AbortError.
        await expect(saveIslandExperience('child', island.revision, action, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        expect(nativeAborts).toBe(1);
        expect(await snapshot(d)).toEqual(before);
        expect(nativeAbortEvents).toBe(1);
        const updated = await saveIslandExperience('child', island.revision, action, d);
        expect(updated.experience!.layouts).toHaveLength(1);
        expect(updated.revision).toBe(island.revision + 1);
        expect(await d.islandEvents.where('type').equals('experience_changed').count()).toBe(1);
    });

    it('rolls back a failed layout application receipt including all positions, cosmetics and optional expression state', async () => {
        const d = await setup();
        for (let section = 0; getIslandCustomization(await current(d)).points < 60; section++) {
            expect(section).toBeLessThan(21);
            await finish(d, await startIslandPlan('child', d));
        }
        let island = await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'もとの にわ' });
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d);
        island = await saveIslandEdit('child', island.revision, { type: 'store', itemId: island.items[0].id }, d);
        const before = await snapshot(d), action = { type: 'apply-layout' as const, layoutId: 'slot-1' as const };
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'experience_changed') throw new Error('receipt failed'); };
        d.islandEvents.hook('creating', fail);
        await expect(saveIslandExperience('child', island.revision, action, d)).rejects.toThrow('receipt failed');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        const applied = await saveIslandExperience('child', island.revision, action, d);
        expect(applied.items[0].position).toEqual({ x: 1.5, z: .8 });
        expect(applied.customization).toMatchObject({ themeId: 'moon-garden', points: island.customization!.points, ownedItemIds: ['moon-garden', 'starry'] });
    });
});

describe('saved layout application against the current earned world', () => {
    it('does not recapture a newer world when retrying an already saved layout, and replaces it only with a new revision', async () => {
        const d = await setup(), initial = await current(d), action = { type: 'save-layout' as const, layoutId: 'slot-1' as const, name: 'にわ' };
        const first = await saveIslandExperience('child', initial.revision, action, d);
        const edited = await saveIslandEdit('child', first.revision, { type: 'store', itemId: first.items[0].id }, d);
        const before = await snapshot(d);
        expect(await saveIslandExperience('child', initial.revision, action, d)).toEqual(edited);
        expect(await snapshot(d)).toEqual(before);
        expect((await current(d)).experience!.layouts[0]).toEqual(first.experience!.layouts[0]);
        const replaced = await saveIslandExperience('child', edited.revision, action, d);
        expect(replaced.experience!.layouts).toHaveLength(1);
        expect(replaced.experience!.layouts[0].poses[0].position).toBeUndefined();
        expect(replaced.revision).toBe(edited.revision + 1);
    });

    it('uses the current snapshot on save, previews without writes, and matches the persisted merged result', async () => {
        const d = await setup();
        let island = await current(d);
        island = await saveIslandEdit('child', island.revision, { type: 'store', itemId: island.items[0].id }, d);
        island = await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'ひろい にわ' });
        expect(island.experience!.layouts[0].poses[0].position).toBeUndefined();
        island = await saveIslandEdit('child', island.revision, { type: 'place', itemId: island.items[0].id, position: { x: 1.5, z: .8 }, rotation: 1 }, d);
        const before = await snapshot(d), preview = previewIslandLayout(island, 'slot-1');
        expect(preview.items[0].position).toBeUndefined();
        expect(await snapshot(d)).toEqual(before);
        const applied = await saveIslandExperience('child', island.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d);
        expect(applied).toEqual({ ...preview, revision: island.revision + 1, updatedAt: applied.updatedAt });
        await expression(d, { type: 'delete-layout', layoutId: 'slot-1' });
        expect((await current(d)).items).toEqual(applied.items);
        expect((await current(d)).experience!.layouts).toEqual([]);
    });

    it('keeps real later learning/growth, earned new items, spent stars and the saved next plan when restoring an old layout', async () => {
        const d = await setup();
        await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'はじめの にわ' });
        let earnedQuestions = 0;
        for (let section = 0; (await current(d)).growth!.progress.garden < 6; section++) {
            expect(section).toBeLessThan(22);
            const completed = await finish(d, await startIslandPlan('child', d));
            earnedQuestions += completed.slots.length;
        }
        let island = await current(d);
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d);
        const plan = await startIslandPlan('child', d);
        island = await current(d);
        island = await saveIslandEdit('child', island.revision, { type: 'store', itemId: island.items[0].id }, d);
        const before = structuredClone(island), learning = await learningSnapshot(d);
        const applied = await saveIslandExperience('child', island.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d);
        expect(applied.completedSets).toBe(before.completedSets);
        expect(applied.growth).toEqual(before.growth);
        expect(applied.growth!.progress.garden).toBe(6);
        expect(applied.items.length).toBeGreaterThan(applied.experience!.layouts[0].poses.length);
        const remembered = new Set(applied.experience!.layouts[0].poses.map(pose => pose.id));
        expect(applied.items.filter(item => !remembered.has(item.id))).toEqual(before.items.filter(item => !remembered.has(item.id)));
        expect(applied.items[0]).toMatchObject({ position: { x: 1.5, z: .8 }, growthLevel: 3 });
        expect(applied.customization).toEqual({ ...before.customization, themeId: 'moon-garden', appearance: createIslandAppearance('moon-garden', 'legacy-v1') });
        expect(applied.customization!.points).toBe(earnedQuestions - 60);
        expect(applied.pendingPlanId).toBe(plan.id);
        expect(await learningSnapshot(d)).toEqual(learning);
    });

    it('rejects whole applications for new-item collisions, missing references, outside land or unowned cosmetics without altering learning or stars', async () => {
        const d = await setup();
        const saved = await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'もとの にわ' });
        const cases: [IslandRecord, IslandExperienceConflict['code']][] = [];
        const collision = structuredClone(saved); collision.items[0].position = undefined;
        collision.items.push({ id: 'later-new', kind: 'flower', rotation: 0, position: { x: 1.5, z: .8 } });
        cases.push([collision, 'layout-collision']);
        const missing = structuredClone(saved); missing.items.splice(0, 1); cases.push([missing, 'layout-item-missing']);
        const outside = structuredClone(saved); outside.experience!.layouts[0].poses[0].position = { x: 100, z: 0 }; cases.push([outside, 'layout-collision']);
        const unowned = structuredClone(saved); unowned.experience!.layouts[0].cosmetics.themeId = 'candy'; cases.push([unowned, 'cosmetics-not-owned']);
        for (const [island, code] of cases) {
            island.customization = { ...getIslandCustomization(island), points: 4 };
            await d.islands.put(island);
            const before = await snapshot(d);
            await expect(saveIslandExperience('child', island.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d)).rejects.toMatchObject({ code });
            expect(await snapshot(d)).toEqual(before);
        }
    });

    it('requires a refreshed preview after concurrent earning, preserving both the new layout and the final answer', async () => {
        const d = await setup();
        await expression(d, { type: 'save-layout', layoutId: 'slot-1', name: 'にわ' });
        let plan = await startIslandPlan('child', d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        const island = await current(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            previewIslandLayout(island, 'slot-1');
            await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), second);
            const afterLearning = await current(d), before = await snapshot(d);
            await expect(saveIslandExperience('child', island.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
            const applied = await saveIslandExperience('child', afterLearning.revision, { type: 'apply-layout', layoutId: 'slot-1' }, d);
            expect(applied.completedSets).toBe(1);
            expect(applied.customization!.points).toBe(3);
            expect(applied.growth).toEqual(afterLearning.growth);
            expect((await d.islandPlans.get(plan.id))!.status).toBe('completed');
            expect(await d.logs.count()).toBe(3);
        } finally { second.close(); }
    });
});
