import { describe, expect, it } from 'vitest';
import { resolveReviewBudget } from './reviewBudget';

describe('Due review workload budget', () => {
    it.each([2, 3, 6, 10])('retains a main question in a %s-question section', count => {
        expect(resolveReviewBudget({ count, dueCount: 100 })).toEqual({
            reviewLimit: Math.floor(count / 2), suppressPlusOne: true,
        });
        expect(resolveReviewBudget({ count, dueCount: 100 }).reviewLimit).toBeLessThan(count);
    });

    it('expands only when the eligible backlog reaches the section length', () => {
        expect(resolveReviewBudget({ count: 6, dueCount: 5 })).toEqual({ reviewLimit: 1, suppressPlusOne: false });
        expect(resolveReviewBudget({ count: 6, dueCount: 6 })).toEqual({ reviewLimit: 3, suppressPlusOne: true });
    });

    it('leaves room for main when a small section includes Due', () => {
        expect(resolveReviewBudget({ count: 2, dueCount: 1 })).toEqual({ reviewLimit: 1, suppressPlusOne: true });
        expect(resolveReviewBudget({ count: 3, dueCount: 1 })).toEqual({ reviewLimit: 1, suppressPlusOne: false });
        expect(resolveReviewBudget({ count: 6, dueCount: 0 })).toEqual({ reviewLimit: 0, suppressPlusOne: false });
    });

    it('preserves a one-question review and handles empty or invalid counts', () => {
        expect(resolveReviewBudget({ count: 1, dueCount: 1 })).toEqual({ reviewLimit: 1, suppressPlusOne: true });
        for (const count of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(resolveReviewBudget({ count, dueCount: 10 }).reviewLimit).toBe(0);
        }
        expect(resolveReviewBudget({ count: 6, dueCount: Number.NaN }).reviewLimit).toBe(0);
    });
});
