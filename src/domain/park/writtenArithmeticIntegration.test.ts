import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { generateMathProblem } from '../math';
import { getLevelForSkill } from '../math/curriculum';
import { generateHissanGrid } from '../math/hissanEngine';
import { generateWrittenArithmeticGrid } from '../math/writtenArithmetic';
import { createInitialProfile } from '../user/profile';
import type { MemoryState, Problem } from '../types';
import { commitParkLearning } from './commit';
import { gradeParkAnswer, parkHissanGrid, planParkLearning } from './learning';
import { openPark, startParkPlan } from './repository';
import type { LearningSlot } from './types';

const now = new Date('2026-09-07T12:00:00+09:00').getTime();
const profile = (skill: string, enabled = true) => {
    const level = getLevelForSkill(skill)!;
    return { ...createInitialProfile('test', 4, level - 1, 1, 'math'), id: 'child', hissanModeEnabled: enabled };
};
const memory = (skill: string): MemoryState => ({
    id: skill, nextReview: '2000-01-01', strength: 2, totalAnswers: 10, correctAnswers: 8,
    incorrectAnswers: 2, skippedAnswers: 0, updatedAt: '2000-01-01', status: 'active',
});
const reserve = (skill: string, enabled = true) => planParkLearning(
    profile(skill, enabled), [memory(skill)], [], [], 0, `written:${skill}`, now,
).slots[0];
const slotFor = (problem: Problem): LearningSlot => ({
    problem, source: 'main', assisted: false, completed: false, countsTowardReviewCap: false,
});
const multiplication = (): Problem => ({
    id: 'written-multiplication', subject: 'math', categoryId: 'mul_2d2d',
    questionText: '23 × 14 =', correctAnswer: '322', inputType: 'hissan', isReview: false,
});
const databases: SansuDatabase[] = [];
afterEach(async () => {
    for (const database of databases.splice(0)) { database.close(); await database.delete(); }
});

const setup = async (problem: Problem) => {
    const database = new SansuDatabase(`written-integration-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(database);
    const child = profile(problem.categoryId);
    await database.profiles.put(child);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: child.id, profiles: { child } });
    await openPark(child.id, database);
    const plan = await startParkPlan(child.id, 'bubble', database);
    plan.slots = [slotFor(problem)];
    await database.parkPlans.put(plan);
    return { database, plan };
};

describe('reserved written arithmetic layouts', () => {
    it.each(['mul_2d1d', 'mul_3d1d', 'mul_2d2d', 'mul_3d2d', 'div_2d1d_exact',
        'div_3d1d_exact', 'div_2d2d_exact', 'div_3d2d_exact', 'div_rem_q1', 'div_rem_q2'])(
        'reserves %s in the new layout and preserves original answer meaning', skill => {
            const slot = reserve(skill);
            expect(slot.problem.categoryId).toBe(skill);
            expect(slot.problem.inputType).toBe('hissan');
            expect(slot.problem.hissanVersion).toBe(2);
            const grid = parkHissanGrid(slot.problem)!;
            expect(grid).toEqual(generateWrittenArithmeticGrid(slot.problem.questionText!, slot.problem.correctAnswer));
            expect(grid).not.toBeNull();
            for (const [index, step] of grid.steps.entries()) {
                expect(gradeParkAnswer({ ...slot, hissanStep: index }, step.correctValues))
                    .toMatchObject({ correct: true, final: index === grid.steps.length - 1 });
            }
            if (skill.startsWith('div_rem')) {
                expect(slot.problem.correctAnswer).toHaveLength(2);
                expect(slot.problem.inputConfig?.fields).toHaveLength(2);
                expect(gradeParkAnswer(slot, (slot.problem.correctAnswer as string[]).join('')).correct).toBe(false);
            }
        },
    );

    it.each(['mul_2d2d', 'div_3d2d_exact', 'div_rem_q1', 'div_rem_q2'])(
        'keeps mental input enabled for %s when written mode is off', skill => {
            const slot = reserve(skill, false);
            expect(slot.problem.categoryId).toBe(skill);
            expect(slot.problem.hissanVersion).toBeUndefined();
            expect(slot.problem.inputType).toBe(skill.startsWith('div_rem') ? 'multi-number' : 'number');
            expect(parkHissanGrid(slot.problem)).toBeNull();
            expect(gradeParkAnswer(slot, slot.problem.correctAnswer)).toMatchObject({ correct: true, final: true });
        },
    );

    it('leaves fraction fields and choice inputs on their original representation', () => {
        for (const skill of ['frac_add_same', 'frac_mixed', 'dec_compare']) {
            const original = generateMathProblem(skill, { profile: profile(skill) });
            const reserved = reserve(skill).problem;
            expect(reserved.categoryId).toBe(skill);
            expect(reserved.inputType).toBe(original.inputType);
            expect(reserved.hissanVersion).toBeUndefined();
            expect(parkHissanGrid(reserved)).toBeNull();
            expect(reserved.inputConfig?.fields?.length).toBe(original.inputConfig?.fields?.length);
        }
        expect(parkHissanGrid({ ...multiplication(), inputType: 'choice', hissanVersion: 2 })).toBeNull();
    });

    it.each(['add_2d2d_c', 'sub_3d3d', 'dec_mul_int', 'dec_div_int', 'dec_mul_dec', 'dec_div_dec'])(
        'keeps %s on its existing normalized layout', skill => {
            const problem = reserve(skill).problem;
            expect(problem.inputType).toBe('hissan');
            expect(problem.hissanVersion).toBeUndefined();
            expect(parkHissanGrid(problem)).toEqual(generateHissanGrid(skill, problem.questionText!, problem.correctAnswer as string));
        },
    );

    it('never upgrades the coordinates of an unversioned saved multiplication', () => {
        const problem = multiplication();
        const oldGrid = generateHissanGrid(problem.categoryId, problem.questionText!, problem.correctAnswer as string)!;
        expect(parkHissanGrid(JSON.parse(JSON.stringify(problem)))).toEqual(oldGrid);
        expect(parkHissanGrid({ ...problem, hissanVersion: 2 })).not.toEqual(oldGrid);
    });

    it('keeps decimal skills legacy even when a generated decimal normalizes to an integer', () => {
        let integerExampleCount = 0;
        for (let seed = 0; seed < 80; seed += 1) {
            const slot = planParkLearning(profile('dec_mul_int'), [memory('dec_mul_int')], [], [],
                0, `decimal-integer:${seed}`, now).slots[0];
            expect(slot.problem.categoryId).toBe('dec_mul_int');
            if (!slot.problem.questionText?.includes('.')) integerExampleCount += 1;
            expect(slot.problem.hissanVersion).toBeUndefined();
            expect(parkHissanGrid(slot.problem)?.writtenLayout).toBeUndefined();
        }
        expect(integerExampleCount).toBeGreaterThan(0);
    });

    it('resumes persisted v2 work and writes one independent answer only at the final step', async () => {
        const problem = { ...multiplication(), hissanVersion: 2 as const };
        const { database, plan } = await setup(problem);
        const grid = parkHissanGrid(problem)!;
        expect(grid.steps.length).toBeGreaterThan(1);
        let current = (await commitParkLearning('child', plan.id, plan.revision,
            { type: 'answer', answer: grid.steps[0].correctValues }, database)).plan;
        expect(current.cursor).toBe(0);
        expect(current.slots[0].hissanStep).toBe(1);
        const savedValues = current.slots[0].hissanValues;
        expect(savedValues).toBeDefined();
        expect(await database.logs.count()).toBe(0);
        expect(await database.memoryMath.count()).toBe(0);
        database.close();
        await database.open();
        expect(await startParkPlan('child', 'bell', database)).toEqual(current);
        expect(parkHissanGrid(current.slots[0].problem)).toEqual(grid);
        while (current.status === 'active') {
            const step = grid.steps[current.slots[0].hissanStep!];
            const action = { type: 'answer' as const, answer: step.correctValues };
            const revision = current.revision;
            current = (await commitParkLearning('child', plan.id, revision, action, database)).plan;
            await commitParkLearning('child', plan.id, revision, action, database);
            expect(current.slots[0].hissanValues).toMatchObject(savedValues!);
            expect(await database.logs.count()).toBe(current.status === 'completed' ? 1 : 0);
        }
        expect((await database.logs.toArray()).map(log => log.result)).toEqual(['correct']);
        expect((await database.parks.get('child'))?.parts.filter(part => part.id === plan.rewardId)).toHaveLength(1);
    });

    it('keeps completed steps and assistance through an incorrect answer and reload', async () => {
        const problem: Problem = { id: 'remainder', subject: 'math', categoryId: 'div_rem_q2',
            questionText: '785 ÷ 6 =', correctAnswer: ['130', '5'], inputType: 'hissan', hissanVersion: 2, isReview: false };
        const { database, plan } = await setup(problem);
        const grid = parkHissanGrid(problem)!;
        let current = (await commitParkLearning('child', plan.id, plan.revision,
            { type: 'answer', answer: grid.steps[0].correctValues }, database)).plan;
        const savedValues = current.slots[0].hissanValues;
        current = (await commitParkLearning('child', plan.id, current.revision, { type: 'support_opened' }, database)).plan;
        current = (await commitParkLearning('child', plan.id, current.revision, { type: 'answer', answer: ['wrong'] }, database)).plan;
        expect(current.slots[0]).toMatchObject({ assisted: true, hissanStep: 1, hissanValues: savedValues });
        database.close();
        await database.open();
        current = await startParkPlan('child', 'bell', database);
        while (current.status === 'active') {
            const step = grid.steps[current.slots[0].hissanStep!];
            current = (await commitParkLearning('child', plan.id, current.revision, { type: 'answer', answer: step.correctValues }, database)).plan;
        }
        expect(await database.logs.count()).toBe(0);
        expect((await database.memoryMath.get(['child', problem.categoryId]))?.totalAnswers).toBe(0);
        expect(current.slots[0].assisted).toBe(true);
    });
});
