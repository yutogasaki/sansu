import { describe, expect, it } from 'vitest';
import type { Problem } from '../../domain/types';
import { islandLearningGuidance } from './learningGuidance';

const problem = (questionText: string, correctAnswer: string): Problem => ({ id: 'reserved', categoryId: 'add_1d_2', subject: 'math', inputType: 'number', questionText, correctAnswer, isReview: false });
describe('island worked guidance', () => {
    it('explains making ten with the actual addends and no changed assignment', () => {
        const original = problem('8 + 7 =', '15');
        const before = JSON.stringify(original);
        expect(islandLearningGuidance(original)).toEqual({ text: '8は あと2で10。7を 2と5に わけて、8に じゅんに たそう。', example: '8 + 2 = 10 → 10 + 5 = 15' });
        expect(JSON.stringify(original)).toBe(before);
        expect(islandLearningGuidance(problem('28 + 7 =', '35'))?.example).toBe('28 + 2 = 30 → 30 + 5 = 35');
    });
    it('splits subtraction at ten and keeps zero and whole-ten boundaries valid', () => {
        expect(islandLearningGuidance(problem('13 − 5 =', '8'))?.example).toBe('13 − 3 = 10 → 10 − 2 = 8');
        expect(islandLearningGuidance(problem('20 - 5 =', '15'))?.text).toBe('20から、1ずつ へらすのを 5回 やってみよう。');
        expect(islandLearningGuidance(problem('3 - 3 =', '0'))?.text).toBe('3から、1ずつ へらすのを 3回 やってみよう。');
    });
    it('does not invent steps for mismatched answers, larger expressions or unknown text', () => {
        for (const item of [problem('8 + 7 =', '16'), problem('3 - 5 =', '-2'), problem('1.8 + 7 =', '8.8'), problem('8 + 7 = □ + 4', '11'), problem('□ + 7 = 15', '8')]) {
            expect(islandLearningGuidance(item)).toBeUndefined();
        }
    });
    it('explains the operands of multiplication and division without supplying a result', () => {
        expect(islandLearningGuidance(problem('4 × 3 =', '12'))?.text).toBe('4が 3つ分。4を 3回 たすと いくつかな。');
        expect(islandLearningGuidance(problem('12 ÷ 3 =', '4'))?.text).toBe('3 × □ = 12。3を 何倍すると 12に なるかな。');
        for (const item of [problem('12 ÷ 3 =', '5'), problem('12 ÷ 0 =', '0'), problem('4 × 3 =', '13')]) {
            expect(islandLearningGuidance(item)).toBeUndefined();
        }
    });
    it('distinguishes fraction numerator and denominator and checks reduced answer equivalence', () => {
        const item = { ...problem('1/4 + 1/4 =', ''), correctAnswer: ['1', '2'], inputType: 'multi-number' as const };
        const before = JSON.stringify(item);
        expect(islandLearningGuidance(item)?.text).toContain('下の数（分母）は 4のまま');
        expect(islandLearningGuidance(item)?.text).toContain('1 + 1');
        expect(islandLearningGuidance(item)?.text).toContain('約分');
        expect(islandLearningGuidance({ ...item, correctAnswer: ['3', '4'] })).toBeUndefined();
        expect(islandLearningGuidance({ ...item, questionText: '1/0 + 1/4 =' })).toBeUndefined();
        expect(islandLearningGuidance({ ...item, questionText: '1/3 + 1/6 =' })?.text).toContain('分母）を そろえよう');
        expect(JSON.stringify(item)).toBe(before);
    });
});
