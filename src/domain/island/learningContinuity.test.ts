import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getAvailableSkills } from '../math/curriculum';
import { ENGLISH_WORDS } from '../english/words';
import { parkHissanGrid } from '../park/learning';
import { getLearningDayStart } from '../../utils/learningDay';
import { commitIslandLearning } from './commit';
import { claimIslandReward, IslandConflict, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import { mathCheckQuestionKey } from './learningChecks';
import type { IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const memory = (id: string, profileId: string, nextReview = '2099-01-01') => ({
    id, profileId, nextReview, updatedAt: '2026-01-01', strength: 3, totalAnswers: 10,
    correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0, isWeak: false,
});
async function setup(subject: 'math' | 'vocab' | 'mix' = 'math', level = 11) {
    const d = new SansuDatabase(`island-continuity-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(d);
    const p = { ...createInitialProfile('test', 2, level - 1, 2, subject), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
    await d.memoryMath.bulkPut(getAvailableSkills(level).map(id => ({ ...memory(id, p.id), status: 'active' as const })));
    await d.memoryVocab.bulkPut(ENGLISH_WORDS.filter(word => word.level <= 2).map(word => memory(word.id, p.id)));
    await openIsland(p.id, d);
    return d;
}
function correctAction(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, plan: IslandPlan) {
    let next = plan;
    while (next.status === 'active') next = (await commitIslandLearning('child', next.id, next.revision, correctAction(next), d)).plan;
    return next;
}
afterEach(async () => {
    for (const d of databases.splice(0)) { d.close(); await d.delete(); }
});

describe('island learning continuity', () => {
    it('retains a math recheck after correcting the same problem and reopening the plan', async () => {
        const d = await setup();
        await d.memoryMath.update(['child', 'add_2d1d_nc'], { nextReview: '2000-01-01' });
        let plan = await startIslandPlan('child', d);
        const frozen = structuredClone(plan.slots.map(slot => slot.problem));
        expect(plan.slots[0].problem.categoryId).toBe('add_2d1d_nc');
        const failedId = plan.slots[0].problem.id;
        const islandBefore = (await d.islands.get('child'))!;
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'answer', answer: 'wrong' }, d)).plan;
        await expect(saveIslandEdit('child', islandBefore.revision, { type: 'store', itemId: 'starter-flower' }, d)).rejects.toBeInstanceOf(IslandConflict);
        plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        expect((await d.islands.get('child'))?.pendingMathChecks).toEqual([
            expect.objectContaining({ skillId: 'add_2d1d_nc', failedProblemId: failedId, stage: 'bridge' }),
        ]);
        expect(plan.slots.map(slot => slot.problem)).toEqual(frozen);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(plan);
        expect((await d.islands.get('child'))?.pendingMathChecks).toHaveLength(1);
    });

    it.each(['support_opened', 'skipped'] as const)('keeps %s checks after guided completion and reload', async type => {
        const d = await setup();
        await d.memoryMath.update(['child', 'add_2d1d_nc'], { nextReview: '2000-01-01' });
        let plan = await startIslandPlan('child', d);
        const before = await d.memoryMath.get(['child', 'add_2d1d_nc']);
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type }, d)).plan;
        plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        d.close(); await d.open();
        expect(plan.slots[0].assisted).toBe(true);
        expect((await d.islands.get('child'))?.pendingMathChecks).toEqual([expect.objectContaining({ skillId: 'add_2d1d_nc' })]);
        expect((await d.memoryMath.get(['child', 'add_2d1d_nc']))?.correctAnswers).toBe(before!.correctAnswers);
        expect(await d.logs.count()).toBe(type === 'skipped' ? 1 : 0);
    });

    it('reserves remediation through review and unlock guards, leaving every current slot frozen', async () => {
        const d = await setup();
        const island = (await d.islands.get('child'))!;
        await d.islands.put({ ...island, pendingMathChecks: [{ skillId: 'add_2d1d_nc', failedProblemId: 'earlier',
            failedQuestionKey: 'earlier-question', stage: 'bridge', createdAt: 1 }] });
        for (const id of ['add_2d1d_c', 'sub_2d1d_nc']) await d.memoryMath.update(['child', id], { nextReview: '2000-01-01' });
        const plan = await startIslandPlan('child', d);
        expect(plan.slots[0]).toMatchObject({ source: 'remediation', countsTowardReviewCap: true,
            problem: { categoryId: 'add_2d1d_nc_bridge', isReview: true } });
        expect(plan.slots.filter(slot => slot.countsTowardReviewCap).length).toBeLessThanOrEqual(Math.floor(plan.slots.length * .6));
        const frozen = structuredClone(plan.slots.map(slot => slot.problem));
        const after = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        expect(after.slots.map(slot => slot.problem)).toEqual(frozen);
        expect((await d.islands.get('child'))?.pendingMathChecks?.[0].stage).toBe('independent');
    });

    it('clears a pending check only after a different reserved question is independently completed', async () => {
        const d = await setup();
        await d.memoryMath.update(['child', 'add_2d1d_nc'], { nextReview: '2000-01-01' });
        const plan = await startIslandPlan('child', d), problem = plan.slots[0].problem;
        const island = (await d.islands.get('child'))!;
        await d.islands.put({ ...island, pendingMathChecks: [{ skillId: problem.categoryId, failedProblemId: 'previous-reservation',
            failedQuestionKey: mathCheckQuestionKey({ ...problem, questionText: 'a genuinely different calculation' }), stage: 'independent', createdAt: 1 }] });
        const result = await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d);
        expect(result.island.pendingMathChecks).toEqual([]);
        expect(await d.logs.count()).toBe(1);
        const replay = await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d);
        expect(replay.island).toEqual(result.island);
        expect(await d.logs.count()).toBe(1);
    });

    it('adds one check for duplicate receipts and rolls the check back with a failed save', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d), before = await d.islands.get('child');
        const action = { type: 'answer' as const, answer: 'wrong' };
        const fail = () => { throw new Error('disk full'); };
        d.islandEvents.hook('creating', fail);
        await expect(commitIslandLearning('child', plan.id, 0, action, d)).rejects.toThrow('disk full');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await d.islands.get('child')).toEqual(before);
        expect(await d.logs.count()).toBe(0);
        const [first, second] = await Promise.all([commitIslandLearning('child', plan.id, 0, action, d), commitIslandLearning('child', plan.id, 0, action, d)]);
        expect(first.island).toEqual(second.island);
        expect(first.island.pendingMathChecks).toHaveLength(1);
        expect(first.island.revision).toBe(before!.revision + 1);
        expect(await d.logs.count()).toBe(1);
    });

    it('clears a Hissan check after the actual full answer row is independently completed', async () => {
        const d = await setup();
        await d.memoryMath.update(['child', 'add_2d1d_hissan_c'], { nextReview: '2000-01-01' });
        let plan = await startIslandPlan('child', d);
        expect(plan.slots[0].problem.categoryId).toBe('add_2d1d_hissan_c');
        const grid = parkHissanGrid(plan.slots[0].problem)!;
        expect(grid.steps[0].correctValues.length).toBeGreaterThan(1);
        const island = (await d.islands.get('child'))!;
        await d.islands.put({ ...island, pendingMathChecks: [{ skillId: 'add_2d1d_hissan_c', failedProblemId: 'old',
            failedQuestionKey: 'another calculation', stage: 'independent', createdAt: 1 }] });
        for (let index = 0; index < grid.steps.length; index++) {
            const result = await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d);
            plan = result.plan;
            expect(result.island.pendingMathChecks).toHaveLength(index === grid.steps.length - 1 ? 0 : 1);
            expect(await d.logs.count()).toBe(index === grid.steps.length - 1 ? 1 : 0);
        }
    });

    it('lets the next overdue word appear while the oldest supported word remains Due', async () => {
        const d = await setup('vocab');
        await d.memoryVocab.update(['child', 'apple'], { nextReview: '2000-01-01' });
        await d.memoryVocab.update(['child', 'orange'], { nextReview: '2001-01-01' });
        let plan = await startIslandPlan('child', d);
        expect(plan.slots[0].problem.categoryId).toBe('apple');
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
        plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        await finish(d, plan);
        const beforeClaim = (await d.islands.get('child'))!;
        expect(beforeClaim.vocabDueCursor).toBe('apple');
        const reward = beforeClaim.pendingRewards[0];
        expect((await claimIslandReward('child', beforeClaim.revision, reward.id, reward.choices[0], d)).vocabDueCursor).toBe('apple');
        expect((await d.memoryVocab.get(['child', 'apple']))?.nextReview <= getLearningDayStart().toISOString()).toBe(true);
        expect(await d.logs.filter(log => log.itemId === 'apple').count()).toBe(0);
        d.close(); await d.open();
        let next = await startIslandPlan('child', d);
        expect(next.slots[0].problem.categoryId).toBe('orange');
        expect(next.slots[0].source).toBe('due');
        expect(await startIslandPlan('child', d)).toEqual(next);
        next = (await commitIslandLearning('child', next.id, next.revision, { type: 'support_opened' }, d)).plan;
        await finish(d, next);
        expect((await startIslandPlan('child', d)).slots[0].problem.categoryId).toBe('apple');
    });

    it('updates the vocabulary cursor only with a successful reservation, resetting to oldest when the previous word is gone', async () => {
        const d = await setup('vocab'), island = (await d.islands.get('child'))!;
        await d.memoryVocab.update(['child', 'apple'], { nextReview: '2000-01-01' });
        await d.memoryVocab.update(['child', 'orange'], { nextReview: '2001-01-01' });
        await d.islands.put({ ...island, vocabDueCursor: 'apple' });
        const before = await d.islands.get('child');
        const fail = () => { throw new Error('disk full'); };
        d.islandEvents.hook('creating', fail);
        await expect(startIslandPlan('child', d)).rejects.toThrow('disk full');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await d.islands.get('child')).toEqual(before);
        await d.memoryVocab.update(['child', 'apple'], { nextReview: '2099-01-01' });
        const plan = await startIslandPlan('child', d);
        expect(plan.slots[0].problem.categoryId).toBe('orange');
        expect((await d.islands.get('child'))?.vocabDueCursor).toBe('orange');
    });

    it.each([
        { subject: 'math' as const, level: 8, count: 6, due: 'count_10' },
        { subject: 'math' as const, level: 21, count: 3, due: 'add_2d1d_nc' },
        { subject: 'mix' as const, level: 21, count: 3, due: 'add_2d1d_nc' },
    ])('shares review opportunities across $count-question $subject sets', async ({ subject, level, count, due }) => {
        const d = await setup(subject, level), island = (await d.islands.get('child'))!;
        const protectedSkills = ['count_5', 'count_dot', due];
        await d.islands.put({ ...island, pendingMathChecks: protectedSkills.slice(0, 2).map(skillId => ({
            skillId, failedProblemId: `old-${skillId}`, failedQuestionKey: `old-${skillId}`, stage: 'independent', createdAt: 1,
        })) });
        for (const id of protectedSkills.slice(0, 2)) await d.memoryMath.update(['child', id], { nextReview: '2000-01-01' });
        await d.memoryMath.update(['child', due], { nextReview: '2001-01-01' });
        const firstReviews = [];
        const reviewSelections: { skillId: string; source: string }[][] = [];
        for (let turn = 0; turn < 3; turn++) {
            let plan = await startIslandPlan('child', d);
            expect(plan.subject).toBe('math'); expect(plan.slots).toHaveLength(count);
            firstReviews.push({ skillId: plan.slots[0].problem.categoryId, source: plan.slots[0].source });
            reviewSelections.push(plan.slots.filter(slot => slot.countsTowardReviewCap)
                .map(slot => ({ skillId: slot.problem.categoryId, source: slot.source })));
            expect(plan.slots.filter(slot => slot.countsTowardReviewCap).length).toBeLessThanOrEqual(Math.floor(count * .6));
            expect(new Set(plan.slots.filter(slot => slot.source === 'remediation').map(slot => slot.problem.categoryId)).size).toBeLessThanOrEqual(1);
            const mathTurn = (await d.islands.get('child'))?.mathReviewTurn;
            expect(mathTurn).toBe(turn + 1);
            d.close(); await d.open();
            expect(await startIslandPlan('child', d)).toEqual(plan);
            expect((await d.islands.get('child'))?.mathReviewTurn).toBe(mathTurn);
            while (plan.status === 'active') {
                if (protectedSkills.includes(plan.slots[plan.cursor].problem.categoryId) && !plan.slots[plan.cursor].assisted) {
                    plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
                }
                plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
            }
            expect((await d.islands.get('child'))?.mathReviewTurn).toBe(mathTurn);
            if (subject === 'mix' && turn < 2) {
                const vocab = await startIslandPlan('child', d);
                expect(vocab.subject).toBe('vocab');
                await finish(d, vocab);
                expect((await d.islands.get('child'))?.mathReviewTurn).toBe(mathTurn);
            }
        }
        expect(reviewSelections.slice(0, 2).flat()).toContainEqual({ skillId: due, source: 'due' });
        // Six slots can already serve ordinary Due in the first set. Its guided
        // completion then creates a pending check, so it enters that rotation.
        expect(firstReviews).toEqual([{ skillId: 'count_5', source: 'remediation' },
            count === 6 ? { skillId: 'count_5', source: 'remediation' } : { skillId: due, source: 'due' },
            { skillId: 'count_dot', source: 'remediation' }]);
    });

    it('does not disguise unselected pending checks as ordinary Due across repeated short sets', async () => {
        const d = await setup('math', 21), island = (await d.islands.get('child'))!;
        const skills = ['count_5', 'count_dot', 'count_10'];
        await d.islands.put({ ...island, pendingMathChecks: skills.slice(0, 2).map(skillId => ({
            skillId, failedProblemId: `old-${skillId}`, failedQuestionKey: `old-${skillId}`, stage: 'independent', createdAt: 1,
        })) });
        for (const id of skills) await d.memoryMath.update(['child', id], { nextReview: id === 'count_10' ? '2001-01-01' : '2000-01-01' });
        const reviews: string[] = [];
        for (let turn = 0; turn < 8; turn++) {
            let plan = await startIslandPlan('child', d);
            expect(plan.slots).toHaveLength(3);
            reviews.push(plan.slots[0].problem.categoryId);
            const pending = (await d.islands.get('child'))!.pendingMathChecks!.map(check => check.skillId);
            expect(plan.slots.filter(slot => slot.source === 'due').some(slot => pending.includes(slot.problem.categoryId))).toBe(false);
            while (plan.status === 'active') {
                if (skills.includes(plan.slots[plan.cursor].problem.categoryId) && !plan.slots[plan.cursor].assisted) {
                    plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
                }
                plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
            }
        }
        expect(reviews.slice(0, 2)).toEqual(['count_5', 'count_10']);
        expect(new Set(reviews.slice(2, 8))).toEqual(new Set(skills));
        expect((await d.islands.get('child'))?.pendingMathChecks).toHaveLength(3);
    });
});
