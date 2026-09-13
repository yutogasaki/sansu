import { expect, it } from 'vitest';
import { completeIncorrectValues } from './island-e2e-helpers.mjs';

it('submits a complete wrong numerator while preserving the two-digit denominator', () => {
    expect(completeIncorrectValues([9, 11])).toEqual(['8', 11]);
    expect(completeIncorrectValues([10, 13])).toEqual(['11', 13]);
});

it('preserves the decimal places and every remaining written input field', () => {
    expect(completeIncorrectValues(['0.05'])).toEqual(['0.06']);
    expect(completeIncorrectValues([1, 0, 9])).toEqual(['2', 0, 9]);
});

it('retains the answer width when an automatic numeric field is changed', () => {
    expect(completeIncorrectValues([100])).toEqual(['101']);
    expect(completeIncorrectValues([99])).toEqual(['98']);
    expect(completeIncorrectValues([0])).toEqual(['1']);
});
