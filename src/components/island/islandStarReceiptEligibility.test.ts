import { describe, expect, it } from 'vitest';
import { islandStarReceipt } from './islandStarReceiptEligibility';

const before = { id: 'plan', status: 'active' as const, cursor: 2, revision: 4 };
const after = { id: 'plan', status: 'completed' as const, cursor: 3, revision: 5 };
const answer = { id: 'answer-4', planId: 'plan', slotIndex: 2, type: 'answer' as const, result: 'correct' as const };

describe('committed island star receipt', () => {
    it('shows the same earning cue for independent, assisted and modeled final completion', () => {
        expect(islandStarReceipt(before, after, answer)).toBe(answer.id);
        expect(islandStarReceipt(before, after, { ...answer, result: 'assisted-correct' })).toBe(answer.id);
        expect(islandStarReceipt(before, after, { ...answer, type: 'supported_completed', result: 'supported-completion' })).toBe(answer.id);
    });
    it('never shows earnings for a wrong answer, partial row, support opening or nonfinal answer', () => {
        expect(islandStarReceipt(before, after, { ...answer, result: 'incorrect' })).toBeUndefined();
        expect(islandStarReceipt(before, { ...after, cursor: 2, status: 'active' }, answer)).toBeUndefined();
        expect(islandStarReceipt(before, after, { ...answer, type: 'support_opened' })).toBeUndefined();
        expect(islandStarReceipt(before, { ...after, status: 'active' }, answer)).toBeUndefined();
    });
    it('rejects duplicate, old, wrong-plan and already-completed receipts', () => {
        expect(islandStarReceipt(before, after, answer, answer.id)).toBeUndefined();
        expect(islandStarReceipt(before, { ...after, revision: 6 }, answer)).toBeUndefined();
        expect(islandStarReceipt(before, after, { ...answer, slotIndex: 1 })).toBeUndefined();
        expect(islandStarReceipt(before, after, { ...answer, planId: 'other' })).toBeUndefined();
        expect(islandStarReceipt({ ...before, status: 'completed' }, after, answer)).toBeUndefined();
    });
});
