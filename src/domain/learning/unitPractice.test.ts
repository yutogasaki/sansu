import { describe, expect, it } from 'vitest';
import { evaluateMathLevel11Pilot } from './evidence';
import { createMathPilotScenarios } from './pilotReport';
import { getMathLevel11Practice } from './unitPractice';
import { MATH_CURRICULUM } from '../math/curriculum';
import type { LearningEvidenceRecord } from './evidence';
import { createLearningProblemContext } from './context';

const PROFILE = 'synthetic-pilot';
const AS_OF = '2026-09-12T12:00:00.000Z';
const evaluate = (records: readonly LearningEvidenceRecord[], asOf = AS_OF) => evaluateMathLevel11Pilot(records, PROFILE, asOf);
const practice = (records: readonly LearningEvidenceRecord[], asOf = AS_OF) => getMathLevel11Practice(evaluate(records, asOf));

describe('Lv11 practice and coverage hints', () => {
    it('targets existing unsatisfied methods without making planned prerequisites a gate', () => {
        const empty = practice([]);
        expect(empty.coverageReady).toBe(false);
        expect(empty.missingUnitIds).toHaveLength(7);
        expect(empty.priorities.every(unit => unit.priority === 'unconfirmed')).toBe(true);
        expect(empty.priorities.flatMap(unit => unit.itemIds).sort()).toEqual([...MATH_CURRICULUM[11]].sort());
        expect(empty.priorities[0].preferredItemIds).toEqual(['add_2d1d_nc']);
        const balanced = evaluate(createMathPilotScenarios()[3].records);
        expect(balanced.units.every(unit => unit.unconfirmedPrerequisites.includes('math.place-value-tens'))).toBe(true);
        expect(getMathLevel11Practice(balanced).coverageReady).toBe(true);
    });

    it('does not promote addition-only, identical repeated equations, or an incomplete evaluation', () => {
        const scenarios = createMathPilotScenarios();
        expect(practice(scenarios[0].records).missingUnitIds).toHaveLength(6);
        expect(practice(scenarios[1].records).missingUnitIds).toHaveLength(7);
        const incomplete = { ...evaluate(scenarios[3].records), units: [] };
        expect(getMathLevel11Practice(incomplete).coverageReady).toBe(false);
    });

    it('targets the missing borrowing variant without discarding the known variant', () => {
        const records = createMathPilotScenarios()[3].records.filter(record =>
            record.itemId !== 'sub_2d2d' || record.learningEvidence?.problem.variant === 'no-regroup');
        const result = practice(records, '2026-09-08T12:00:00.000Z');
        expect(result.missingUnitIds).toEqual(['math.subtract-two-two']);
        expect(result.priorities[0]).toMatchObject({ unitId: 'math.subtract-two-two',
            preferredItemIds: ['sub_2d2d'], preferredVariants: ['regroup'], priority: 'unconfirmed' });
    });

    it('keeps historical confirmation out of the current coverage guard after support', () => {
        const evaluation = evaluate(createMathPilotScenarios()[5].records);
        expect(evaluation.allUnitsRetained).toBe(true);
        const result = getMathLevel11Practice(evaluation);
        expect(result.coverageReady).toBe(false);
        expect(result.priorities[0]).toMatchObject({ unitId: 'math.subtract-two-two',
            priority: 'recheck', preferredVariants: ['regroup'] });
    });

    it('ranks overdue practice and unresolved unknown context without inferring lost historical learning', () => {
        const records = createMathPilotScenarios()[4].records;
        const later = evaluate(records, '2026-10-12T12:00:00.000Z');
        const due = getMathLevel11Practice(later);
        expect(due.coverageReady).toBe(true);
        expect(due.priorities.every(unit => unit.priority === 'due')).toBe(true);
        const unknown = { ...records[0], id: 'unknown', learningEvidence: undefined,
            timestamp: '2026-09-12T11:00:00.000Z' };
        const uncertain = practice([...records, unknown]);
        expect(uncertain.coverageReady).toBe(false);
        expect(uncertain.missingUnitIds).toEqual(['math.add-two-one-no-regroup']);
        expect(uncertain.priorities[0].priority).toBe('recheck');
    });

    it('leaves input snapshots unchanged', () => {
        const evaluation = evaluate(createMathPilotScenarios()[5].records);
        const before = structuredClone(evaluation);
        getMathLevel11Practice(evaluation);
        expect(evaluation).toEqual(before);
    });

    it('recognizes actual written evidence for convertible IDs without a dedicated algorithm mapping', () => {
        const records = createMathPilotScenarios()[3].records.filter(record =>
            ['add_2d2d_nc', 'add_2d2d_c', 'sub_2d2d'].includes(record.itemId)).map(record => {
            const content = JSON.parse(record.learningEvidence!.problem.problemKey);
            const problem = { categoryId: record.itemId, questionText: content.question,
                correctAnswer: content.answer, inputType: 'hissan' as const };
            return { ...record, learningEvidence: { ...record.learningEvidence!,
                problem: createLearningProblemContext('math', problem)! } };
        });
        const result = practice(records, '2026-09-08T12:00:00.000Z');
        for (const itemId of ['add_2d2d_nc', 'add_2d2d_c', 'sub_2d2d']) {
            const target = result.priorities.find(unit => unit.itemIds.includes(itemId))!;
            expect(target).toMatchObject({ priority: 'practice', preferredItemIds: [itemId] });
            expect(target.targets.every(facet => facet.representation === 'algorithm')).toBe(true);
            expect(result.missingUnitIds).not.toContain(target.unitId);
        }
        const missingRegroup = practice(records.filter(record => record.learningEvidence.problem.variant !== 'regroup'),
            '2026-09-08T12:00:00.000Z').priorities.find(unit => unit.unitId === 'math.subtract-two-two')!;
        expect(missingRegroup).toMatchObject({ priority: 'unconfirmed', preferredItemIds: ['sub_2d2d'], preferredVariants: ['regroup'] });
        expect(missingRegroup.targets.every(facet => facet.representation === 'algorithm')).toBe(true);
    });
});
