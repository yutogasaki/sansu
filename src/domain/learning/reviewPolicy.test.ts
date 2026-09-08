import { describe, expect, it } from 'vitest';
import { isNormalReviewEligible, isReviewDue } from './reviewPolicy';

describe('normal review eligibility', () => {
    it.each(['retired', 'maintenance'] as const)('only returns healthy %s to maintenance sampling', status => {
        expect(isNormalReviewEligible({ status })).toBe(false);
        expect(isNormalReviewEligible({ status, needsRelearning: false })).toBe(false);
        expect(isNormalReviewEligible({ status, needsRelearning: true })).toBe(true);
        expect(isNormalReviewEligible({ status, lastIndependentCorrectAt: '2026-09-08T12:00:00.000Z' })).toBe(true);
        expect(isNormalReviewEligible({ status, lastIndependentCorrectAt: 'invalid' })).toBe(false);
    });

    it('keeps active and legacy items eligible', () => {
        expect(isNormalReviewEligible({ status: 'active' })).toBe(true);
        expect(isNormalReviewEligible({})).toBe(true);
    });
});

describe('review deadlines', () => {
    const now = new Date(2026, 8, 8, 12);
    it('includes an exact deadline and excludes future or invalid deadlines', () => {
        expect(isReviewDue({ nextReview: now.toISOString() }, now)).toBe(true);
        expect(isReviewDue({ nextReview: new Date(now.getTime() + 1).toISOString() }, now)).toBe(false);
        expect(isReviewDue({ nextReview: 'not-a-date' }, now)).toBe(false);
    });

    it('retains the local interpretation of legacy date-only deadlines', () => {
        expect(isReviewDue({ nextReview: '2026-09-08' }, new Date(2026, 8, 8))).toBe(true);
        expect(isReviewDue({ nextReview: '2026-09-08' }, new Date(2026, 8, 7, 23, 59))).toBe(false);
    });
});
