import { describe, expect, it } from 'vitest';
import type { Problem } from '../types';
import { createLearningProblemContext } from '../learning/context';
import { studyLearningEvidence } from '../learning/attemptContext';
import { checkAnswer } from '../../hooks/useStudySession.logic';
import { integerFractionProblem } from './fractionInput';
import { hasStudySingleNumberInput, prepareStudyBlockPresentation, resolveStudyHissanPresentation, studyDisplayedLearningEvidence } from './studyPresentation';

const problem = (categoryId = 'add_2d2d_nc', questionText = '23 + 14 =', correctAnswer = '37'): Problem => {
    const p: Problem = { id: 'study-question', subject: 'math', categoryId, questionText, correctAnswer,
        inputType: 'number', isReview: false };
    p.learningContext = createLearningProblemContext('math', p);
    return p;
};

describe('new Study input reservation', () => {
    it.each([false, true])('keeps all 20 newly reserved finish answers identifiable with written preference %s', enabled => {
        const reserved = prepareStudyBlockPresentation(Array.from({ length: 20 }, (_, i) =>
            problem('add_2d2d_c', `${27 + i} + 18 =`, String(45 + i))), enabled);
        for (const saved of reserved) {
            const resumed = resolveStudyHissanPresentation(saved, !enabled);
            expect(resumed.isHissanActive).toBe(enabled);
            expect(studyDisplayedLearningEvidence(saved, saved, 'independent', resumed.isHissanActive, false))
                .toMatchObject({ completion: 'whole-problem', assistance: 'independent', problem: saved.learningContext });
        }
    });
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

    it('reserves compact division input for new written questions', () => {
        const original = problem('div_3d1d_exact', '816 ÷ 8 =', '102');
        const [frozen] = prepareStudyBlockPresentation([original], true);
        expect(frozen).toMatchObject({ inputType: 'hissan', hissanVersion: 3,
            studyPresentation: { version: 1, hissan: true } });
        const presentation = resolveStudyHissanPresentation(frozen, false);
        expect(presentation.isHissanActive).toBe(true);
        expect(presentation.gridData?.steps.map(step => step.phase)).toEqual(['quotient', 'quotient', 'quotient']);
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

describe('Study evidence through integer fraction input', () => {
    const fraction = (answer: string[], labels = ['分子', '分母']): Problem => {
        const mixed = labels.length === 3;
        const saved: Problem = { id: 'fraction', subject: 'math', categoryId: mixed ? 'frac_mixed' : 'frac_add_same',
            questionText: mixed ? '1 1/2 + 1 1/2 =' : answer[1] === '1' ? '1/2 + 1/2 =' : '1/4 + 1/4 =',
            inputType: 'multi-number', correctAnswer: answer, isReview: false,
            inputConfig: { fields: labels.map(label => ({ label, length: 2 })) } };
        saved.learningContext = createLearningProblemContext('math', saved);
        return saved;
    };

    it.each([
        [['1', '1'], ['分子', '分母'], '1'],
        [['3', '0', '2'], ['整数', '分子', '分母'], '3'],
    ])('grades an integer display while preserving the original whole-problem evidence: %j', (answer, labels, correct) => {
        const saved = fraction(answer, labels), before = structuredClone(saved);
        const display = integerFractionProblem(saved);
        expect(checkAnswer('number', display.correctAnswer, correct, [], undefined)).toBe(true);
        expect(checkAnswer('number', display.correctAnswer, '9', [], undefined)).toBe(false);
        expect(studyDisplayedLearningEvidence(saved, display, 'independent', false, false))
            .toMatchObject({ assistance: 'independent', problem: saved.learningContext });
        expect(studyDisplayedLearningEvidence(saved, display, 'assisted', false, false)?.assistance).toBe('assisted');
        expect(saved).toEqual(before);
    });

    it('keeps ordinary fraction input and its original evidence', () => {
        const saved = fraction(['1', '2']);
        const display = integerFractionProblem(saved);
        expect(display).toBe(saved);
        expect(checkAnswer('multi-number', display.correctAnswer, '', ['1', '2'], undefined)).toBe(true);
        expect(checkAnswer('multi-number', display.correctAnswer, '', ['1', '3'], undefined)).toBe(false);
        expect(studyDisplayedLearningEvidence(saved, display, 'independent', false, false)?.problem).toEqual(saved.learningContext);
    });

    it('refuses unknown provenance, changed content and changed representation', () => {
        const saved = fraction(['1', '1']), display = integerFractionProblem(saved);
        expect(studyDisplayedLearningEvidence({ ...saved, learningContext: undefined }, display, 'independent', false, false)).toBeUndefined();
        expect(studyDisplayedLearningEvidence(saved, { ...display, correctAnswer: '2' }, 'independent', false, false)).toBeUndefined();
        expect(studyDisplayedLearningEvidence(saved, { ...display, questionText: '1/2 + 3/2 =' }, 'independent', false, false)).toBeUndefined();
        expect(studyDisplayedLearningEvidence(saved, display, 'independent', true, false)).toBeUndefined();
        expect(studyDisplayedLearningEvidence(saved, display, 'independent', false, true)).toBeUndefined();
        expect(studyDisplayedLearningEvidence({ ...saved, correctAnswer: ['2', '1'] }, display, 'independent', false, false)).toBeUndefined();
    });
});
