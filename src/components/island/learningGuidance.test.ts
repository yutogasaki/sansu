import { describe, expect, it } from 'vitest';
import type { Problem } from '../../domain/types';
import { islandLearningGuidance } from './learningGuidance';

const problem = (questionText: string, correctAnswer: string): Problem => ({ id: 'reserved', categoryId: 'add_1d_2', subject: 'math', inputType: 'number', questionText, correctAnswer, isReview: false });
describe('island worked guidance', () => {
    it('explains making ten with the actual addends and no changed assignment', () => {
        const original = problem('8 + 7 =', '15');
        const before = JSON.stringify(original);
        expect(islandLearningGuidance(original)).toEqual({ text: '7を 2と 5に わけて、10の まとまりを つくろう。', example: '8 + 2 = 10 → 10 + 5 = 15' });
        expect(JSON.stringify(original)).toBe(before);
        expect(islandLearningGuidance(problem('28 + 7 =', '35'))?.example).toBe('28 + 2 = 30 → 30 + 5 = 35');
    });
    it('splits subtraction at ten and keeps zero and whole-ten boundaries valid', () => {
        expect(islandLearningGuidance(problem('13 − 5 =', '8'))?.example).toBe('13 − 3 = 10 → 10 − 2 = 8');
        expect(islandLearningGuidance(problem('20 - 5 =', '15'))?.text).toBe('20から 5こ もどって、かぞえよう。');
        expect(islandLearningGuidance(problem('3 - 3 =', '0'))?.text).toBe('3から 3こ もどって、かぞえよう。');
    });
    it('does not invent steps for mismatched answers, larger expressions or unknown text', () => {
        for (const item of [problem('8 + 7 =', '16'), problem('3 - 5 =', '-2'), problem('1.8 + 7 =', '8.8'), problem('8 + 7 = □ + 4', '11'), problem('□ + 7 = 15', '8')]) {
            expect(islandLearningGuidance(item)).toBeUndefined();
        }
    });
});
