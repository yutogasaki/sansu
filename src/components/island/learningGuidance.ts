import type { Problem } from '../../domain/types';
import { visualLearningHint } from './visualLearningGuidance';

export interface IslandGuidance { text: string; example?: string }

/** Worked steps are shown only when they agree with the frozen problem's answer. */
export function islandLearningGuidance(problem: Problem): IslandGuidance | undefined {
    if (problem.subject === 'vocab') return { text: 'ことばと いみを、いっしょに たしかめよう。' };
    const visualHint = visualLearningHint(problem);
    if (visualHint) return { text: visualHint };
    const fraction = fractionGuidance(problem);
    if (fraction) return fraction;
    // These are deliberately narrow templates, never a parser for arbitrary lesson text.
    const match = problem.questionText?.match(/^\s*(\d{1,4})\s*([+＋−×÷-])\s*(\d{1,4})\s*=\s*$/);
    if (!match || typeof problem.correctAnswer !== 'string') return undefined;
    const a = Number(match[1]), b = Number(match[3]), addition = ['+', '＋'].includes(match[2]);
    if (match[2] === '×') return String(a * b) === problem.correctAnswer
        ? { text: `${a}が ${b}つ分。${a}を ${b}回 たすと いくつかな。` } : undefined;
    if (match[2] === '÷') return b > 0 && String(a / b) === problem.correctAnswer && a % b === 0
        ? { text: `${b} × □ = ${a}。${b}を 何倍すると ${a}に なるかな。` } : undefined;
    const result = addition ? a + b : a - b;
    if (result < 0 || String(result) !== problem.correctAnswer) return undefined;
    const ones = a % 10;
    if (b < 10 && addition && ones > 0 && ones + b > 10) {
        const first = 10 - ones, middle = a + first, rest = b - first;
        return { text: `${a}は あと${first}で${middle}。${b}を ${first}と${rest}に わけて、${a}に じゅんに たそう。`,
            example: `${a} + ${first} = ${middle} → ${middle} + ${rest} = ${result}` };
    }
    if (b < 10 && !addition && ones > 0 && b > ones) {
        const middle = a - ones, rest = b - ones;
        return { text: `${a}から ${ones}を ひくと${middle}。${b}の のこり${rest}を、${middle}から ひこう。`,
            example: `${a} − ${ones} = ${middle} → ${middle} − ${rest} = ${result}` };
    }
    if (b === 0) return { text: `0を ${addition ? 'たしても' : 'ひいても'}、もとの 数は かわらないよ。` };
    if (b <= 10) return { text: `${a}から、1ずつ ${addition ? 'ふやす' : 'へらす'}のを ${b}回 やってみよう。` };
    return { text: `${b}を ${b - b % 10}と ${b % 10}に わけよう。${a}から じゅんに ${addition ? 'たそう' : 'ひこう'}。` };
}

function fractionGuidance(problem: Problem): IslandGuidance | undefined {
    const match = problem.questionText?.match(/^(\d{1,2})\/(\d{1,2})\s*([+−-])\s*(\d{1,2})\/(\d{1,2})\s*=\s*$/);
    if (!match || !Array.isArray(problem.correctAnswer) || problem.correctAnswer.length !== 2) return undefined;
    const [, topA, bottomA, operator, topB, bottomB] = match;
    const a = Number(topA), b = Number(topB), d = Number(bottomA), e = Number(bottomB);
    const sign = operator === '+' ? 1 : -1;
    const numerator = a * e + sign * b * d, denominator = d * e;
    const [answerN, answerD] = problem.correctAnswer.map(Number);
    if (d === 0 || e === 0 || numerator < 0 || !Number.isInteger(answerN) || !Number.isInteger(answerD)
        || answerD <= 0 || numerator * answerD !== denominator * answerN) return undefined;
    if (d === e) return { text: `下の数（分母）は ${d}のまま。上の数（分子）を ${a} ${sign === 1 ? '+' : '−'} ${b}で 計算し、約分しよう。` };
    return { text: 'まず 下の数（分母）を そろえよう。上下に 同じ数を かけると、同じ大きさの 分数に なるよ。' };
}
