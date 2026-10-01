import { createProblem as createCoreProblem, getMathSkillProgress, randomInt, type GeneratorFn, type MathGeneratorContext } from '../core';
import type { ProblemVisual } from '../../types';

const comparisonChoices = { choices: ['>', '=', '<'].map(value => ({ value, label: value })) };
const createProblem: typeof createCoreProblem = (id, question, answer, inputType, inputConfig, displayConfig) =>
    createCoreProblem(id, question, answer, inputType, inputConfig, {
        ...displayConfig,
        ...(displayConfig?.questionVisual ? { questionVisual: { ...displayConfig.questionVisual, prompt: question } } : {}),
    });
const strip = (parts: number, filled: number, label = 'ぜんぶ1'): ProblemVisual => ({
    kind: 'fraction-strips', groups: [{ parts, filled, label }],
});
const stage = (id: string, context?: MathGeneratorContext) => {
    const preferred = context?.preferredLearningVariant?.match(/^intro-([012])$/);
    if (preferred) return Number(preferred[1]);
    const count = getMathSkillProgress(id, context);
    return count !== undefined && count < 3 ? count : randomInt(0, 2, context?.random);
};

export const generators: Record<string, GeneratorFn> = {
    foundation_tens: context => {
        const tens = randomInt(1, 5, context?.random), ones = randomInt(1, 9, context?.random);
        return createProblem('foundation_tens', `10の まとまりが ${tens}こ、1が ${ones}こ。あわせて？`, String(tens * 10 + ones), 'number', undefined, {
            questionVisual: { kind: 'operation-base10', operator: '+', groups: [{ label: '10の まとまり', value: tens * 10 }, { label: '1', value: ones }] },
        });
    },
    foundation_expanded: context => {
        const h = randomInt(1, 4, context?.random), t = randomInt(1, 4, context?.random), o = randomInt(1, 4, context?.random);
        return createProblem('foundation_expanded', `100が ${h}こ、10が ${t}こ、1が ${o}こ。あわせて？`, String(h * 100 + t * 10 + o), 'number', undefined, {
            questionVisual: { kind: 'item-order', groups: [{ emoji: '🟥', label: '1こが100', count: h }, { emoji: '🟦', label: '1こが10', count: t }, { emoji: '●', label: '1こが1', count: o }] },
        });
    },
    foundation_groups: context => {
        const each = randomInt(2, 4, context?.random), groups = randomInt(2, 4, context?.random);
        return createProblem('foundation_groups', `${each}こずつ ${groups}まとまり。ぜんぶで？`, String(each * groups), 'number', undefined, {
            questionVisual: { kind: 'item-order', groups: Array.from({ length: groups }, (_, i) => ({ emoji: '🍎', label: `${i + 1}つめの まとまり`, count: each })) },
        });
    },
    foundation_division: context => {
        const mode = stage('foundation_division', context), each = randomInt(2, 4, context?.random), groups = randomInt(2, 4, context?.random);
        const total = each * groups;
        if (mode === 0) return createProblem('foundation_division', `${total}こを ${groups}にんで 同じにわける。1にんぶんは？`, String(each), 'number', undefined, {
            questionVisual: { kind: 'sharing-items', source: { emoji: '🍎', label: 'わけるもの', count: total }, recipients: { emoji: '🐻', label: '同じにわける', count: groups } },
        });
        if (mode === 1) return createProblem('foundation_division', `${total}こを ${each}こずつ わける。何まとまり？`, String(groups), 'number', undefined, {
            questionVisual: { kind: 'item-order', groups: Array.from({ length: groups }, (_, i) => ({ emoji: '🍎', label: `${i + 1}つめ`, count: each })) },
        });
        const remainder = randomInt(1, each - 1, context?.random);
        return createProblem('foundation_division', `${total + remainder}こを ${each}こずつ わける。あまりは？`, String(remainder), 'number', undefined, {
            questionVisual: { kind: 'item-order', groups: [...Array.from({ length: groups }, (_, i) => ({ emoji: '🍎', label: `${i + 1}つめ`, count: each })), { emoji: '🍎', label: 'のこったもの', count: remainder }] },
        });
    },
    foundation_decimal: context => {
        const mode = stage('foundation_decimal', context), n = randomInt(1, 8, context?.random);
        if (mode === 0) return createProblem('foundation_decimal', '1を10等分したよ。ぬった量を 小数でかくと？', String(n / 10), 'number', undefined, { questionVisual: strip(10, n) });
        if (mode === 1) {
            const reversed = randomInt(0, 1, context?.random) === 1;
            const a = n / 10, b = (n * 10 + 1) / 100;
            return createProblem('foundation_decimal', `${reversed ? b : a} □ ${reversed ? a : b}`, reversed ? '>' : '<', 'choice', comparisonChoices);
        }
        return createProblem('foundation_decimal', `${n / 10} を10倍すると？`, String(n), 'number', undefined, { questionVisual: strip(10, n) });
    },
    foundation_fraction: context => {
        const mode = stage('foundation_fraction', context), d = randomInt(3, 8, context?.random), n = randomInt(1, d - 1, context?.random);
        if (mode === 0) return createProblem('foundation_fraction', `1を${d}等分したよ。ぬったのは □/${d}。□は？`, String(n), 'number', undefined, { questionVisual: strip(d, n) });
        if (mode === 1) {
            const reversed = randomInt(0, 1, context?.random) === 1;
            const denominators = reversed ? [d + 1, d] : [d, d + 1];
            return createProblem('foundation_fraction', `${n}/${denominators[0]} □ ${n}/${denominators[1]}`, reversed ? '<' : '>', 'choice', comparisonChoices, {
                questionVisual: { kind: 'fraction-strips', groups: denominators.map(parts => ({ parts, filled: n, label: `${n}/${parts}` })) },
            });
        }
        return createProblem('foundation_fraction', `1ぜんぶを${d}等分。1 = □/${d}。□は？`, String(d), 'number', undefined, { questionVisual: strip(d, d) });
    },
    foundation_equivalence: context => {
        const mode = stage('foundation_equivalence', context), d = randomInt(2, 5, context?.random), factor = 2;
        if (mode === 0) return createProblem('foundation_equivalence', `同じ量だよ。1/${d} = □/${d * factor}。□は？`, String(factor), 'number', undefined, { questionVisual: { kind: 'fraction-strips', groups: [{ parts: d, filled: 1, label: `1/${d}` }, { parts: d * factor, filled: factor, label: `□/${d * factor}` }] } });
        if (mode === 1) return createProblem('foundation_equivalence', `同じ量だよ。2/${d * 2} = 1/□。□は？`, String(d), 'number', undefined, { questionVisual: strip(d * 2, 2) });
        return createProblem('foundation_equivalence', `1/${d} と1/${d * 2}。同じ分母にそろえる。いちばん小さい分母は？`, String(d * 2), 'number', undefined, { questionVisual: { kind: 'fraction-strips', groups: [{ parts: d, filled: 1, label: `1/${d}` }, { parts: d * 2, filled: 1, label: `1/${d * 2}` }] } });
    },
    foundation_mixed: context => {
        const whole = randomInt(1, 2, context?.random), d = randomInt(3, 6, context?.random), n = randomInt(1, d - 1, context?.random);
        return createProblem('foundation_mixed', `${whole} と${n}/${d}を合わせた量は □/${d}。□は？`, String(whole * d + n), 'number', undefined, {
            questionVisual: { kind: 'fraction-strips', groups: [...Array.from({ length: whole }, () => ({ parts: d, filled: d, label: '1' })), { parts: d, filled: n, label: `${n}/${d}` }] },
        });
    },
    foundation_rate: context => {
        const each = randomInt(2, 6, context?.random), groups = randomInt(2, 4, context?.random);
        return createProblem('foundation_rate', `${groups}ふくろで ${each * groups}こ。同じ数ずつ入っているよ。1ふくろは？`, String(each), 'number', undefined, {
            questionVisual: { kind: 'item-order', groups: Array.from({ length: groups }, (_, i) => ({ emoji: '🍎', label: `${i + 1}ふくろめ`, count: each })) },
        });
    },
};
