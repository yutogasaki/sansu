import type { Problem } from '../types';

/** Capability belongs to the exercise family, not the length/value of its answer. */
export function allowsDecimalEntry(problem: Pick<Problem, 'subject' | 'categoryId' | 'inputType'> | undefined): boolean {
    return problem?.subject === 'math' && problem.inputType === 'number'
        && (problem.categoryId.startsWith('dec_') || ['scale_10x', 'percent_basic'].includes(problem.categoryId));
}

export function appendNumberField(values: readonly string[], active: number, digit: string, limits: readonly number[]) {
    if (!/^\d$/.test(digit) || active < 0 || active >= values.length) return { values: [...values], active };
    const limit = limits[active] ?? 8;
    const next = [...values];
    if (next[active].length >= limit) return { values: next, active };
    next[active] += digit;
    // Never overwrite an already-entered neighbouring field during a correction.
    return { values: next, active: next[active].length === limit && active < next.length - 1 && !next[active + 1] ? active + 1 : active };
}
