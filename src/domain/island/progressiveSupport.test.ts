import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import type { Problem } from '../types';
import { parkHissanGrid } from '../park/learning';
import { getLearningDayStart } from '../../utils/learningDay';
import { commitIslandLearning } from './commit';
import { assertIslandPlan, IslandConflict, openIsland, startIslandPlan } from './repository';
import { islandSupportStage } from './learningSupport';
import { mathCheckQuestionKey } from './learningChecks';
import type { IslandLearningAction, IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
const arithmetic: Problem = { id: 'frozen-question', subject: 'math', categoryId: 'add_2d1d_nc',
    questionText: '23 + 4 =', correctAnswer: '27', inputType: 'number', isReview: true };
const baselineMemory = (id: string) => ({ id, profileId: 'child', strength: 4, totalAnswers: 10,
    correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0, nextReview: '2000-01-01',
    updatedAt: '2026-01-01', status: 'active' as const });
async function setup(problem = arithmetic) {
    const d = new SansuDatabase(`island-progressive-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 11, 2, problem.subject), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { child: profile } });
    await (problem.subject === 'math' ? d.memoryMath : d.memoryVocab).put(baselineMemory(problem.categoryId));
    await openIsland('child', d);
    const plan = await startIslandPlan('child', d);
    // A one-slot frozen fixture isolates the final receipt/growth boundary. The
    // existing planner suites still exercise the real three/six-slot workload.
    plan.slots = [{ problem: structuredClone(problem), assisted: false, completed: false,
        source: 'due', countsTowardReviewCap: true }];
    plan.introducedItemIds = [problem.categoryId];
    await d.islandPlans.put(plan);
    return { d, plan };
}
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
const act = async (d: SansuDatabase, plan: IslandPlan, action: IslandLearningAction) => commitIslandLearning('child', plan.id, plan.revision, action, d);
async function model(d: SansuDatabase, plan: IslandPlan) {
    const hint = (await act(d, plan, { type: 'support_opened' })).plan;
    return (await act(d, hint, { type: 'model_opened' })).plan;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('Island progressive support persistence', () => {
    it('persists hint and model on the exact frozen question without answer writes or draft-cell changes', async () => {
        const { d, plan } = await setup({ ...arithmetic, categoryId: 'mul_2d2d', questionText: '23 × 14 =',
            correctAnswer: '322', inputType: 'hissan', hissanVersion: 2 });
        const grid = parkHissanGrid(plan.slots[0].problem)!;
        expect(grid.steps.length).toBeGreaterThan(1);
        const first = grid.steps[0];
        const partial = (await act(d, plan, { type: 'answer', answer: first.correctValues })).plan;
        const savedCells = structuredClone(partial.slots[0].hissanValues);
        const hint = await act(d, partial, { type: 'support_opened' });
        expect(hint.plan.slots[0]).toMatchObject({ assisted: true, supportStage: 'hint', completed: false });
        expect(hint.event.result).toBeUndefined();
        const shown = await act(d, hint.plan, { type: 'model_opened' });
        expect(shown.plan.slots[0].problem).toEqual(plan.slots[0].problem);
        expect(shown.plan.slots[0].hissanValues).toEqual(savedCells);
        expect(shown.plan.slots[0].hissanStep).toBe(partial.slots[0].hissanStep);
        expect(shown.event.learningLogId).toBeUndefined();
        expect(await d.logs.count()).toBe(0);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(shown.plan);
        expect(islandSupportStage((await startIslandPlan('child', d)).slots[0])).toBe('model');
        const completed = await act(d, shown.plan, { type: 'supported_completed' });
        expect(completed.plan.slots[0].hissanValues).toEqual(savedCells);
        expect(completed.plan.slots[0].hissanStep).toBe(partial.slots[0].hissanStep);
        expect(completed.event.result).toBe('supported-completion');
        expect(await d.logs.count()).toBe(0);
    });

    it('lets a hint retry finish with an actual assisted answer, preserving independent evidence separately', async () => {
        const { d, plan } = await setup();
        const hint = (await act(d, plan, { type: 'support_opened' })).plan;
        const wrong = await act(d, hint, { type: 'answer', answer: '28' });
        expect(wrong.plan.cursor).toBe(0);
        expect(wrong.event.result).toBe('assisted-incorrect');
        const answer = await act(d, wrong.plan, { type: 'answer', answer: '27' });
        expect(answer.event).toMatchObject({ type: 'answer', result: 'assisted-correct', action: { type: 'answer', answer: '27' } });
        expect(answer.plan.cursor).toBe(1);
        expect(answer.island.pendingMathChecks).toEqual([expect.objectContaining({ skillId: arithmetic.categoryId })]);
        expect(await d.logs.count()).toBe(0);
        expect((await d.memoryMath.get(['child', arithmetic.categoryId]))?.correctAnswers).toBe(10);
    });

    it.each(['math', 'vocab'] as const)('finishes %s from a model without submitting an answer or manufacturing mastery', async subject => {
        const problem = subject === 'math' ? arithmetic : { ...arithmetic, subject, categoryId: 'apple',
            questionText: 'apple', correctAnswer: 'apple', displayAnswer: 'りんご', inputType: 'choice' as const };
        const { d, plan } = await setup(problem);
        const shown = await model(d, plan);
        const profileBefore = await d.profiles.get('child');
        const result = await act(d, shown, { type: 'supported_completed' });
        expect(result.event).toMatchObject({ type: 'supported_completed', result: 'supported-completion', action: { type: 'supported_completed' } });
        expect(result.event.learningLogId).toBeUndefined();
        expect(result.plan).toMatchObject({ status: 'completed', cursor: 1 });
        expect(result.island).toMatchObject({ completedSets: 1, pendingPlanId: undefined });
        expect(result.island.pendingRewards).toHaveLength(0);
        expect(result.island.growth?.progress.garden).toBe(0);
        expect((await d.islands.get('child'))?.growth?.pendingAnswers?.garden).toBe(1);
        expect(result.plan.slots[0].problem).toEqual(problem);
        expect(await d.logs.count()).toBe(0);
        expect(await d.islandEvents.where('type').equals('answer').count()).toBe(0);
        const memory = await (subject === 'math' ? d.memoryMath : d.memoryVocab).get(['child', problem.categoryId]);
        expect(memory).toMatchObject({ strength: 1, needsRelearning: true, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0, nextReview: '2000-01-01' });
        const profileAfter = await d.profiles.get('child');
        expect(profileAfter?.mathMainLevel).toBe(profileBefore?.mathMainLevel);
        expect(profileAfter?.vocabMainLevel).toBe(profileBefore?.vocabMainLevel);
        expect(profileAfter?.mathMaxUnlocked).toBe(profileBefore?.mathMaxUnlocked);
    });

    it('enforces every stage transition and one skip in the transaction, leaving all stores unchanged on rejection', async () => {
        const { d, plan } = await setup();
        const invalid = async (current: IslandPlan, actions: IslandLearningAction[]) => {
            for (const action of actions) {
                const before = await snapshot(d);
                await expect(act(d, current, action)).rejects.toBeInstanceOf(IslandConflict);
                expect(await snapshot(d)).toEqual(before);
            }
        };
        await invalid(plan, [{ type: 'model_opened' }, { type: 'supported_completed' }]);
        const skipped = await act(d, plan, { type: 'skipped' });
        expect(await act(d, plan, { type: 'skipped' })).toEqual(skipped);
        await invalid(skipped.plan, [{ type: 'support_opened' }, { type: 'skipped' }, { type: 'supported_completed' }]);
        const shown = (await act(d, skipped.plan, { type: 'model_opened' })).plan;
        await invalid(shown, [{ type: 'support_opened' }, { type: 'skipped' }, { type: 'model_opened' }, { type: 'answer', answer: '27' }]);
        await act(d, shown, { type: 'supported_completed' });
        expect(await d.logs.toArray()).toEqual([expect.objectContaining({ result: 'skipped' })]);
        expect((await d.memoryMath.get(['child', arithmetic.categoryId]))?.skippedAnswers).toBe(1);
    });

    it('serializes concurrent supported completions to one receipt/growth without an answer or log', async () => {
        const { d, plan } = await setup();
        const shown = await model(d, plan);
        const second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const [one, two] = await Promise.all([act(d, shown, { type: 'supported_completed' }), act(second, shown, { type: 'supported_completed' })]);
            expect(two).toEqual(one);
            expect(await act(d, shown, { type: 'supported_completed' })).toEqual(one);
            expect(await d.islandEvents.where('type').equals('supported_completed').count()).toBe(1);
            expect(await d.islandEvents.where('type').equals('plan_completed').count()).toBe(1);
            expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(0);
        expect((await d.islands.get('child'))?.growth?.pendingAnswers?.garden).toBe(1);
            expect(await d.logs.count()).toBe(0);
        } finally { second.close(); }
    });

    it('rolls back completion, receipt, Due, profile and growth together when the final event fails', async () => {
        const { d, plan } = await setup();
        const shown = await model(d, plan);
        const before = await snapshot(d);
        const fail = (_key: unknown, event: { type: string }) => { if (event.type === 'plan_completed') throw new Error('disk failure'); };
        d.islandEvents.hook('creating', fail);
        try { await expect(act(d, shown, { type: 'supported_completed' })).rejects.toThrow('disk failure'); }
        finally { d.islandEvents.hook('creating').unsubscribe(fail); }
        expect(await snapshot(d)).toEqual(before);
    });

    it('finishes a guided bridge into an independent recheck, without clearing the original problem', async () => {
        const { d, plan } = await setup({ ...arithmetic, categoryId: 'add_2d1d_nc_bridge' });
        const check = { skillId: arithmetic.categoryId, failedProblemId: 'original-failed',
            failedQuestionKey: mathCheckQuestionKey(arithmetic), stage: 'bridge' as const, createdAt: 1 };
        await d.islands.update('child', { pendingMathChecks: [check] });
        const shown = await model(d, plan);
        const done = await act(d, shown, { type: 'supported_completed' });
        expect(done.island.pendingMathChecks).toContainEqual({ ...check, stage: 'independent' });
        expect(done.island.pendingMathChecks).toContainEqual(expect.objectContaining({ skillId: 'add_2d1d_nc_bridge' }));
        expect(await d.logs.count()).toBe(0);
    });

    it('resumes legacy answer-exposed slots as models, replays old receipts unchanged and creates a missing followup', async () => {
        const { d, plan } = await setup();
        plan.slots[0].assisted = true;
        plan.revision = 1;
        const oldReceipt = { id: JSON.stringify(['island-action-v1', 'child', plan.id, 0]), profileId: 'child', planId: plan.id,
            timestamp: 1, type: 'support_opened' as const, action: { type: 'support_opened' as const }, slotIndex: 0 };
        await d.islandPlans.put(plan);
        await d.islandEvents.add(oldReceipt);
        const reopened = await startIslandPlan('child', d);
        expect(islandSupportStage(reopened.slots[0])).toBe('model');
        expect((await commitIslandLearning('child', plan.id, 0, { type: 'support_opened' }, d)).event).toEqual(oldReceipt);
        const done = await act(d, reopened, { type: 'supported_completed' });
        expect(done.island.pendingMathChecks).toEqual([expect.objectContaining({ skillId: arithmetic.categoryId, failedProblemId: arithmetic.id })]);
        expect((await d.memoryMath.get(['child', arithmetic.categoryId]))!.nextReview <= getLearningDayStart().toISOString()).toBe(true);
        expect(await d.islandEvents.get(oldReceipt.id)).toEqual(oldReceipt);
        expect(await d.logs.count()).toBe(0);
    });

    it.each([{ supportStage: 'invalid', assisted: true }, { supportStage: 'hint', assisted: false },
        { supportStage: null, assisted: true }, { assisted: 'yes' }])('rejects malformed support state %j', async fields => {
        const { plan } = await setup();
        Object.assign(plan.slots[0], fields);
        expect(() => assertIslandPlan(plan, 'child')).toThrow(IslandConflict);
    });
});
