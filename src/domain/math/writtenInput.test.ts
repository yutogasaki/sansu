import { describe, expect, it } from 'vitest';
import { nextWrittenInput, writtenRetryValues } from './writtenInput';

describe('written row correction', () => {
    it('clears the whole failed row, including supplied correct digits', () => {
        // 123 × 4 = 492, entered from the ones column.
        const original = ['7', '9', '5'];
        const retry = writtenRetryValues(original, ['2', '9', '4']);
        expect(retry).toEqual(['', '', '']);
        expect(nextWrittenInput(retry, -1)).toBe(0);
        retry[0] = '2';
        expect(nextWrittenInput(retry, 0)).toBe(1);
        expect(original).toEqual(['7', '9', '5']);
    });

    it('returns to an earlier hole after tapping a later digit', () => {
        expect(nextWrittenInput(['', '3', '1'], 2)).toBe(0);
        expect(nextWrittenInput(['2', '3', '1'], 0)).toBe(0);
    });

    it('never fills absent input from an expected answer, including zeros and decimals', () => {
        expect(writtenRetryValues(['', '0', '8', '.', ''], ['2', '0', '1', '.', '0'])).toEqual(['', '', '', '', '']);
        expect(writtenRetryValues(['4'], ['4', '2'])).toEqual(['', '']);
        expect(writtenRetryValues(['42', ''], ['4', '2'])).toEqual(['', '']);
    });
});
