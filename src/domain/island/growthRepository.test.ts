import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { commitIslandLearningSession } from './learningSession';
import { IslandConflict, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import { recordIslandDiscovery, selectIslandGrowthTarget, setIslandItemAppearance } from './growthRepository';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from './growth';
import { islandGrowthStep } from './pacing';
import type { IslandEvent, IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
async function setup() {
    const d = new SansuDatabase(`island-growth-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d);
    return d;
}
function correctAction(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, plan: IslandPlan) {
    let current = plan;
    while (current.status === 'active') current = (await commitIslandLearning('child', current.id, current.revision, correctAction(current), d)).plan;
    return current;
}
async function beforeFinal(d: SansuDatabase, plan: IslandPlan) {
    let current = plan;
    while (current.cursor < current.slots.length - 1) current = (await commitIslandLearning('child', current.id, current.revision, correctAction(current), d)).plan;
    return current;
}
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('owned atomic living island persistence', () => {
    it('rolls back partial growth with the final answer, then retains it through reload, focus changes and receipt replay', async () => {
        const d = await setup();
        await finish(d, await startIslandPlan('child', d));
        let plan = await startIslandPlan('child', d);
        plan.slots = plan.slots.slice(0, 3);
        await d.islandPlans.put(plan);
        plan = await beforeFinal(d, plan);
        const before = await snapshot(d), action = correctAction(plan);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_completed') throw new Error('partial save failed'); };
        d.islandEvents.hook('creating', fail);
        await expect(commitIslandLearning('child', plan.id, plan.revision, action, d)).rejects.toThrow('partial save failed');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        await commitIslandLearning('child', plan.id, plan.revision, action, d);
        let island = (await d.islands.get('child'))!;
        expect(islandGrowthStep(island, 'garden')).toMatchObject({ progress: 1, pending: 3, remaining: 3 });
        island = await selectIslandGrowthTarget('child', island.revision, 'village', d);
        d.close(); await d.open();
        await commitIslandLearning('child', plan.id, plan.revision, action, d);
        expect(await d.islands.get('child')).toEqual(island);
        expect((await startIslandPlan('child', d)).growthTarget).toBe('village');
        expect((await d.islands.get('child'))?.growth?.pendingAnswers?.garden).toBe(3);
    });

    it('freezes a target while an optional focus selection applies only to the next reservation', async () => {
        const d = await setup();
        const plan = await startIslandPlan('child', d), original = structuredClone(plan);
        expect(plan.growthTarget).toBe('garden');
        const island = (await d.islands.get('child'))!;
        await expect(selectIslandGrowthTarget('child', island.revision, 'grove', d)).rejects.toBeInstanceOf(IslandConflict);
        const selected = await selectIslandGrowthTarget('child', island.revision, 'village', d);
        expect(await selectIslandGrowthTarget('child', island.revision, 'village', d)).toEqual(selected);
        await expect(selectIslandGrowthTarget('child', island.revision, 'garden', d)).rejects.toBeInstanceOf(IslandConflict);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(original);
        expect((await d.islands.get('child'))?.growth?.progress.village).toBe(0);
        await finish(d, plan);
        expect((await d.islands.get('child'))?.growth?.progress).toEqual({ garden: 1, waterside: 0, grove: 0, village: 0 });
        expect((await startIslandPlan('child', d)).growthTarget).toBe('village');
    });

    it('serializes the first final answer across connections into one growth, one log and an automatic next question', async () => {
        const d = await setup(), plan = await beforeFinal(d, await startIslandPlan('child', d)), action = correctAction(plan);
        const second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.all([d, second].map(database => commitIslandLearningSession('child', plan.id, plan.revision, action, database)));
            expect(results.every(result => result.nextPlan?.id === results[0].nextPlan?.id)).toBe(true);
            expect(results[0].nextPlan?.cursor).toBe(0);
            expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(1);
            expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
            expect((await d.islands.get('child'))?.items).toHaveLength(3);
            expect(await d.logs.count()).toBe(plan.slots.length);
            const before = await snapshot(d);
            await commitIslandLearningSession('child', plan.id, plan.revision, action, d);
            expect(await snapshot(d)).toEqual(before);
        } finally { second.close(); }
    });

    it('aborts growth, snapshot, answer, profile and completion together then saves each once on retry', async () => {
        const d = await setup();
        let reserved = await startIslandPlan('child', d);
        for (let set = 0; ; set++) {
            expect(set).toBeLessThan(22);
            const step = islandGrowthStep((await d.islands.get('child'))!, 'garden');
            if (step.progress === 5 && step.remaining <= reserved.slots.length) break;
            await finish(d, reserved); reserved = await startIslandPlan('child', d);
        }
        const plan = await beforeFinal(d, reserved);
        const before = await snapshot(d);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_completed') throw new Error('disk full'); };
        d.islandEvents.hook('creating', fail);
        await expect(commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toThrow('disk full');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
        await finish(d, plan);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(6);
        expect((await d.islands.get('child'))?.growth?.memories).toHaveLength(2);
        expect((await d.islands.get('child'))?.growth?.memories[1]).toMatchObject({ kind: 'upgrade', expansionLevel: 1 });
    });

    it('resumes an old waterside reservation before any habitat matured and keeps its earned eastern land', async () => {
        const d = await setup(), island = (await d.islands.get('child'))!;
        island.completedSets = 2;
        delete island.growth!.expansionLevel;
        delete island.growth!.memories[0].expansionLevel;
        island.growth!.focus = 'waterside';
        island.growth!.progress.garden = 2;
        await d.islands.put(island);
        const plan = await startIslandPlan('child', d);
        expect(plan.growthTarget).toBe('waterside');
        const before = structuredClone(plan), memories = structuredClone(island.growth!.memories);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(before);
        await finish(d, plan);
        const grown = (await d.islands.get('child'))!;
        expect(grown.growth).toMatchObject({ expansionLevel: 1, progress: { garden: 2, waterside: 1 } });
        expect(grown.growth!.memories).toEqual(memories);
    });

    it('rejects a new reservation with missing growth state or a locked target instead of repairing it during an answer', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d);
        await d.islandPlans.put({ ...plan, growthTarget: 'grove' });
        let before = await snapshot(d);
        await expect(startIslandPlan('child', d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
        await d.islandPlans.put(plan);
        const island = (await d.islands.get('child'))!;
        delete island.growth;
        await d.islands.put(island);
        before = await snapshot(d);
        await expect(startIslandPlan('child', d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });

    it('keeps an old frozen gift reservation unchanged, then migrates only when reserving new learning', async () => {
        const d = await setup(), legacy = await startIslandPlan('child', d);
        delete legacy.growthTarget;
        delete legacy.rewardPacing;
        await d.islandPlans.put(legacy);
        const island = (await d.islands.get('child'))!;
        delete island.growth;
        island.items = island.items.map(item => ({ id: item.id, kind: item.kind, position: item.position, rotation: item.rotation }));
        await d.islands.put(island);
        const before = await snapshot(d);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(legacy);
        expect(await snapshot(d)).toEqual(before);
        await finish(d, legacy);
        const after = (await d.islands.get('child'))!;
        expect(after.growth).toBeUndefined();
        expect(after.pendingRewards).toHaveLength(1);
        const fresh = await startIslandPlan('child', d);
        expect(fresh.growthTarget).toBe('garden');
        await finish(d, fresh);
        const grown = (await d.islands.get('child'))!;
        expect(grown.pendingRewards).toEqual(after.pendingRewards);
        expect(grown.growth?.progress.garden).toBe(1);
        expect(grown.growth?.memories[0].completedSets).toBe(1);
    });

    it('keeps the growth contract after every habitat matures instead of falling back to unlimited gifts', async () => {
        const d = await setup();
        let island = (await d.islands.get('child'))!;
        for (let completedSets = 1; completedSets <= 24; completedSets++) {
            island = growIslandAfterCompletedSet({ ...island, completedSets }, getIslandGrowthTarget(island), completedSets);
        }
        await d.islands.put(island);
        const memories = structuredClone(island.growth!.memories);
        const plan = await startIslandPlan('child', d);
        expect(plan.growthTarget).toBeDefined();
        await finish(d, plan);
        const completed = (await d.islands.get('child'))!;
        expect(completed.completedSets).toBe(25);
        expect(completed.items).toEqual(island.items);
        expect(completed.pendingRewards).toHaveLength(0);
        expect(completed.growth!.progress).toEqual({ garden: 6, waterside: 6, grove: 6, village: 6 });
        expect(completed.growth!.memories).toEqual(memories);
        await expect(selectIslandGrowthTarget('child', completed.revision, 'garden', d)).rejects.toBeInstanceOf(IslandConflict);
    });

    it('saves old appearances independently of earned growth and never rewrites album snapshots or user placement', async () => {
        const d = await setup();
        await finish(d, await startIslandPlan('child', d));
        let island = (await d.islands.get('child'))!;
        const memories = structuredClone(island.growth!.memories);
        await expect(setIslandItemAppearance('child', island.revision, 'starter-flower', 2, d)).rejects.toBeInstanceOf(IslandConflict);
        const revision = island.revision;
        island = await setIslandItemAppearance('child', revision, 'starter-flower', 0, d);
        expect(await setIslandItemAppearance('child', revision, 'starter-flower', 0, d)).toEqual(island);
        island = await saveIslandEdit('child', island.revision, { type: 'store', itemId: 'starter-flower' }, d);
        for (let set = 0; (await d.islands.get('child'))!.growth!.progress.garden < 3; set++) {
            expect(set).toBeLessThan(6);
            await finish(d, await startIslandPlan('child', d));
        }
        d.close(); await d.open();
        island = await openIsland('child', d);
        expect(island.items.find(item => item.id === 'starter-flower')).toMatchObject({ appearanceLevel: 0, growthLevel: 2, position: undefined });
        expect(island.growth!.memories.slice(0, memories.length)).toEqual(memories);
        island = await setIslandItemAppearance('child', island.revision, 'starter-flower', 2, d);
        expect(island.items.find(item => item.id === 'starter-flower')?.appearanceLevel).toBeUndefined();
    });

    it('records only eligible observed life, once across tabs, while keeping learning untouched', async () => {
        const d = await setup();
        await expect(recordIslandDiscovery('child', 'flower-scent', 'starter-flower', d)).rejects.toBeInstanceOf(IslandConflict);
        await finish(d, await startIslandPlan('child', d));
        expect((await d.islands.get('child'))?.growth?.discoveries).toEqual([]);
        await expect(recordIslandDiscovery('child', 'butterfly-visit', 'starter-flower', d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(recordIslandDiscovery('child', 'flower-scent', 'starter-lantern', d)).rejects.toBeInstanceOf(IslandConflict);
        const before = await snapshot(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            await Promise.all([d, second].map(database => recordIslandDiscovery('child', 'flower-scent', 'starter-flower', database)));
            expect((await d.islands.get('child'))?.growth?.discoveries).toEqual([{ id: 'flower-scent', itemId: 'starter-flower', discoveredAt: expect.any(Number) }]);
            expect(await d.islandEvents.where('type').equals('discovery_observed').count()).toBe(1);
            const after = await snapshot(d);
            for (const name of Object.keys(before).filter(name => !['islands', 'islandEvents'].includes(name))) expect(after[name]).toEqual(before[name]);
            d.close(); await d.open();
            expect((await recordIslandDiscovery('child', 'flower-scent', 'starter-flower', d)).growth!.discoveries).toHaveLength(1);
            expect(await snapshot(d)).toEqual(after);
        } finally { second.close(); }
    });

    it('checks profile ownership and rolls back failed optional changes without touching the island or learning', async () => {
        const d = await setup();
        await finish(d, await startIslandPlan('child', d));
        let island = (await d.islands.get('child'))!;
        const fail = (_key: unknown, event: IslandEvent) => { if (['growth_selected', 'appearance_changed', 'discovery_observed'].includes(event.type)) throw new Error('disk full'); };
        const actions = [() => selectIslandGrowthTarget('child', island.revision, 'village', d),
            () => setIslandItemAppearance('child', island.revision, 'starter-flower', 0, d),
            () => recordIslandDiscovery('child', 'flower-scent', 'starter-flower', d)];
        const before = await snapshot(d);
        d.islandEvents.hook('creating', fail);
        for (const action of actions) { await expect(action()).rejects.toThrow('disk full'); expect(await snapshot(d)).toEqual(before); }
        d.islandEvents.hook('creating').unsubscribe(fail);
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        const switched = await snapshot(d);
        for (const action of actions) await expect(action()).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(switched);
        island = (await d.islands.get('child'))!;
        expect(island.growth?.discoveries).toEqual([]);
    });
});
