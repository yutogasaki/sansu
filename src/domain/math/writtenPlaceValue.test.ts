import { describe, expect, it } from 'vitest';
import { generateHissanGrid } from './hissanEngine';
import { writtenPlaceValue, shiftWrittenDecimal } from './writtenPlaceValue';
import { writtenAutomaticValues, writtenInputOrder, nextWrittenInput } from './writtenInput';

function fixture(question: string, answer: string) {
    const grid = generateHissanGrid('dec_add', question, answer)!;
    return { grid, model: writtenPlaceValue(grid), step: grid.steps[0] };
}
describe('place value and manual decimal input', () => {
    it.each([['12.3 + 4 =', '16.3'], ['3.5 - 0.78 =', '2.72'], ['0.9 + 0.1 =', '1']])('aligns %s at the decimal axis, preserving full operands', (q, a) => {
        const { model } = fixture(q, a);
        const points = [...model.operands, model.result].map(row => row.find(cell => cell.point)?.column);
        expect(new Set(points).size).toBe(1);
        expect(model.operands[0].filter(cell => !cell.padding).map(cell => cell.value).join('')).toBe(q.split(' ')[0].replace('.', ''));
    });
    it('places multiplication by final digit rather than decimal point', () => {
        const { model } = fixture('1.2 × 0.03 =', '0.036');
        expect(model.operands.map(row => row.at(-1)?.column)).toEqual([model.columns - 1, model.columns - 1]);
    });
    it('shifts both division operands exactly and aligns the quotient', () => {
        const { model } = fixture('1.2 ÷ 0.3 =', '4');
        expect(model.normalization).toBe('1.2 ÷ 0.3 → 12 ÷ 3');
        expect(model.divisor).toBe('3');
        expect(shiftWrittenDecimal('0.29', 2)).toBe('29');
        expect(shiftWrittenDecimal('3', 2)).toBe('300');
    });
    it.each([['12.3 + 0 =', '12.3', '12.3'], ['0.05 + 0 =', '0.05', '0.05'], ['0.5 + 0 =', '0.50', '0.5'], ['1000 - 999 =', '1', '1']])('enters %s with a manual dot and without redundant zeros and keeps the saved format', (q, a, entry) => {
        const { step } = fixture(q, a);
        const values = writtenAutomaticValues(step), order = writtenInputOrder(step);
        let cursor = nextWrittenInput(values, -1, order);
        for (const digit of entry) { values[cursor] = digit; cursor = nextWrittenInput(values, cursor, order); }
        expect(values).toEqual(step.correctValues);
    });
    it('does not reveal answer digits in the automatic values', () => {
        const { step } = fixture('1001 + 1 =', '1002');
        expect(writtenAutomaticValues(step)).toEqual(['', '', '', '']);
    });
});
