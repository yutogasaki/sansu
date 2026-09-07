import { describe, expect, it } from 'vitest';
import { createIslandLearningObserver, readIslandLearningDOM, type IslandRenderedLearning } from './useIslandLearningObservation';
import type { IslandObservationBinding } from '../../domain/island/learningObservation';

const binding: IslandObservationBinding = { profileId: 'child', planId: 'plan', revisionBefore: 0, slotIndex: 0, problemId: 'problem' };
const rendered: IslandRenderedLearning = { problemId: 'problem', inputMode: 'hissan', referenceVisual: 'present', hint: false, model: false };
const action = { type: 'answer' as const, answer: ['2', '7'] };
function fixture() {
    let wall = 100, mono = 10, id = 0;
    const observer = createIslandLearningObserver({ wall: () => wall, monotonic: () => mono, id: () => `id-${++id}` });
    return { observer, clock: (nextWall: number, nextMono = mono + 10) => { wall = nextWall; mono = nextMono; } };
}

describe('Island bounded DOM observation and exact retry snapshots', () => {
    it('keeps a single presentation through busy commits, draft changes and Hissan revisions', () => {
        const { observer, clock } = fixture();
        observer.observe(binding, rendered);
        const first = observer.request(binding, action);
        observer.succeeded(first);
        clock(130);
        observer.observe({ ...binding, revisionBefore: 1 }, rendered);
        const second = observer.request({ ...binding, revisionBefore: 1 }, action);
        expect(second.observation.presentation).toEqual(first.observation.presentation);
        expect(second.observation.elapsedSincePresentationMs).toBe(10);
        expect(second.observation.observedSupport).toBeUndefined();
        expect(second.observation.eventAt).toBe(130);
    });

    it('does not turn a saved hint/model operation into evidence of the resulting DOM', () => {
        const { observer, clock } = fixture();
        observer.observe(binding, rendered);
        const hint = observer.request(binding, { type: 'support_opened' });
        expect(hint.observation.observedSupport).toBeUndefined();
        observer.succeeded(hint);
        clock(120); observer.observe({ ...binding, revisionBefore: 1 }, { ...rendered, hint: true });
        const model = observer.request({ ...binding, revisionBefore: 1 }, { type: 'model_opened' });
        expect(model.observation.observedSupport).toEqual({ hintAt: 120 });
        observer.succeeded(model);
        clock(150); observer.observe({ ...binding, revisionBefore: 2 }, { ...rendered, model: true });
        observer.observe({ ...binding, revisionBefore: 2 }, { ...rendered, model: true });
        const complete = observer.request({ ...binding, revisionBefore: 2 }, { type: 'supported_completed' });
        expect(complete.observation.observedSupport).toEqual({ hintAt: 120, modelAt: 150 });
    });

    it('freezes the first accepted action and metadata through a failed save, clock changes and later DOM', () => {
        const { observer, clock } = fixture();
        const answer = structuredClone(action);
        const first = observer.request(binding, answer);
        answer.answer[0] = '9';
        clock(86_400_100); observer.observe(binding, { ...rendered, model: true });
        const retry = observer.request(binding, action);
        expect(retry).toBe(first);
        expect(observer.request({ revisionBefore: 0, problemId: 'problem', slotIndex: 0, planId: 'plan', profileId: 'child' },
            { answer: ['2', '7'], type: 'answer' })).toBe(first);
        expect(retry.action).toEqual(action);
        expect(retry.observation.eventAt).toBe(100);
        expect(retry.observation.presentation).toBeUndefined();
        expect(Object.isFrozen(retry.action)).toBe(true);
        expect(Object.isFrozen((retry.action as typeof action).answer)).toBe(true);
        expect(Object.isFrozen(retry.observation.binding)).toBe(true);
        expect(() => { (retry.action as typeof action).answer[0] = '8'; }).toThrow();
        expect(observer.request(binding, { type: 'answer', answer: ['9', '7'] })).not.toBe(first);
    });

    it('clears snapshots only for their success or instance, and records re-entry as a new presentation', () => {
        const { observer, clock } = fixture();
        observer.observe(binding, rendered);
        const first = observer.request(binding, action);
        observer.succeeded(undefined);
        expect(observer.request(binding, action)).toBe(first);
        observer.succeeded(first);
        clock(120);
        const second = observer.request(binding, action);
        expect(second).not.toBe(first);
        observer.leave(binding); observer.observe(binding, rendered);
        const reentry = observer.request(binding, action);
        expect(reentry.observation.presentation!.id).not.toBe(first.observation.presentation!.id);
        expect(reentry.observation.presentation!.documentId).toBe(first.observation.presentation!.documentId);
        expect(reentry.observation.observedSupport).toBeUndefined();
        observer.leave({ ...binding, slotIndex: 1 });
        expect(observer.request(binding, action)).toBe(reentry);
    });

    it.each([{ slotIndex: 1 }, { planId: 'another' }, { profileId: 'other' }, { problemId: 'replacement' }])('never attaches another instance presentation: %j', changed => {
        const { observer } = fixture(); observer.observe(binding, { ...rendered, hint: true });
        const next = { ...binding, ...changed };
        observer.observe(next, undefined);
        expect(observer.request(next, action).observation.presentation).toBeUndefined();
    });

    it('keeps a reversed wall clock visible and never substitutes it for elapsed time', () => {
        const { observer, clock } = fixture(); observer.observe(binding, rendered);
        clock(10, 40);
        const request = observer.request(binding, action);
        expect(request.observation).toMatchObject({ eventAt: 10, elapsedSincePresentationMs: 30 });
        observer.succeeded(request); clock(0, 0);
        expect(observer.request(binding, action).observation).toMatchObject({ gaps: ['clock-order-uncertain'] });
    });

    it('reads actual input and support nodes, including whole Hissan models, and rejects missing/mismatched problem DOM', () => {
        const form = { dataset: { problemId: 'problem', inputType: 'number' }, querySelector: (selector: string) =>
            selector === '.island-support-model' || selector === '.park-question [data-visual-surface]' ? {} : null };
        const root = { querySelector: () => form } as unknown as ParentNode;
        expect(readIslandLearningDOM(root)).toEqual({ ...rendered, inputMode: 'number', model: true });
        // A Hissan input is known via data-input-type; it is not automatically a reference-visual marker.
        form.dataset.inputType = 'hissan'; form.querySelector = selector => selector === '.island-support-model' ? {} : null;
        expect(readIslandLearningDOM(root)).toEqual({ ...rendered, referenceVisual: 'absent', model: true });
        expect(readIslandLearningDOM(null)).toBeUndefined();
        const { observer } = fixture();
        observer.observe(binding, { ...rendered, problemId: 'stale' });
        expect(observer.request(binding, action).observation.presentation).toBeUndefined();
        form.dataset.inputType = 'unknown'; expect(readIslandLearningDOM(root)).toBeUndefined();
    });
});
