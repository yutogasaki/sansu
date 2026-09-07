import { describe, expect, it } from 'vitest';
import { auditIslandObservations, createIslandObservation, islandObservationBinding, islandObservationScope,
    normalizeIslandObservation, readIslandObservation, type IslandObservationInput } from './learningObservation';
import type { IslandEvent, IslandPlan } from './types';

const plan: IslandPlan = { id: 'plan', profileId: 'child', schemaVersion: 1, plannerVersion: 'island-learning-v1',
    subject: 'math', status: 'active', revision: 0, cursor: 0, startedAt: 1, rewardId: 'reward', rewardChoices: ['bench'],
    slots: [{ problem: { id: 'reserved', categoryId: 'add_1d_2', subject: 'math', questionText: '7 + 8 =', correctAnswer: '15',
        inputType: 'number', isReview: true }, assisted: false, completed: false, source: 'due', countsTowardReviewCap: true }] };
const binding = islandObservationBinding(plan);
const input: IslandObservationInput = { version: 1, adapterVersion: 'island-dom-v1', binding, eventAt: 120,
    presentation: { id: 'presentation', documentId: 'document', observedAt: 100, inputVersion: 'island-input-v1',
        inputMode: 'number', referenceVisual: 'present' }, elapsedSincePresentationMs: 20 };
function event(revision = 0, fields: Partial<IslandEvent> = {}): IslandEvent {
    const action = { type: 'answer' as const, answer: '0' };
    return { id: `event-${revision}`, profileId: 'child', planId: 'plan', slotIndex: 0, type: 'answer', result: 'incorrect',
        timestamp: 130 + revision, action, observation: createIslandObservation({ ...binding, revisionBefore: revision },
            islandObservationScope(plan.slots[0], action), { ...input, binding: { ...binding, revisionBefore: revision } }), ...fields };
}

describe('prospective Island observation normalization and denominators', () => {
    it.each([
        [undefined, 'observer-unavailable'], [null, 'observer-unavailable'], [false, 'invalid-observation'],
        [{ ...input, version: 2 }, 'unsupported-version'], [{ ...input, adapterVersion: 'future' }, 'unsupported-version'],
        [{ ...input, binding: { ...binding, problemId: 'invented' } }, 'binding-mismatch'],
        [{ ...input, eventAt: Infinity }, 'invalid-observation'], [{ ...input, eventAt: '120' }, 'invalid-observation'],
    ])('degrades optional %j to unknown without throwing', (value, gap) => {
        expect(normalizeIslandObservation(value, binding)).toEqual({ coverage: 'unknown', gaps: [gap] });
    });

    it('copies only bounded positive UI fields and ignores invented grading/answer facts', () => {
        const actual = normalizeIslandObservation({ ...input, result: 'correct', wholeCompleted: true,
            answer: '15', allKeystrokes: ['1', '5'], presentation: { ...input.presentation, attention: 'certain' } }, binding);
        expect(actual).toEqual({ adapterVersion: 'island-dom-v1', eventAt: 120, presentation: input.presentation,
            elapsedSincePresentationMs: 20, coverage: 'current-presentation', gaps: [] });
        expect(actual.presentation).not.toBe(input.presentation);
        expect(normalizeIslandObservation({ ...input, presentation: { ...input.presentation, id: 'x'.repeat(1025) } }, binding))
            .toMatchObject({ coverage: 'unknown', gaps: ['invalid-observation'] });
    });

    it('keeps each invalid optional field unknown while preserving separately observed positive facts', () => {
        const malformed = normalizeIslandObservation({ ...input, observedSupport: { hintAt: 'oops', modelAt: 115 }, gaps: 'bad' }, binding);
        expect(malformed).toMatchObject({ coverage: 'partial', gaps: ['invalid-observation'], observedSupport: { modelAt: 115 } });
        const absent = normalizeIslandObservation({ ...input, presentation: undefined, observedSupport: { hintAt: 110 } }, binding);
        expect(absent.presentation).toBeUndefined(); expect(absent.observedSupport).toBeUndefined();
    });

    it('does not coerce malformed render descriptors into strings', () => {
        const malformed = { ...input, presentation: { ...input.presentation, inputMode: Object.create(null) } };
        expect(() => normalizeIslandObservation(malformed, binding)).not.toThrow();
        expect(normalizeIslandObservation(malformed, binding).coverage).toBe('unknown');
    });

    it('records support state before the operation and never invents a known legacy stage', () => {
        expect(islandObservationScope({ ...plan.slots[0], assisted: true }, { type: 'supported_completed' }))
            .toEqual({ supportBefore: 'legacy-assisted-unknown-stage', answerScope: 'not-an-answer', wholeCompleted: false });
        expect(islandObservationScope({ ...plan.slots[0], assisted: true, supportStage: 'hint' }, { type: 'model_opened' }).supportBefore).toBe('hint');
    });

    it('captures the actual Hissan step for support too, without treating it as an answer or fabricating ordinary steps', () => {
        const written = { ...plan.slots[0], hissanStep: 1, problem: { ...plan.slots[0].problem,
            categoryId: 'mul_2d2d', questionText: '23 × 14 =', correctAnswer: '322', inputType: 'hissan' as const, hissanVersion: 2 as const } };
        for (const type of ['support_opened', 'skipped', 'model_opened', 'supported_completed'] as const) {
            expect(islandObservationScope(written, { type })).toMatchObject({ answerScope: 'not-an-answer', stepIndexBefore: 1 });
            expect(islandObservationScope({ ...plan.slots[0], hissanStep: 8 }, { type }).stepIndexBefore).toBeUndefined();
        }
    });

    it('separates saved support requests, positive DOM, domain scope and one-question completion', () => {
        const hint = event(1, { type: 'support_opened', action: { type: 'support_opened' }, result: undefined });
        hint.observation!.answerScope = 'not-an-answer';
        const model = event(2, { type: 'model_opened', action: { type: 'model_opened' }, result: undefined });
        Object.assign(model.observation!, { answerScope: 'not-an-answer', supportBefore: 'hint', observedSupport: { hintAt: 110 } });
        const done = event(3, { type: 'supported_completed', action: { type: 'supported_completed' }, result: 'supported-completion' });
        Object.assign(done.observation!, { answerScope: 'not-an-answer', supportBefore: 'model', wholeCompleted: true, observedSupport: { modelAt: 115 } });
        const legacy = event(4, { observation: undefined });
        const nonlearning: IslandEvent = { id: 'reward', profileId: 'child', type: 'reward_claimed', timestamp: 140 };
        const report = auditIslandObservations([event(), hint, model, done, legacy, nonlearning], [plan]);
        expect(report).toMatchObject({ denominator: 'saved-island-learning-operations', savedOperations: 5, scopeKnown: 4,
            savedSupportOperations: 2, observedSupportPositive: 2, presentationObserved: 4, wholeCompletedOperations: 1, unknown: 1 });
        expect(report.rows[1].observedSupport).toBe('unknown');
        expect(report.rows[3].scope).toBe('not-an-answer');
        expect(report.rows[4]).toMatchObject({ scope: 'unknown', observedSupport: 'unknown', priorIncorrect: 'unknown' });
    });

    it('reports recorded prior wrong answers only within the saved reserved instance, never absence of mistakes', () => {
        const correct = event(1, { result: 'correct' }); correct.observation!.wholeCompleted = true;
        const other = event(1, { id: 'other-plan', planId: 'other' });
        const report = auditIslandObservations([event(), correct, other], [plan]);
        expect(report.rows.map(row => row.priorIncorrect)).toEqual(['unknown', 'recorded', 'unknown']);
        expect(report.rows[2].content).toBe('unknown');
        expect(readIslandObservation(event()).coverage).toBe('partial');
    });

    it('marks missing middle Hissan steps, legacy prefixes and missing first revisions partial without guessing history', () => {
        const first = event(0, { result: 'correct' }); Object.assign(first.observation!, { answerScope: 'hissan-step', stepIndexBefore: 0 });
        const third = event(2, { result: 'correct' }); Object.assign(third.observation!, { answerScope: 'hissan-step', stepIndexBefore: 2, wholeCompleted: true });
        const report = auditIslandObservations([first, third], [plan]);
        expect(report.rows[1]).toMatchObject({ coverage: 'partial', gaps: ['incomplete-saved-prefix'] });
        expect(auditIslandObservations([event(5)], [plan]).rows[0].gaps).toContain('incomplete-saved-prefix');
        expect(auditIslandObservations([event(0, { observation: undefined }), event(1)], [plan]).rows[1].gaps).toContain('incomplete-saved-prefix');
    });

    it('detects a missing operation in a later slot from real plan revisions, without inventing its type/result', () => {
        const laterPlan = structuredClone(plan);
        laterPlan.slots.push({ ...structuredClone(plan.slots[0]), problem: { ...plan.slots[0].problem, id: 'second' } });
        const first = event(0, { result: 'correct' }); first.observation!.wholeCompleted = true;
        const wrong = event(1, { slotIndex: 1 }); wrong.observation!.problemId = 'second';
        const correct = event(2, { slotIndex: 1, result: 'correct' });
        Object.assign(correct.observation!, { problemId: 'second', wholeCompleted: true });
        const complete = auditIslandObservations([first, wrong, correct], [laterPlan]);
        expect(complete.rows[2]).toMatchObject({ coverage: 'current-presentation', priorIncorrect: 'recorded', gaps: [] });
        const missing = auditIslandObservations([first, correct], [laterPlan]);
        expect(missing.rows[1]).toMatchObject({ coverage: 'partial', priorIncorrect: 'unknown', gaps: ['incomplete-saved-prefix'] });
        const support = event(1, { slotIndex: 1, type: 'support_opened', result: undefined, action: { type: 'support_opened' } });
        Object.assign(support.observation!, { problemId: 'second', answerScope: 'not-an-answer' });
        const supported = auditIslandObservations([first, support, correct], [laterPlan]);
        expect(supported.rows[2]).toMatchObject({ coverage: 'current-presentation', priorIncorrect: 'unknown', gaps: [] });
    });

    it('keeps malformed/unsupported stored envelopes unknown rather than crashing or treating them as success', () => {
        const wrong = event(); wrong.observation!.wholeCompleted = true;
        expect(readIslandObservation(wrong, plan).scope).toBe('unknown');
        const malformed = event(); Object.assign(malformed.observation!, { gaps: 42 });
        expect(() => readIslandObservation(malformed, plan)).not.toThrow();
        expect(readIslandObservation(malformed, plan).gaps).toContain('invalid-observation');
        const unobserved = event(); unobserved.observation = createIslandObservation(binding, islandObservationScope(plan.slots[0], action()), undefined);
        expect(readIslandObservation(unobserved, plan)).toMatchObject({ scope: 'whole', coverage: 'unknown', gaps: ['observer-unavailable'] });
        function action() { return { type: 'answer' as const, answer: '0' }; }
    });

    it('retains clock uncertainty without changing observed elapsed time or treating retry time as event time', () => {
        const reversed = normalizeIslandObservation({ ...input, eventAt: 90, observedSupport: { hintAt: 95 } }, binding);
        expect(reversed).toMatchObject({ coverage: 'partial', elapsedSincePresentationMs: 20, gaps: ['clock-order-uncertain'] });
        const prior = event(), next = event(1); next.observation!.eventAt = 110;
        const report = auditIslandObservations([prior, next], [plan]);
        expect(report.clockOrderUncertain).toBe(1);
        expect(report.rows[1].gaps).toContain('clock-order-uncertain');
    });
});
