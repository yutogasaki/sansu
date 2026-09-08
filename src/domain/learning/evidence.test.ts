import { describe, expect, it } from 'vitest';
import { evaluateMathLevel11Pilot, reservedEventsToEvidenceRecords } from './evidence';
import type { LearningEvidenceRecord } from './evidence';
import { buildLearningPilotReport, createMathPilotScenarios } from './pilotReport';

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

    it('invalidates stale confidence after a support barrier and requires fresh independent coverage', () => {
        const records = scenarios()[5].records;
        const result = evaluate(records);
        expect(result.allUnitsRetained).toBe(false);
        expect(result.units.filter((unit) => unit.readiness === 'ready')).toHaveLength(6);
        const corrected = { ...scenarios()[4].records[0], id: 'one-correction',
            itemId: 'sub_2d2d', learningEvidence: scenarios()[4].records[23].learningEvidence,
            timestamp: '2026-09-11T10:00:01.000Z' };
        expect(evaluate([...records, corrected]).units.find((unit) => unit.unitId === 'math.subtract-two-two')?.readiness).toBe('unconfirmed');
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
});
