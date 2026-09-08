import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import type { Problem } from '../types';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import { auditIslandObservations, islandObservationBinding, type IslandObservationInput } from './learningObservation';
import { createIslandLearningObserver } from '../../components/island/useIslandLearningObservation';
import type { IslandLearningAction, IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
const arithmetic: Problem = { id: 'frozen-question', subject: 'math', categoryId: 'add_2d1d_nc',
    questionText: '23 + 4 =', correctAnswer: '27', inputType: 'number', isReview: true };
const vocab: Problem = { ...arithmetic, subject: 'vocab', categoryId: 'apple', questionText: 'apple', correctAnswer: 'apple',
    displayAnswer: 'りんご', inputType: 'choice' };
const written: Problem = { ...arithmetic, categoryId: 'mul_2d2d', questionText: '23 × 14 =', correctAnswer: '322', inputType: 'hissan', hissanVersion: 2 };
const newDatabase = () => { const d = new SansuDatabase(`island-observation-${crypto.randomUUID()}`, options); databases.push(d); return d; };
async function setup(problem = arithmetic) {
    const d = newDatabase();
    const profile = { ...createInitialProfile('test', 2, 11, 2, problem.subject), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await (problem.subject === 'math' ? d.memoryMath : d.memoryVocab).put({ id: problem.categoryId, profileId: 'child',
        strength: 4, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0,
        nextReview: '2000-01-01', updatedAt: '2026-01-01', status: 'active' });
    await openIsland('child', d);
    const plan = await startIslandPlan('child', d);
    // Public planner and native fake IDB are used first; a fixed one-question
    // fixture isolates actual row/final/growth writes without random questions.
    plan.slots = [{ problem: structuredClone(problem), assisted: false, completed: false, source: 'due', countsTowardReviewCap: true }];
    plan.introducedItemIds = [problem.categoryId];
    await d.islandPlans.put(plan);
    return { d, plan };
}
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function cloneDatabase(d: SansuDatabase) {
    const next = newDatabase();
    for (const [name, rows] of Object.entries(await snapshot(d))) if (rows.length) await next.table(name).bulkPut(rows);
    return next;
}
async function withoutObservation(d: SansuDatabase) {
    const saved = await snapshot(d);
    for (const event of saved.islandEvents) delete event.observation;
    return saved;
}
function metadata(plan: IslandPlan, extra: Partial<IslandObservationInput> = {}): IslandObservationInput {
    return { version: 1, adapterVersion: 'island-dom-v1', binding: islandObservationBinding(plan), eventAt: Date.now(),
        presentation: { id: 'actual-presentation', documentId: 'test-document', observedAt: Date.now() - 100,
            inputVersion: 'island-input-v1', inputMode: plan.slots[plan.cursor].problem.inputType, referenceVisual: 'unknown' },
        elapsedSincePresentationMs: 100, ...extra };
}
const act = (d: SansuDatabase, plan: IslandPlan, action: IslandLearningAction, input?: unknown) =>
    commitIslandLearning('child', plan.id, plan.revision, action, d, input);
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-08T12:00:00+09:00')); });
afterEach(async () => { vi.useRealTimers(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('Island observation preserves the existing transaction and clocks', () => {
    it.each([arithmetic, vocab, written])('leaves every store identical apart from optional envelopes for $inputType actual wrong/correct answers', async problem => {
        const { d, plan: initial } = await setup(problem), baseline = await cloneDatabase(d);
        let plan = initial;
        const grid = parkHissanGrid(problem);
        const actions: IslandLearningAction[] = [{ type: 'answer', answer: grid ? ['wrong'] : 'wrong' },
            ...(grid ? grid.steps.map(step => ({ type: 'answer' as const, answer: step.correctValues }))
                : [{ type: 'answer' as const, answer: problem.correctAnswer }])];
        for (const action of actions) {
            const observed = await act(d, plan, action, metadata(plan));
            const legacyCall = await act(baseline, plan, action);
            expect(observed.plan).toEqual(legacyCall.plan);
            expect(await withoutObservation(d)).toEqual(await withoutObservation(baseline));
            plan = observed.plan;
        }
        const answerEvents = await d.islandEvents.where('type').equals('answer').toArray();
        expect(answerEvents.filter(event => event.observation?.wholeCompleted)).toHaveLength(1);
        expect(answerEvents[0].observation).toMatchObject({ problemId: problem.id, revisionBefore: 0,
            supportBefore: 'unassisted-slot', wholeCompleted: false, answerScope: grid ? 'hissan-step' : 'whole' });
        if (grid) {
            expect(answerEvents.filter(event => event.observation?.answerScope === 'hissan-step')).toHaveLength(grid.steps.length + 1);
            expect((await d.logs.toArray()).map(log => log.result)).toEqual(['incorrect', 'correct']);
        }
        expect(auditIslandObservations(answerEvents, [plan]).rows.some(row => row.priorIncorrect === 'recorded')).toBe(true);
        expect((await d.islandEvents.where('type').equals('plan_completed').first())?.observation).toBeUndefined();
    });

    it.each([arithmetic, vocab, written])('keeps $inputType support requests, real DOM observations and supported completion separate', async problem => {
        const { d, plan: initial } = await setup(problem), baseline = await cloneDatabase(d);
        let plan = initial;
        if (problem === written) {
            const action = { type: 'answer' as const, answer: parkHissanGrid(problem)!.steps[0].correctValues };
            const next = await act(d, plan, action, metadata(plan)); await act(baseline, plan, action); plan = next.plan;
        }
        const savedCells = structuredClone(plan.slots[0].hissanValues);
        const actions: IslandLearningAction[] = [{ type: 'skipped' }, { type: 'model_opened' }, { type: 'supported_completed' }];
        for (const [index, action] of actions.entries()) {
            const context = metadata(plan, index === 0 ? {} : { observedSupport: index === 1 ? { hintAt: Date.now() - 40 } : { modelAt: Date.now() - 20 } });
            const next = await act(d, plan, action, context); await act(baseline, plan, action);
            expect(await withoutObservation(d)).toEqual(await withoutObservation(baseline));
            expect(next.event.observation).toMatchObject({ answerScope: 'not-an-answer', wholeCompleted: index === 2,
                supportBefore: ['unassisted-slot', 'hint', 'model'][index] });
            expect(next.event.observation!.stepIndexBefore).toBe(problem === written ? 1 : undefined);
            if (index === 0) expect(next.event.observation!.observedSupport).toBeUndefined();
            if (index === 2) expect(next.event.learningLogId).toBeUndefined();
            plan = next.plan;
        }
        expect(plan.slots[0].hissanValues).toEqual(savedCells);
        expect((await d.logs.toArray()).map(log => log.result)).toEqual(['skipped']);
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(0);
        expect((await d.islands.get('child'))?.growth?.pendingAnswers?.garden).toBe(1);
    });

    it.each([undefined, false, { version: 77 }, { version: 1, adapterVersion: 'island-dom-v1', eventAt: NaN },
        { version: 1, adapterVersion: 'island-dom-v1', binding: {}, eventAt: 1 }])('commits a valid answer with optional malformed/missing observation %j', async input => {
        const { d, plan } = await setup();
        const result = await act(d, plan, { type: 'answer', answer: '27' }, input);
        expect(result.plan.status).toBe('completed');
        expect(result.event.observation).toMatchObject({ answerScope: 'whole', wholeCompleted: true, coverage: 'unknown' });
        expect(await d.logs.count()).toBe(1);
    });

    it('derives partial row, wrong result and stage guards from the actual slot despite invented metadata', async () => {
        const { d, plan } = await setup(written);
        const next = await act(d, plan, { type: 'answer', answer: parkHissanGrid(written)!.steps[0].correctValues }, {
            ...metadata(plan), problemId: 'invented', revisionBefore: 500, wholeCompleted: true,
            answerScope: 'whole', supportBefore: 'model', stepIndexBefore: 99,
        });
        expect(next.event.observation).toMatchObject({ problemId: written.id, revisionBefore: 0, wholeCompleted: false,
            answerScope: 'hissan-step', supportBefore: 'unassisted-slot', stepIndexBefore: 0 });
        expect(next.plan.cursor).toBe(0); expect(await d.logs.count()).toBe(0);
        const before = await snapshot(d);
        await expect(act(d, next.plan, { type: 'model_opened' }, { ...metadata(next.plan), supportBefore: 'hint' })).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
        const wrong = await act(d, next.plan, { type: 'answer', answer: ['wrong'] }, {
            ...metadata(next.plan), binding: { ...islandObservationBinding(next.plan), problemId: 'different' }, result: 'correct',
        });
        expect(wrong.event).toMatchObject({ result: 'incorrect', observation: { stepIndexBefore: 1, wholeCompleted: false,
            coverage: 'unknown', gaps: ['binding-mismatch'] } });
    });

    it('returns the originally saved envelope for duplicate/replayed actions and rejects different actions or ownership', async () => {
        const { d, plan } = await setup();
        const first = await act(d, plan, { type: 'answer', answer: '0' }, metadata(plan));
        const before = await snapshot(d);
        vi.setSystemTime(new Date('2026-09-09T12:00:00+09:00'));
        const replay = await act(d, plan, { type: 'answer', answer: '0' }, { version: 99 });
        expect(replay.event).toEqual(first.event);
        expect(await snapshot(d)).toEqual(before);
        await expect(act(d, plan, { type: 'answer', answer: '27' }, metadata(plan))).rejects.toBeInstanceOf(IslandConflict);
        await expect(commitIslandLearning('other', plan.id, 0, { type: 'answer', answer: '0' }, d, metadata(plan))).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });

    it('serializes two real database connections to one envelope, answer, growth and progression write', async () => {
        const { d, plan } = await setup();
        const connection = new SansuDatabase(d.name, options); await connection.open();
        try {
            const action = { type: 'answer' as const, answer: '27' };
            const [one, two] = await Promise.all([act(d, plan, action, metadata(plan)), act(connection, plan, action, metadata(plan, { eventAt: Date.now() + 20 }))]);
            expect(two.event).toEqual(one.event);
            expect(await d.islandEvents.where('type').equals('answer').count()).toBe(1);
            expect(await d.logs.count()).toBe(1);
            expect((await d.memoryMath.get(['child', arithmetic.categoryId]))?.correctAnswers).toBe(11);
            expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(0);
        expect((await d.islands.get('child'))?.growth?.pendingAnswers?.garden).toBe(1);
        } finally { connection.close(); }
    });

    it.each(['event', 'log', 'memory', 'profile', 'app', 'plan', 'island', 'reward'] as const)('rolls back all stores on a real %s write exception', async target => {
        const { d, plan } = await setup();
        const before = await snapshot(d);
        const fail = () => { throw new Error(`disk failure ${target}`); };
        const final = (_key: unknown, row: { type: string }) => { if (row.type === 'plan_completed') fail(); };
        const table = { event: d.islandEvents, log: d.logs, memory: d.memoryMath, profile: d.profiles,
            app: d.appData, plan: d.islandPlans, island: d.islands, reward: d.islandEvents }[target];
        const mode = ['event', 'log', 'reward'].includes(target) ? 'creating' : 'updating';
        const hook = target === 'reward' ? final : fail;
        table.hook(mode, hook);
        try { await expect(act(d, plan, { type: 'answer', answer: '27' }, metadata(plan))).rejects.toThrow(`disk failure ${target}`); }
        finally { table.hook(mode).unsubscribe(hook); }
        expect(await snapshot(d)).toEqual(before);
        const retry = await act(d, plan, { type: 'answer', answer: '27' }, metadata(plan));
        expect(retry.plan.status).toBe('completed');
        expect(await d.logs.count()).toBe(1);
    });

    it('keeps the first accepted snapshot on a real failed write, then uses unchanged writer time on next-day retry', async () => {
        vi.setSystemTime(new Date('2026-09-08T03:59:00+09:00'));
        const { d, plan } = await setup(), baseline = await cloneDatabase(d);
        const observer = createIslandLearningObserver({ wall: Date.now, monotonic: () => 10, id: () => 'frozen' });
        observer.observe(islandObservationBinding(plan), { problemId: arithmetic.id, inputMode: 'number', referenceVisual: 'absent', hint: false, model: false });
        const request = observer.request(islandObservationBinding(plan), { type: 'answer', answer: '27' });
        const fail = () => { throw new Error('offline disk'); }; d.islandEvents.hook('creating', fail);
        try { await expect(act(d, plan, request.action, request.observation)).rejects.toThrow('offline disk'); }
        finally { d.islandEvents.hook('creating').unsubscribe(fail); }
        vi.setSystemTime(new Date('2026-09-09T04:00:00+09:00'));
        const retry = observer.request(islandObservationBinding(plan), { type: 'answer', answer: '27' });
        expect(retry).toBe(request);
        const done = await act(d, plan, retry.action, retry.observation); await act(baseline, plan, retry.action);
        expect(done.event.observation!.eventAt).toBe(new Date('2026-09-08T03:59:00+09:00').getTime());
        expect(done.event.timestamp).toBe(Date.now());
        expect(await withoutObservation(d)).toEqual(await withoutObservation(baseline));
    });

    it.each(['2026-09-08T03:59:00+09:00', '2026-09-08T04:00:00+09:00', '2026-09-07T03:00:00+09:00'])('preserves exact existing stores at %s including a reversed event clock', async writerTime => {
        const { d, plan } = await setup(), baseline = await cloneDatabase(d);
        const captured = metadata(plan);
        vi.setSystemTime(new Date(writerTime));
        const observed = await act(d, plan, { type: 'answer', answer: '27' }, captured);
        await act(baseline, plan, { type: 'answer', answer: '27' });
        expect(await withoutObservation(d)).toEqual(await withoutObservation(baseline));
        expect(auditIslandObservations([observed.event], [observed.plan]).clockOrderUncertain).toBe(1);
    });

    it('retains a real partial Hissan step through hint/model/completion and legacy stage omission', async () => {
        for (const legacy of [false, true]) {
            const { d, plan } = await setup(written);
            const partial = await act(d, plan, { type: 'answer', answer: parkHissanGrid(written)!.steps[0].correctValues }, metadata(plan));
            const hint = await act(d, partial.plan, { type: 'support_opened' }, metadata(partial.plan));
            const model = await act(d, hint.plan, { type: 'model_opened' }, metadata(hint.plan));
            if (legacy) {
                delete model.plan.slots[0].supportStage;
                await d.islandPlans.put(model.plan);
            }
            const completed = await act(d, model.plan, { type: 'supported_completed' }, metadata(model.plan));
            for (const receipt of [hint, model, completed]) expect(receipt.event.observation).toMatchObject({
                answerScope: 'not-an-answer', stepIndexBefore: 1,
            });
            expect(completed.event.observation).toMatchObject({ wholeCompleted: true,
                supportBefore: legacy ? 'legacy-assisted-unknown-stage' : 'model' });
            expect(completed.plan.slots[0].hissanValues).toEqual(partial.plan.slots[0].hissanValues);
            expect(await d.logs.count()).toBe(0);
        }
    });

    it('preserves legacy receipts without backfill and labels a resumed legacy assisted slot with unknown stage', async () => {
        const { d, plan } = await setup(); plan.slots[0].assisted = true; plan.revision = 1;
        const saved = { id: JSON.stringify(['island-action-v1', 'child', plan.id, 0]), profileId: 'child', planId: plan.id,
            timestamp: 1, type: 'support_opened' as const, action: { type: 'support_opened' as const }, slotIndex: 0 };
        await d.islandPlans.put(plan); await d.islandEvents.add(saved);
        expect((await commitIslandLearning('child', plan.id, 0, saved.action, d, metadata(plan))).event).toEqual(saved);
        const done = await act(d, plan, { type: 'supported_completed' }, metadata(plan));
        expect(done.event.observation).toMatchObject({ supportBefore: 'legacy-assisted-unknown-stage', answerScope: 'not-an-answer', wholeCompleted: true });
        expect(done.event.observation!.observedSupport).toBeUndefined();
        expect(await d.islandEvents.get(saved.id)).toEqual(saved);
        expect(await d.logs.count()).toBe(0);
        const audit = auditIslandObservations(await d.islandEvents.toArray(), [done.plan]);
        expect(audit.rows.find(row => row.eventId === done.event.id)?.gaps).toContain('incomplete-saved-prefix');
    });
});
