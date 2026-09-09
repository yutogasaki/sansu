import type { HissanStep } from './hissanTypes';

/** Keep only digits the child supplied correctly in a graded, failed row. */
export function writtenRetryValues(answer: readonly string[], expected: readonly string[]): string[] {
    if (answer.length !== expected.length) return expected.map(() => '');
    return answer.map((value, index) => value === expected[index] ? value : '');
}

/** Follow the row's calculation order, skipping filled cells and wrapping to holes. */
export function nextWrittenInput(values: readonly string[], current: number, order: readonly number[] = values.map((_, i) => i)): number {
    const position = order.indexOf(current);
    const after = order.slice(position + 1).find(index => !values[index]) ?? -1;
    if (after >= 0) return after;
    const first = order.find(index => !values[index]) ?? -1;
    return first >= 0 ? first : current;
}

/** Stored answer arrays retain their historical order; only cursor order changes. */
export function writtenInputOrder(step: HissanStep): number[] {
    const automatic = writtenAutomaticValues(step);
    return step.inputCellIndices.map((_, index) => index)
        .filter(index => !automatic[index])
        .sort((a, b) => step.inputCellIndices[a] - step.inputCellIndices[b]);
}

/** Formatting, not answers: fixed points and optional fractional trailing zeros. */
export function writtenAutomaticValues(step: HissanStep): string[] {
    const values: string[] = step.correctValues.map(value => value === '.' ? '.' : '');
    const order = step.inputCellIndices.map((_, i) => i).sort((a, b) => step.inputCellIndices[a] - step.inputCellIndices[b]);
    const point = order.findIndex(i => step.correctValues[i] === '.');
    if (point >= 0) {
        for (let i = order.length - 1; i > point && step.correctValues[order[i]] === '0'; i--) values[order[i]] = '0';
    }
    // Redundant leading zeroes are formatting too; keep the single units zero.
    const integerEnd = point < 0 ? order.length : point;
    for (let i = 0; i < integerEnd - 1 && step.correctValues[order[i]] === '0'; i++) values[order[i]] = '0';
    return values;
}
