import { describe, expect, it } from 'vitest';
import type { Problem } from '../types';
import { integerFractionProblem, restoreFractionAnswer } from './fractionInput';
const problem = (answer: string[], labels = ['分子', '分母']): Problem => ({ id: 'saved', subject: 'math', categoryId: 'frac_add_same', questionText: '1/2 + 1/2 =', isReview: true,
    correctAnswer: answer, inputType: 'multi-number', inputConfig: { fields: labels.map(label => ({ label, length: 2 })) } });
describe('integer fraction presentation', () => {
    it('shows an integer while preserving a frozen fraction and its incorrect-answer contract', () => {
        const original = problem(['1', '1']);
        expect(integerFractionProblem(original)).toMatchObject({ correctAnswer: '1', inputType: 'number', inputConfig: undefined });
        expect(original.correctAnswer).toEqual(['1', '1']);
        expect(restoreFractionAnswer(original, '9')).toEqual(['9', '1']);
    });
    it('handles a saved mixed answer with a zero fractional part', () => {
        const original = problem(['3', '0', '1'], ['整数', '分子', '分母']);
        expect(integerFractionProblem(original).correctAnswer).toBe('3');
        expect(restoreFractionAnswer(original, '4')).toEqual(['4', '0', '1']);
    });
    it('preserves ordinary fractions, remainders and malformed legacy fields', () => {
        for (const original of [problem(['1','2']), problem(['1','1'], ['商','あまり']), problem(['3','0','0'], ['整数','分子','分母']), problem(['1','1','2'])]) {
            expect(integerFractionProblem(original)).toBe(original);
            expect(restoreFractionAnswer(original, '9')).toBe('9');
        }
        expect(integerFractionProblem(undefined)).toBeUndefined();
    });
});
