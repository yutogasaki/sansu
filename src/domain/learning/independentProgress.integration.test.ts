import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase, type AttemptLog } from '../../db';
import type { MemoryState, Problem } from '../types';
import { createInitialProfile } from '../user/profile';
import { getLearningAttemptTransactionTables, writeLearningAttemptInTransaction, type LearningAttemptWriteInput } from '../learningAttemptWriter';
import { openIsland, startIslandPlan } from '../island/repository';
import { commitIslandLearning } from '../island/commit';
import { planParkLearning } from '../park/learning';
import { createLearningProblemContext } from './context';
import { learningEvidenceForProblem, studyLearningEvidence } from './attemptContext';
import { prepareStudyBlockPresentation, resolveStudyHissanPresentation } from '../math/studyPresentation';

const databases: SansuDatabase[] = [];
const timestamp = '2026-09-08T03:00:00.000Z';
const problem = (): Problem => {
    const value: Problem = { id: 'original', subject: 'math', categoryId: 'add_2d1d_nc',
        questionText: '23 + 4 =', correctAnswer: '27', inputType: 'number', isReview: false };
    value.learningContext = createLearningProblemContext('math', value);
    return value;
};
const evidence = (assistance: 'independent' | 'assisted' | 'unknown' = 'independent') => learningEvidenceForProblem(problem(), assistance);
const setup = async () => {
    const database = new SansuDatabase(`independent-progress-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(database);
    const profile = { ...createInitialProfile('test', 2, 10, 2, 'math'), id: 'child', hissanModeEnabled: false };
    await database.profiles.put(profile);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    return database;
};
const write = (database: SansuDatabase, overrides: Partial<LearningAttemptWriteInput> = {}) => database.transaction('rw',
    getLearningAttemptTransactionTables(database), async () => writeLearningAttemptInTransaction(database, {
        profileId: 'child', subject: 'math', itemId: problem().categoryId, result: 'correct',
        timestamp, isReview: false, isMaintenanceCheck: false, learningEvidence: evidence(), ...overrides,
    }));
const memory = (overrides: Partial<MemoryState> = {}): MemoryState => ({
    profileId: 'child', id: problem().categoryId, strength: 5, status: 'retired',
    totalAnswers: 60, correctAnswers: 60, incorrectAnswers: 0, skippedAnswers: 0,
    lastCorrectAt: '2026-08-01T03:00:00.000Z', updatedAt: '2026-08-01T03:00:00.000Z',
    nextReview: '2026-09-01T03:00:00.000Z', ...overrides,
});
afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const database of databases.splice(0)) { database.close(); await database.delete(); }
});

describe('independent progress through the learning writer', () => {
    it.each(['written', 'mental', 'corrected', 'toggled', 'legacy', 'partial'] as const)(
        'counts only a whole independent Study answer with the actual %s presentation', async mode => {
            const database = await setup();
            const [reserved] = prepareStudyBlockPresentation([problem()], mode !== 'mental', mode === 'legacy');
            const presentation = resolveStudyHissanPresentation(reserved, mode !== 'mental');
            const learningEvidence = mode === 'partial' ? learningEvidenceForProblem(reserved, 'independent', false)
                : studyLearningEvidence(reserved, mode === 'corrected' ? 'assisted' : 'independent',
                    mode === 'toggled' ? false : presentation.isHissanActive, mode === 'toggled');
            const receipt = await write(database, { learningEvidence });
            const expectedIndependent = mode === 'written' || mode === 'mental' ? 1 : 0;
            expect(receipt.memory).toMatchObject({ correctAnswers: 1, independentCorrectAnswers: expectedIndependent });
            expect(receipt.profile?.mathLevels?.find(level => level.level === 11)?.recentIndependentAnswersNonReview)
                .toEqual(expectedIndependent ? [true] : mode === 'corrected' ? [false] : undefined);
            const saved = await database.logs.get(receipt.logId);
            if (expectedIndependent) expect(saved?.learningEvidence?.problem.representation).toBe(mode === 'written' ? 'algorithm' : 'symbol');
            else if (mode === 'corrected') expect(saved?.learningEvidence?.assistance).toBe('assisted');
            else expect(saved?.learningEvidence).toBeUndefined();
        },
    );

    it('keeps raw correction successes but only adds matching independent whole answers to progress', async () => {
        const database = await setup();
        await write(database, { result: 'incorrect' });
        const corrected = await write(database, { learningEvidence: evidence('assisted') });
        expect(corrected.memory).toMatchObject({ totalAnswers: 2, correctAnswers: 1, incorrectAnswers: 1,
            independentCorrectAnswers: 0, strength: 1, needsRelearning: true });
        expect(corrected.memory.lastIndependentCorrectAt).toBeUndefined();
        await write(database, { learningEvidence: evidence('unknown') });
        await write(database, { learningEvidence: learningEvidenceForProblem(problem(), 'independent', false) });
        const independent = await write(database);
        expect(independent.memory).toMatchObject({ totalAnswers: 5, correctAnswers: 4, incorrectAnswers: 1,
            independentCorrectAnswers: 1, lastIndependentCorrectAt: timestamp });
        expect(independent.profile?.mathLevels?.find(level => level.level === 11)).toMatchObject({
            recentAnswersNonReview: [false, true, true, true, true],
            recentIndependentAnswersNonReview: [false, false, true],
        });
        expect((await database.logs.toArray()).map(log => log.learningEvidence?.assistance))
            .toEqual(['independent', 'assisted', 'unknown', undefined, 'independent']);
        expect((await database.profiles.get('child'))?.mathSkills[problem().categoryId]).toEqual(independent.memory);
        expect((await database.appData.get('app'))?.profiles.child.mathSkills[problem().categoryId]).toEqual(independent.memory);
    });

    it('rejects mismatched and partial metadata without erasing real raw successes', async () => {
        const database = await setup();
        const wrongItem = evidence()!;
        wrongItem.problem.itemId = 'add_2d1d_c';
        const partial = { ...evidence()!, completion: 'partial' } as unknown as NonNullable<LearningAttemptWriteInput['learningEvidence']>;
        for (const learningEvidence of [undefined, wrongItem, partial]) await write(database, { learningEvidence });
        expect(await database.memoryMath.get(['child', problem().categoryId])).toMatchObject({
            correctAnswers: 3, independentCorrectAnswers: 0, strength: 1,
        });
        expect((await database.logs.toArray()).every(log => log.learningEvidence === undefined)).toBe(true);
    });

    it('seeds a missing independent counter only from matching explicit historical logs', async () => {
        const database = await setup();
        await database.memoryMath.put(memory({ correctAnswers: 100, totalAnswers: 100 }));
        const historical = (overrides: Partial<AttemptLog> = {}): AttemptLog => ({
            profileId: 'child', subject: 'math', itemId: problem().categoryId, result: 'correct',
            timestamp: '2026-08-01T03:00:00.000Z', learningEvidence: evidence(), ...overrides,
        });
        await database.logs.bulkAdd([
            historical(), historical(), historical({ learningEvidence: undefined }),
            historical({ learningEvidence: evidence('unknown') }), historical({ learningEvidence: evidence('assisted') }),
            historical({ skipped: true }), historical({ result: 'incorrect' }),
            historical({ itemId: 'add_2d1d_c' }), historical({ profileId: 'other-child' }),
        ]);
        const before = await database.logs.toArray();
        const seeded = await write(database, { learningEvidence: undefined });
        expect(seeded.memory).toMatchObject({ correctAnswers: 101, independentCorrectAnswers: 2 });
        expect(seeded.memory.lastIndependentCorrectAt).toBeUndefined();
        expect((await database.logs.toArray()).slice(0, before.length)).toEqual(before);
        const next = await write(database);
        expect(next.memory.independentCorrectAnswers).toBe(3);
        expect(await database.memoryMath.get(['other-child', problem().categoryId])).toBeUndefined();
    });

    it('respects an explicit zero independent count instead of reseeding it from old logs', async () => {
        const database = await setup();
        await database.memoryMath.put(memory({ independentCorrectAnswers: 0 }));
        await database.logs.add({ profileId: 'child', subject: 'math', itemId: problem().categoryId,
            result: 'correct', timestamp: '2026-08-01T03:00:00.000Z', learningEvidence: evidence() });
        expect((await write(database)).memory.independentCorrectAnswers).toBe(1);
    });

    it('rolls back the independent count, raw log and profile together before a retry', async () => {
        const database = await setup();
        const before = await database.appData.get('app');
        const failure = vi.spyOn(database.memoryMath, 'put').mockRejectedValueOnce(new Error('memory write failed'));
        await expect(write(database)).rejects.toThrow('memory write failed');
        failure.mockRestore();
        expect(await database.logs.count()).toBe(0);
        expect(await database.memoryMath.count()).toBe(0);
        expect(await database.appData.get('app')).toEqual(before);
        const retry = await write(database);
        expect(retry.memory).toMatchObject({ totalAnswers: 1, correctAnswers: 1, independentCorrectAnswers: 1 });
        expect(await database.logs.count()).toBe(1);
    });

    it('preserves graduation through support, same-day independent recovery and the next dated ordinary review', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(timestamp));
        const database = await setup();
        await database.memoryMath.put(memory());
        await openIsland('child', database);
        const reserved = await startIslandPlan('child', database);
        reserved.slots = [{ problem: problem(), assisted: false, completed: false, source: 'maintenance',
            countsTowardReviewCap: true, learningEvidenceAssistance: 'independent' }];
        reserved.introducedItemIds = [];
        await database.islandPlans.put(reserved);
        const support = await commitIslandLearning('child', reserved.id, reserved.revision, { type: 'support_opened' }, database);
        const replay = await commitIslandLearning('child', reserved.id, reserved.revision, { type: 'support_opened' }, database);
        expect(replay.event).toEqual(support.event);
        const supported = (await database.memoryMath.get(['child', problem().categoryId]))!;
        expect(supported).toMatchObject({ status: 'retired', totalAnswers: 60, correctAnswers: 60, needsRelearning: true, strength: 1 });
        expect(await database.logs.count()).toBe(0);
        const profile = (await database.appData.get('app'))!.profiles.child;
        const plan = planParkLearning(profile, [supported], [], [], 0, 'ordinary-after-support', Date.now(),
            { standardCount: 3, complexCount: 3 });
        expect(plan.slots[0]).toMatchObject({ source: 'due', problem: { categoryId: supported.id, isReview: true } });
        const recovered = await write(database, { timestamp: new Date(Date.now() + 60_000).toISOString(), isReview: true });
        expect(recovered.memory).toMatchObject({ status: 'retired', strength: 1, needsRelearning: true, independentCorrectAnswers: 1 });
        expect(Date.parse(recovered.memory.nextReview) - Date.parse(recovered.memory.updatedAt)).toBe(24 * 60 * 60 * 1000);
        const confirmed = await write(database, { timestamp: recovered.memory.nextReview, isReview: true });
        expect(confirmed.memory).toMatchObject({ status: 'retired', strength: 2, needsRelearning: false, independentCorrectAnswers: 2 });
        const nextReview = planParkLearning(confirmed.profile!, [confirmed.memory], [], [], 1, 'ordinary-after-recovery',
            Date.parse(confirmed.memory.nextReview), { standardCount: 3, complexCount: 3 });
        expect(nextReview.slots[0]).toMatchObject({ source: 'due', problem: { categoryId: supported.id, isReview: true } });
        expect(confirmed.profile?.mathMainLevel).toBe(profile.mathMainLevel);
        expect(confirmed.profile?.mathMaxUnlocked).toBe(profile.mathMaxUnlocked);
    });
});
