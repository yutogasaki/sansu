import type { Problem } from '../types';

/** Present whole results naturally, without mutating a frozen question. */
export function integerFractionProblem<T extends Problem | undefined>(problem: T): T {
    if (!problem || problem.subject !== 'math' || problem.inputType !== 'multi-number' || !Array.isArray(problem.correctAnswer)) return problem;
    const labels = problem.inputConfig?.fields?.map(field => field.label).join('/');
    const values = problem.correctAnswer;
    const whole = labels === '分子/分母' && values.length === 2 && values[1] === '1' ? values[0]
        : labels === '整数/分子/分母' && values.length === 3 && values[1] === '0' && /^[1-9]\d*$/.test(values[2]) ? values[0] : undefined;
    if (whole === undefined || !/^\d+$/.test(whole)) return problem;
    return { ...problem, inputType: 'number', correctAnswer: whole, displayAnswer: whole, inputConfig: undefined } as T;
}

/** Keep the original grader contract, including incorrect submitted integers. */
export function restoreFractionAnswer(original: Problem, answer: string | string[]): string | string[] {
    if (typeof answer !== 'string' || integerFractionProblem(original) === original) return answer;
    const expected = original.correctAnswer as string[];
    return expected.length === 2 ? [answer, expected[1]] : [answer, expected[1], expected[2]];
}
