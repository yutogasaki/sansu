import { describe, expect, it } from 'vitest';
import { generateMathProblem } from '../../domain/math';
import { buildSubtractionBackAddVisual } from '../../domain/math/problemVisuals';
import { createSeededRandom } from '../../utils/random';
import { visualLearningHint } from './visualLearningGuidance';

const generated = (id: string) => generateMathProblem(id, { random: createSeededRandom(`hint:${id}`) });

describe('visual math hints follow the question, not just its picture', () => {
    it.each(['compose_5', 'compose_10'])('counts empty spaces for %s, keeping the frozen assignment intact', id => {
        const problem = generated(id), before = structuredClone(problem);
        expect(problem.questionVisual?.kind).toBe('single-items');
        expect(visualLearningHint(problem)).toContain('絵のない マス');
        const counting = { ...problem, categoryId: 'count_10', questionText: 'いくつ ある？' };
        expect(visualLearningHint(counting)).toContain('絵だけを');
        expect(problem).toEqual(before);
    });
    it('distinguishes counting, matching, empty and numeral-reading tasks', () => {
        expect(visualLearningHint(generated('same_count_match'))).toContain('ペア');
        expect(visualLearningHint(generated('which_is_empty'))).toContain('ひとつでも あるか');
        expect(visualLearningHint(generated('count_read'))).toContain('よみかた');
    });
    it('describes the two subtraction groups actually rendered by the island', () => {
        const subtraction = generated('sub_tiny');
        expect(subtraction.questionVisual?.kind).toBe('subtraction-items');
        expect(visualLearningHint(subtraction)).toContain('左の 絵から、右の 絵の 数だけ');
        expect(visualLearningHint(subtraction)).not.toContain('線');
    });
    it('does not treat a repeating picture pattern as an ordinal-counting task', () => {
        const ordinal = generated('ordinal_small');
        expect(ordinal.questionVisual?.kind).toBe('ordinal-row');
        expect(visualLearningHint(ordinal)).toContain('1ばん');
        if (ordinal.questionVisual?.kind !== 'ordinal-row') throw new Error('Expected ordinal fixture');
        const pattern = { ...ordinal, questionVisual: { ...ordinal.questionVisual, showPlaceholder: true } };
        expect(visualLearningHint(pattern)).toContain('くりかえす');
        expect(visualLearningHint(pattern)).not.toContain('1ばん');
    });
    it('uses the visible number-line starting point without exposing a hidden reverse-addition answer', () => {
        expect(visualLearningHint(generated('count_50'))).toContain('右へ、めもりを 1こ');
        const reverse = { ...generated('sub_2d1d_back_add'), ...buildSubtractionBackAddVisual(32, 8) };
        expect(visualLearningHint(reverse)).toBeUndefined();
    });
});
