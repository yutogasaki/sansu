import type { Problem } from '../../domain/types';

/** Refer only to the displayed task; the same picture can ask for different things. */
export function visualLearningHint(problem: Problem): string | undefined {
    const visual = problem.questionVisual;
    if (!visual) return undefined;
    switch (visual.kind) {
        case 'single-items':
            if (['compose_5', 'compose_10'].includes(problem.categoryId) && visual.style === 'frame') {
                return '絵のない マスを、かぞえよう。';
            }
            if (problem.categoryId === 'same_count_match') return 'おてほんの 絵と、えらぶ 絵を ひとつずつ ペアにしよう。';
            if (problem.categoryId === 'which_is_empty') return 'マスの なかに、絵が ひとつでも あるか みてみよう。';
            return '絵だけを ひとつずつ かぞえよう。';
        case 'addition-items': return 'ふたつの 絵の まとまりを、あわせて かぞえよう。';
        case 'subtraction-items': return '左の 絵から、右の 絵の 数だけ へらしてみよう。';
        case 'sharing-items': return 'ひとりに 1こずつ、じゅんばんに くばろう。ひとり分は いくつかな。';
        case 'comparison-items': return 'ふたつの 絵を ひとつずつ ペアにしよう。あまる ほうが 多いよ。';
        case 'comparison-base10': return 'ぼうは 10、まるは 1。まず ぼうの 数を くらべよう。';
        case 'number-card': return '絵を かぞえながら、声に だしてみよう。その よみかたを えらぼう。';
        case 'number-sequence': return '空らんの となりの 数から、じゅんに かぞえてみよう。';
        case 'number-line': {
            const { start, step, hiddenValues, hiddenTarget } = visual.line;
            // The reverse-addition start and the destination can be the hidden answer.
            if (hiddenValues?.includes(start) || !hiddenTarget || !step) return undefined;
            return `${start}から ${step > 0 ? '右' : '左'}へ、めもりを ${Math.abs(step)}こ すすもう。`;
        }
        case 'ordinal-row': {
            if (visual.showPlaceholder) return '絵が どんな じゅんで くりかえすか、左から みてみよう。';
            const prompt = visual.prompt ?? problem.questionText ?? '';
            const side = prompt.includes('みぎ') ? 'みぎ' : prompt.includes('ひだり') ? 'ひだり' : undefined;
            return side ? `${side}の はしを 1ばんにして、ひとつずつ かぞえよう。` : 'はしの 絵を 1ばんにして、もんだいの むきから かぞえよう。';
        }
        case 'length-compare': return visual.direction === 'vertical'
            ? '下を そろえて、上の はしが どこまで のびているか くらべよう。'
            : '左の はしを そろえて、右の はしを くらべよう。';
        case 'balance-compare': return 'てんびんの 下がった ほうが、おもいよ。';
        // Arithmetic/number-line templates are handled from the frozen expression.
        default: return undefined;
    }
}
