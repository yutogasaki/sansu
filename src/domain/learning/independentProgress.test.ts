import { describe, expect, it } from 'vitest';
import type { AttemptLog } from '../../db';
import type { Problem } from '../types';
import type { LearningEvidenceContext } from './types';
import { createLearningProblemContext } from './context';
import { learningEvidenceForProblem } from './attemptContext';
import { hasKnownWholeAttempt, independentCorrectCount, isIndependentCorrect } from './independentProgress';

const problem: Problem = { id: 'question', subject: 'math', categoryId: 'add_2d1d_nc',
    questionText: '23 + 4 =', correctAnswer: '27', inputType: 'number', isReview: false };
problem.learningContext = createLearningProblemContext('math', problem);
const log = (overrides: Partial<AttemptLog> = {}): AttemptLog => ({
    profileId: 'child', subject: 'math', itemId: problem.categoryId, result: 'correct',
    timestamp: '2026-09-08T03:00:00.000Z', learningEvidence: learningEvidenceForProblem(problem, 'independent'),
    ...overrides,
});

describe('independent progress evidence', () => {
    it.each([0, 1, 30])('reads the explicit independent count %i', independentCorrectAnswers => {
        expect(independentCorrectCount({ independentCorrectAnswers })).toBe(independentCorrectAnswers);
    });

    it.each([undefined, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('does not infer a count from %s', value => {
        expect(independentCorrectCount({ independentCorrectAnswers: value })).toBe(0);
    });

    it('keeps old raw successes and missing memory unconfirmed', () => {
        expect(independentCorrectCount(undefined)).toBe(0);
        const legacy = { correctAnswers: 100, totalAnswers: 100, independentCorrectAnswers: undefined };
        expect(independentCorrectCount(legacy)).toBe(0);
        expect(isIndependentCorrect(log({ learningEvidence: undefined }))).toBe(false);
        expect(hasKnownWholeAttempt(log({ learningEvidence: undefined }))).toBe(false);
    });

    it('accepts only a matching independent whole-problem success', () => {
        expect(isIndependentCorrect(log())).toBe(true);
        expect(hasKnownWholeAttempt(log())).toBe(true);
        expect(isIndependentCorrect(log({ result: 'incorrect' }))).toBe(false);
        expect(isIndependentCorrect(log({ result: 'skipped' }))).toBe(false);
        expect(isIndependentCorrect(log({ skipped: true }))).toBe(false);
    });

    it('keeps an assisted whole answer in the known window as a non-independent result', () => {
        const correction = log({ learningEvidence: learningEvidenceForProblem(problem, 'assisted') });
        expect(hasKnownWholeAttempt(correction)).toBe(true);
        expect(isIndependentCorrect(correction)).toBe(false);
    });

    it.each(['unknown', 'partial', 'wrong-item', 'wrong-version', 'changed-content'])('excludes %s evidence', kind => {
        const evidence = learningEvidenceForProblem(problem, 'independent')!;
        if (kind === 'unknown') evidence.assistance = 'unknown';
        if (kind === 'partial') (evidence as unknown as { completion: string }).completion = 'partial';
        if (kind === 'wrong-item') evidence.problem.itemId = 'add_2d1d_c';
        if (kind === 'wrong-version') (evidence.problem as unknown as { catalogVersion: string }).catalogVersion = 'future';
        if (kind === 'changed-content') evidence.problem.problemKey = 'not-json';
        const invalid = log({ learningEvidence: evidence as LearningEvidenceContext });
        expect(hasKnownWholeAttempt(invalid)).toBe(false);
        expect(isIndependentCorrect(invalid)).toBe(false);
    });
});
