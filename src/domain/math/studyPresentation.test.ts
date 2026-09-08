import { describe, expect, it } from 'vitest';
import type { Problem } from '../types';
import { createLearningProblemContext } from '../learning/context';
import { studyLearningEvidence } from '../learning/attemptContext';
import { hasStudySingleNumberInput, prepareStudyBlockPresentation, resolveStudyHissanPresentation } from './studyPresentation';

const problem = (categoryId = 'add_2d2d_nc', questionText = '23 + 14 =', correctAnswer = '37'): Problem => {
    const p: Problem = { id: 'study-question', subject: 'math', categoryId, questionText, correctAnswer,
        inputType: 'number', isReview: false };
    p.learningContext = createLearningProblemContext('math', p);
    return p;
};

describe('new Study input reservation', () => {
    it.each([
        ['add_2d2d_nc', '23 + 14 =', '37'],
        ['add_2d2d_c', '27 + 18 =', '45'],
        ['sub_2d2d', '42 - 17 =', '25'],
    ])('records the real initial written presentation of %s', (id, text, answer) => {
        const original = problem(id, text, answer), before = structuredClone(original);
        expect(original.learningContext?.representation).toBe('symbol');
        const [frozen] = prepareStudyBlockPresentation([original], true);
        expect(frozen).toMatchObject({ inputType: 'hissan', studyPresentation: { version: 1, hissan: true },
            learningContext: { inputType: 'hissan', representation: 'algorithm' } });
        // A later parent-setting fetch must not silently change this reservation.
        expect(resolveStudyHissanPresentation(frozen, false).isHissanActive).toBe(true);
        expect(studyLearningEvidence(frozen, 'independent', true, false)?.assistance).toBe('independent');
        expect(frozen.learningContext).toEqual(createLearningProblemContext('math', frozen));
        expect(original).toEqual(before);
    });

    it('keeps a new mental-mode reservation in the parent-selected mode', () => {
        const original = problem();
        const [frozen] = prepareStudyBlockPresentation([original], false);
        expect(frozen).toMatchObject({ inputType: 'number', studyPresentation: { version: 1, hissan: false },
            learningContext: { representation: 'symbol' } });
        expect(resolveStudyHissanPresentation(frozen, true)).toMatchObject({ isHissanActive: false, isHissanEligibleSkill: true });
        expect(studyLearningEvidence(frozen, 'independent', false, false)?.assistance).toBe('independent');
        expect(prepareStudyBlockPresentation([frozen], true)[0]).toBe(frozen);
    });

    it('preserves forced written skills even when the parent preference is mental mode', () => {
        const [frozen] = prepareStudyBlockPresentation([problem('add_2d1d_hissan_nc', '23 + 4 =', '27')], false);
        expect(resolveStudyHissanPresentation(frozen, false)).toMatchObject({ isHissanActive: true, isForcedHissanSkill: true });
        expect(studyLearningEvidence(frozen, 'independent', true, false)?.problem.representation).toBe('algorithm');
    });

    it('leaves saved test problems and their unknown old default-written evidence unchanged', () => {
        const saved = [problem()], before = structuredClone(saved);
        expect(prepareStudyBlockPresentation(saved, true, true)).toBe(saved);
        expect(saved).toEqual(before);
        expect(resolveStudyHissanPresentation(saved[0], true).isHissanActive).toBe(true);
        expect(resolveStudyHissanPresentation(saved[0], false).isHissanActive).toBe(false);
        expect(studyLearningEvidence(saved[0], 'independent', true, false)).toBeUndefined();
        expect(saved[0].studyPresentation).toBeUndefined();
    });

    it('keeps the numeric field and keyboard available after a written-to-mental toggle, without independent evidence', () => {
        const [frozen] = prepareStudyBlockPresentation([problem()], true);
        expect(hasStudySingleNumberInput(frozen)).toBe(true);
        expect(studyLearningEvidence(frozen, 'independent', false, true)).toBeUndefined();
        expect(studyLearningEvidence(frozen, 'independent', true, true)).toBeUndefined();
        expect(studyLearningEvidence(frozen, 'assisted', true, false)?.assistance).toBe('assisted');
    });

    it('does not manufacture provenance for missing-context fallback content or change vocabulary', () => {
        const fallback = { ...problem(), learningContext: undefined };
        expect(prepareStudyBlockPresentation([fallback], true)[0].learningContext).toBeUndefined();
        const vocab: Problem = { id: 'word', categoryId: 'apple', subject: 'vocab', inputType: 'choice',
            correctAnswer: 'りんご', isReview: false };
        expect(prepareStudyBlockPresentation([vocab], true)[0]).toBe(vocab);
        expect(hasStudySingleNumberInput(vocab)).toBe(false);
    });
});
