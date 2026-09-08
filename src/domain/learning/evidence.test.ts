import { describe, expect, it } from 'vitest';
import { evaluateMathLevel11Pilot, reservedEventsToEvidenceRecords } from './evidence';
import type { LearningEvidenceRecord } from './evidence';
import { buildLearningPilotReport, createMathPilotScenarios } from './pilotReport';
import { createLearningProblemContext } from './context';
import type { Problem } from '../types';

const profile = 'synthetic-pilot';
const asOf = '2026-09-12T12:00:00.000Z';
const evaluate = (records: LearningEvidenceRecord[]) => evaluateMathLevel11Pilot(records, profile, asOf);
const scenarios = () => createMathPilotScenarios();

describe('Lv11 concept evidence pilot', () => {
    it('shows the coverage gap in the existing level-wide criterion', () => {
        const report = buildLearningPilotReport();
        expect(report.catalogErrors).toEqual([]);
        const addition = report.scenarios[0].evaluation;
        expect(addition.legacyLevel11Evidence).toBe(true);
        expect(addition.allUnitsReady).toBe(false);
        expect(addition.units.filter((unit) => unit.readiness === 'ready')).toHaveLength(1);
        expect(addition.units.find((unit) => unit.unitId === 'math.subtract-two-one-no-regroup')?.readiness).toBe('unconfirmed');
    });

    it('keeps repetitions, assisted completion and old context out of independent coverage', () => {
        const list = scenarios();
        for (const index of [1, 2, 6]) {
            expect(evaluate(list[index].records).units.every((unit) => unit.readiness === 'unconfirmed')).toBe(true);
        }
        expect(evaluate(list[1].records).units[0].facets[0].independentProblemCount).toBe(1);
        expect(evaluate(list[6].records).units[0].unknownAttempts).toBe(30);
    });

    it('separates present understanding, later retention and prerequisites', () => {
        const balanced = evaluate(scenarios()[3].records);
        const delayed = evaluate(scenarios()[4].records);
        expect(balanced.allUnitsReady).toBe(true);
        expect(balanced.allUnitsRetained).toBe(false);
        expect(delayed.allUnitsReady).toBe(true);
        expect(delayed.allUnitsRetained).toBe(true);
        expect(delayed.units.some((unit) => unit.unconfirmedPrerequisites.length > 0)).toBe(true);
        expect(delayed.units.every((unit) => unit.readyMethods.includes('symbol') && !unit.readyMethods.includes('algorithm'))).toBe(true);
    });

    it('does not equate crossing midnight or 04:00 with spaced retrieval', () => {
        const base = scenarios()[0].records.slice(0, 3).map((record, i) => ({
            ...record, timestamp: `2026-09-09T03:59:0${i}.000Z`,
        }));
        const immediate = { ...base[0], id: 'after-boundary', timestamp: '2026-09-09T04:01:00.000Z' };
        expect(evaluate([...base, immediate]).units[0].retention).toBe('unconfirmed');
        const late = { ...base[0], id: 'next-day', timestamp: '2026-09-10T04:01:00.000Z' };
        expect(evaluate([...base, late]).units[0].retention).toBe('confirmed');
    });

    it('preserves past confirmation while requiring fresh coverage only for the supported variant', () => {
        const records = scenarios()[5].records;
        const result = evaluate(records);
        expect(result.allUnitsRetained).toBe(true);
        expect(result.units.filter((unit) => unit.readiness === 'ready')).toHaveLength(6);
        const corrected = { ...scenarios()[4].records[0], id: 'one-correction',
            itemId: 'sub_2d2d', learningEvidence: scenarios()[4].records[23].learningEvidence,
            timestamp: '2026-09-12T10:00:01.000Z' };
        expect(evaluate([...records, corrected]).units.find((unit) => unit.unitId === 'math.subtract-two-two')?.readiness).toBe('unconfirmed');
        const subtraction = result.units.find(unit => unit.unitId === 'math.subtract-two-two')!;
        expect(subtraction).toMatchObject({ retention: 'confirmed', needsRecheck: true });
        expect(subtraction.facets.find(facet => facet.variant === 'no-regroup'))
            .toMatchObject({ ready: true, retained: true, needsRecheck: false });
        expect(subtraction.facets.find(facet => facet.variant === 'regroup'))
            .toMatchObject({ ready: false, retained: true, needsRecheck: true, delayedConfirmationCount: 1 });
    });

    it('requires both borrowing cases and refuses unknown variants', () => {
        const records = scenarios()[3].records;
        const noBorrowOnly = records.filter((record) => record.itemId !== 'sub_2d2d' || record.learningEvidence?.problem.variant === 'no-regroup');
        expect(evaluate(noBorrowOnly).allUnitsReady).toBe(false);
        const unknown = records.map((record) => record.itemId === 'sub_2d2d' ? {
            ...record, learningEvidence: { ...record.learningEvidence!, problem: { ...record.learningEvidence!.problem, variant: 'unknown' } },
        } : record);
        expect(evaluate(unknown).allUnitsReady).toBe(false);
    });

    it('isolates profiles, removes duplicate receipts and ignores future or invalid times', () => {
        const base = scenarios()[3].records;
        const other = base.map((record) => ({ ...record, profileId: 'other' }));
        expect(evaluate(other).allUnitsReady).toBe(false);
        const twice = evaluate([...base, ...base]);
        expect(twice.duplicateRecords).toBe(base.length);
        expect(twice.units[0].facets[0].independentAttemptCount).toBe(3);
        expect(evaluate(base.map((record) => ({ ...record, timestamp: 'invalid' }))).allUnitsReady).toBe(false);
        expect(evaluate(base.map((record) => ({ ...record, timestamp: '2099-01-01T00:00:00Z' }))).allUnitsReady).toBe(false);
    });

    it('uses explicit support events without treating observations or duplicate independent events as evidence', () => {
        const source = scenarios()[3].records[0];
        const event = { id: 'support', profileId: profile, timestamp: Date.parse(source.timestamp),
            learningEvidence: { ...source.learningEvidence!, assistance: 'assisted' as const } };
        const records = reservedEventsToEvidenceRecords([
            event,
            { ...event, id: 'independent', learningEvidence: source.learningEvidence },
            { id: 'observation', profileId: profile, timestamp: source.timestamp },
        ]);
        expect(records).toHaveLength(1);
        expect(records[0].result).toBe('barrier');
        expect(records[0].learningEvidence).toBeUndefined();
        expect(records[0].timestamp).toBe(source.timestamp);
    });

    it('never mutates the supplied answer history', () => {
        const records = scenarios()[3].records;
        const before = JSON.stringify(records);
        evaluate(records.reverse());
        expect(JSON.stringify(records.reverse())).toBe(before);
    });

    it('keeps the historical confirmation after 30 days but marks the current check overdue', () => {
        const records = scenarios()[4].records;
        const later = evaluateMathLevel11Pilot(records, profile, '2026-10-12T12:00:00.000Z');
        expect(later.allUnitsRetained).toBe(true);
        expect(later.units.every(unit => unit.freshness === 'due')).toBe(true);
        expect(later.units[0].facets[0]).toMatchObject({
            lastDelayedConfirmationAt: '2026-09-10T10:00:00.000Z',
            nextCheckAt: '2026-09-13T10:00:00.000Z', reviewStage: 2, retained: true,
        });
    });

    it('uses the last contact across representations for delayed confirmation', () => {
        const records = scenarios()[0].records.slice(0, 3);
        const bridge: Problem = { id: 'bridge', subject: 'math', categoryId: 'add_2d1d_nc_bridge',
            questionText: '21 + 3 =', correctAnswer: '24', inputType: 'number', isReview: false };
        const contact: LearningEvidenceRecord = {
            id: 'bridge-contact', profileId: profile, subject: 'math', itemId: bridge.categoryId,
            result: 'correct', timestamp: '2026-09-10T09:59:00.000Z',
            learningEvidence: { problem: createLearningProblemContext('math', bridge)!,
                assistance: 'independent', completion: 'whole-problem' },
        };
        const later = { ...records[0], id: 'later-symbol', timestamp: '2026-09-10T10:00:00.000Z' };
        const unit = evaluate([...records, contact, later]).units[0];
        expect(unit.retention).toBe('unconfirmed');
        expect(unit.facets.find(facet => facet.representation === 'symbol')?.delayedConfirmationCount).toBe(0);
    });

    it('does not clear known methods for unknown context and resolves uncertainty with identifiable independent evidence', () => {
        const records = scenarios()[4].records;
        const unknown: LearningEvidenceRecord = { ...records[0], id: 'unknown', learningEvidence: undefined,
            timestamp: '2026-09-12T10:00:00.000Z' };
        const before = evaluate([...records, unknown]).units[0];
        expect(before).toMatchObject({ readiness: 'ready', retention: 'confirmed', uncertainty: true,
            freshness: 'unconfirmed', unknownAttempts: 1 });
        expect(before.facets[0].independentProblemCount).toBe(3);
        const known = { ...records[0], id: 'known', timestamp: '2026-09-12T10:01:00.000Z' };
        expect(evaluate([...records, unknown, known]).units[0]).toMatchObject({ uncertainty: false,
            retention: 'confirmed', lastUnknownAt: '2026-09-12T10:00:00.000Z' });
    });

    it('does not grow the interval or postpone the existing deadline on early spaced practice', () => {
        const records = scenarios()[4].records.filter(record => record.itemId === 'add_2d1d_nc');
        const early = { ...records[0], id: 'early', timestamp: '2026-09-11T10:00:00.000Z' };
        const earlyFacet = evaluate([...records, early]).units[0].facets[0];
        expect(earlyFacet).toMatchObject({ reviewStage: 2, nextCheckAt: '2026-09-13T10:00:00.000Z' });
        const due = { ...records[0], id: 'due', timestamp: '2026-09-13T10:00:00.000Z' };
        const dueFacet = evaluateMathLevel11Pilot([...records, early, due], profile, '2026-09-13T12:00:00.000Z').units[0].facets[0];
        expect(dueFacet).toMatchObject({ reviewStage: 3, nextCheckAt: '2026-09-20T10:00:00.000Z' });
    });

    it('keeps same-day recovery awaiting delayed recheck and resumes at the three-day stage', () => {
        const records = scenarios()[4].records.filter(record => record.itemId === 'add_2d1d_nc');
        const failure: LearningEvidenceRecord = { ...records[0], id: 'failure', result: 'incorrect',
            timestamp: '2026-09-12T10:00:00.000Z' };
        const recovery = records.slice(0, 3).map((record, index) => ({ ...record, id: `recovery-${index}`,
            timestamp: `2026-09-12T11:00:0${index}.000Z` }));
        const history = [...records, failure, ...recovery];
        const recovered = evaluate(history).units[0];
        expect(recovered).toMatchObject({ readiness: 'ready', retention: 'confirmed', needsRecheck: true,
            freshness: 'unconfirmed', nextCheckAt: '2026-09-13T10:00:00.000Z' });
        const delayed = { ...records[0], id: 'recovered-later', timestamp: '2026-09-13T11:01:00.000Z' };
        const later = evaluateMathLevel11Pilot([...history, delayed], profile, delayed.timestamp).units[0];
        expect(later).toMatchObject({ needsRecheck: false, freshness: 'fresh' });
        expect(later.facets[0]).toMatchObject({ reviewStage: 2, nextCheckAt: '2026-09-16T11:01:00.000Z' });
    });

    it('uses the full 1/3/7/14/30-day schedule and caps later confirmations at 30 days', () => {
        const history = scenarios()[0].records.slice(0, 3);
        const checkpoints = [
            ['2026-09-09T10:01:00.000Z', 2, '2026-09-12T10:01:00.000Z'],
            ['2026-09-12T10:01:00.000Z', 3, '2026-09-19T10:01:00.000Z'],
            ['2026-09-19T10:01:00.000Z', 4, '2026-10-03T10:01:00.000Z'],
            ['2026-10-03T10:01:00.000Z', 5, '2026-11-02T10:01:00.000Z'],
            ['2026-11-02T10:01:00.000Z', 5, '2026-12-02T10:01:00.000Z'],
        ] as const;
        for (const [timestamp, reviewStage, nextCheckAt] of checkpoints) {
            history.push({ ...history[0], id: `check-${timestamp}`, timestamp });
            expect(evaluateMathLevel11Pilot(history, profile, timestamp).units[0].facets[0])
                .toMatchObject({ reviewStage, nextCheckAt, freshness: 'fresh' });
        }
    });

    it('does not erase a different method when one method fails', () => {
        const records = scenarios()[0].records.slice(0, 3);
        const algorithms = records.map((record, index) => {
            const content = JSON.parse(record.learningEvidence!.problem.problemKey);
            const problem: Problem = { id: `algorithm-${index}`, subject: 'math', categoryId: 'add_2d1d_hissan_nc',
                questionText: content.question, correctAnswer: content.answer, inputType: 'hissan', isReview: false };
            return { ...record, id: problem.id, itemId: problem.categoryId,
                learningEvidence: { ...record.learningEvidence!, problem: createLearningProblemContext('math', problem)! } };
        });
        const failure: LearningEvidenceRecord = { ...records[0], id: 'symbol-fail', result: 'incorrect',
            timestamp: '2026-09-11T10:00:00.000Z' };
        const unit = evaluate([...records, ...algorithms, failure]).units[0];
        expect(unit.readyMethods).toEqual(['algorithm']);
        expect(unit.facets.find(facet => facet.representation === 'algorithm')?.independentProblemCount).toBe(3);
    });
});
