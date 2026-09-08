import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { commitIslandLearningSession } from './learningSession';
import { CUSTOMIZATION_CATALOG, getIslandCustomization, type IslandCustomizationAction } from './customization';
import { customizeIsland } from './customizationRepository';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import type { IslandEvent, IslandPlan } from './types';

const options = { indexedDB, IDBKeyRange };
const databases: SansuDatabase[] = [];
async function setup(completedSets = 0) {
    const d = new SansuDatabase(`island-customization-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    const island = await openIsland('child', d);
    await d.islands.put({ ...island, completedSets });
    return d;
}
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
function correctAction(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function beforeFinal(d: SansuDatabase, plan: IslandPlan) {
    let currentPlan = plan;
    while (currentPlan.cursor < currentPlan.slots.length - 1) {
        currentPlan = (await commitIslandLearning('child', currentPlan.id, currentPlan.revision, correctAction(currentPlan), d)).plan;
    }
    return currentPlan;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('atomic owned island customization', () => {
    it('persists legacy credit once, buys and equips a selected theme, clears its goal, and switches freely', async () => {
        const d = await setup(8), original = await current(d);
        const desired = await customizeIsland('child', original.revision, { type: 'desire', itemId: 'starry' }, d);
        expect(desired.customization).toMatchObject({ points: 80, desiredItemId: 'starry' });
        const bought = await customizeIsland('child', desired.revision, { type: 'purchase', itemId: 'starry' }, d);
        expect(bought.customization).toMatchObject({ points: 20, themeId: 'starry', desiredItemId: null, ownedItemIds: ['moon-garden', 'starry'] });
        d.close(); await d.open();
        expect(await openIsland('child', d)).toEqual(bought);
        expect(await customizeIsland('child', desired.revision, { type: 'purchase', itemId: 'starry' }, d)).toEqual(bought);
        let island = await customizeIsland('child', bought.revision, { type: 'equip', itemId: 'moon-garden' }, d);
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d);
        expect(island.customization?.points).toBe(20);
        expect(island.customization?.themeId).toBe('starry');
        expect(island.completedSets).toBe(original.completedSets);
        expect(island.items).toEqual(original.items);
        expect(island.growth).toEqual(original.growth);
        expect(await d.logs.count()).toBe(0);
    });

    it('combines theme and accent independently, and changes or clears a goal without spending', async () => {
        const d = await setup(9);
        let island = await current(d);
        for (const action of [
            { type: 'purchase', itemId: 'starry' }, { type: 'purchase', itemId: 'candy-flags' },
            { type: 'desire', itemId: 'crystal' }, { type: 'desire', itemId: 'candy' },
        ] as const) island = await customizeIsland('child', island.revision, action, d);
        expect(island.customization).toMatchObject({ themeId: 'starry', accentId: 'candy-flags', points: 10, desiredItemId: 'candy' });
        island = await customizeIsland('child', island.revision, { type: 'clear-accent' }, d);
        island = await customizeIsland('child', island.revision, { type: 'clear-desire' }, d);
        expect(island.customization).toMatchObject({ themeId: 'starry', accentId: null, points: 10, desiredItemId: null });
        island = await customizeIsland('child', island.revision, { type: 'equip', itemId: 'candy-flags' }, d);
        expect(island.customization?.accentId).toBe('candy-flags');
    });

    it('serializes same purchase across tabs and retries into one debit and receipt', async () => {
        const d = await setup(9), island = await current(d), action = { type: 'purchase' as const, itemId: 'starry' as const };
        const second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.all([d, second].map(database => customizeIsland('child', island.revision, action, database)));
            expect(results[0]).toEqual(results[1]);
            expect((await current(d)).customization?.points).toBe(30);
            expect(await d.islandEvents.where('type').equals('customization_changed').count()).toBe(1);
            await customizeIsland('child', island.revision, action, d);
            expect((await current(d)).customization?.points).toBe(30);
        } finally { second.close(); }
    });

    it('rejects a different concurrent purchase and a stale revision without taking another debit', async () => {
        const d = await setup(10), island = await current(d);
        const second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.allSettled([
                customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d),
                customizeIsland('child', island.revision, { type: 'purchase', itemId: 'candy' }, second),
            ]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
            expect((await current(d)).customization?.ownedItemIds).toHaveLength(2);
            const before = await snapshot(d);
            await expect(customizeIsland('child', island.revision - 1, { type: 'purchase', itemId: 'crystal' }, d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
        } finally { second.close(); }
    });

    it('rejects unknown items, insufficient points, unowned equipment, and invalid actions without any writes', async () => {
        const d = await setup(), island = await current(d), before = await snapshot(d);
        const invalid = [
            { type: 'purchase', itemId: 'unknown' }, { type: 'purchase', itemId: 'starry' },
            { type: 'equip', itemId: 'starry' }, { type: 'desire', itemId: 'moon-garden' }, { type: 'unknown' },
        ];
        for (const action of invalid) await expect(customizeIsland('child', island.revision, action as IslandCustomizationAction, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });

    it('rolls back purchase, debit, ownership and equip when its receipt fails, then retries the same choice', async () => {
        const d = await setup(8), island = await current(d), before = await snapshot(d);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'customization_changed') throw new Error('disk full'); };
        d.islandEvents.hook('creating', fail);
        await expect(customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d)).rejects.toThrow('disk full');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        expect((await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d)).customization?.points).toBe(20);
    });

    it('checks active ownership before returning an old receipt or reading another profile balance', async () => {
        const d = await setup(6), island = await current(d);
        await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d);
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(other);
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        const otherIsland = await openIsland('other', d);
        const before = await snapshot(d);
        await expect(customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(customizeIsland('other', otherIsland.revision, { type: 'purchase', itemId: 'starry' }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });
});

describe('exactly once stars from committed learning', () => {
    it.each([3, 6])('awards exactly %i stars for a complete reservation of that many whole problems', async count => {
        const d = await setup();
        let plan = await startIslandPlan('child', d);
        // Explicitly fixed short/long reservations isolate rewards from planner selection.
        plan.slots = Array.from({ length: count }, (_, index) => ({ ...structuredClone(plan.slots[index % plan.slots.length]),
            problem: { ...structuredClone(plan.slots[index % plan.slots.length].problem), id: `balance-${index}` } }));
        await d.islandPlans.put(plan);
        plan = await beforeFinal(d, plan);
        expect(getIslandCustomization(await current(d)).points).toBe(0);
        const action = correctAction(plan);
        await commitIslandLearning('child', plan.id, plan.revision, action, d);
        const earned = await current(d);
        expect(earned.customization?.points).toBe(count);
        expect(earned.growth?.progress.garden).toBe(1);
        expect(earned.growth?.pendingAnswers?.garden).toBe(count - 3);
        const saved = await snapshot(d);
        d.close(); await d.open();
        await commitIslandLearning('child', plan.id, plan.revision, action, d);
        expect(await snapshot(d)).toEqual(saved);
    });

    it('finishes a saved old growth reservation at its original reward before adopting new pacing', async () => {
        const d = await setup();
        let plan = await startIslandPlan('child', d);
        delete plan.rewardPacing;
        await d.islandPlans.put(plan);
        d.close(); await d.open();
        expect((await startIslandPlan('child', d)).rewardPacing).toBeUndefined();
        plan = await beforeFinal(d, plan);
        const result = await commitIslandLearningSession('child', plan.id, plan.revision, correctAction(plan), d);
        expect(result.receipt.island.customization?.points).toBe(10);
        expect(result.receipt.island.growth?.progress.garden).toBe(1);
        expect(result.nextPlan?.rewardPacing).toBe('answers-v1');
        const next = await beforeFinal(d, result.nextPlan!);
        await commitIslandLearning('child', next.id, next.revision, correctAction(next), d);
        expect((await current(d)).customization?.points).toBe(10 + next.slots.length);
    });

    it('continues earning after every habitat and every catalog item are complete', async () => {
        const d = await setup(24), island = await current(d);
        island.growth!.progress = { garden: 6, waterside: 6, grove: 6, village: 6 };
        island.growth!.expansionLevel = 2;
        island.customization = { ...getIslandCustomization(island), points: 0, ownedItemIds: CUSTOMIZATION_CATALOG.map(item => item.id) };
        await d.islands.put(island);
        const plan = await beforeFinal(d, await startIslandPlan('child', d));
        await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d);
        const result = await current(d);
        expect(result.completedSets).toBe(25);
        expect(result.customization?.points).toBe(3);
        expect(result.growth?.progress).toEqual(island.growth!.progress);
        expect(result.growth?.memories).toEqual(island.growth!.memories);
    });

    it.each([false, true])('credits final completion once including legacy gift contract=%s', async legacy => {
        const d = await setup(3);
        let plan = await startIslandPlan('child', d);
        if (legacy) { delete plan.growthTarget; delete plan.rewardPacing; await d.islandPlans.put(plan); }
        plan = await beforeFinal(d, plan);
        expect((await current(d)).customization).toBeUndefined();
        const action = correctAction(plan), second = new SansuDatabase(d.name, options); await second.open();
        try {
            await Promise.all([d, second].map(database => commitIslandLearning('child', plan.id, plan.revision, action, database)));
            await commitIslandLearning('child', plan.id, plan.revision, action, d);
            const island = await current(d);
            expect(island.completedSets).toBe(4);
            expect(island.customization?.points).toBe(legacy ? 40 : 33);
            expect(island.pendingRewards).toHaveLength(legacy ? 1 : 0);
            expect(await d.islandEvents.where('type').equals('plan_completed').count()).toBe(1);
        } finally { second.close(); }
    });

    it('gives the same final credit after support without rewarding wrong answers or intermediate support stages', async () => {
        const d = await setup();
        let plan = await beforeFinal(d, await startIslandPlan('child', d));
        for (const action of [{ type: 'answer', answer: 'wrong' }, { type: 'support_opened' }, { type: 'model_opened' }] as const) {
            plan = (await commitIslandLearning('child', plan.id, plan.revision, action, d)).plan;
            expect(getIslandCustomization(await current(d)).points).toBe(0);
        }
        const result = await commitIslandLearning('child', plan.id, plan.revision, { type: 'supported_completed' }, d);
        expect(result.island.customization?.points).toBe(3);
        expect(result.event.result).toBe('supported-completion');
    });

    it('rolls back final stars with learning and persists completion even if the next reservation fails', async () => {
        const d = await setup(3), plan = await beforeFinal(d, await startIslandPlan('child', d)), before = await snapshot(d);
        const failCompletion = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_completed') throw new Error('full'); };
        d.islandEvents.hook('creating', failCompletion);
        await expect(commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toThrow('full');
        d.islandEvents.hook('creating').unsubscribe(failCompletion);
        expect(await snapshot(d)).toEqual(before);
        const failNext = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_started') throw new Error('next failed'); };
        d.islandEvents.hook('creating', failNext);
        const result = await commitIslandLearningSession('child', plan.id, plan.revision, correctAction(plan), d);
        d.islandEvents.hook('creating').unsubscribe(failNext);
        expect(result.nextPlan).toBeUndefined();
        expect((await current(d)).customization?.points).toBe(33);
        await commitIslandLearningSession('child', plan.id, plan.revision, correctAction(plan), d);
        expect((await current(d)).customization?.points).toBe(33);
    });

    it('serializes final completion with spending without recreating spent credit', async () => {
        const d = await setup(7), plan = await beforeFinal(d, await startIslandPlan('child', d)), island = await current(d);
        const second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.allSettled([
                customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry' }, d),
                commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), second),
            ]);
            expect(results[1].status).toBe('fulfilled');
            let latest = await current(d);
            if (results[0].status === 'rejected') latest = await customizeIsland('child', latest.revision, { type: 'purchase', itemId: 'starry' }, d);
            expect(latest.completedSets).toBe(8);
            expect(latest.customization?.points).toBe(13);
            expect(latest.customization?.ownedItemIds).toEqual(['moon-garden', 'starry']);
        } finally { second.close(); }
    });
});
