import type { Problem } from '../types';

export const MATH_CONTENT_VARIANTS: Readonly<Record<string, readonly string[]>> = {
    mul_99_rand: Array.from({ length: 9 }, (_, i) => `table-${i + 1}`),
    percent_basic: ['percent', 'part'], speed_basic: ['distance', 'speed', 'time'],
    scale_10x: ['times-ten', 'times-hundred', 'divide-ten'],
    large_number_unit: ['man', 'oku'],
    frac_compare: ['same-denominator', 'same-numerator', 'equivalent', 'different'],
    average_basic: ['integer', 'decimal'], div_2d2d_exact: ['quotient-one', 'quotient-many'],
};

export const mathContentVariants = (id: string): readonly string[] => {
    const table = id.match(/^mul_99_([1-9])$/);
    return table ? [`table-${table[1]}`] : MATH_CONTENT_VARIANTS[id] ?? ['default'];
};

/** Practice keeps quotient-one at one in five; assessments still cover both facets. */
export const mathPracticeVariants = (id: string): readonly string[] => id === 'div_2d2d_exact'
    ? ['quotient-one', 'quotient-many', 'quotient-many', 'quotient-many', 'quotient-many']
    : mathContentVariants(id);

type Content = Pick<Problem, 'categoryId' | 'questionText' | 'correctAnswer'>;
/** Classify verified content, never trust a generator's requested variant. */
export function classifyMathContent(problem: Content): string {
    const { categoryId: id, questionText: text, correctAnswer: answer } = problem;
    const numbers = text?.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (/^mul_99_/.test(id)) {
        const match = text?.match(/^([1-9]) × ([1-9]) =$/);
        if (!match || Number(answer) !== Number(match[1]) * Number(match[2])) return 'unknown';
        return `table-${match[1]}`;
    }
    if (id === 'percent_basic' && numbers.length === 2) {
        if (/^\d+(?:\.\d+)? は \d+(?:\.\d+)? の なん%？$/.test(text ?? '')
            && Math.abs(Number(answer) - numbers[0] / numbers[1] * 100) < 1e-8) return 'percent';
        if (/^\d+(?:\.\d+)? の \d+% は？$/.test(text ?? '')
            && Number(answer) === numbers[0] * numbers[1] / 100) return 'part';
    }
    if (id === 'speed_basic' && numbers.length === 2) {
        const n = Number(answer);
        if (text?.startsWith('はやさ ') && text.endsWith('きょりは？') && n === numbers[0] * numbers[1]) return 'distance';
        if (text?.startsWith('きょり ') && n === numbers[0] / numbers[1]) {
            if (text.endsWith('はやさは？')) return 'speed';
            if (text.endsWith('じかんは？')) return 'time';
        }
    }
    if (id === 'scale_10x') {
        const m = text?.match(/^(\d+) ([×÷]) (10|100) =$/);
        if (!m) return 'unknown';
        const n = Number(m[1]), factor = Number(m[3]);
        if (Number(answer) !== (m[2] === '×' ? n * factor : n / factor)) return 'unknown';
        return m[2] === '÷' && factor === 10 ? 'divide-ten' : m[2] === '×' ? factor === 10 ? 'times-ten' : 'times-hundred' : 'unknown';
    }
    if (id === 'large_number_unit') {
        const m = text?.match(/^([\d,]+) は なん(まん|おく)？$/);
        if (m && Number(answer) === Number(m[1].replace(/,/g, '')) / (m[2] === 'まん' ? 1e4 : 1e8)) return m[2] === 'まん' ? 'man' : 'oku';
    }
    if (id === 'frac_compare') {
        const m = text?.match(/^(\d+)\/(\d+) □ (\d+)\/(\d+)$/);
        if (!m) return 'unknown';
        const [a, b, c, d] = m.slice(1).map(Number);
        if (b === 0 || d === 0) return 'unknown';
        const expected = a * d === b * c ? '=' : a * d > b * c ? '>' : '<';
        if (answer !== expected) return 'unknown';
        return expected === '=' ? 'equivalent' : b === d ? 'same-denominator' : a === c ? 'same-numerator' : 'different';
    }
    if (id === 'average_basic' && /^(\d+、){2,4}\d+ の へいきんは？$/.test(text ?? '')) {
        const average = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        if (numbers.some(n => n <= 0) || Math.abs(Math.round(average * 10) / 10 - average) > 1e-8) return 'unknown';
        if (Math.abs(Number(answer) - average) < 1e-8) return Number.isInteger(average) ? 'integer' : 'decimal';
    }
    if (id === 'div_2d2d_exact') {
        const m = text?.match(/^(\d{2}) ÷ (\d{2}) =$/);
        if (m && Number(m[1]) >= 10 && Number(m[2]) >= 10 && Number(answer) >= 1 && Number(answer) <= 9
            && Number(answer) === Number(m[1]) / Number(m[2]) && Number.isInteger(Number(answer))) return answer === '1' ? 'quotient-one' : 'quotient-many';
    }
    return mathContentVariants(id)[0] === 'default' ? 'default' : 'unknown';
}
