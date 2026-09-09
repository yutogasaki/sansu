import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LearningAnswerForm } from './LearningAnswerForm';
import { TenKey } from './TenKey';
import type { LearningSlot } from '../../domain/park/types';

const noop = () => undefined;
const slot: LearningSlot = { problem: { id: 'input-fixture', subject: 'math', categoryId: 'sub_tiny',
    questionText: '3 - 1 =', inputType: 'number', correctAnswer: '2', isReview: false },
    source: 'main', assisted: false, completed: false, countsTowardReviewCap: false };

describe('nonverbal answer confirmation', () => {
    it('keeps Enter in place but inactive for automatic input, independently of correctness', () => {
        for (const correctAnswer of ['2', '9']) {
            const html = renderToStaticMarkup(<LearningAnswerForm slot={{ ...slot, problem: { ...slot.problem, correctAnswer } }} disabled={false} onAnswer={noop} />);
            expect(html).toContain('data-answer-completion="automatic"');
            expect(html).toContain('data-confirmation-mode="automatic"');
            expect(html).not.toContain('data-confirmation-cue="intro"');
            expect(html).not.toContain('aria-label="しょうすうてん"');
            expect(html).toMatch(/<button[^>]*disabled=""[^>]*data-keypad-submit/);
        }
    });
    it('only cues a complete, enabled manual confirmation', () => {
        const props = { onInput: noop, onDelete: noop, onClear: noop, onEnter: noop };
        for (const disabled of [false, true]) for (const enterDisabled of [false, true]) {
            const html = renderToStaticMarkup(<TenKey {...props} confirmationMode="manual" disabled={disabled} enterDisabled={enterDisabled} />);
            expect(html.includes('data-confirmation-cue="intro"')).toBe(!disabled && !enterDisabled);
        }
        expect(renderToStaticMarkup(<TenKey {...props} />)).not.toContain('data-confirmation-state');
    });

    it('keeps the digit positions while removing written confirmation and arrow actions', () => {
        const props = { onInput: noop, onDelete: noop, onClear: noop, onEnter: noop, onCursorMove: noop, writtenInput: true };
        const automatic = renderToStaticMarkup(<TenKey {...props} confirmationMode="automatic" />);
        expect(automatic).toContain('data-written-auto-confirm');
        expect(automatic).not.toContain('data-keypad-submit');
        expect(automatic).not.toContain('aria-label="カーソルを');
        expect([...automatic.matchAll(/aria-label="(\d)"/g)].map(match => match[1])).toEqual(['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']);
        const retrySave = renderToStaticMarkup(<TenKey {...props} confirmationMode="manual" />);
        expect(retrySave).toContain('data-keypad-submit');
        expect(retrySave).toContain('data-confirmation-state="ready"');
    });

    it('starts a saved written retry with only the correctly supplied digits', () => {
        const problem = { ...slot.problem, categoryId: 'mul_3d1d', questionText: '123 × 4 =', correctAnswer: '492', hissanVersion: 2 as const, inputType: 'hissan' as const };
        const html = renderToStaticMarkup(<LearningAnswerForm slot={{ ...slot, problem }} disabled={false} onAnswer={noop} retryAnswer={['7', '9', '5']} />);
        expect(html).toContain('data-written-correction="true"');
        expect(html).toContain('あいたマスを なおそう');
        expect(html).toMatch(/data-written-input="2-2"[^>]*>9<\/button>/);
        expect(html).toMatch(/data-active="true"[^>]*data-written-input="2-1"/);
    });
});
