import { describe, expect, it } from 'vitest';
import { canConfirmNumberFields, mathAnswerShape, appendAnswerDigit, isAnswerShapeComplete, isWrittenStepComplete } from './answerCompletion';
import { MATH_GENERATORS } from './index';
import { createSeededRandom } from '../../utils/random';
import { createInitialProfile } from '../user/profile';

describe('immediate answer-cell completion', () => {
    it('gives the same automatic rule to one- and multi-digit answers across curricula', () => {
        for (const correctAnswer of ['3', '12', '105', '0.25']) {
            expect(mathAnswerShape({ subject: 'math', inputType: 'number', correctAnswer }))
                .toEqual([correctAnswer.replace(/\d/g, '□')]);
        }
        expect(mathAnswerShape({ subject: 'vocab', inputType: 'number', correctAnswer: '3' })).toBeUndefined();
        expect(mathAnswerShape({ subject: 'math', inputType: 'choice', correctAnswer: '3' })).toBeUndefined();
        expect(mathAnswerShape(undefined)).toBeUndefined();
    });

    it('can fill every generated numeric shape without Enter or knowing the right digits', () => {
        const profile = createInitialProfile('fixture', 1, 1, 1, 'math');
        for (const [categoryId, generate] of Object.entries(MATH_GENERATORS)) {
            for (let seed = 0; seed < 30; seed++) {
                const problem = generate({ random: createSeededRandom(`${categoryId}:${seed}`), profile });
                if (problem.inputType === 'choice') continue;
                const shape = mathAnswerShape({ ...problem, subject: 'math' });
                expect(shape, categoryId).toBeDefined();
                let draft = { values: shape!.map(() => ''), active: 0 };
                const count = shape!.join('').replace(/\./g, '').length;
                for (let i = 0; i < count; i++) {
                    expect(isAnswerShapeComplete(draft.values, shape!), categoryId).toBe(false);
                    draft = appendAnswerDigit(draft.values, draft.active, '9', shape!);
                }
                expect(isAnswerShapeComplete(draft.values, shape!), categoryId).toBe(true);
            }
        }
    });

    it('inserts the printed decimal point and keeps an incomplete prefix ungraded', () => {
        const shape = ['□□.□'];
        let draft = { values: [''], active: 0 };
        draft = appendAnswerDigit(draft.values, 0, '1', shape);
        expect(isAnswerShapeComplete(draft.values, shape)).toBe(false);
        draft = appendAnswerDigit(draft.values, 0, '2', shape);
        expect(draft.values).toEqual(['12']);
        draft = appendAnswerDigit(draft.values, 0, '.', shape);
        expect(draft.values).toEqual(['12']);
        draft = appendAnswerDigit(draft.values, 0, '8', shape);
        expect(draft.values).toEqual(['12.8']);
        expect(isAnswerShapeComplete(draft.values, shape)).toBe(true);
        expect(appendAnswerDigit(draft.values, 0, '9', shape).values).toEqual(['12.8']);
    });

    it('auto advances fractions and remainders without overwriting a filled neighbour', () => {
        const shape = ['□□', '□'];
        expect(appendAnswerDigit(['1', ''], 0, '2', shape)).toEqual({ values: ['12', ''], active: 1 });
        expect(appendAnswerDigit(['1', '7'], 0, '8', shape)).toEqual({ values: ['18', '7'], active: 0 });
        expect(isAnswerShapeComplete(['18', '7'], shape)).toBe(true);
        expect(isAnswerShapeComplete(['1', '7'], shape)).toBe(false);
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
