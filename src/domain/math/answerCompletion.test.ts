import { describe, expect, it } from 'vitest';
import { canConfirmNumberFields, isSingleDigitMathInput, isWrittenStepComplete } from './answerCompletion';
import { MATH_GENERATORS } from './index';
import { createSeededRandom } from '../../utils/random';
import { createInitialProfile } from '../user/profile';

describe('answer completion without answer-derived hints', () => {
    it('uses the full curriculum range even when the current answer happens to be one digit', () => {
        for (const categoryId of ['add_5', 'add_1d_1', 'count_10', 'count_next_10', 'mul_99_rand', 'dec_add', 'frac_add_same', 'unknown']) {
            expect(isSingleDigitMathInput({ subject: 'math', inputType: 'number', categoryId })).toBe(false);
        }
        expect(isSingleDigitMathInput({ subject: 'math', inputType: 'number', categoryId: 'sub_1d1d_nc' })).toBe(true);
        expect(isSingleDigitMathInput({ subject: 'vocab', inputType: 'number', categoryId: 'sub_1d1d_nc' })).toBe(false);
        expect(isSingleDigitMathInput({ subject: 'math', inputType: 'choice', categoryId: 'sub_1d1d_nc' })).toBe(false);
        expect(isSingleDigitMathInput(undefined)).toBe(false);
    });

    it('keeps every enabled curriculum within one digit across introduction and full-range generators', () => {
        const enabled = Object.keys(MATH_GENERATORS).filter(categoryId => isSingleDigitMathInput({ subject: 'math', inputType: 'number', categoryId }));
        expect(enabled).toHaveLength(12);
        for (const categoryId of enabled) {
            for (const progress of [undefined, 0, 4, 12, 30, 100]) {
                const profile = createInitialProfile('fixture', 1, 1, 1, 'math');
                profile.mathSkills[categoryId] = { totalAnswers: progress ?? 0, correctAnswers: progress ?? 0, independentCorrectAnswers: progress ?? 0 };
                for (let seed = 0; seed < 80; seed++) {
                    const generated = MATH_GENERATORS[categoryId]({ random: createSeededRandom(`${categoryId}:${progress}:${seed}`), profile: progress === undefined ? undefined : profile });
                    expect(generated.inputType, categoryId).toBe('number');
                    expect(generated.correctAnswer, categoryId).toMatch(/^[0-9]$/);
                }
            }
        }
    });

    it('accepts any filled written row, including incorrect digits, and never a partial row', () => {
        expect(isWrittenStepComplete(['9', '9'])).toBe(true);
        expect(isWrittenStepComplete(['1', '.', '2'])).toBe(true);
        for (const values of [[], ['1', ''], ['', '2'], ['12'], ['x']]) expect(isWrittenStepComplete(values)).toBe(false);
    });

    it('requires a usable value in each manual field without treating maximum lengths as completion', () => {
        for (const values of [['12'], ['0'], ['.5'], ['1.2'], ['1', '12'], ['0', '1', '2']]) expect(canConfirmNumberFields(values)).toBe(true);
        for (const values of [[], [''], ['.'], ['1.'], ['1..2'], ['1', '']]) expect(canConfirmNumberFields(values)).toBe(false);
    });
});
