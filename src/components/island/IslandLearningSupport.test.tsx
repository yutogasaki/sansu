import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Problem } from '../../domain/types';
import type { IslandLearningSlot, IslandPlan } from '../../domain/island/types';
import { parkHissanGrid } from '../../domain/park/learning';
import { IslandLearningSupport } from './IslandLearningSupport';
import { IslandAnswerForm } from './IslandAnswerForm';
import { IslandLearningPanel } from './IslandLearningPanel';

const arithmetic: Problem = { id: 'frozen', subject: 'math', categoryId: 'add_1d_2', questionText: '8 + 7 =',
    correctAnswer: '15', inputType: 'number', isReview: true };
const slot = (problem = arithmetic, supportStage: IslandLearningSlot['supportStage'] = 'hint'): IslandLearningSlot => ({
    problem, source: 'due', countsTowardReviewCap: true, assisted: true, completed: false, supportStage,
});
const html = (current: IslandLearningSlot) => renderToStaticMarkup(<IslandLearningSupport slot={current} />);
const noop = () => undefined;
const labels = (markup: string) => [...markup.matchAll(/<button[^>]*aria-label="([^"]+)"/g)].map(match => match[1]);
const formats: [string, Problem][] = [
    ['count', { ...arithmetic, categoryId: 'count_5', questionText: 'いくつ？', correctAnswer: '3',
        questionVisual: { kind: 'single-items', group: { emoji: '🍎', label: 'りんご', count: 3 }, frameSize: 5 } }],
    ['number', arithmetic],
    ['choice', { ...arithmetic, questionText: 'つぎは どれ？', inputType: 'choice', correctAnswer: '2',
        inputConfig: { choices: [{ label: '2', value: '2' }, { label: '3', value: '3' }] } }],
    ['fraction', { ...arithmetic, categoryId: 'frac_add_same', questionText: '1/4 + 2/4 =', correctAnswer: ['3', '4'],
        inputType: 'multi-number', inputConfig: { fields: [{ label: '分子', length: 2 }, { label: '分母', length: 2 }] } }],
    ['hissan', { ...arithmetic, categoryId: 'add_2d1d_hissan_nc', questionText: '23 + 4 =', correctAnswer: '27', inputType: 'hissan' }],
    ['vocab', { ...arithmetic, subject: 'vocab', categoryId: 'apple', questionText: 'apple', correctAnswer: 'apple', displayAnswer: 'りんご',
        inputType: 'choice', inputConfig: { choices: [{ label: 'りんご', value: 'apple' }, { label: 'はな', value: 'flower' }] } }],
];

describe('Island staged assistance presentation', () => {
    it('shows the method in a hint while withholding the worked example and final answer', () => {
        const hint = html(slot());
        expect(hint).toContain('7を 2と 5に わけて');
        expect(hint).not.toContain('15');
        expect(hint).not.toContain('こたえは');
        expect(hint).not.toContain('island-support-example');
        const model = html(slot(arithmetic, 'model'));
        expect(model).toContain('8 + 2 = 10 → 10 + 5 = 15');
        expect(model).toContain('こたえは');
        expect(model).not.toContain('いれてみよう');
    });

    it.each(formats)('keeps %s inputs unchanged while the hint is available', (_name, problem) => {
        const independent = renderToStaticMarkup(<IslandAnswerForm slot={{ ...slot(problem), assisted: false, supportStage: undefined }} disabled={false} onAnswer={noop} />);
        const assisted = renderToStaticMarkup(<IslandAnswerForm slot={slot(problem)} disabled={false} onAnswer={noop} />);
        expect(labels(assisted)).toEqual(labels(independent));
        if (problem.inputType !== 'choice') {
            for (const key of ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'こたえを けす', 'ひとつ もどす']) expect(labels(assisted)).toContain(key);
        }
        expect(assisted).toContain('data-support-stage="hint"');
        expect(assisted).not.toContain('こたえは');
    });

    it.each(formats)('keeps %s live controls mounted but actually disabled in model mode', (_name, problem) => {
        const current = slot(problem, 'model');
        const before = JSON.stringify(current);
        const rendered = renderToStaticMarkup(<IslandAnswerForm slot={current} disabled={false} onAnswer={noop} />);
        expect(rendered).toContain('data-support-stage="model"');
        const allButtons = [...rendered.matchAll(/<button\b[^>]*>/g)].map(match => match[0]);
        // Listening to the visible word is available during a model; answer input stays locked.
        const speech = allButtons.find(button => button.includes('aria-label="えいごを きく"'));
        if (problem.subject === 'vocab') {
            expect(speech).toBeDefined();
            expect(speech).not.toContain('disabled=""');
        } else expect(speech).toBeUndefined();
        const buttons = allButtons.filter(button => !button.includes('aria-label="えいごを きく"'));
        expect(buttons.length).toBeGreaterThan(0);
        expect(buttons.every(button => button.includes('disabled=""'))).toBe(true);
        expect(JSON.stringify(current)).toBe(before);
    });

    it.each([
        { ...arithmetic, categoryId: 'mul_2d2d', questionText: '23 × 14 =', correctAnswer: '322', inputType: 'hissan' as const, hissanVersion: 2 as const },
        { ...arithmetic, categoryId: 'div_3d1d', questionText: '156 ÷ 3 =', correctAnswer: '52', inputType: 'hissan' as const, hissanVersion: 2 as const },
    ])('shows all worked rows for $questionText without filling the saved Hissan state', problem => {
        const current = { ...slot(problem, 'model'), hissanStep: 1, hissanValues: { '0-1': '9' } };
        const before = structuredClone(current);
        const grid = parkHissanGrid(problem)!;
        expect(grid.steps.length).toBeGreaterThan(2);
        const rendered = html(current);
        expect(rendered).toContain(`data-written-step="${grid.steps.length}"`);
        for (const [index, row] of grid.rows.entries()) if (row.type !== 'separator') expect(rendered).toContain(`data-row="${index}"`);
        expect(rendered).not.toContain('data-written-input=');
        expect(rendered).not.toContain('<button');
        expect(current).toEqual(before);
    });

    it('keeps Hissan hints free of correct row values and supports old answer-exposed slots', () => {
        const problem = formats.find(([name]) => name === 'hissan')![1];
        const hint = html(slot(problem));
        expect(hint).toContain('おなじ くらいを たそう');
        for (const value of parkHissanGrid(problem)!.steps.flatMap(step => step.correctValues)) expect(hint).not.toContain(value);
        const legacy = slot(arithmetic);
        delete legacy.supportStage;
        expect(html(legacy)).toContain('おてほん');
        expect(html(legacy)).toContain('15');
    });

    it('offers only the appropriate support action without adding an ordinary completion tap', () => {
        const plan = (current: IslandLearningSlot): IslandPlan => ({ id: 'plan', profileId: 'child', schemaVersion: 1,
            plannerVersion: 'island-learning-v1', subject: 'math', status: 'active', revision: 0, cursor: 0,
            slots: [current], rewardId: 'reward', rewardChoices: ['bench', 'flower', 'lantern'], startedAt: 1 });
        const render = (current: IslandLearningSlot) => renderToStaticMarkup(<IslandLearningPanel plan={plan(current)} busy={false} onAction={noop} />);
        const ordinary = render({ ...slot(), assisted: false, supportStage: undefined });
        expect(ordinary).toContain('ヒントを みる');
        expect(ordinary).toContain('わからない');
        expect(ordinary).not.toContain('つぎへ すすむ');
        const hint = render(slot());
        expect(hint).toContain('おてほんを みる');
        expect(hint).not.toContain('わからない');
        expect(hint).not.toContain('つぎへ すすむ');
        const model = render(slot(arithmetic, 'model'));
        expect(model).toContain('つぎへ すすむ');
        expect(model).not.toContain('おてほんを みる');
        expect(model).not.toContain('わからない');
        expect(model).not.toContain('わかった');
    });
});
