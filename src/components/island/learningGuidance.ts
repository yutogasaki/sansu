import type { Problem } from '../../domain/types';

export interface IslandGuidance { text: string; example?: string }

/** Worked steps are shown only when they agree with the frozen problem's answer. */
export function islandLearningGuidance(problem: Problem): IslandGuidance | undefined {
    if (problem.subject === 'vocab') return { text: 'ことばと いみを、いっしょに たしかめよう。' };
    const visual = problem.questionVisual;
    if (visual?.kind === 'single-items') return { text: 'ひとつずつ ゆびを さして、かぞえよう。' };
    if (visual?.kind === 'comparison-items') return { text: 'ひとつずつ ペアにすると、どちらが あまるかな。' };
    if (visual?.kind === 'number-sequence') return { text: 'まえと うしろの 数を みて、ならびかたを たしかめよう。' };
    if (visual?.kind === 'ordinal-row') return { text: 'もんだいの むきから、ひとつめ、ふたつめと かぞえよう。' };
    // These are deliberately narrow templates, never a parser for arbitrary lesson text.
    const match = problem.questionText?.match(/^\s*(\d{1,2})\s*([+＋−-])\s*(\d)\s*=\s*$/);
    if (!match || typeof problem.correctAnswer !== 'string') return undefined;
    const a = Number(match[1]), b = Number(match[3]), addition = ['+', '＋'].includes(match[2]);
    const result = addition ? a + b : a - b;
    if (result < 0 || String(result) !== problem.correctAnswer) return undefined;
    const ones = a % 10;
    if (addition && ones > 0 && ones + b > 10) {
        const first = 10 - ones, middle = a + first, rest = b - first;
        return { text: `${b}を ${first}と ${rest}に わけて、10の まとまりを つくろう。`,
            example: `${a} + ${first} = ${middle} → ${middle} + ${rest} = ${result}` };
    }
    if (!addition && ones > 0 && b > ones) {
        const middle = a - ones, rest = b - ones;
        return { text: `${b}を ${ones}と ${rest}に わけて、じゅんに ひこう。`,
            example: `${a} − ${ones} = ${middle} → ${middle} − ${rest} = ${result}` };
    }
    return { text: `${a}から ${b}こ ${addition ? 'すすんで' : 'もどって'}、かぞえよう。` };
}
