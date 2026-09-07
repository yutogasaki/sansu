import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Problem, ProblemVisual } from '../../domain/types';
import type { LearningSlot } from '../../domain/park/types';
import { generateMathProblem, MATH_GENERATORS } from '../../domain/math';
import { createSeededRandom } from '../../utils/random';
import { MathProblemPrompt } from '../domain/MathProblemPrompt';
import { LearningAnswerForm } from '../domain/LearningAnswerForm';
import { ParkAnswerForm } from '../park/ParkAnswerForm';
import { IslandAnswerForm } from './IslandAnswerForm';
import { IslandProblemPrompt, IslandChoiceLabel } from './IslandProblemPrompt';
import { IslandGlyph } from './IslandGlyph';
import { ISLAND_GLYPH_LABELS, splitIslandLabel } from './islandGlyphs';

const base: Problem = { id: 'reserved-1', subject: 'math', categoryId: 'fixture', questionText: '7 + 8 =', inputType: 'number', correctAnswer: '15', isReview: true };
const apple = { emoji: '🍎', label: 'りんご' };
const orange = { emoji: '🍊', label: 'みかん' };
const a2 = { ...apple, count: 2 };
const o1 = { ...orange, count: 1 };
const slot = (problem = base): LearningSlot => ({ problem, source: 'due', countsTowardReviewCap: true, assisted: false, completed: false });
const noop = () => undefined;
const glyphs = (html: string) => [...html.matchAll(/data-island-glyph="([^"]*)"/g)].map(match => match[1]);
const count = (html: string, needle: string) => html.split(needle).length - 1;
const renderVisual = (questionVisual: ProblemVisual) => renderToStaticMarkup(<IslandProblemPrompt problem={{ ...base, questionVisual }} />);

// Independent examples cover every persisted schema, including two older families
// which current generators no longer emit. Their ordering is part of the task.
const families: [ProblemVisual, string[]][] = [
    [{ kind: 'number-card', card: { value: 2, supportGroup: a2, frameSize: 5, columns: 5 } }, ['🍎', '🍎']],
    [{ kind: 'reference-choice-grid', grid: { reference: apple, choices: [orange, apple], columns: 2 } }, ['🍎', '🍊', '🍎']],
    [{ kind: 'single-items', group: a2, frameSize: 5, style: 'frame' }, ['🍎', '🍎']],
    [{ kind: 'addition-items', groups: [a2, o1] }, ['🍎', '🍎', '🍊']],
    [{ kind: 'subtraction-items', group: { ...a2, crossedOutCount: 1 }, takenAwayCount: 1 }, ['🍎', '🍎', '🍎']],
    [{ kind: 'sharing-items', source: a2, recipients: { emoji: '🙂', label: 'ともだち', count: 3 } }, ['🍎', '🍎', '🙂', '🙂', '🙂']],
    [{ kind: 'comparison-items', groups: [a2, o1] }, ['🍎', '🍎', '🍊']],
    [{ kind: 'comparison-base10', groups: [{ label: 'ひだり', value: 21 }, { label: 'みぎ', value: 13 }] }, []],
    [{ kind: 'operation-base10', operator: '−', groups: [{ label: 'ひだり', value: 21 }, { label: 'みぎ', value: 13 }] }, []],
    [{ kind: 'number-sequence', slots: [{ value: 2 }, { value: null }, { value: 4 }] }, []],
    [{ kind: 'number-line', line: { min: 1, max: 5, start: 2, end: 4, step: 2, hiddenTarget: true, highlightValues: [2] } }, []],
    [{ kind: 'item-order', groups: [o1, a2] }, ['🍊', '🍎', '🍎']],
    [{ kind: 'ordinal-row', items: [orange, apple, orange], showPlaceholder: true }, ['🍊', '🍎', '🍊']],
    [{ kind: 'length-compare', bars: [{ ...apple, length: 2, tone: 'rose' }, { ...orange, length: 5, tone: 'amber' }] }, ['🍎', '🍊']],
    [{ kind: 'category-sort', target: apple, buckets: [{ label: 'くだもの', tone: 'rose', items: [orange, apple] }] }, ['🍎', '🍊', '🍎']],
    [{ kind: 'balance-compare', items: [{ ...apple, weight: 2 }, { ...orange, weight: 5 }] }, ['🍎', '🍊']],
    [{ kind: 'position-scene', scene: 'front-back', target: apple, reference: orange, relation: 'うしろ' }, ['🍊', '🍎']],
    [{ kind: 'item-grid', items: [apple, orange, apple], columns: 3 }, ['🍎', '🍊', '🍎']],
    [{ kind: 'item-pair', items: [{ ...apple, scale: 2 }, { ...orange, scale: 1 }], orientation: 'column' }, ['🍎', '🍊']],
];

describe('Island problem semantic presentation', () => {
    it.each(families.map(([visual, expected]) => [visual.kind, visual, expected] as const))('preserves %s items and order', (_kind, visual, expected) => {
        const before = JSON.stringify(visual);
        const html = renderVisual(visual);
        expect(glyphs(html)).toEqual(expected);
        expect(html).toContain(`data-problem-visual="${visual.kind}"`);
        expect(JSON.stringify(visual)).toBe(before);
    });

    it('keeps empty ten-frame holes empty and keeps the exact filled count', () => {
        const html = renderVisual({ kind: 'single-items', group: { ...apple, count: 6 }, frameSize: 10, columns: 5, style: 'frame' });
        expect(count(html, 'data-count-slot="filled"')).toBe(6);
        expect(count(html, 'data-count-slot="empty"')).toBe(4);
        expect(glyphs(html)).toHaveLength(6);
    });

    it('preserves actual crossed-out items; subtraction keeps source and removed group separate', () => {
        const crossed = renderVisual({ kind: 'item-order', groups: [{ ...apple, count: 5, crossedOutCount: 2 }] });
        expect(count(crossed, 'data-crossed-out="true"')).toBe(2);
        expect(glyphs(crossed)).toHaveLength(5);
        const subtraction = renderVisual({ kind: 'subtraction-items', group: { ...apple, count: 5, crossedOutCount: 2 }, actionLabel: 'なくなる' });
        expect(count(subtraction, 'data-crossed-out="true"')).toBe(0);
        expect(subtraction).toContain('data-visual-count="5"');
        expect(subtraction).toContain('data-visual-count="2"');
        expect(subtraction).toContain('data-visual-operator="−"');
        expect(glyphs(subtraction)).toHaveLength(7);
    });

    it('retains base-ten unit counts, number-line holes, and a backwards step', () => {
        const html = renderVisual({ kind: 'operation-base10', operator: '+', groups: [{ label: 'もと', value: 21 }, { label: 'ふえる', value: 13 }] });
        expect(count(html, 'data-base10-unit="ten"')).toBe(3);
        expect(count(html, 'data-base10-unit="one"')).toBe(4);
        expect(html).toContain('data-visual-operator="+"');
        const line = renderVisual({ kind: 'number-line', line: { min: 3, max: 7, start: 7, end: 4, step: -3, hiddenTarget: true, hiddenValues: [5] } });
        expect(count(line, 'data-visual-hidden="true"')).toBe(2);
        expect(line).toMatch(/data-visual-value="4" data-visual-hidden="true"[^>]*>\?<\/div>/);
        expect(line).toContain('<span>←</span><span>3</span>');
    });

    it('keeps the same scale, length, balance and spatial geometry as the shared renderer', () => {
        for (const [visual] of families.filter(([v]) => ['item-pair', 'length-compare', 'balance-compare', 'position-scene'].includes(v.kind))) {
            const legacy = renderToStaticMarkup(<MathProblemPrompt problem={{ ...base, questionVisual: visual }} />);
            const themed = renderVisual(visual);
            const styles = (html: string) => [...html.matchAll(/style="([^"]+)"/g)].map(match => match[1]);
            expect(styles(themed)).toEqual(styles(legacy));
        }
    });

    it('uses the same glyphs in repeated, mixed-text choice labels without changing values', () => {
        const problem: Problem = { ...base, inputType: 'choice', inputConfig: { choices: [{ label: '🍎 🍎', value: '2' }, { label: '🍊 みかん', value: 'orange' }] } };
        const html = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        expect(glyphs(html)).toEqual(['🍎', '🍎', '🍊']);
        expect([...html.matchAll(/data-choice-value="([^"]*)"/g)].map(match => match[1])).toEqual(['2', 'orange']);
        expect(html).toContain('aria-label="🍎 🍎"');
        expect(html).toContain('aria-label="🍊 みかん"');
        const unknown = renderToStaticMarkup(<IslandChoiceLabel choice={{ label: '🦄 むかしのもの', value: 'legacy' }} problem={problem} />);
        expect(unknown).toContain('data-glyph-renderer="literal"');
        expect(unknown).toContain('🦄');
        expect(splitIslandLabel('🍎  🍎\n🧑🏽‍🚀')).toEqual([{ kind: 'glyph', value: '🍎' }, { kind: 'text', value: '  ' }, { kind: 'glyph', value: '🍎' }, { kind: 'text', value: '\n' }, { kind: 'glyph', value: '🧑🏽‍🚀' }]);
    });

    it.each(['count_shape', 'count_color', 'count_pair'])('shows %s options once on the answer buttons while retaining the reference', skillId => {
        const problem = { ...base, ...generateMathProblem(skillId, { random: createSeededRandom(`island-options:${skillId}`) }) };
        const before = JSON.stringify(problem);
        const visual = problem.questionVisual;
        if (visual?.kind !== 'reference-choice-grid') throw new Error('Expected a reference choice fixture');
        const prompt = renderToStaticMarkup(<IslandProblemPrompt problem={problem} />);
        const answer = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        const shared = renderToStaticMarkup(<MathProblemPrompt problem={problem} renderItem={item => <IslandGlyph symbol={item.emoji} label={item.label} />} />);
        expect(glyphs(prompt)).toEqual([visual.grid.reference.emoji]);
        expect(prompt).toContain(visual.prompt);
        expect(glyphs(answer)).toEqual([visual.grid.reference.emoji, ...visual.grid.choices.map(item => item.emoji)]);
        expect(glyphs(shared)).toEqual([visual.grid.reference.emoji, ...visual.grid.choices.map(item => item.emoji)]);
        expect([...answer.matchAll(/data-choice-value="([^"]*)"/g)].map(match => match[1])).toEqual(problem.inputConfig!.choices!.map(choice => choice.value));
        for (const choice of problem.inputConfig!.choices!) expect(answer).toContain(`aria-label="${choice.label}"`);
        expect(JSON.stringify(problem)).toBe(before);
    });

    it('retains sequence order, placeholders, and odd-one-out quantities even when objects also appear on the buttons', () => {
        const choices = { choices: [{ label: orange.emoji, value: orange.emoji }, { label: apple.emoji, value: apple.emoji }] };
        const sequence: Problem = { ...base, inputType: 'choice', inputConfig: choices,
            questionVisual: { kind: 'ordinal-row', items: [orange, apple, orange, apple], showPlaceholder: true, prompt: 'つぎは どれ？' } };
        const sequenceHtml = renderToStaticMarkup(<IslandAnswerForm slot={slot(sequence)} disabled={false} onAnswer={noop} />);
        expect(glyphs(sequenceHtml)).toEqual(['🍊', '🍎', '🍊', '🍎', '🍊', '🍎']);
        expect(sequenceHtml).toContain('data-visual-surface="ordinal"');
        expect(sequenceHtml).toContain('つぎは どれ？');
        expect(sequenceHtml).toContain('>?</');
        const oddOneOut: Problem = { ...sequence, questionVisual: { kind: 'item-grid', items: [apple, apple, orange, apple], columns: 4, prompt: 'なかまはずれ は？' } };
        const oddHtml = renderToStaticMarkup(<IslandAnswerForm slot={slot(oddOneOut)} disabled={false} onAnswer={noop} />);
        expect(glyphs(oddHtml)).toEqual(['🍎', '🍎', '🍊', '🍎', '🍊', '🍎']);
        expect(oddHtml).toContain('grid-template-columns:repeat(4, minmax(0, 1fr))');
    });

    it('keeps an unfamiliar saved reference grid complete when its illustrations do not match the answer set', () => {
        const problem: Problem = { ...base, inputType: 'choice',
            questionVisual: { kind: 'reference-choice-grid', grid: { reference: apple, choices: [orange, apple], columns: 2 } },
            inputConfig: { choices: [{ label: 'ひだり', value: 'left' }, { label: 'みぎ', value: 'right' }] } };
        const html = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        expect(glyphs(html)).toEqual(['🍎', '🍊', '🍎']);
        expect(html).toContain('data-choice-value="left"');
        expect(html).toContain('data-choice-value="right"');
    });

    it('does not add object clues or answer-derived illustrations to words and symbolic arithmetic', () => {
        const vocab: Problem = { ...base, subject: 'vocab', questionText: 'apple', correctAnswer: 'apple', displayAnswer: 'りんご', inputType: 'choice', inputConfig: { choices: [{ label: 'りんご', value: 'apple' }, { label: 'はな', value: 'flower' }] } };
        const html = renderToStaticMarkup(<IslandAnswerForm slot={slot(vocab)} disabled={false} onAnswer={noop} />);
        expect(glyphs(html)).toEqual([]);
        expect(html).toContain('>apple</span>');
        expect(glyphs(renderToStaticMarkup(<IslandProblemPrompt problem={base} />))).toEqual([]);
    });

    it('uses the same object in persisted assistance while leaving unassisted answers concealed', () => {
        const problem: Problem = { ...base, inputType: 'choice', correctAnswer: '🍎', inputConfig: { choices: [{ label: '🍎', value: '🍎' }, { label: '🍊', value: '🍊' }] } };
        const independent = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        const assisted = renderToStaticMarkup(<IslandAnswerForm slot={{ ...slot(problem), assisted: true }} disabled={false} onAnswer={noop} />);
        expect(count(assisted, 'data-island-glyph="🍎"')).toBe(count(independent, 'data-island-glyph="🍎"') + 1);
        expect(assisted).toContain('こたえは <span class="island-choice-label"><svg');
        expect(independent).not.toContain('class="park-support"');
        const park = renderToStaticMarkup(<ParkAnswerForm slot={{ ...slot(problem), assisted: true }} disabled={false} onAnswer={noop} />);
        expect(park).toContain('こたえは 🍎。');
        expect(park).not.toContain('data-island-glyph');
    });

    it('draws every curated symbol and preserves exact teaching colors and shape classes', () => {
        for (const symbol of Object.keys(ISLAND_GLYPH_LABELS)) {
            expect(renderToStaticMarkup(<IslandGlyph symbol={symbol} />)).toContain('data-glyph-renderer="vector"');
        }
        for (const [symbol, shape, color] of [['🔴', 'circle', '#e44343'], ['🔺', 'triangle', '#e44343'], ['🟦', 'square', '#268bda'], ['●', 'circle', '#354739']]) {
            const html = renderToStaticMarkup(<IslandGlyph symbol={symbol} />);
            expect(html).toContain(`data-glyph-shape="${shape}"`);
            expect(html).toContain(`fill="${color}"`);
        }
    });

    it('has a curated equivalent for every symbol actually emitted by the current math generators', () => {
        const missing = new Set<string>();
        for (const [skillId, generate] of Object.entries(MATH_GENERATORS)) {
            for (let seed = 0; seed < 12; seed += 1) {
                const problem = { ...base, ...generate({ random: createSeededRandom(`${skillId}:${seed}`) }) };
                const before = JSON.stringify(problem);
                const html = renderToStaticMarkup(<IslandProblemPrompt problem={problem} />)
                    + (problem.inputConfig?.choices ?? []).map(choice => renderToStaticMarkup(<IslandChoiceLabel choice={choice} problem={problem} />)).join('');
                for (const match of html.matchAll(/data-island-glyph="([^"]*)" data-glyph-renderer="literal"/g)) missing.add(`${skillId}: ${match[1]}`);
                expect(JSON.stringify(problem)).toBe(before);
            }
        }
        expect([...missing]).toEqual([]);
    });
});

describe('shared answer input compatibility', () => {
    it('renders an optional support surface only for the assisted frozen slot', () => {
        const original = slot(), assisted = { ...original, assisted: true };
        const received: LearningSlot[] = [];
        const renderSupport = (current: LearningSlot) => { received.push(current); return <strong>もとの もんだいで たしかめよう</strong>; };
        const hidden = renderToStaticMarkup(<LearningAnswerForm slot={original} disabled={false} onAnswer={noop} renderSupport={renderSupport} />);
        expect(received).toEqual([]);
        expect(hidden).not.toContain('もとの もんだいで');
        const visible = renderToStaticMarkup(<LearningAnswerForm slot={assisted} disabled={false} onAnswer={noop} renderSupport={renderSupport} />);
        expect(received).toEqual([assisted]);
        expect(received[0]).toBe(assisted);
        expect(visible).toContain('class="park-support" role="note"><strong>もとの もんだいで たしかめよう</strong>');
        expect(visible).not.toContain('こたえは ');
    });

    it('leaves Park as the unthemed shared form', () => {
        const props = { slot: slot(), disabled: false, onAnswer: noop };
        expect(renderToStaticMarkup(<ParkAnswerForm {...props} />)).toBe(renderToStaticMarkup(<LearningAnswerForm {...props} />));
        expect(renderToStaticMarkup(<ParkAnswerForm {...props} />)).not.toContain('island-');
    });

    it('retains all number keys and action labels in their existing order', () => {
        const html = renderToStaticMarkup(<IslandAnswerForm slot={slot()} disabled={false} onAnswer={noop} />);
        const buttons = [...html.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(match => match[1]);
        expect(buttons).toEqual(['こたえ', '7', '8', '9', 'こたえを けす', '4', '5', '6', 'ひとつ もどす', '1', '2', '3', 'しょうすうてん', '0', 'こたえる']);
        expect(html).toContain('data-input-type="number"');
        expect(html).toContain('data-problem-id="reserved-1"');
    });

    it('keeps fraction operands, numerator/denominator fields and cursor controls', () => {
        const problem = { ...base, ...generateMathProblem('frac_add_same', { random: createSeededRandom('island-fraction') }) };
        const html = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        expect(count(html, 'border-b-2 border-slate-800')).toBe(2);
        const labels = problem.inputConfig!.fields!.map(field => field.label!);
        expect(labels).toEqual(['分子', '分母']);
        expect(html.indexOf('aria-label="分子"')).toBeLessThan(html.indexOf('aria-label="分母"'));
        expect(html).toContain('aria-label="カーソルを ひだりへ"');
        expect(html).toContain('aria-label="カーソルを みぎへ"');
    });

    it('keeps forced Hissan and persisted support on the same input surface', () => {
        const problem = { ...base, categoryId: 'add_2d1d_hissan_nc', questionText: '23 + 4 =', correctAnswer: '27' };
        const current = { ...slot(problem), assisted: true, supportStage: 'hint' as const, hissanStep: 0, hissanValues: {} };
        const html = renderToStaticMarkup(<IslandAnswerForm slot={current} disabled={false} onAnswer={noop} />);
        expect(html).toContain('data-input-type="hissan"');
        expect(html).toContain('class="park-support" role="note"');
        expect(html).toContain('おなじ くらいを たそう。');
        expect(html).toContain('class="park-keypad"');
        expect(html).not.toContain('class="park-inputs"');
        expect(html).not.toContain('island-problem-prompt');
    });
});
