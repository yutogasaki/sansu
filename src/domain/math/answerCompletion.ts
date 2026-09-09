import type { Problem } from '../types';

/** Answer-sized scaffolding measures calculation, not digit-count inference.
 * A shape contains only slots and punctuation, never the correct digits. */
export function mathAnswerShape(problem: Pick<Problem, 'subject' | 'inputType' | 'correctAnswer'> | undefined): string[] | undefined {
    if (!problem || problem.subject !== 'math' || !['number', 'multi-number', 'hissan'].includes(problem.inputType)) return;
    const answers = Array.isArray(problem.correctAnswer) ? problem.correctAnswer : [problem.correctAnswer];
    if (!answers.length || !answers.every(answer => /^\d+(?:\.\d+)?$/.test(answer))) return;
    return answers.map(answer => answer.replace(/\d/g, '□'));
}

export function isAnswerShapeComplete(values: readonly string[], shape: readonly string[]): boolean {
    return values.length === shape.length && shape.length > 0 && shape.every((field, i) =>
        values[i]?.length === field.length && [...field].every((cell, j) =>
            cell === '.' ? values[i][j] === '.' : /^\d$/.test(values[i][j])));
}

/** Advance on filled slots, including wrong digits. A point is printed scaffolding. */
export function appendAnswerDigit(values: readonly string[], active: number, digit: string, shape: readonly string[]) {
    const next = [...values];
    if (!/^\d$/.test(digit) || !shape[active]) return { values: next, active };
    const field = shape[active];
    let value = next[active] ?? '';
    if (field[value.length] === '.') value += '.';
    if (value.length >= field.length) return { values: next, active };
    next[active] = value + digit;
    const following = Array.from({ length: shape.length }, (_, offset) => (active + 1 + offset) % shape.length)
        .find(i => (next[i] ?? '').length < shape[i].length);
    return { values: next, active: next[active].length === field.length && following !== undefined ? following : active };
}

/** A printed decimal point never consumes a deletion keystroke. */
export function removeAnswerDigit(value: string): string {
    return value.replace(/\.$/, '').slice(0, -1).replace(/\.$/, '');
}

/** Every existing Hissan input cell holds exactly one digit or decimal point. */
export function isWrittenStepComplete(values: readonly string[]): boolean {
    return values.length > 0 && values.every(value => /^[0-9.]$/.test(value));
}

/** Field lengths are maximums, not proof that a fraction/remainder is finished. */
export function canConfirmNumberFields(values: readonly string[]): boolean {
    return values.length > 0 && values.every(value => /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value));
}
