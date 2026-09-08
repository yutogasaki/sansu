import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { canonicalIslandLearningKeepsakeAction, getIslandLearningKeepsakes, hasValidIslandLearningKeepsakes,
    ISLAND_LEARNING_KEEPSAKES, isIslandLearningKeepsakeAvailable, IslandLearningKeepsakeConflict, reduceIslandLearningKeepsakes,
    summarizeIslandLearningKeepsake, type IslandLearningKeepsakeAction } from './learningKeepsakes';
import { learningKeepsakeHistoryOrdinals, learningKeepsakePlanId } from './learningKeepsakeSummary';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const island = (completedSets = 0) => ({ ...createIsland('child', 1), completedSets });
function plan(ordinal = 0, subject: IslandPlan['subject'] = 'math'): IslandPlan {
    const id = learningKeepsakePlanId('child', ordinal);
    return { id, profileId: 'child', schemaVersion: 1, plannerVersion: 'island-learning-v1', subject,
        status: 'completed', revision: 3, cursor: 3, startedAt: ordinal * 100 + 1, completedAt: ordinal * 100 + 10,
        rewardId: `${id}:reward`, rewardChoices: ['flower', 'mushroom', 'fountain'],
        slots: Array.from({ length: 3 }, (_, index) => ({ source: 'new', countsTowardReviewCap: false, assisted: true, completed: true,
            problem: { id: `${id}:slot-${index}`, subject, categoryId: `${subject}-${index}`, inputType: 'number' as const,
                correctAnswer: 'secret-answer', questionText: `${subject} question ${index}` } })) };
}
const completed = (value: IslandPlan): IslandEvent => ({ id: `${value.id}:completed`, profileId: value.profileId,
    planId: value.id, type: 'plan_completed', timestamp: value.completedAt! });

describe('free learning keepsakes', () => {
    it.each(ISLAND_LEARNING_KEEPSAKES)('$id uses the exact completed-section boundary and does not select automatically', item => {
        const before = island(item.requiredCompletedSets - 1), eligible = island(item.requiredCompletedSets);
        expect(isIslandLearningKeepsakeAvailable(before, item.id)).toBe(false);
        expect(isIslandLearningKeepsakeAvailable(eligible, item.id)).toBe(true);
        expect(isIslandLearningKeepsakeAvailable(island(item.requiredCompletedSets + 100), item.id)).toBe(true);
        expect(getIslandLearningKeepsakes(eligible)).toEqual({ version: 1, displayed: [] });
        expect(eligible.learningKeepsakes).toBeUndefined();
    });
    it('has multiple free displays, keeps lower trophies available, and never mutates source or wallet', () => {
        const before = island(25), original = structuredClone(before);
        let updated = reduceIslandLearningKeepsakes(before, { type: 'display', keepsakeId: 'first-completion', displayed: true });
        updated = reduceIslandLearningKeepsakes(updated, { type: 'display', keepsakeId: 'certificate-25', displayed: true });
        updated = reduceIslandLearningKeepsakes(updated, { type: 'display', keepsakeId: 'completed-5', displayed: true });
        updated = reduceIslandLearningKeepsakes(updated, { type: 'display', keepsakeId: 'first-completion', displayed: false });
        expect(updated).toStrictEqual({ ...before, learningKeepsakes: { version: 1, displayed: ['completed-5', 'certificate-25'] } });
        expect(before).toStrictEqual(original);
        const copy = getIslandLearningKeepsakes(updated); copy.displayed.length = 0;
        expect(updated.learningKeepsakes!.displayed).toEqual(['completed-5', 'certificate-25']);
    });
    it('displays only currently earned keepsakes in canonical order, with all sixteen available at 1000 sections', () => {
        expect(ISLAND_LEARNING_KEEPSAKES).toHaveLength(16);
        expect(ISLAND_LEARNING_KEEPSAKES.filter(item => item.slot === 'trophy')).toHaveLength(13);
        expect(reduceIslandLearningKeepsakes(island(5), { type: 'display-earned' }).learningKeepsakes)
            .toEqual({ version: 1, displayed: ['first-completion', 'completed-5'] });
        const all = reduceIslandLearningKeepsakes(island(1000), { type: 'display-earned' });
        expect(all.learningKeepsakes!.displayed).toEqual(ISLAND_LEARNING_KEEPSAKES.map(item => item.id));
        expect(reduceIslandLearningKeepsakes(all, { type: 'display', keepsakeId: 'completed-5', displayed: true }).learningKeepsakes).toEqual(all.learningKeepsakes);
        expect(reduceIslandLearningKeepsakes(island(), { type: 'display-earned' }).learningKeepsakes).toEqual({ version: 1, displayed: [] });
    });
    it.each([
        { type: 'display', keepsakeId: 'first-completion', displayed: 1 },
        { type: 'display', keepsakeId: 'completed-5' }, { type: 'display', keepsakeId: 'completed-99', displayed: true },
        { type: 'display', keepsakeId: null, displayed: false }, { type: 'display', keepsakeId: 'completed-5', displayed: true, price: 0 },
        { type: 'display-earned', through: 1000 }, null,
    ])('rejects malformed requests %j', value => {
        expect(() => canonicalIslandLearningKeepsakeAction(value)).toThrow(IslandLearningKeepsakeConflict);
    });
    it('rejects unearned selections and corrupted states without replacing them by defaults', () => {
        expect(() => reduceIslandLearningKeepsakes(island(), { type: 'display', keepsakeId: 'first-completion', displayed: true }))
            .toThrow(expect.objectContaining({ code: 'not-eligible' }));
        for (const value of [null, { version: 2, displayed: [] }, { version: 1 },
            { version: 1, displayed: ['completed-99'] }, { version: 1, displayed: ['completed-5'] },
            { version: 1, displayed: [], acquiredAt: 12 }]) {
            const corrupted = { ...island(), learningKeepsakes: value } as IslandRecord;
            expect(hasValidIslandLearningKeepsakes(corrupted)).toBe(false);
            expect(() => getIslandLearningKeepsakes(corrupted)).toThrow(IslandLearningKeepsakeConflict);
        }
        for (const displayed of [['first-completion', 'first-completion'], ['completed-5', 'first-completion']]) {
            expect(hasValidIslandLearningKeepsakes({ ...island(5), learningKeepsakes: { version: 1, displayed } } as IslandRecord)).toBe(false);
        }
        const intent = { displayed: false, keepsakeId: 'completed-5', type: 'display' } as IslandLearningKeepsakeAction;
        expect(JSON.stringify(canonicalIslandLearningKeepsakeAction(intent))).toBe('{"type":"display","keepsakeId":"completed-5","displayed":false}');
    });
});

describe('truthful milestone history', () => {
    it('uses saved completed plans, unique problems and exact completion time, not answer attempts or support usage', () => {
        const value = plan(), event = completed(value);
        value.slots.push(value.slots[0]); value.cursor++;
        const answer = { ...event, id: 'retry', type: 'answer' as const, timestamp: 900, result: 'incorrect' as const };
        const summary = summarizeIslandLearningKeepsake(island(1), 'first-completion', [value, value], [event, event, answer, answer]);
        expect(summary).toMatchObject({ available: true, completedAt: 10, recordScope: 'complete', verifiedCompletedSets: 1,
            problemCount: 3, subjects: [{ subject: 'math', problemCount: 3 }] });
        expect(summary.examples).toHaveLength(3); expect(JSON.stringify(summary)).not.toContain('secret-answer');
    });
    it('reads the requested milestone prefix, not the newest completion or a later subject', () => {
        const values = Array.from({ length: 6 }, (_, i) => plan(i, i % 2 ? 'vocab' : 'math'));
        const summary = summarizeIslandLearningKeepsake(island(100), 'completed-5', values, values.map(completed));
        expect(summary).toMatchObject({ completedAt: 410, completedSets: 100, verifiedCompletedSets: 5, problemCount: 15,
            subjects: [{ subject: 'math', problemCount: 9 }, { subject: 'vocab', problemCount: 6 }], recordScope: 'complete' });
        expect(summary.examples.length).toBeLessThanOrEqual(3);
    });
    it('keeps eligibility independent from missing history and never fabricates a date or a problem count', () => {
        expect(summarizeIslandLearningKeepsake(island(25), 'certificate-25', [], [])).toEqual({
            keepsakeId: 'certificate-25', available: true, completedSets: 25, requiredCompletedSets: 25,
            recordScope: 'count-only', verifiedCompletedSets: 0, subjects: [], examples: [],
        });
        const milestone = plan(4);
        expect(summarizeIslandLearningKeepsake(island(5), 'completed-5', [], [completed(milestone)]))
            .toMatchObject({ completedAt: 410, recordScope: 'partial', verifiedCompletedSets: 1 });
        expect(summarizeIslandLearningKeepsake(island(5), 'completed-5', [plan(0)], [])).not.toHaveProperty('completedAt');
    });
    it('bounds large milestones to one actual canonical completion and explicitly reports only partial problem history', () => {
        expect(learningKeepsakeHistoryOrdinals(1000, 1000)).toEqual([999]);
        expect(learningKeepsakeHistoryOrdinals(999, 1000)).toEqual([]);
        expect(learningKeepsakeHistoryOrdinals(1000, 25)).toHaveLength(25);
        const milestone = plan(999, 'vocab');
        expect(summarizeIslandLearningKeepsake(island(1000), 'completed-1000', [plan(0), milestone], [completed(milestone)]))
            .toMatchObject({ available: true, completedSets: 1000, completedAt: milestone.completedAt, recordScope: 'partial',
                verifiedCompletedSets: 1, problemCount: 3, subjects: [{ subject: 'vocab', problemCount: 3 }] });
    });
    it('does not count active, foreign, noncanonical, malformed or contradictory copies as detailed evidence', () => {
        const original = plan();
        for (const invalid of [{ ...original, status: 'active' as const }, { ...original, profileId: 'other' },
            { ...original, id: 'other-id' }, { ...original, slots: [{ ...original.slots[0], completed: false }] },
            { ...original, subject: 'other' } as unknown as IslandPlan]) {
            const summary = summarizeIslandLearningKeepsake(island(1), 'first-completion', [invalid], []);
            expect(summary.recordScope).toBe('count-only'); expect(summary.problemCount).toBeUndefined();
            expect(summary.completedAt).toBeUndefined();
        }
        const conflict = summarizeIslandLearningKeepsake(island(1), 'first-completion', [original, { ...original, completedAt: 99 }], []);
        expect(conflict.verifiedCompletedSets).toBe(0); expect(conflict.completedAt).toBeUndefined();
    });
    it('withholds a timestamp for conflicts, malformed times, or a not-yet-reached trophy', () => {
        const original = plan(), event = completed(original);
        for (const [value, receipt] of [
            [original, { ...event, timestamp: 11 }], [{ ...original, completedAt: -1 }, event],
            [original, { ...event, profileId: 'other' }], [original, { ...event, type: 'answer' }],
            [{ ...original, completedAt: undefined }, { ...event, timestamp: 0 }],
        ] as [IslandPlan, IslandEvent][]) {
            expect(summarizeIslandLearningKeepsake(island(1), 'first-completion', [value], [receipt]).completedAt).toBeUndefined();
        }
        expect(summarizeIslandLearningKeepsake(island(1), 'completed-5', [original, plan(4)], [event, completed(plan(4))]))
            .toMatchObject({ available: false, recordScope: 'partial', verifiedCompletedSets: 1, problemCount: 3 });
        expect(summarizeIslandLearningKeepsake(island(1), 'completed-5', [original], [event]).completedAt).toBeUndefined();
    });
});
