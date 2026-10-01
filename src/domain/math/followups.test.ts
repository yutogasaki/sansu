import { describe, expect, it } from 'vitest';
import { getMathFollowupPlan } from './followups';
import type { RecentAttempt } from '../types';

const attempt = (assistance?: RecentAttempt['assistance']): RecentAttempt => ({
    id: 'attempt', timestamp: '2026-10-01T00:00:00Z', subject: 'math',
    skillId: 'add_2d1d_nc_bridge', result: 'correct', assistance,
});

describe('representation followup evidence', () => {
    it('advances only after an explicitly independent whole answer', () => {
        expect(getMathFollowupPlan([attempt('independent')], ['add_2d1d_nc_bridge', 'add_2d1d_mental_nc'], 11))
            .toContainEqual(expect.objectContaining({ skillId: 'add_2d1d_mental_nc', reason: 'progression' }));
        for (const assistance of [undefined, 'unknown'] as const) {
            expect(getMathFollowupPlan([attempt(assistance)], ['add_2d1d_nc_bridge', 'add_2d1d_mental_nc'], 11)).toEqual([]);
        }
    });
    it('uses assisted success for a supported recheck without advancing', () => {
        const plan = getMathFollowupPlan([attempt('assisted')], ['add_2d1d_nc_bridge', 'add_2d1d_mental_nc'], 11);
        expect(plan.length).toBeGreaterThan(0);
        expect(plan.every(candidate => candidate.reason === 'remediation')).toBe(true);
        expect(plan.some(candidate => candidate.reason === 'progression')).toBe(false);
    });
});
