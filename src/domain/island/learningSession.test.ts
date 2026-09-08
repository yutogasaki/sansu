import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getLevelForSkill, getSkillsForLevel } from '../math/curriculum';
import { parkHissanGrid, planParkLearning } from '../park/learning';
import { commitIslandLearning } from './commit';
import { commitIslandLearningSession, isFirstIslandPlan } from './learningSession';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import type { IslandEvent, IslandLearningAction, IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
async function setup(level = 1) {
    const d = new SansuDatabase(`island-session-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, level, 1, 'math'), id: 'child', soundEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await d.memoryMath.bulkPut(getSkillsForLevel(profile.mathMainLevel).map(id => ({ id, profileId: 'child',
        strength: 4, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0,
        updatedAt: '2026-01-01', nextReview: '2099-01-01', status: 'active' as const })));
    await openIsland('child', d);
    return d;
}
function correctAction(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
const session = (d: SansuDatabase, plan: IslandPlan, action: IslandLearningAction = correctAction(plan)) =>
    commitIslandLearningSession('child', plan.id, plan.revision, action, d);
async function finish(d: SansuDatabase, plan: IslandPlan) {
    let current = plan;
    while (current.status === 'active') current = (await commitIslandLearning('child', current.id, current.revision, correctAction(current), d)).plan;
    return current;
}
async function normalPlan(d: SansuDatabase) {
    await finish(d, await startIslandPlan('child', d));
    return startIslandPlan('child', d);
}
async function beforeFinal(d: SansuDatabase, plan: IslandPlan) {
    let current = plan;
    while (current.cursor < current.slots.length - 1) current = (await session(d, current)).receipt.plan;
    return current;
}
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('Island answer receipt and the next reserved section', () => {
    it('automatically grows after the first three questions, then crosses six questions with zero reward interruptions', async () => {
        const d = await setup();
        let plan = await startIslandPlan('child', d);
        expect(isFirstIslandPlan(plan)).toBe(true);
        expect(plan.slots).toHaveLength(3);
        expect(await d.logs.count()).toBe(0);
        let firstNext: IslandPlan | undefined;
        for (let question = 0; question < 3; question++) {
            const result = await session(d, plan);
            if (question < 2) expect(result.nextPlan).toBeUndefined();
            else firstNext = result.nextPlan;
            expect(result.nextPlanError).toBeUndefined();
            plan = result.receipt.plan;
        }
        expect(plan.status).toBe('completed');
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(1);
        expect(await d.islandPlans.count()).toBe(2);
        expect(firstNext).toEqual(await startIslandPlan('child', d));
        plan = firstNext!;
        expect(isFirstIslandPlan(plan)).toBe(false); expect(plan.slots).toHaveLength(6);
        plan = await beforeFinal(d, plan);
        const result = await session(d, plan);
        expect(result.receipt.plan.status).toBe('completed');
        expect(result.receipt.island.pendingPlanId).toBeUndefined();
        expect(result.nextPlan).toMatchObject({ status: 'active', cursor: 0, revision: 0 });
        expect(result.nextPlan!.slots).toHaveLength(6);
        expect(result.latestIsland).toEqual(await d.islands.get('child'));
        expect(result.latestIsland?.pendingPlanId).toBe(result.nextPlan!.id);
        expect(result.latestIsland?.pendingRewards).toHaveLength(0);
        expect(result.latestIsland?.growth?.progress.garden).toBe(2);
        expect(await d.logs.count()).toBe(9);
        expect(await d.islandEvents.where('type').equals('reward_claimed').count()).toBe(0);
    });

    it('retains a previously frozen first six-question reservation without rewriting its questions or revision', async () => {
        const d = await setup(), first = await startIslandPlan('child', d);
        const profile = (await d.profiles.get('child'))!;
        // A legacy reservation uses the actual pre-change planner workload.
        const legacy = { ...first, ...planParkLearning(profile, await d.memoryMath.toArray(), [], [], 0,
            first.id, first.startedAt, { standardCount: 6, complexCount: 3 }) };
        delete legacy.growthTarget;
        expect(legacy.slots).toHaveLength(6);
        await d.islandPlans.put(legacy);
        const saved = await snapshot(d);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(legacy);
        expect(await snapshot(d)).toEqual(saved);
        expect(isFirstIslandPlan(legacy)).toBe(true);
    });

    it('keeps the normal complex workload at three and advances only after the whole reserved question completes', async () => {
        const level = getLevelForSkill('mul_2d2d')!;
        const d = await setup(level - 1);
        await finish(d, await startIslandPlan('child', d));
        await d.memoryMath.update(['child', 'mul_2d2d'], { nextReview: '2000-01-01' });
        let plan = await startIslandPlan('child', d);
        expect(plan.slots[0].problem.categoryId).toBe('mul_2d2d');
        expect(plan.slots).toHaveLength(3);
        const firstGrid = parkHissanGrid(plan.slots[0].problem);
        expect(firstGrid).not.toBeNull();
        expect(firstGrid!.steps.length).toBeGreaterThan(1);
        const logCount = await d.logs.count();
        const partial = await session(d, plan);
        expect(partial.receipt.plan.cursor).toBe(0); expect(partial.nextPlan).toBeUndefined();
        expect(await d.logs.count()).toBe(logCount);
        plan = partial.receipt.plan;
        while (plan.status === 'active') {
            const result = await session(d, plan);
            if (result.receipt.plan.status === 'completed') expect(result.nextPlan?.status).toBe('active');
            else expect(result.nextPlan).toBeUndefined();
            plan = result.receipt.plan;
        }
        expect((await d.islands.get('child'))?.completedSets).toBe(2);
    });

    it('serializes two final submissions and replays against the latest pending plan without a second growth or reservation', async () => {
        const d = await setup(), plan = await beforeFinal(d, await normalPlan(d)), action = correctAction(plan);
        const second = new SansuDatabase(d.name, options); await second.open();
        try {
            const results = await Promise.all([session(d, plan, action), session(second, plan, action)]);
            expect(results.every(result => result.nextPlan?.id === results[0].nextPlan?.id)).toBe(true);
            const progressed = (await session(d, results[0].nextPlan!)).receipt.plan;
            const before = await snapshot(d), replay = await session(d, plan, action);
            expect(replay.nextPlan).toEqual(progressed);
            expect(replay.latestIsland?.pendingPlanId).toBe(progressed.id);
            expect(await snapshot(d)).toEqual(before);
            expect(await d.islandPlans.count()).toBe(3);
            expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
            expect(await d.islandEvents.where('type').equals('plan_completed').count()).toBe(2);
            expect(await d.logs.count()).toBe(10);
        } finally { second.close(); }
    });

    it('does not turn an old non-final receipt into a new reservation after that plan later completes', async () => {
        const d = await setup(), original = await normalPlan(d), action = correctAction(original);
        const next = (await session(d, original, action)).receipt.plan;
        await finish(d, next);
        const before = await snapshot(d), replay = await session(d, original, action);
        expect(replay.receipt.plan.status).toBe('completed');
        expect(replay.nextPlan).toBeUndefined(); expect(replay.nextPlanError).toBeUndefined();
        expect(await snapshot(d)).toEqual(before);
    });

    it('keeps an old first-plan gift receipt introductory even after later sections have completed', async () => {
        const d = await setup(), firstFinal = await beforeFinal(d, await startIslandPlan('child', d)), action = correctAction(firstFinal);
        // An explicit pre-growth first plan retains its old optional gift stop.
        delete firstFinal.growthTarget;
        await d.islandPlans.put(firstFinal);
        await session(d, firstFinal, action);
        await finish(d, await startIslandPlan('child', d));
        const before = await snapshot(d), replay = await session(d, firstFinal, action);
        expect(replay.receipt.island.completedSets).toBe(2);
        expect(replay.nextPlan).toBeUndefined();
        expect(await snapshot(d)).toEqual(before);
    });

    it('keeps the final answer and growth when the real next-reservation write aborts, then retries the same receipt', async () => {
        const d = await setup(), plan = await beforeFinal(d, await normalPlan(d)), action = correctAction(plan);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_started') throw new Error('reservation disk failure'); };
        d.islandEvents.hook('creating', fail);
        const failed = await session(d, plan, action);
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(failed.nextPlanError).toBe(true); expect(failed.nextPlan).toBeUndefined();
        expect(failed.receipt.plan.status).toBe('completed');
        expect(failed.receipt.island).toEqual(await d.islands.get('child'));
        expect(failed.receipt.island).toMatchObject({ completedSets: 2, pendingPlanId: undefined });
        expect(failed.receipt.island.pendingRewards).toHaveLength(0);
        expect(await d.islandPlans.count()).toBe(2); expect(await d.logs.count()).toBe(9);
        const saved = await snapshot(d), retried = await session(d, plan, action);
        expect(retried.receipt.event).toEqual(failed.receipt.event);
        expect(retried.nextPlan?.status).toBe('active'); expect(retried.nextPlanError).toBeUndefined();
        expect(retried.latestIsland?.pendingPlanId).toBe(retried.nextPlan!.id);
        const after = await snapshot(d);
        for (const name of Object.keys(saved).filter(name => !['islands', 'islandPlans', 'islandEvents'].includes(name))) expect(after[name]).toEqual(saved[name]);
        expect((await d.islands.get('child'))?.pendingRewards).toEqual(failed.receipt.island.pendingRewards);
        expect(await d.islandEvents.where('type').equals('plan_completed').count()).toBe(2);
    });

    it('still rejects and rolls back every answer store when the first transaction fails', async () => {
        const d = await setup(), plan = await beforeFinal(d, await normalPlan(d)), before = await snapshot(d);
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_completed') throw new Error('answer disk failure'); };
        d.islandEvents.hook('creating', fail);
        await expect(session(d, plan)).rejects.toThrow('answer disk failure');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot(d)).toEqual(before);
    });

    it('does not fabricate a correct answer when model completion ends a normal section', async () => {
        const d = await setup();
        let plan = await beforeFinal(d, await normalPlan(d));
        const logCount = await d.logs.count();
        for (const action of [{ type: 'support_opened' }, { type: 'model_opened' }] as const) {
            const result = await session(d, plan, action);
            expect(result.nextPlan).toBeUndefined(); plan = result.receipt.plan;
        }
        const result = await session(d, plan, { type: 'supported_completed' });
        expect(result.receipt.event).toMatchObject({ result: 'supported-completion' });
        expect(result.receipt.event.learningLogId).toBeUndefined();
        expect(result.nextPlan?.status).toBe('active');
        expect(await d.logs.count()).toBe(logCount);
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
    });

    it('checks active ownership again after the answer commits, without rolling back that saved answer', async () => {
        const d = await setup(), plan = await beforeFinal(d, await normalPlan(d));
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(other); await d.appData.put({ ...app, profiles: { ...app.profiles, other } });
        let switched: PromiseLike<unknown> | undefined;
        // Queue an actual profile write at the first transaction's completion,
        // before the wrapper opens its second transaction. No domain call is mocked.
        const switchProfile = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'plan_completed') transaction.on('complete', () => {
                switched = d.appData.update('app', { activeProfileId: 'other' });
            });
        };
        d.islandEvents.hook('creating', switchProfile);
        const result = await session(d, plan);
        d.islandEvents.hook('creating').unsubscribe(switchProfile);
        await switched;
        expect(switched).toBeDefined();
        expect(result.receipt.plan.status).toBe('completed'); expect(result.nextPlanError).toBe(true);
        expect(result.nextPlan).toBeUndefined(); expect(await d.islandPlans.count()).toBe(2);
        expect((await d.appData.get('app'))?.activeProfileId).toBe('other');
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        const saved = await snapshot(d);
        await expect(session(d, plan)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(saved);
    });
});
