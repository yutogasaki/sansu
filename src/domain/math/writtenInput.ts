/** Keep only digits the child supplied correctly in a graded, failed row. */
export function writtenRetryValues(answer: readonly string[], expected: readonly string[]): string[] {
    if (answer.length !== expected.length) return expected.map(() => '');
    return answer.map((value, index) => value === expected[index] ? value : '');
}

/** Follow the row's calculation order, skipping filled cells and wrapping to holes. */
export function nextWrittenInput(values: readonly string[], current: number): number {
    const after = values.findIndex((value, index) => index > current && !value);
    if (after >= 0) return after;
    const first = values.findIndex(value => !value);
    return first >= 0 ? first : current;
}
