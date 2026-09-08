import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase, SANSU_V5_STORES } from '../../db';
import { createInitialProfile } from '../user/profile';
import { deleteProfileOwnedIndexedDbRows } from '../user/repository';
import { MATH_GENERATORS, generateMathProblem } from '../math';
import { getLevelForSkill } from '../math/curriculum';
import { getLearningDayStart } from '../../utils/learningDay';
import { createPark, editPark } from './course';
import { simulateCourse } from './simulation';
import { gradeParkAnswer, parkHissanGrid, planParkLearning } from './learning';
import { openPark, startParkPlan, saveParkEdit, recordParkVisit, parkTables, ParkConflict } from './repository';
import { commitParkLearning } from './commit';
import type { LearningSlot, ParkPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
const profile = (id = 'child') => ({ ...createInitialProfile('test', 2, 8, 1, 'math'), id, soundEnabled: false });
const setup = async () => {
    const database = new SansuDatabase(`park-test-${crypto.randomUUID()}`, options);
    databases.push(database);
    const p = profile();
    await database.profiles.put(p);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
    await openPark(p.id, database);
    return database;
};
const correctAction = (plan: ParkPlan) => {
    const slot = plan.slots[plan.cursor];
    const grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
};
const finish = async (database: SansuDatabase, plan: ParkPlan) => {
    let next = plan;
    while (next.status === 'active') next = (await commitParkLearning(next.profileId, next.id, next.revision, correctAction(next), database)).plan;
    return next;
};
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('free deterministic toy rules', () => {
    it('skips the gate after a strong trampoline, but carries and pops a bubble when it comes first', () => {
        const skipped = simulateCourse(['slide', 'trampoline', 'bubble']);
        expect(skipped.find(b => b.action === 'jump')).toMatchObject({ skipped: 2, bubble: false });
        expect(skipped.some(b => b.action === 'bubble')).toBe(false);
        const carried = simulateCourse(['slide', 'bubble', 'trampoline']);
        expect(carried.find(b => b.action === 'jump')).toMatchObject({ bubble: true, popped: true, to: 3 });
        expect(carried.at(-1)).toMatchObject({ action: 'finish', bubble: false });
    });
    it('mat changes the jump, bell only rings on the ground, paint changes later bubbles, and chains terminate', () => {
        expect(simulateCourse(['slide', 'mat', 'trampoline']).some(b => b.action === 'hop')).toBe(true);
        expect(simulateCourse(['slide', 'trampoline', 'bell']).some(b => b.action === 'bell')).toBe(false);
        expect(simulateCourse(['paint', 'bubble', 'bell']).at(-1)).toMatchObject({ pink: true, bubble: true, bubblePink: true });
        expect(simulateCourse(['slide', 'trampoline', 'bubble', 'trampoline', 'bell', 'mat']).filter(b => b.action === 'jump')).toHaveLength(1);
    });
    it('moves physical parts without duplication and requires explicit cross-course transfer', () => {
        let p = editPark(createPark('a', 0), { type: 'place', courseId: 'course-1', slot: 0, partId: 'starter-trampoline' });
        expect(p.courses[0].slots).toEqual(['starter-trampoline', 'starter-slide', null]);
        p = editPark(p, { type: 'add-course' });
        expect(() => editPark(p, { type: 'place', courseId: 'course-2', slot: 0, partId: 'starter-slide' })).toThrow();
        const moved = editPark(p, { type: 'place', courseId: 'course-2', slot: 0, partId: 'starter-slide', fromCourseId: 'course-1' });
        expect(moved.parts).toHaveLength(2);
        expect(moved.courses[0].slots[1]).toBeNull();
        expect(p.courses[0].slots[1]).toBe('starter-slide');
    });
});

describe('reserved learning and atomic rewards', () => {
    it('does not replan across reload, part selection, or changed curriculum and reserves without writing learning', async () => {
        const d = await setup();
        const initial = await d.appData.get('app');
        const first = await startParkPlan('child', 'bubble', d);
        await expect(startParkPlan('child', 'bell', d)).resolves.toEqual(first);
        await expect(d.logs.count()).resolves.toBe(0);
        await expect(d.appData.get('app')).resolves.toEqual(initial);
        d.close(); await d.open();
        await expect(startParkPlan('child', 'mat', d)).resolves.toEqual(first);
    });
    it('serializes two tab answers and grants exactly one reward with the final log', async () => {
        const d = await setup();
        let plan = await startParkPlan('child', 'bubble', d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        const second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const action = correctAction(plan);
            await Promise.all([commitParkLearning('child', plan.id, plan.revision, action, d), commitParkLearning('child', plan.id, plan.revision, action, second)]);
            await commitParkLearning('child', plan.id, plan.revision, action, d);
            expect((await d.parks.get('child'))?.parts.filter(p => p.id === plan.rewardId)).toHaveLength(1);
            expect((await d.parkPlans.get(plan.id))?.status).toBe('completed');
            expect(await d.logs.count()).toBe(plan.slots.length);
            expect(await d.parkEvents.where('type').equals('plan_completed').count()).toBe(1);
        } finally { second.close(); }
    });
    it('rolls back the last answer, memory, cursor and inventory when the reward event cannot be saved', async () => {
        const d = await setup();
        let plan = await startParkPlan('child', 'bubble', d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        const before = { park: await d.parks.get('child'), profile: await d.appData.get('app'), logs: await d.logs.toArray(), memory: await d.memoryMath.toArray() };
        const fail = (_key: unknown, event: { type: string }) => { if (event.type === 'plan_completed') throw new Error('disk failure'); };
        d.parkEvents.hook('creating', fail);
        await expect(commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toThrow('disk failure');
        d.parkEvents.hook('creating').unsubscribe(fail);
        expect({ park: await d.parks.get('child'), profile: await d.appData.get('app'), logs: await d.logs.toArray(), memory: await d.memoryMath.toArray() }).toEqual(before);
        await expect(d.parkPlans.get(plan.id)).resolves.toEqual(plan);
        await finish(d, plan);
        expect((await d.parks.get('child'))?.parts).toHaveLength(3);
    });
    it('keeps support sticky through reload and grants a part without inventing independent correct logs', async () => {
        const d = await setup();
        let plan = await startParkPlan('child', 'bubble', d);
        const wrong = await commitParkLearning('child', plan.id, 0, { type: 'answer', answer: 'wrong' }, d);
        expect(wrong.plan.cursor).toBe(0);
        expect(wrong.plan.slots[0].problem).toEqual(plan.slots[0].problem);
        plan = wrong.plan;
        while (plan.status === 'active') {
            plan = (await commitParkLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
            d.close(); await d.open();
            expect((await d.parkPlans.get(plan.id))?.slots[plan.cursor].assisted).toBe(true);
            plan = (await commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        }
        expect(await d.logs.toArray()).toEqual([expect.objectContaining({ result: 'incorrect' })]);
        for (const memory of await d.memoryMath.toArray()) {
            expect(memory.correctAnswers).toBe(0);
            expect(memory.nextReview <= getLearningDayStart().toISOString()).toBe(true);
        }
        expect((await d.parks.get('child'))?.parts).toHaveLength(3);
    });
    it('skip remains unresolved and Due, while free replay never adds learning or parts', async () => {
        const d = await setup();
        const plan = await startParkPlan('child', 'bubble', d);
        const next = (await commitParkLearning('child', plan.id, 0, { type: 'skipped' }, d)).plan;
        expect(next.cursor).toBe(0);
        expect(next.slots[0].problem).toEqual(plan.slots[0].problem);
        expect((await d.memoryMath.get(['child', plan.slots[0].problem.categoryId]))?.nextReview).toBe(getLearningDayStart().toISOString());
        const before = await d.logs.toArray();
        await recordParkVisit('child', 'replay-1', 'replay_started', 'course-1', d);
        await recordParkVisit('child', 'replay-1', 'replay_started', 'course-1', d);
        expect(await d.logs.toArray()).toEqual(before);
        expect((await d.parks.get('child'))?.parts).toHaveLength(2);
        expect(await d.parkEvents.where('type').equals('replay_started').count()).toBe(1);
    });
    it('rejects stale edits and cross-profile actions and cascades only the deleted profile', async () => {
        const d = await setup();
        const plan = await startParkPlan('child', 'bubble', d);
        await expect(saveParkEdit('child', 0, { type: 'add-course' }, d)).rejects.toBeInstanceOf(ParkConflict);
        const other = profile('other');
        const app = (await d.appData.get('app'))!;
        await d.profiles.put(other);
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        await openPark('other', d);
        await expect(commitParkLearning('child', plan.id, 0, correctAction(plan), d)).rejects.toBeInstanceOf(ParkConflict);
        await d.transaction('rw', [...parkTables(d), d.exploreRuns, d.exploreRunEvents, d.exploreDiscoveries, d.islands, d.islandPlans, d.islandEvents], async () => { await deleteProfileOwnedIndexedDbRows(d, 'child'); });
        expect(await d.parks.get('child')).toBeUndefined();
        expect(await d.parkPlans.count()).toBe(0);
        expect(await d.parkEvents.count()).toBe(0);
        expect(await d.parks.get('other')).toBeDefined();
    });
    it('upgrades v5 additively without changing legacy rows or checkpoints', async () => {
        const name = `park-migration-${crypto.randomUUID()}`;
        const legacy = new Dexie(name, options);
        legacy.version(5).stores(SANSU_V5_STORES);
        const p = profile();
        const run = { runId: 'legacy', profileId: p.id, status: 'active', activeCheckpoint: { revision: 4, payload: 'untouched' } };
        await legacy.table('profiles').put(p);
        await legacy.table('exploreRuns').put(run);
        legacy.close();
        const d = new SansuDatabase(name, options); databases.push(d);
        await d.open();
        expect(d.verno).toBe(7);
        await expect(d.profiles.get(p.id)).resolves.toEqual(p);
        await expect(d.exploreRuns.get('legacy')).resolves.toEqual(run);
        expect(await d.parks.count()).toBe(0);
    });
    it('uses existing vocabulary progression only after independent answers', async () => {
        const d = await setup();
        const app = (await d.appData.get('app'))!;
        const p = { ...app.profiles.child, subjectMode: 'vocab' as const,
            vocabLevels: [{ level: 1, unlocked: true, enabled: true, recentAnswersNonReview: Array(19).fill(true) }] };
        await d.profiles.put(p);
        await d.appData.put({ ...app, profiles: { child: p } });
        let plan = await startParkPlan('child', 'bubble', d);
        plan = (await commitParkLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
        plan = (await commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        expect((await d.profiles.get('child'))?.vocabMaxUnlocked).toBe(1);
        expect(await d.logs.count()).toBe(0);
        await commitParkLearning('child', plan.id, plan.revision, correctAction(plan), d);
        expect((await d.profiles.get('child'))?.vocabMaxUnlocked).toBe(2);
        expect((await d.profiles.get('child'))?.vocabMainLevel).toBe(1);
    });
});

describe('full input compatibility, separate from child usability validation', () => {
    it.each(Object.keys(MATH_GENERATORS))('%s keeps the generated problem, answer arity and grading', skill => {
        const p = profile();
        const level = getLevelForSkill(skill)!;
        p.mathMainLevel = level; p.mathMaxUnlocked = level;
        p.mathLevels = p.mathLevels?.map(state => ({
            ...state, unlocked: state.level <= level, enabled: state.level <= level,
        }));
        const problem = { ...generateMathProblem(skill, { profile: p }), id: skill, subject: 'math' as const, isReview: false };
        const slot: LearningSlot = { problem, source: 'due', assisted: false, completed: false, countsTowardReviewCap: true };
        const grid = parkHissanGrid(problem);
        expect(gradeParkAnswer(slot, grid ? grid.steps[0].correctValues : problem.correctAnswer).correct).toBe(true);
        if (problem.inputType === 'multi-number') expect(problem.inputConfig?.fields).toHaveLength(problem.correctAnswer.length);
        if (problem.inputType === 'choice') expect(problem.inputConfig?.choices?.some(c => c.value === problem.correctAnswer)).toBe(true);
        const memory = { id: skill, nextReview: '2000-01-01', strength: 2, totalAnswers: 10, correctAnswers: 8, incorrectAnswers: 2, skippedAnswers: 0, updatedAt: '2000-01-01', status: 'active' as const };
        const reserved = planParkLearning(p, [memory], [], [], 0, `coverage:${skill}`, Date.now());
        expect(reserved.slots[0].problem.categoryId).toBe(skill);
    });
    it('respects vocabulary and mixed subject schedules independently of game choices', () => {
        const p = { ...profile(), subjectMode: 'mix' as const };
        expect(planParkLearning(p, [], [], [], 0, 'seq0', Date.now()).subject).toBe('math');
        const english = planParkLearning(p, [], [], [], 1, 'seq1', Date.now());
        expect(english.subject).toBe('vocab');
        for (const slot of english.slots) {
            expect(slot.problem.inputType).toBe('choice');
            expect(slot.problem.inputConfig?.choices).toHaveLength(4);
        }
    });
    it('keeps legacy Park Due order unless the caller opts into an Island review cursor', () => {
        const p = { ...profile(), subjectMode: 'vocab' as const, vocabMainLevel: 2, vocabMaxUnlocked: 2,
            vocabLevels: profile().vocabLevels?.map(level => level.level <= 2 ? { ...level, unlocked: true, enabled: true } : level) };
        const memory = ['apple', 'orange'].map((id, index) => ({ id, strength: 2, totalAnswers: 10,
            correctAnswers: 8, incorrectAnswers: 2, skippedAnswers: 0, isWeak: false,
            nextReview: index ? '2001-01-01' : '2000-01-01', updatedAt: '2000-01-01' }));
        const legacy = planParkLearning(p, [], memory, [], 0, 'park-compatibility', Date.now());
        const rotated = planParkLearning(p, [], memory, [], 0, 'park-compatibility', Date.now(), { vocabDueAfterId: 'apple' });
        expect(legacy.slots[0].problem.categoryId).toBe('apple');
        expect(rotated.slots[0].problem.categoryId).toBe('orange');
        expect(planParkLearning(p, [], memory, [], 0, 'park-compatibility', Date.now(), { vocabDueAfterId: 'gone' })
            .slots[0].problem.categoryId).toBe('apple');
    });
});
