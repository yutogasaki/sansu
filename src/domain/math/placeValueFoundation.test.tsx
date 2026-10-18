import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateMathProblem } from './index';
import { createSeededRandom } from '../../utils/random';
import { BaseTenDiagram } from '../../components/domain/BaseTenDiagram';
import { MathProblemPrompt } from '../../components/domain/MathProblemPrompt';
import { buildPrintableMathPrompt } from '../test/printability';
import { baseTenVisual } from './baseTenVisual';
import { islandLearningGuidance } from '../../components/island/learningGuidance';

const make = (mode: number, random = createSeededRandom('place-value')) => ({ ...generateMathProblem('foundation_expanded', {
    random, preferredLearningVariant: `intro-${mode}`,
}), id: 'place-value-fixture', subject: 'math' as const, isReview: false });
const quantity = (b: { hundreds: number; tens: number; ones: number }) => b.hundreds * 100 + b.tens * 10 + b.ones;

describe('place value means quantities rather than arbitrary symbols', () => {
    it('reads the actual blocks, including absent tens and ones and the full digit range', () => {
        const random = createSeededRandom('zeros-and-nines'), seenTens = new Set(), seenOnes = new Set();
        for (let i = 0; i < 300; i++) {
            const p = make(0, random), visual = p.questionVisual;
            expect(visual?.kind).toBe('base-ten-blocks');
            if (visual?.kind !== 'base-ten-blocks') throw new Error('missing blocks');
            const b = visual.groups[0].blocks;
            expect(p.correctAnswer).toBe(String(quantity(b)));
            expect(p.questionText).toBe('ぜんぶで いくつ？');
            seenTens.add(b.tens); seenOnes.add(b.ones);
            expect(buildPrintableMathPrompt(p)).toContain(`10のぼう${b.tens}本`);
        }
        expect(seenTens.size).toBe(10); expect(seenOnes.size).toBe(10);
    });
    it('has exactly one correct diagram, a swapped zero place and varying answer positions', () => {
        const random = createSeededRandom('choices'), positions = new Set();
        for (let i = 0; i < 90; i++) {
            const p = make(1, random), visual = p.questionVisual;
            if (visual?.kind !== 'base-ten-blocks') throw new Error('missing blocks');
            const target = Number(p.questionText?.match(/^\d+/)?.[0]);
            const matches = visual.groups.filter(g => quantity(g.blocks) === target);
            expect(matches).toHaveLength(1);
            expect(matches[0].label).toBe(p.correctAnswer);
            expect(p.inputConfig?.choices?.map(c => c.value)).toEqual(visual.groups.map(g => g.label));
            expect(new Set(visual.groups.map(g => quantity(g.blocks))).size).toBe(3);
            expect(matches[0].blocks.tens === 0 || matches[0].blocks.ones === 0).toBe(true);
            positions.add(p.correctAnswer);
        }
        expect(positions.size).toBe(3);
    });
    it('exchanges ten rods for a plate without changing the quantity', () => {
        const random = createSeededRandom('exchanges');
        for (let i = 0; i < 30; i++) {
            const p = make(2, random), visual = p.questionVisual;
            if (visual?.kind !== 'base-ten-blocks') throw new Error('missing blocks');
            const b = visual.groups[0].blocks;
            expect(b.tens).toBe(10); expect(b.ones).toBe(0);
            expect(Number(p.correctAnswer) * 100).toBe(quantity(b));
            expect(islandLearningGuidance(p)?.text).toContain('ぼう10本で 板1まい');
            const restored = JSON.parse(JSON.stringify(p));
            expect(renderToStaticMarkup(<MathProblemPrompt problem={restored} />)).toBe(renderToStaticMarkup(<MathProblemPrompt problem={p} />));
        }
    });
    it('repairs legacy presentation without rewriting the frozen reservation', () => {
        const legacy = { ...make(0), questionText: '100が 1こ、10が 4こ、1が 4こ。あわせて？', correctAnswer: '144',
            questionVisual: { kind: 'item-order' as const, groups: [
                { emoji: '🟥', label: '1こが100', count: 1 }, { emoji: '🟦', label: '1こが10', count: 4 }, { emoji: '●', label: '1こが1', count: 4 },
            ] } };
        const frozen = JSON.stringify(legacy);
        const html = renderToStaticMarkup(<MathProblemPrompt problem={legacy} />);
        expect(html).toContain('data-base-ten-diagram');
        expect(html).not.toContain('1こが1');
        expect(JSON.stringify(legacy)).toBe(frozen);
        expect(baseTenVisual({ ...legacy, categoryId: 'foundation_groups' })).toBeUndefined();
    });
    it('draws 100, 10 and 1 equal-sized unit cells, with no color dependency', () => {
        const html = renderToStaticMarkup(<BaseTenDiagram blocks={{ hundreds: 1, tens: 1, ones: 1 }} />);
        expect(html.match(/<rect /g)).toHaveLength(111);
        expect(html.match(/width="1" height="1"/g)).toHaveLength(111);
        expect(html).toContain('100の板1まい、10のぼう1本、1のマス1こ');
    });
});
