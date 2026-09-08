import { describe, expect, it } from 'vitest';
import { islandFeedbackForReceipt } from './learningFeedback';

const before = { id: 'reserved-section', cursor: 1 };
const event = { id: 'saved-answer-receipt', planId: before.id, slotIndex: 1, type: 'answer' as const, result: 'correct' as const };

describe('Island saved answer presentation', () => {
    it('keeps a correct intermediate Hissan row separate from a completed question', () => {
        const intermediate = islandFeedbackForReceipt(before, { ...before }, event);
        expect(intermediate?.feedback.kind).toBe('step');
        expect(intermediate?.reaction).toBeUndefined();
        const complete = islandFeedbackForReceipt(before, { ...before, cursor: 2 }, event);
        expect(complete?.reaction).toEqual({ id: event.id, kind: 'correct' });
    });

    it('celebrates assisted completion without inventing a different receipt', () => {
        const result = islandFeedbackForReceipt(before, { ...before, cursor: 2 }, { ...event, result: 'assisted-correct' });
        expect(result?.reaction).toEqual({ id: event.id, kind: 'correct' });
    });

    it('gives supported session completion its own feedback without labelling it a correct answer', () => {
        const receipt = { ...event, type: 'supported_completed' as const, result: 'supported-completion' as const };
        const response = islandFeedbackForReceipt(before, { ...before, cursor: 2 }, receipt);
        expect(response?.feedback).toEqual({ id: event.id, kind: 'supported', text: 'ひかりを とどけたよ' });
        expect(response?.reaction).toEqual({ id: event.id, kind: 'correct' });
        expect(islandFeedbackForReceipt(before, before, receipt)).toBeUndefined();
        expect(islandFeedbackForReceipt(before, { ...before, cursor: 2 }, { ...receipt, result: 'correct' })).toBeUndefined();
    });

    it('uses a retry cue for both independent and assisted wrong answers', () => {
        for (const result of ['incorrect', 'assisted-incorrect'] as const) {
            const response = islandFeedbackForReceipt(before, before, { ...event, result });
            expect(response?.reaction?.kind).toBe('retry');
            expect(response?.feedback.text).toBe('もういちど');
        }
    });

    it('does not award success light for opening help or skipping', () => {
        for (const type of ['support_opened', 'skipped', 'model_opened'] as const) {
            expect(islandFeedbackForReceipt(before, before, { ...event, type, result: undefined })?.reaction?.kind).toBe('support');
        }
    });

    it('carries the saved failed row into correction without reusing successful or unrelated receipts', () => {
        const action = { type: 'answer' as const, answer: ['2', '8', '1'] };
        expect(islandFeedbackForReceipt(before, before, { ...event, action, result: 'incorrect' })?.feedback.retryAnswer).toEqual(action.answer);
        expect(islandFeedbackForReceipt(before, before, { ...event, action })?.feedback.retryAnswer).toBeUndefined();
        expect(islandFeedbackForReceipt(before, before, { ...event, action, result: 'incorrect', slotIndex: 0 })).toBeUndefined();
    });

    it('does not replay a receipt from another slot or section', () => {
        expect(islandFeedbackForReceipt(before, { ...before, cursor: 2 }, { ...event, slotIndex: 0 })).toBeUndefined();
        expect(islandFeedbackForReceipt(before, { ...before, id: 'next-section' }, event)).toBeUndefined();
        expect(islandFeedbackForReceipt(before, { ...before, cursor: 2 }, { ...event, planId: 'another-section' })).toBeUndefined();
        expect(islandFeedbackForReceipt(before, { ...before, cursor: 3 }, event)).toBeUndefined();
    });
});
