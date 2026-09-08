import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase, type AttemptLog } from '../../db';
import type { Problem } from '../types';
import { createInitialProfile } from '../user/profile';
import { openPark, startParkPlan } from '../park/repository';
import { openIsland, startIslandPlan } from '../island/repository';
import { commitParkLearning } from '../park/commit';
import { commitIslandLearning } from '../island/commit';
import type { ParkPlan } from '../park/types';
import type { IslandPlan } from '../island/types';
import { createLearningProblemContext } from './context';
import { learningBarrierForProblem, learningEvidenceForProblem } from './attemptContext';
import { readMathLevel11Pilot } from './pilotRepository';

const SUBJECT_ITEM = 'add_2d1d_nc';
const UNIT = 'math.add-two-one-no-regroup';
const BEFORE_SUPPORT = '2026-09-10T12:00:00.000Z';
const AFTER_SUPPORT = '2026-09-11T12:00:00.000Z';
const databases: SansuDatabase[] = [];
type Mode = 'park' | 'island';

function problem(a = 23): Problem {
    const p: Problem = { id: `frozen-${a}`, subject: 'math', categoryId: SUBJECT_ITEM,
        questionText: `${a} + 4 =`, correctAnswer: String(a + 4), inputType: 'number', isReview: true };
    p.learningContext = createLearningProblemContext('math', p);
    return p;
}
async function database() {
    const d = new SansuDatabase(`pilot-read-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(d);
    const p = { ...createInitialProfile('test', 2, 11, 2, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { child: p } });
    return d;
}
const record = (p: Problem, timestamp: string, profileId = 'child'): AttemptLog => ({
    profileId, subject: 'math', itemId: SUBJECT_ITEM, result: 'correct', timestamp, isReview: false,
    learningEvidence: learningEvidenceForProblem(p, 'independent'),
});
async function seedRetained(d: SansuDatabase) {
    await d.logs.bulkAdd([
        record(problem(23), '2026-09-08T09:00:00.000Z'),
        record(problem(33), '2026-09-08T09:01:00.000Z'),
        record(problem(43), '2026-09-08T09:02:00.000Z'),
        record(problem(23), '2026-09-10T10:00:00.000Z'),
    ]);
}
const snapshot = (d: SansuDatabase) => Promise.all(d.tables.map(async table => [table.name, await table.toArray()]));
const unit = (report: Awaited<ReturnType<typeof readMathLevel11Pilot>>) => report.evaluation.units.find(u => u.unitId === UNIT)!;

afterEach(async () => { vi.useRealTimers(); vi.restoreAllMocks(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('read-only persisted Lv11 pilot', () => {
    it.each<Mode>(['park', 'island'])('reads numeric %s support events as barriers after retained evidence', async mode => {
        const d = await database();
        await seedRetained(d);
        const confirmed = unit(await readMathLevel11Pilot(d, 'child', BEFORE_SUPPORT));
        expect(confirmed).toMatchObject({ readiness: 'ready', retention: 'confirmed' });
        expect(confirmed.facets[0]).toMatchObject({ independentProblemCount: 3, delayedConfirmationCount: 1 });

        if (mode === 'park') await openPark('child', d); else await openIsland('child', d);
        const plan = mode === 'park' ? await startParkPlan('child', 'bubble', d) : await startIslandPlan('child', d);
        plan.slots = [{ problem: problem(), assisted: false, completed: false, source: 'due', countsTowardReviewCap: true,
            learningEvidenceAssistance: 'independent' }];
        // This diagnostic replaces the reserved items, so its introduction
        // snapshot must describe the replacement too.
        if (mode === 'island') (plan as IslandPlan).introducedItemIds = [SUBJECT_ITEM];
        if (mode === 'park') await d.parkPlans.put(plan as ParkPlan); else await d.islandPlans.put(plan as IslandPlan);
        vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-11T10:00:00.000Z'));
        const receipt = mode === 'park'
            ? await commitParkLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)
            : await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d);
        expect(typeof receipt.event.timestamp).toBe('number');
        expect(receipt.event.learningEvidenceBarrier?.reason).toBe('support-opened');
        const beforeRead = await snapshot(d);
        // Historical reads must exclude the later persisted numeric event.
        expect(unit(await readMathLevel11Pilot(d, 'child', BEFORE_SUPPORT)).retention).toBe('confirmed');
        const afterSupport = unit(await readMathLevel11Pilot(d, 'child', AFTER_SUPPORT));
        expect(afterSupport).toMatchObject({ readiness: 'unconfirmed', retention: 'confirmed', unknownAttempts: 0, needsRecheck: true });
        expect(afterSupport.facets[0]).toMatchObject({ independentProblemCount: 0, delayedConfirmationCount: 1,
            historicalIndependentProblemCount: 3, lastDelayedConfirmationAt: '2026-09-10T10:00:00.000Z',
            lastAttemptAt: '2026-09-11T10:00:00.000Z' });
        expect(await snapshot(d)).toEqual(beforeRead);
        expect(await d.logs.count()).toBe(4);
    });

    it.each<Mode>(['park', 'island'])('uses a numeric %s assisted completion even without a separate support event', async mode => {
        const d = await database(); await seedRetained(d);
        const event = { id: 'assisted-complete', profileId: 'child', type: 'answer' as const,
            timestamp: Date.parse('2026-09-11T10:00:00.000Z'), result: 'assisted-correct' as const,
            learningEvidence: learningEvidenceForProblem(problem(), 'assisted') };
        if (mode === 'park') await d.parkEvents.add(event); else await d.islandEvents.add(event);
        const beforeRead = await snapshot(d);
        expect(unit(await readMathLevel11Pilot(d, 'child', AFTER_SUPPORT)))
            .toMatchObject({ readiness: 'unconfirmed', retention: 'confirmed', unknownAttempts: 0, needsRecheck: true });
        expect(await snapshot(d)).toEqual(beforeRead);
    });

    it('isolates profiles and namespaces equal event IDs across both modes', async () => {
        const d = await database(); await seedRetained(d);
        const foreign = { id: 'support', profileId: 'other-child', type: 'support_opened' as const,
            timestamp: Date.parse('2026-09-11T10:00:00.000Z'), learningEvidenceBarrier: learningBarrierForProblem(problem(), 'support-opened') };
        await d.parkEvents.add(foreign); await d.islandEvents.add(foreign);
        await d.logs.bulkAdd([record(problem(23), BEFORE_SUPPORT, 'other-child'), record(problem(33), BEFORE_SUPPORT, 'other-child')]);
        const own = await readMathLevel11Pilot(d, 'child', AFTER_SUPPORT);
        expect(unit(own)).toMatchObject({ readiness: 'ready', retention: 'confirmed' });
        expect(own.evaluation.duplicateRecords).toBe(0);
        const foreignReport = await readMathLevel11Pilot(d, 'other-child', AFTER_SUPPORT);
        expect(unit(foreignReport)).toMatchObject({ readiness: 'unconfirmed', retention: 'unconfirmed' });
        // The identical IDs in different event tables are separate saved actions.
        expect(foreignReport.evaluation.duplicateRecords).toBe(0);
    });

    it('keeps old log correctness separate from new evidence and never backfills old events', async () => {
        const d = await database();
        await d.logs.bulkAdd(Array.from({ length: 30 }, (_, i): AttemptLog => ({
            profileId: 'child', subject: 'math', itemId: SUBJECT_ITEM, result: 'correct', isReview: false,
            timestamp: new Date(Date.parse('2026-09-08T09:00:00.000Z') + i * 60_000).toISOString(),
        })));
        await d.parkEvents.add({ id: 'legacy-support', profileId: 'child', type: 'support_opened', timestamp: Date.parse(BEFORE_SUPPORT) });
        await d.islandEvents.add({ id: 'legacy-complete', profileId: 'child', type: 'supported_completed',
            result: 'supported-completion', timestamp: Date.parse(BEFORE_SUPPORT) });
        const beforeRead = await snapshot(d);
        const report = await readMathLevel11Pilot(d, 'child', AFTER_SUPPORT);
        expect(report.legacyLevel11Evidence).toBe(true);
        expect(report.practice.coverageReady).toBe(false);
        expect(unit(report)).toMatchObject({ readiness: 'unconfirmed', retention: 'unconfirmed', unknownAttempts: 30, facets: [] });
        expect(await snapshot(d)).toEqual(beforeRead);
    });
});
