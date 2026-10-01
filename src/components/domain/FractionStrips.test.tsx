import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MathProblemPrompt } from './MathProblemPrompt';
import { generateMathProblem } from '../../domain/math';
import { createInitialProfile } from '../../domain/user/profile';
import { createDefaultMemoryState } from '../../domain/types';

describe('fraction quantity diagrams', () => {
    it('uses the same whole width, visible non-color fill marks and the actual comparison prompt', () => {
        const profile = createInitialProfile('T', 1, 21, 1, 'math');
        profile.mathSkills.foundation_fraction = { ...createDefaultMemoryState('foundation_fraction', 'math', true), independentCorrectAnswers: 1 };
        const problem = generateMathProblem('foundation_fraction', { profile, random: () => 0 });
        const html = renderToStaticMarkup(<MathProblemPrompt problem={problem} />);
        expect(html).toContain('1/3 □ 1/4');
        expect(html.match(/role="img"/g)).toHaveLength(2);
        expect(html.match(/data-filled-cell="true"/g)).toHaveLength(2);
        expect(html.match(/>●<\/span>/g)).toHaveLength(2);
        expect(html).toContain('repeat(3, minmax(0, 1fr))');
        expect(html).toContain('repeat(4, minmax(0, 1fr))');
        expect(html).toContain('1を3等分したうち1こぶん');
        expect(html).toContain('1を4等分したうち1こぶん');
        expect(html.match(/grid h-8 w-full/g)).toHaveLength(2);
        expect(html.indexOf('data-visual-caption')).toBeLessThan(html.indexOf('data-visual-surface="fraction-strips"'));
    });
});
