import 'fake-indexeddb/auto';
import { afterEach, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getLevelForSkill, getSkillsForLevel } from '../math/curriculum';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from '../island/commit';
import { openIsland, startIslandPlan } from '../island/repository';
import type { IslandPlan } from '../island/types';
import { terminalFacts } from './repository';

let database: SansuDatabase;
afterEach(async () => { vi.restoreAllMocks(); await database?.delete(); });
it('uses the whole written-problem completion time and includes model completion without changing mastery', async () => {
    database = new SansuDatabase(`life-learning-${crypto.randomUUID()}`);
    const profile = { ...createInitialProfile('test', 2, getLevelForSkill('mul_2d2d')! - 1, 1, 'math'), id: 'child' };
    await database.profiles.put(profile);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { child: profile } });
    await database.memoryMath.bulkPut(getSkillsForLevel(profile.mathMainLevel).map(id => ({ id, profileId: profile.id,
        strength: 4, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0,
        updatedAt: '2026-01-01', nextReview: '2099-01-01', status: 'active' as const })));
    await openIsland(profile.id, database);
    const answer = async (plan: IslandPlan) => {
        const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
        return (await commitIslandLearning(profile.id, plan.id, plan.revision,
            { type: 'answer', answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer }, database)).plan;
    };
    let first = await startIslandPlan(profile.id, database);
    while (first.status === 'active') first = await answer(first);
    await database.memoryMath.update([profile.id, 'mul_2d2d'], { nextReview: '2000-01-01' });
    let plan = await startIslandPlan(profile.id, database);
    expect(plan.slots[0].problem.categoryId).toBe('mul_2d2d');
    const tick = Date.now() + 1000, now = vi.spyOn(Date, 'now').mockReturnValue(tick);
    const id = JSON.stringify([profile.id, plan.id, 0]);
    plan = await answer(plan);
    expect(plan.cursor).toBe(0);
    expect((await terminalFacts(profile.id, database)).some(f => f.id === id)).toBe(false);
    now.mockReturnValue(tick + 60_000);
    while (plan.cursor === 0) plan = await answer(plan);
    expect((await terminalFacts(profile.id, database)).find(f => f.id === id)?.at).toBe(tick + 60_000);
    for (const type of ['support_opened', 'model_opened', 'supported_completed'] as const)
        plan = (await commitIslandLearning(profile.id, plan.id, plan.revision, { type }, database)).plan;
    const before = await database.memoryMath.toArray();
    expect((await terminalFacts(profile.id, database)).some(f => f.id === JSON.stringify([profile.id, plan.id, 1]))).toBe(true);
    expect(await terminalFacts('other', database)).toEqual([]);
    expect(await database.memoryMath.toArray()).toEqual(before);
});
