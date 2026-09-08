import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getSkillsForLevel } from '../math/curriculum';
import { ENGLISH_WORDS } from '../english/words';
import { parkHissanGrid } from '../park/learning';
import { openIsland, startIslandPlan, IslandConflict, assertIsland, assertIslandPlan } from './repository';
import { commitIslandLearning } from './commit';
import { commitIslandLearningSession } from './learningSession';
import { setIslandNextSubject } from './subjectPreference';
import type { IslandPlan } from './types';

const databases: SansuDatabase[] = [];
async function setup(familiar = true) {
    const d = new SansuDatabase(`island-subject-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(d);
    const p = { ...createInitialProfile('test', 2, 1, 1, 'mix'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
    if (familiar) {
        const memory = (id: string) => ({ id, profileId: p.id, strength: 3, totalAnswers: 10, correctAnswers: 10,
            independentCorrectAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0, updatedAt: '2026-01-01', nextReview: '2099-01-01' });
        await d.memoryMath.bulkPut(getSkillsForLevel(p.mathMainLevel).map(id => ({ ...memory(id), status: 'active' as const })));
        await d.memoryVocab.bulkPut(ENGLISH_WORDS.filter(word => word.level === p.vocabMainLevel).map(word => memory(word.id)));
    }
    await openIsland(p.id, d);
    return d;
}
const action = (plan: IslandPlan) => {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
};
async function finish(d: SansuDatabase, plan: IslandPlan) {
    let current = plan;
    while (current.status === 'active') current = (await commitIslandLearning('child', current.id, current.revision, action(current), d)).plan;
    return current;
}
async function choose(d: SansuDatabase, plan: IslandPlan, enabled = true) {
    return setIslandNextSubject('child', (await d.islands.get('child'))!.revision, plan.id, enabled, d);
}
const learning = async (d: SansuDatabase) => ({ plans: await d.islandPlans.toArray(), events: await d.islandEvents.toArray(),
    logs: await d.logs.toArray(), math: await d.memoryMath.toArray(), vocab: await d.memoryVocab.toArray(), profile: await d.profiles.get('child') });
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('Island next-section choice persistence', () => {
    it('keeps the exact question and learning state, survives reload, is idempotent, and applies to one section only', async () => {
        const d = await setup(), first = await startIslandPlan('child', d), before = await learning(d);
        const selected = await choose(d, first);
        expect(selected.nextSubjectChoice).toEqual({ afterPlanId: first.id, subject: 'math' });
        expect(await setIslandNextSubject('child', selected.revision - 1, first.id, true, d)).toEqual(selected);
        expect(await learning(d)).toEqual(before);
        expect(selected.growth).toEqual((await d.islands.get('child'))?.growth);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(first);
        expect((await d.islands.get('child'))?.nextSubjectChoice).toEqual(selected.nextSubjectChoice);
        await finish(d, first);
        const next = await startIslandPlan('child', d);
        expect(next.subject).toBe('math'); expect(next.slots).toHaveLength(6);
        expect((await d.islands.get('child'))?.nextSubjectChoice).toBeUndefined();
        await finish(d, next);
        expect((await startIslandPlan('child', d)).subject).toBe('vocab');
        expect(await d.logs.count()).toBe(9);
    });

    it('cancels before the boundary and rejects stale revisions, completed plans and another profile', async () => {
        const d = await setup(), first = await startIslandPlan('child', d), initial = (await d.islands.get('child'))!;
        await choose(d, first);
        await expect(setIslandNextSubject('child', initial.revision, first.id, false, d)).rejects.toBeInstanceOf(IslandConflict);
        await choose(d, first, false);
        await finish(d, first);
        const next = await startIslandPlan('child', d);
        expect(next.subject).toBe('vocab');
        const snapshot = await learning(d), island = (await d.islands.get('child'))!;
        await expect(setIslandNextSubject('child', island.revision, first.id, true, d)).rejects.toBeInstanceOf(IslandConflict);
        const app = (await d.appData.get('app'))!;
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other: { ...app.profiles.child, id: 'other' } } });
        await expect(setIslandNextSubject('child', island.revision, next.id, true, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await learning(d)).toEqual(snapshot);
    });

    it('keeps the saved choice when the final answer commits but next reservation fails', async () => {
        const d = await setup();
        let plan = await startIslandPlan('child', d);
        await choose(d, plan);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, action(plan), d)).plan;
        const fail = function (_key: unknown, _value: IslandPlan, transaction: Transaction) { transaction.abort(); };
        d.islandPlans.hook('creating', fail);
        const result = await commitIslandLearningSession('child', plan.id, plan.revision, action(plan), d);
        d.islandPlans.hook('creating').unsubscribe(fail);
        expect(result.nextPlanError).toBe(true);
        expect(result.receipt.plan.status).toBe('completed');
        expect((await d.islands.get('child'))?.nextSubjectChoice?.afterPlanId).toBe(plan.id);
        expect(await d.logs.count()).toBe(3);
        const next = await startIslandPlan('child', d);
        expect(next.subject).toBe('math');
        const replay = await commitIslandLearningSession('child', plan.id, plan.revision, action(plan), d);
        expect(replay.nextPlan).toEqual(next);
        expect(await d.logs.count()).toBe(3);
        expect(await d.islandPlans.count()).toBe(2);
    });

    it('records new content at reservation time and continues it after actual independent answers', async () => {
        const d = await setup(false), first = await startIslandPlan('child', d);
        expect(first.introducedItemIds?.length).toBeGreaterThan(0);
        await finish(d, first);
        const next = await startIslandPlan('child', d);
        expect(next.subject).toBe(first.subject);
        expect(next.slots.some(slot => first.introducedItemIds!.includes(slot.problem.categoryId) && slot.source === 'main')).toBe(true);
        expect(next.slots).toHaveLength(3);
        await finish(d, next);
        expect((await startIslandPlan('child', d)).subject).toBe('vocab');
    });

    it('preserves old reservations and gives updated single-subject settings priority over a prior choice', async () => {
        const d = await setup(), first = await startIslandPlan('child', d);
        delete first.introducedItemIds;
        await d.islandPlans.put(first);
        expect(() => assertIslandPlan(first, 'child')).not.toThrow();
        expect(await startIslandPlan('child', d)).toEqual(first);
        await choose(d, first);
        const app = (await d.appData.get('app'))!, p = { ...app.profiles.child, subjectMode: 'vocab' as const };
        await d.appData.put({ ...app, profiles: { child: p } }); await d.profiles.put(p);
        expect(await startIslandPlan('child', d)).toEqual(first);
        await finish(d, first);
        expect((await startIslandPlan('child', d)).subject).toBe('vocab');
        const island = (await d.islands.get('child'))!;
        expect(island.nextSubjectChoice).toBeUndefined();
        expect(() => assertIsland(island)).not.toThrow();
    });
});
