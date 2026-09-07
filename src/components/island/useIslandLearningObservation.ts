import { useEffect, useRef } from 'react';
import type { IslandLearningAction } from '../../domain/island/types';
import type { IslandObservationBinding, IslandObservationInput, IslandPresentationObservation } from '../../domain/island/learningObservation';

export interface IslandRenderedLearning {
    problemId: string;
    inputMode: IslandPresentationObservation['inputMode'];
    referenceVisual: IslandPresentationObservation['referenceVisual'];
    hint: boolean;
    model: boolean;
}
export interface IslandObservationClock { wall: () => number; monotonic: () => number; id: () => string }
export interface IslandLearningRequest {
    binding: IslandObservationBinding;
    action: IslandLearningAction;
    observation: IslandObservationInput;
}
const instanceKey = (binding: IslandObservationBinding) => JSON.stringify([
    binding.profileId, binding.planId, binding.slotIndex, binding.problemId,
]);
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

/** Read the committed subtree, never infer a rendered hint from saved assisted state. */
export function readIslandLearningDOM(root: ParentNode | null): IslandRenderedLearning | undefined {
    const form = root?.querySelector<HTMLElement>('.park-answer');
    const mode = form?.dataset.inputType;
    if (!form?.dataset.problemId || !mode || !['number', 'multi-number', 'choice', 'hissan'].includes(mode)) return undefined;
    return { problemId: form.dataset.problemId, inputMode: mode as IslandRenderedLearning['inputMode'],
        referenceVisual: form.querySelector('.park-question [data-visual-surface]') ? 'present' : 'absent',
        hint: Boolean(form.querySelector('.island-learning-support[data-support-kind="hint"]')),
        model: Boolean(form.querySelector('.island-support-model')) };
}

/** One current presentation plus one pending operation. No per-key or per-render log. */
export function createIslandLearningObserver(clock: IslandObservationClock, documentId = clock.id()) {
    let current: { key: string; presentation: IslandPresentationObservation; started: number;
        observedSupport?: IslandObservationInput['observedSupport'] } | undefined;
    let pending: IslandLearningRequest | undefined;
    return {
        observe(binding: IslandObservationBinding, rendered: IslandRenderedLearning | undefined) {
            const key = instanceKey(binding);
            if (current?.key !== key) current = undefined;
            if (!rendered || rendered.problemId !== binding.problemId) return;
            const now = clock.wall();
            if (!current) current = { key, started: clock.monotonic(), presentation: {
                id: clock.id(), documentId, observedAt: now, inputVersion: 'island-input-v1',
                inputMode: rendered.inputMode, referenceVisual: rendered.referenceVisual,
            } };
            if (rendered.hint || rendered.model) {
                current.observedSupport ??= {};
                if (rendered.hint && current.observedSupport.hintAt === undefined) current.observedSupport.hintAt = now;
                if (rendered.model && current.observedSupport.modelAt === undefined) current.observedSupport.modelAt = now;
            }
        },
        /** Call only inside useIslandActions.run, after its synchronous lock. */
        request(binding: IslandObservationBinding, action: IslandLearningAction): IslandLearningRequest {
            if (pending && instanceKey(pending.binding) === instanceKey(binding) && pending.binding.revisionBefore === binding.revisionBefore
                && pending.action.type === action.type && (action.type !== 'answer'
                    || pending.action.type === 'answer' && JSON.stringify(pending.action.answer) === JSON.stringify(action.answer))) return pending;
            const shown = current?.key === instanceKey(binding) ? current : undefined;
            const eventAt = clock.wall();
            const elapsed = shown ? clock.monotonic() - shown.started : undefined;
            const observation: IslandObservationInput = { version: 1, adapterVersion: 'island-dom-v1', binding: { ...binding }, eventAt,
                ...(shown ? { presentation: { ...shown.presentation },
                    ...(shown.observedSupport ? { observedSupport: { ...shown.observedSupport } } : {}),
                    ...(elapsed !== undefined && Number.isFinite(elapsed) && elapsed >= 0 ? { elapsedSincePresentationMs: elapsed }
                        : { gaps: ['clock-order-uncertain'] }) } : {}) };
            pending = freeze({ binding: { ...binding }, action: structuredClone(action), observation });
            return pending;
        },
        succeeded(request: IslandLearningRequest | undefined) { if (pending === request) pending = undefined; },
        leave(binding?: IslandObservationBinding) {
            if (!binding || current?.key === instanceKey(binding)) current = undefined;
            if (!binding || (pending && instanceKey(pending.binding) === instanceKey(binding))) pending = undefined;
        },
    };
}
export type IslandLearningObserver = ReturnType<typeof createIslandLearningObserver>;
let documentId: string | undefined;
export function useIslandLearningObservation(): IslandLearningObserver {
    const observer = useRef<IslandLearningObserver | undefined>(undefined);
    if (!observer.current) {
        documentId ??= crypto.randomUUID();
        observer.current = createIslandLearningObserver({ wall: Date.now, monotonic: () => performance.now(), id: () => crypto.randomUUID() }, documentId);
    }
    useEffect(() => { const current = observer.current; return () => current?.leave(); }, []);
    return observer.current;
}
