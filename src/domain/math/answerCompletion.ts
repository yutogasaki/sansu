import type { Problem } from '../types';

// These curricula guarantee a single-digit response across their entire range.
// Never derive completion from the particular answer, its length or a timer.
const SINGLE_DIGIT_SKILLS = new Set([
    'compose_5', 'add_tiny', 'add_finger', 'count_back', 'sub_tiny',
    'sub_1d1d_nc', 'sub_1d1d_nc_bridge', 'sub_1d1d_c', 'sub_1d1d_c_bridge',
    'div_99_rev', 'div_2d2d_exact', 'div_3d2d_exact',
]);

export function isSingleDigitMathInput(problem: Pick<Problem, 'subject' | 'categoryId' | 'inputType'> | undefined): boolean {
    return problem?.subject === 'math' && problem.inputType === 'number' && SINGLE_DIGIT_SKILLS.has(problem.categoryId);
}

/** Every existing Hissan input cell holds exactly one digit or decimal point. */
export function isWrittenStepComplete(values: readonly string[]): boolean {
    return values.length > 0 && values.every(value => /^[0-9.]$/.test(value));
}

/** Field lengths are maximums, not proof that a fraction/remainder is finished. */
export function canConfirmNumberFields(values: readonly string[]): boolean {
    return values.length > 0 && values.every(value => /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value));
}
