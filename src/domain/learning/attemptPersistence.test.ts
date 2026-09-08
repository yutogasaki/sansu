import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import type { Problem } from '../types';
import { createInitialProfile } from '../user/profile';
import { createLearningProblemContext } from './context';
import * as contextHelpers from './context';
import { learningBarrierForProblem, learningEvidenceForProblem, studyLearningEvidence } from './attemptContext';
import { getLearningAttemptTransactionTables, writeLearningAttemptInTransaction } from '../learningAttemptWriter';
import { openPark, startParkPlan } from '../park/repository';
import { openIsland, startIslandPlan } from '../island/repository';
import { commitParkLearning } from '../park/commit';
import { commitIslandLearning } from '../island/commit';
import { parkHissanGrid, planParkLearning } from '../park/learning';
import type { ParkLearningAction, ParkPlan } from '../park/types';
import type { IslandPlan } from '../island/types';
import { generateMathProblem } from '../math';
import { generateVocabProblem } from '../english/generator';
import { createSeededRandom } from '../../utils/random';

const databases: SansuDatabase[] = [];
const makeDatabase = async (subject: Problem['subject'] = 'math') => {
    const d = new SansuDatabase(`learning-evidence-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 11, 2, subject), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    return d;
};
const arithmetic = (written = false): Problem => {
    const problem: Problem = { id: 'frozen-question', subject: 'math',
        categoryId: written ? 'add_2d2d_c' : 'add_2d1d_nc',
        questionText: written ? '27 + 18 =' : '23 + 4 =', correctAnswer: written ? '45' : '27',
        inputType: written ? 'hissan' : 'number', isReview: true };
    problem.learningContext = createLearningProblemContext('math', problem);
    return problem;
};
type Mode = 'park' | 'island';
async function setup(mode: Mode, problem = arithmetic()) {
    const d = await makeDatabase(problem.subject);
    if (mode === 'park') await openPark('child', d); else await openIsland('child', d);
    const plan = mode === 'park' ? await startParkPlan('child', 'bubble', d) : await startIslandPlan('child', d);
    plan.slots = [{ problem, assisted: false, completed: false, source: 'due', countsTowardReviewCap: true,
        learningEvidenceAssistance: 'independent' }];
    if (mode === 'park') await d.parkPlans.put(plan as ParkPlan); else {
        (plan as IslandPlan).introducedItemIds = [problem.categoryId];
        await d.islandPlans.put(plan as IslandPlan);
    }
    return { d, plan };
}
const act = (mode: Mode, d: SansuDatabase, plan: ParkPlan | IslandPlan, action: ParkLearningAction) => mode === 'park'
    ? commitParkLearning('child', plan.id, plan.revision, action, d)
    : commitIslandLearning('child', plan.id, plan.revision, action, d);
const correctAction = (plan: ParkPlan | IslandPlan): ParkLearningAction => {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer', answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
};
afterEach(async () => { vi.restoreAllMocks(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('new learning evidence persistence', () => {
    it('attaches deterministic contexts without another random draw', () => {
        for (const subject of ['math', 'vocab'] as const) {
            const random = vi.fn(createSeededRandom('evidence-seed'));
            const generate = (source: typeof random) => subject === 'math' ? generateMathProblem('add_2d1d_nc', { random: source })
                : generateVocabProblem('apple', { random: source });
            const problem = generate(random), calls = random.mock.calls.length;
            expect(problem.learningContext).toEqual(createLearningProblemContext(subject, problem));
            expect(random).toHaveBeenCalledTimes(calls);
            expect(problem.learningContext).toMatchObject({ subject, itemId: problem.categoryId });
            const withoutContext = vi.spyOn(contextHelpers, 'createLearningProblemContext').mockReturnValue(undefined);
            const baselineRandom = vi.fn(createSeededRandom('evidence-seed'));
            const baseline = generate(baselineRandom);
            withoutContext.mockRestore();
            expect({ ...problem, learningContext: undefined }).toEqual(baseline);
            expect(baselineRandom).toHaveBeenCalledTimes(calls);
        }
    });

    it('freezes the actual written representation after new-plan mode selection', () => {
        const p = { ...createInitialProfile('test', 2, 11, 2, 'math'), mathMainLevel: 11, mathMaxUnlocked: 11,
            hissanModeEnabled: true, mathSkills: {} };
        p.mathLevels = p.mathLevels?.map(level => ({ ...level, enabled: level.level === 11, unlocked: level.level <= 11 }));
        const plan = planParkLearning(p, [], [], [], 0, 'written-evidence', Date.now());
        expect(plan.slots.some(slot => slot.problem.inputType === 'hissan')).toBe(true);
        for (const slot of plan.slots) {
            expect(slot.learningEvidenceAssistance).toBe('independent');
            expect(slot.problem.learningContext).toEqual(createLearningProblemContext('math', slot.problem));
            if (slot.problem.inputType === 'hissan') expect(slot.problem.learningContext?.representation).toBe('algorithm');
        }
    });

    it('validates optional evidence and commits it inside the existing learning transaction', async () => {
        const d = await makeDatabase(), problem = arithmetic();
        const write = (evidence = learningEvidenceForProblem(problem, 'independent')) => d.transaction('rw',
            getLearningAttemptTransactionTables(d), async () => writeLearningAttemptInTransaction(d, {
                profileId: 'child', subject: 'math', itemId: problem.categoryId, result: 'correct',
                isReview: true, isMaintenanceCheck: false, timestamp: '2026-09-08T03:00:00.000Z', learningEvidence: evidence,
            }));
        const first = await write();
        expect((await d.logs.get(first.logId))?.learningEvidence).toEqual(learningEvidenceForProblem(problem, 'independent'));
        expect((await d.memoryMath.get(['child', problem.categoryId]))?.correctAnswers).toBe(1);
        const mismatched = learningEvidenceForProblem(problem, 'independent')!;
        mismatched.problem.itemId = 'apple';
        const second = await write(mismatched);
        expect((await d.logs.get(second.logId))?.learningEvidence).toBeUndefined();
        expect((await d.memoryMath.get(['child', problem.categoryId]))?.correctAnswers).toBe(2);
        const fail = vi.spyOn(d.memoryMath, 'put').mockRejectedValueOnce(new Error('disk full'));
        await expect(write()).rejects.toThrow('disk full');
        fail.mockRestore();
        expect(await d.logs.count()).toBe(2);
        expect((await d.memoryMath.get(['child', problem.categoryId]))?.correctAnswers).toBe(2);
    });

    it.each<Mode>(['park', 'island'])('%s retains independent evidence exactly once on receipt replay', async mode => {
        const { d, plan } = await setup(mode), action = correctAction(plan);
        const [first, replay] = await Promise.all([act(mode, d, plan, action), act(mode, d, plan, action)]);
        expect(replay.event).toEqual(first.event);
        expect(await d.logs.count()).toBe(1);
        expect((await d.logs.toArray())[0].learningEvidence).toMatchObject({ assistance: 'independent', completion: 'whole-problem' });
        expect(first.event.learningEvidence).toBeUndefined();
        expect((await d.memoryMath.get(['child', plan.slots[0].problem.categoryId]))?.correctAnswers).toBe(1);
    });

    it.each<Mode>(['park', 'island'])('%s records vocabulary recognition without inferring an audio skill', async mode => {
        const problem: Problem = { ...generateVocabProblem('apple', { random: createSeededRandom('apple') }),
            id: 'frozen-apple', subject: 'vocab', isReview: true };
        const { d, plan } = await setup(mode, problem);
        await act(mode, d, plan, correctAction(plan));
        expect((await d.logs.toArray())[0].learningEvidence).toMatchObject({ assistance: 'independent',
            problem: { subject: 'vocab', itemId: 'apple', representation: 'recognition' } });
    });

    it.each<Mode>(['park', 'island'])('%s rolls back the learning evidence, memory and slot with a failed receipt', async mode => {
        const { d, plan } = await setup(mode);
        const events = mode === 'park' ? d.parkEvents : d.islandEvents;
        const fail = vi.spyOn(events, 'add').mockRejectedValueOnce(new Error('receipt failure'));
        await expect(act(mode, d, plan, correctAction(plan))).rejects.toThrow('receipt failure');
        fail.mockRestore();
        expect(await d.logs.count()).toBe(0);
        expect(await d.memoryMath.get(['child', plan.slots[0].problem.categoryId])).toBeUndefined();
        const saved = mode === 'park' ? await d.parkPlans.get(plan.id) : await d.islandPlans.get(plan.id);
        expect(saved).toEqual(plan);
        await act(mode, d, plan, correctAction(plan));
        expect((await d.logs.toArray())[0].learningEvidence?.assistance).toBe('independent');
    });

    it.each<Mode>(['park', 'island'])('%s preserves correction history across reload without changing SRS outcomes', async mode => {
        const { d, plan } = await setup(mode);
        const wrong = await act(mode, d, plan, { type: 'answer', answer: 'wrong' });
        expect(wrong.plan.slots[0]).toMatchObject({ assisted: false, learningEvidenceAssistance: 'assisted' });
        d.close(); await d.open();
        const resumed = mode === 'park' ? await startParkPlan('child', 'bell', d) : await startIslandPlan('child', d);
        await act(mode, d, resumed, correctAction(resumed));
        const logs = await d.logs.toArray();
        expect(logs.map(log => [log.result, log.learningEvidence?.assistance])).toEqual([
            ['incorrect', 'independent'], ['correct', 'assisted'],
        ]);
        expect((await d.memoryMath.get(['child', plan.slots[0].problem.categoryId]))?.correctAnswers).toBe(1);
    });

    it.each<Mode>(['park', 'island'])('%s records a support barrier and assisted completion without a fabricated SRS answer', async mode => {
        const { d, plan } = await setup(mode);
        const hint = await act(mode, d, plan, { type: 'support_opened' });
        expect(hint.event.learningEvidenceBarrier).toMatchObject({ reason: 'support-opened', problem: plan.slots[0].problem.learningContext });
        expect(hint.event.learningEvidence).toBeUndefined();
        const done = await act(mode, d, hint.plan, correctAction(hint.plan));
        expect(done.event.learningEvidence).toMatchObject({ assistance: 'assisted', completion: 'whole-problem' });
        expect(done.event.learningLogId).toBeUndefined();
        expect(await d.logs.count()).toBe(0);
        expect((await d.memoryMath.get(['child', plan.slots[0].problem.categoryId]))?.correctAnswers).toBe(0);
    });

    it.each<Mode>(['park', 'island'])('%s does not count partial written work as a whole answer', async mode => {
        const { d, plan } = await setup(mode, arithmetic(true));
        const wrong = await act(mode, d, plan, { type: 'answer', answer: ['wrong'] });
        expect(wrong.event.learningEvidenceBarrier?.reason).toBe('error-correction');
        expect((await d.logs.toArray())[0].learningEvidence).toBeUndefined();
        let next = wrong.plan;
        while (next.status === 'active') {
            const receipt = await act(mode, d, next, correctAction(next));
            if (receipt.plan.status === 'active') expect(receipt.event.learningLogId).toBeUndefined();
            next = receipt.plan;
        }
        const logs = await d.logs.toArray();
        expect(logs).toHaveLength(2);
        expect(logs[1].learningEvidence).toMatchObject({ assistance: 'assisted', problem: { representation: 'algorithm' } });
    });

    it.each<Mode>(['park', 'island'])('%s resumes a legacy pending problem without filling in context or independent evidence', async mode => {
        const problem = arithmetic(); delete problem.learningContext;
        const { d, plan } = await setup(mode, problem);
        delete plan.slots[0].learningEvidenceAssistance;
        if (mode === 'park') await d.parkPlans.put(plan as ParkPlan); else await d.islandPlans.put(plan as IslandPlan);
        d.close(); await d.open();
        const resumed = mode === 'park' ? await startParkPlan('child', 'bell', d) : await startIslandPlan('child', d);
        expect(resumed.slots[0].problem).toEqual(problem);
        await act(mode, d, resumed, correctAction(resumed));
        expect((await d.logs.toArray())[0].learningEvidence).toBeUndefined();
    });

    it.each<Mode>(['park', 'island'])('%s keeps missing support provenance unknown even when a context exists', async mode => {
        const { d, plan } = await setup(mode);
        delete plan.slots[0].learningEvidenceAssistance;
        if (mode === 'park') await d.parkPlans.put(plan as ParkPlan); else await d.islandPlans.put(plan as IslandPlan);
        await act(mode, d, plan, correctAction(plan));
        expect((await d.logs.toArray())[0].learningEvidence?.assistance).toBe('unknown');
    });

    it('preserves a supported model completion as a barrier without claiming an answer', async () => {
        const { d, plan } = await setup('island');
        const hint = await act('island', d, plan, { type: 'support_opened' });
        const model = await commitIslandLearning('child', plan.id, hint.plan.revision, { type: 'model_opened' }, d);
        const done = await commitIslandLearning('child', plan.id, model.plan.revision, { type: 'supported_completed' }, d);
        expect(done.event.result).toBe('supported-completion');
        expect(done.event.learningEvidence?.assistance).toBe('assisted');
        expect(await d.logs.count()).toBe(0);
    });

    it('requires known Study presentation and explicit support facts', () => {
        const problem = arithmetic();
        expect(studyLearningEvidence(problem, 'independent', false, false)?.assistance).toBe('independent');
        expect(studyLearningEvidence(problem, 'assisted', false, false)?.assistance).toBe('assisted');
        expect(studyLearningEvidence(problem, 'independent', true, false)).toBeUndefined();
        expect(studyLearningEvidence(problem, 'independent', false, true)).toBeUndefined();
        expect(studyLearningEvidence(arithmetic(true), 'assisted', true, false)?.assistance).toBe('assisted');
        expect(learningEvidenceForProblem({ ...problem, learningContext: undefined }, 'independent')).toBeUndefined();
        expect(learningEvidenceForProblem({ ...problem, categoryId: 'apple' }, 'independent')).toBeUndefined();
        expect(learningBarrierForProblem({ ...problem, categoryId: 'apple' }, 'support-opened')).toBeUndefined();
    });

    it.each<Partial<Problem>>([
        { questionText: '33 + 4 =', correctAnswer: '37' },
        { correctAnswer: '28' },
        { inputType: 'hissan' },
    ])('rejects valid old context when the actual reserved content changes: %j', changed => {
        const original = arithmetic();
        const stale = { ...original, ...changed };
        expect(learningEvidenceForProblem(original, 'independent')).toBeDefined();
        expect(learningEvidenceForProblem(stale, 'independent')).toBeUndefined();
        expect(learningBarrierForProblem(stale, 'support-opened')).toBeUndefined();
        expect(stale.learningContext).toEqual(original.learningContext);
    });
});
