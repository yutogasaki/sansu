import { parkHissanGrid } from '../park/learning';
import type { IslandEvent, IslandLearningAction, IslandLearningSlot, IslandPlan } from './types';

export type IslandObservationGap = 'observer-unavailable' | 'unsupported-version' | 'binding-mismatch'
    | 'invalid-observation' | 'presentation-unobserved' | 'clock-order-uncertain';
export interface IslandObservationBinding {
    profileId: string; planId: string; slotIndex: number; problemId: string; revisionBefore: number;
}
export interface IslandPresentationObservation {
    id: string;
    documentId: string;
    observedAt: number;
    inputVersion: 'island-input-v1';
    inputMode: 'number' | 'multi-number' | 'choice' | 'hissan';
    /** Presence of the committed question's data-visual-surface marker, not absence of assistance. */
    referenceVisual: 'present' | 'absent' | 'unknown';
}
export interface IslandObservationInput {
    version: 1;
    adapterVersion: 'island-dom-v1';
    binding: IslandObservationBinding;
    eventAt: number;
    presentation?: IslandPresentationObservation;
    observedSupport?: { hintAt?: number; modelAt?: number };
    /** Same-document monotonic time only; never derived from wall-clock subtraction. */
    elapsedSincePresentationMs?: number;
    gaps?: IslandObservationGap[];
}
export interface IslandObservationV1 {
    version: 1;
    problemId: string;
    revisionBefore: number;
    answerScope: 'whole' | 'hissan-step' | 'not-an-answer';
    stepIndexBefore?: number;
    wholeCompleted: boolean;
    supportBefore: 'unassisted-slot' | 'hint' | 'model' | 'legacy-assisted-unknown-stage';
    adapterVersion?: 'island-dom-v1';
    eventAt?: number;
    presentation?: IslandPresentationObservation;
    observedSupport?: { hintAt?: number; modelAt?: number };
    elapsedSincePresentationMs?: number;
    coverage: 'current-presentation' | 'partial' | 'unknown';
    gaps: IslandObservationGap[];
}
const gaps: readonly IslandObservationGap[] = ['observer-unavailable', 'unsupported-version', 'binding-mismatch',
    'invalid-observation', 'presentation-unobserved', 'clock-order-uncertain'];
const modes = ['number', 'multi-number', 'choice', 'hissan'];
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const time = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 8.64e15;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 1024;
const nonnegative = (value: unknown): value is number => time(value) && value >= 0;
const sameBinding = (value: unknown, binding: IslandObservationBinding) => record(value)
    && Object.entries(binding).every(([key, expected]) => value[key] === expected);
const uniqueGaps = (values: IslandObservationGap[]) => [...new Set(values)];

export function islandObservationBinding(plan: IslandPlan): IslandObservationBinding {
    return { profileId: plan.profileId, planId: plan.id, slotIndex: plan.cursor,
        problemId: plan.slots[plan.cursor].problem.id, revisionBefore: plan.revision };
}

/** Only this small whitelist crosses the optional UI boundary. No raw DOM,
 * answer, problem copy, result, or unbounded event array is retained. */
export function normalizeIslandObservation(input: unknown, binding: IslandObservationBinding): Pick<IslandObservationV1,
    'adapterVersion' | 'eventAt' | 'presentation' | 'observedSupport' | 'elapsedSincePresentationMs' | 'coverage' | 'gaps'> {
    const unknown = (reason: IslandObservationGap) => ({ coverage: 'unknown' as const, gaps: [reason] });
    if (input === undefined || input === null) return unknown('observer-unavailable');
    if (!record(input)) return unknown('invalid-observation');
    if (input.version !== 1 || input.adapterVersion !== 'island-dom-v1') return unknown('unsupported-version');
    if (!sameBinding(input.binding, binding)) return unknown('binding-mismatch');
    if (!time(input.eventAt)) return unknown('invalid-observation');
    const missing: IslandObservationGap[] = [];
    if (input.gaps !== undefined) {
        if (Array.isArray(input.gaps) && input.gaps.length <= gaps.length && input.gaps.every(gap => gaps.includes(gap))) missing.push(...input.gaps);
        else missing.push('invalid-observation');
    }
    let presentation: IslandPresentationObservation | undefined;
    const shown = input.presentation;
    if (record(shown) && text(shown.id) && text(shown.documentId) && time(shown.observedAt)
        && shown.inputVersion === 'island-input-v1' && typeof shown.inputMode === 'string' && modes.includes(shown.inputMode)
        && typeof shown.referenceVisual === 'string' && ['present', 'absent', 'unknown'].includes(shown.referenceVisual)) {
        presentation = { id: shown.id, documentId: shown.documentId, observedAt: shown.observedAt,
            inputVersion: 'island-input-v1', inputMode: shown.inputMode as IslandPresentationObservation['inputMode'],
            referenceVisual: shown.referenceVisual as IslandPresentationObservation['referenceVisual'] };
        if (presentation.observedAt > input.eventAt) missing.push('clock-order-uncertain');
    } else {
        missing.push(shown === undefined ? 'presentation-unobserved' : 'invalid-observation');
    }
    let observedSupport: IslandObservationV1['observedSupport'];
    if (input.observedSupport !== undefined) {
        if (presentation && record(input.observedSupport)) {
            for (const key of ['hintAt', 'modelAt'] as const) {
                const observedAt = input.observedSupport[key];
                if (observedAt === undefined) continue;
                if (!time(observedAt)) { missing.push('invalid-observation'); continue; }
                observedSupport ??= {};
                observedSupport[key] = observedAt;
                if (observedAt < presentation.observedAt || observedAt > input.eventAt) missing.push('clock-order-uncertain');
            }
        } else missing.push('invalid-observation');
    }
    let elapsedSincePresentationMs: number | undefined;
    if (input.elapsedSincePresentationMs !== undefined) {
        if (presentation && nonnegative(input.elapsedSincePresentationMs)) elapsedSincePresentationMs = input.elapsedSincePresentationMs;
        else missing.push(presentation ? 'clock-order-uncertain' : 'invalid-observation');
    }
    return { adapterVersion: 'island-dom-v1', eventAt: input.eventAt, ...(presentation ? { presentation } : {}),
        ...(observedSupport ? { observedSupport } : {}), ...(elapsedSincePresentationMs !== undefined ? { elapsedSincePresentationMs } : {}),
        coverage: !presentation ? 'unknown' : missing.length ? 'partial' : 'current-presentation', gaps: uniqueGaps(missing) };
}

/** Capture before the existing commit mutates assisted/supportStage/Hissan cells. */
export function islandObservationScope(slot: IslandLearningSlot, action: IslandLearningAction): Pick<IslandObservationV1,
    'supportBefore' | 'answerScope' | 'stepIndexBefore' | 'wholeCompleted'> {
    return { supportBefore: slot.supportStage ?? (slot.assisted ? 'legacy-assisted-unknown-stage' : 'unassisted-slot'),
        answerScope: action.type === 'answer' ? 'whole' : 'not-an-answer', wholeCompleted: false,
        ...(parkHissanGrid(slot.problem) ? { stepIndexBefore: slot.hissanStep ?? 0 } : {}) };
}

export function createIslandObservation(binding: IslandObservationBinding, scope: ReturnType<typeof islandObservationScope>, input: unknown): IslandObservationV1 {
    return { version: 1, problemId: binding.problemId, revisionBefore: binding.revisionBefore,
        ...scope, ...normalizeIslandObservation(input, binding) };
}

const learningTypes = ['answer', 'support_opened', 'model_opened', 'supported_completed', 'skipped'];
export interface IslandObservationRead {
    eventId: string;
    learningOperation: boolean;
    scope: IslandObservationV1['answerScope'] | 'unknown';
    wholeCompleted: boolean | 'unknown';
    supportBefore: IslandObservationV1['supportBefore'] | 'unknown';
    /** Saved support operation and observed support DOM are separate positive facts. */
    savedSupportOperation: boolean;
    observedSupport: 'positive' | 'unknown';
    presentationObserved: boolean;
    coverage: IslandObservationV1['coverage'];
    gaps: string[];
    content: 'reserved-problem' | 'unknown';
    priorIncorrect: 'recorded' | 'unknown';
}

/** Only saved Island learning operations form the denominator. The reader does
 * not infer missing wrong answers, absence of assistance, attention or mastery. */
export function readIslandObservation(event: IslandEvent, plan?: IslandPlan): IslandObservationRead {
    const learningOperation = learningTypes.includes(event.type);
    const result: IslandObservationRead = { eventId: event.id, learningOperation, scope: 'unknown', wholeCompleted: 'unknown',
        supportBefore: 'unknown', savedSupportOperation: ['support_opened', 'model_opened', 'skipped'].includes(event.type),
        observedSupport: 'unknown', presentationObserved: false, coverage: 'unknown', gaps: [], content: 'unknown', priorIncorrect: 'unknown' };
    if (!learningOperation) return result;
    const value = event.observation;
    if (!record(value) || value.version !== 1) { result.gaps.push('legacy-or-uninstrumented'); return result; }
    const scopeValid = event.type === 'answer' ? ['whole', 'hissan-step'].includes(value.answerScope) : value.answerScope === 'not-an-answer';
    if (!text(value.problemId) || !Number.isSafeInteger(value.revisionBefore) || value.revisionBefore < 0
        || !scopeValid || typeof value.wholeCompleted !== 'boolean'
        || (value.wholeCompleted && !(event.type === 'supported_completed' && event.result === 'supported-completion'
            || event.type === 'answer' && ['correct', 'assisted-correct'].includes(event.result ?? '')))
        || (event.type === 'supported_completed' && !value.wholeCompleted)
        || !['unassisted-slot', 'hint', 'model', 'legacy-assisted-unknown-stage'].includes(value.supportBefore)
        || (value.answerScope === 'hissan-step' && (!Number.isSafeInteger(value.stepIndexBefore) || value.stepIndexBefore! < 0))) {
        result.gaps.push('invalid-observation'); return result;
    }
    result.scope = value.answerScope; result.wholeCompleted = value.wholeCompleted; result.supportBefore = value.supportBefore;
    const slot = event.slotIndex === undefined ? undefined : plan?.slots[event.slotIndex];
    if (plan?.profileId === event.profileId && plan.id === event.planId && slot?.problem.id === value.problemId) result.content = 'reserved-problem';
    else result.gaps.push('reserved-problem-unavailable');
    const normalized = value.adapterVersion === undefined && value.eventAt === undefined
        ? { coverage: 'unknown' as const, gaps: Array.isArray(value.gaps) && value.gaps.every(gap => gaps.includes(gap))
            ? value.gaps : ['invalid-observation' as const], presentation: undefined, observedSupport: undefined }
        : normalizeIslandObservation({ ...value, binding: { profileId: event.profileId, planId: event.planId,
        slotIndex: event.slotIndex, problemId: value.problemId, revisionBefore: value.revisionBefore } }, {
        profileId: event.profileId, planId: event.planId ?? '', slotIndex: event.slotIndex ?? -1,
        problemId: value.problemId, revisionBefore: value.revisionBefore });
    result.presentationObserved = Boolean(normalized.presentation);
    result.observedSupport = normalized.observedSupport?.hintAt !== undefined || normalized.observedSupport?.modelAt !== undefined ? 'positive' : 'unknown';
    result.coverage = normalized.coverage;
    result.gaps.push(...normalized.gaps);
    if (result.content === 'unknown' && result.coverage !== 'unknown') result.coverage = 'partial';
    result.gaps = [...new Set(result.gaps)];
    return result;
}

export function auditIslandObservations(events: readonly IslandEvent[], plans: readonly IslandPlan[] = []) {
    const saved = events.filter(event => learningTypes.includes(event.type));
    const rows = saved.map(event => readIslandObservation(event, plans.find(plan => plan.id === event.planId && plan.profileId === event.profileId)));
    saved.forEach((event, index) => {
        const row = rows[index], revision = event.observation?.revisionBefore;
        const priorPlanRevisions = new Set(saved.filter((candidate, candidateIndex) => candidate.profileId === event.profileId
            && candidate.planId === event.planId && rows[candidateIndex].scope !== 'unknown'
            && candidate.observation!.revisionBefore < (revision ?? 0)).map(candidate => candidate.observation!.revisionBefore));
        const instance = saved.filter(candidate => candidate.profileId === event.profileId && candidate.planId === event.planId && candidate.slotIndex === event.slotIndex);
        if (Number.isSafeInteger(revision)) {
            const earlier = instance.filter(candidate => candidate.observation && candidate.observation.revisionBefore < revision!);
            if (earlier.some(candidate => candidate.result === 'incorrect' || candidate.result === 'assisted-incorrect')) row.priorIncorrect = 'recorded';
            if (instance.some(candidate => !candidate.observation) || (event.observation?.answerScope === 'hissan-step'
                && event.observation.stepIndexBefore! > 0 && new Set(earlier.filter(candidate =>
                        Number.isSafeInteger(candidate.observation?.stepIndexBefore) && candidate.observation!.stepIndexBefore! >= 0
                        && candidate.observation!.stepIndexBefore! < event.observation!.stepIndexBefore!
                        && ['correct', 'assisted-correct'].includes(candidate.result ?? '')).map(candidate => candidate.observation!.stepIndexBefore)).size
                    < event.observation.stepIndexBefore!)
                // Every accepted learning operation increments this plan's revision once.
                // A known revision therefore proves the count of earlier operations,
                // without labeling a missing operation as an answer or inventing its result.
                || priorPlanRevisions.size < revision!) {
                row.gaps.push('incomplete-saved-prefix');
                if (row.coverage !== 'unknown') row.coverage = 'partial';
            }
        }
        const eventAt = event.observation?.eventAt;
        if (time(eventAt) && (eventAt > event.timestamp || saved.some(other => other.profileId === event.profileId
            && other.timestamp < event.timestamp && time(other.observation?.eventAt) && other.observation!.eventAt! > eventAt))) {
            row.gaps.push('clock-order-uncertain'); if (row.coverage !== 'unknown') row.coverage = 'partial';
        }
        row.gaps = [...new Set(row.gaps)];
    });
    return { denominator: 'saved-island-learning-operations' as const, savedOperations: saved.length,
        scopeKnown: rows.filter(row => row.scope !== 'unknown').length, presentationObserved: rows.filter(row => row.presentationObserved).length,
        savedSupportOperations: rows.filter(row => row.savedSupportOperation).length,
        observedSupportPositive: rows.filter(row => row.observedSupport === 'positive').length,
        wholeCompletedOperations: rows.filter(row => row.wholeCompleted === true).length,
        partial: rows.filter(row => row.coverage === 'partial').length, unknown: rows.filter(row => row.coverage === 'unknown').length,
        clockOrderUncertain: rows.filter(row => row.gaps.includes('clock-order-uncertain')).length, rows };
}
