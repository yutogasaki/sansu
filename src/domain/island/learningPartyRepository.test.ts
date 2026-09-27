import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import type { Transaction } from 'dexie';
import { afterEach, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getSkillsForLevel } from '../math/curriculum';
import { parkHissanGrid } from '../park/learning';
import { openIsland, startIslandPlan } from './repository';
import { commitIslandLearning } from './commit';
import { commitIslandLearningSession } from './learningSession';
import type { IslandPlan } from './types';

const databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`party-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { [profile.id]: profile } });
    await d.memoryMath.bulkPut(getSkillsForLevel(profile.mathMainLevel).map(id => ({ id, profileId: 'child',
        strength: 4, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0,
        updatedAt: '2026-01-01', nextReview: '2099-01-01', status: 'active' as const })));
    await openIsland(profile.id, d);
    return { d, plan: await startIslandPlan(profile.id, d) };
}
function action(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

it('saves game progress with each receipt across sections, reopen, and duplicate concurrent delivery', async () => {
    const { d, plan: first } = await setup();
    expect((await d.islands.get('child'))?.learningParty).toBeUndefined();
    let plan = first;
    for (let i = 0; i < 5; i++) {
        const result = await commitIslandLearningSession('child', plan.id, plan.revision, action(plan), d);
        plan = result.nextPlan ?? result.receipt.plan;
    }
    const earned = (await d.islands.get('child'))!.learningParty;
    expect(earned).toEqual({ version: 1, streak: 5, light: 5, rideRemaining: 3 });
    expect(plan.id).not.toBe(first.id);
    const duplicate = action(plan);
    const results = await Promise.all([0, 1].map(() => commitIslandLearning('child', plan.id, plan.revision, duplicate, d)));
    expect(results[0].event.id).toBe(results[1].event.id);
    expect((await d.islands.get('child'))?.learningParty).toEqual({ version: 1, streak: 6, light: 7, rideRemaining: 2 });
    expect(await d.logs.count()).toBe(6);
    d.close(); await d.open();
    expect((await d.islands.get('child'))?.learningParty?.rideRemaining).toBe(2);
    expect(await startIslandPlan('child', d)).toEqual(results[0].plan);
    const other = { ...createInitialProfile('other', 2, 1, 1, 'math'), id: 'other' };
    await d.profiles.put(other);
    const app = (await d.appData.get('app'))!;
    await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
    await openIsland('other', d);
    expect((await d.islands.get('other'))?.learningParty).toBeUndefined();
    expect((await d.islands.get('child'))?.learningParty?.light).toBe(7);
});

it('does not reward a failed save and retries the same answer exactly once', async () => {
    const { d, plan } = await setup();
    const before = await d.islands.get('child');
    const abort = (_mods: unknown, _key: unknown, _value: unknown, tx: Transaction) => tx.abort();
    d.islands.hook('updating', abort);
    await expect(commitIslandLearning('child', plan.id, plan.revision, action(plan), d)).rejects.toThrow();
    d.islands.hook('updating').unsubscribe(abort);
    expect(await d.islands.get('child')).toEqual(before);
    expect(await d.islandPlans.get(plan.id)).toEqual(plan);
    expect(await d.logs.count()).toBe(0);
    await commitIslandLearning('child', plan.id, plan.revision, action(plan), d);
    expect((await d.islands.get('child'))?.learningParty).toEqual({ version: 1, streak: 1, light: 1, rideRemaining: 0 });
    expect(await d.logs.count()).toBe(1);
});

it('keeps the earned ride through wrong answers and modeled completion without claiming independence', async () => {
    const { d, plan: first } = await setup(); let plan = first;
    for (let i = 0; i < 5; i++) {
        const r = await commitIslandLearningSession('child', plan.id, plan.revision, action(plan), d);
        plan = r.nextPlan ?? r.receipt.plan;
    }
    plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'answer', answer: 'wrong' }, d)).plan;
    expect((await d.islands.get('child'))?.learningParty).toEqual({ version: 1, streak: 0, light: 5, rideRemaining: 3 });
    plan = (await commitIslandLearning('child', plan.id, plan.revision, action(plan), d)).plan;
    expect((await d.islands.get('child'))?.learningParty).toEqual({ version: 1, streak: 0, light: 6, rideRemaining: 2 });
    for (const type of ['support_opened', 'model_opened', 'supported_completed'] as const) {
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type }, d)).plan;
    }
    expect((await d.islands.get('child'))?.learningParty).toEqual({ version: 1, streak: 0, light: 7, rideRemaining: 1 });
    expect(await d.logs.count()).toBe(7); // five correct, one error, one corrected; model is not an answer
});
