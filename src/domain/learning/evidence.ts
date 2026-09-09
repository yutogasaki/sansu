import type { SubjectKey } from '../types';
import { getLearningItemMapping, getLearningUnit } from './catalog';
import { validateLearningEvidenceContext } from './context';
import { MATH_LV11_UNIT_IDS } from './mathCatalog';
import type { LearningEvidenceBarrier, LearningEvidenceContext, LearningRepresentation } from './types';

export interface LearningEvidenceRecord {
    id?: number | string;
    profileId: string;
    subject: SubjectKey;
    itemId: string;
    timestamp: string;
    result: 'correct' | 'incorrect' | 'skipped' | 'barrier' | 'contact';
    contactUncertain?: boolean;
    skipped?: boolean;
    learningEvidence?: LearningEvidenceContext;
    learningEvidenceBarrier?: LearningEvidenceBarrier;
}

export const MATH_PILOT_POLICY = {
    distinctIndependentProblems: 3,
    delayedAfterMs: 24 * 60 * 60 * 1000,
    reviewIntervalsDays: [1, 3, 7, 14, 30],
} as const;

export type LearningFreshness = 'unconfirmed' | 'fresh' | 'due';

export interface LearningFacetEvidence {
    representation: LearningRepresentation;
    variant: string;
    independentProblemCount: number;
    independentAttemptCount: number;
    delayedConfirmationCount: number;
    ready: boolean;
    retained: boolean;
    lastAttemptAt: string;
    historicalIndependentProblemCount: number;
    lastDelayedConfirmationAt: string | null;
    nextCheckAt: string | null;
    reviewStage: number;
    freshness: LearningFreshness;
    needsRecheck: boolean;
}

interface FacetAccumulator {
    representation: LearningRepresentation;
    variant: string;
    keys: Set<string>;
    historicalKeys: Set<string>;
    attempts: number;
    delayed: number;
    lastAttemptAt: string;
    lastDelayedConfirmationAt: string | null;
    nextCheckAt: number | null;
    reviewStage: number;
    needsRecheck: boolean;
}

export interface MathUnitPilotEvaluation {
    unitId: string;
    label: string;
    readiness: 'unconfirmed' | 'ready';
    retention: 'unconfirmed' | 'confirmed';
    readyMethods: LearningRepresentation[];
    retainedMethods: LearningRepresentation[];
    unconfirmedPrerequisites: string[];
    facets: LearningFacetEvidence[];
    unknownAttempts: number;
    lastUnknownAt: string | null;
    uncertainty: boolean;
    lastContactAt: string | null;
    nextCheckAt: string | null;
    freshness: LearningFreshness;
    needsRecheck: boolean;
}

export const getMathUnitRequiredVariants = (unitId: string): readonly string[] =>
    unitId === 'math.subtract-two-two' ? ['no-regroup', 'regroup'] : ['default'];

const intervalMs = (stage: number) => MATH_PILOT_POLICY.reviewIntervalsDays[stage - 1]
    * MATH_PILOT_POLICY.delayedAfterMs;
const iso = (time: number | null) => time === null ? null : new Date(time).toISOString();

/** Pure evidence projection. No inferred MemoryState mastery or recall probability. */
export const evaluateMathLevel11Pilot = (
    records: readonly LearningEvidenceRecord[],
    profileId: string,
    asOf: string,
) => {
    const asOfTime = Date.parse(asOf);
    if (!Number.isFinite(asOfTime)) throw new Error('A valid comparison timestamp is required');
    const units = MATH_LV11_UNIT_IDS.map((id) => getLearningUnit(id)!);
    const accumulators = new Map<string, Map<string, FacetAccumulator>>(units.map((unit) => [unit.id, new Map()]));
    const unknown = new Map<string, number>();
    const lastUnknown = new Map<string, number>();
    const lastIndependent = new Map<string, number>();
    const lastContact = new Map<string, number>();
    const seen = new Set<number | string>();
    let ignoredRecords = 0;
    let duplicateRecords = 0;
    const ordered = records.filter((record) => {
        const time = Date.parse(record.timestamp);
        const eligible = record.profileId === profileId && record.subject === 'math'
            && Number.isFinite(time) && time <= asOfTime;
        if (!eligible) ignoredRecords += 1;
        return eligible;
    }).slice().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
        // At equal timestamps, uncertainty invalidates confidence after success.
        || Number(a.result !== 'correct' || a.learningEvidence?.assistance !== 'independent')
            - Number(b.result !== 'correct' || b.learningEvidence?.assistance !== 'independent'));

    for (const record of ordered) {
        if (record.id !== undefined) {
            if (seen.has(record.id)) { duplicateRecords += 1; continue; }
            seen.add(record.id);
        }
        const mapping = getLearningItemMapping('math', record.itemId);
        const facets = mapping ? accumulators.get(mapping.unitId) : undefined;
        if (!mapping || !facets) { ignoredRecords += 1; continue; }
        const isBarrier = record.result === 'barrier';
        const barrier = record.learningEvidenceBarrier;
        const context = validateLearningEvidenceContext(isBarrier && barrier ? {
            problem: barrier.problem, assistance: 'assisted', completion: 'whole-problem',
        } : record.learningEvidence, 'math', record.itemId);
        const time = Date.parse(record.timestamp);
        const previousContact = lastContact.get(mapping.unitId);
        lastContact.set(mapping.unitId, time);
        if (record.result === 'contact') {
            if (record.contactUncertain) lastUnknown.set(mapping.unitId, time);
            continue;
        }
        if (!context || context.assistance === 'unknown' || context.problem.variant === 'unknown'
            || (isBarrier && !['support-opened', 'error-correction', 'skipped'].includes(barrier?.reason ?? ''))) {
            unknown.set(mapping.unitId, (unknown.get(mapping.unitId) ?? 0) + 1);
            // Keep known historical evidence; separately request an identifiable
            // independent check before using this unit for progression again.
            lastUnknown.set(mapping.unitId, time);
            continue;
        }
        const problem = context.problem;
        const key = `${problem.representation}:${problem.variant}`;
        const facet: FacetAccumulator = facets.get(key) ?? {
            representation: problem.representation, variant: problem.variant,
            keys: new Set(), historicalKeys: new Set(), attempts: 0, delayed: 0,
            lastAttemptAt: record.timestamp, lastDelayedConfirmationAt: null,
            nextCheckAt: null, reviewStage: 1, needsRecheck: false,
        };
        const independent = !isBarrier && record.result === 'correct'
            && record.skipped !== true && context.assistance === 'independent';
        if (independent) {
            const hadIndependentEvidence = facet.keys.size > 0;
            facet.keys.add(problem.problemKey);
            facet.historicalKeys.add(problem.problemKey);
            facet.attempts += 1;
            lastIndependent.set(mapping.unitId, time);
            const delayed = hadIndependentEvidence
                && facet.keys.size >= MATH_PILOT_POLICY.distinctIndependentProblems
                && previousContact !== undefined
                && time - previousContact >= MATH_PILOT_POLICY.delayedAfterMs;
            if (delayed) {
                facet.delayed += 1;
                facet.lastDelayedConfirmationAt = record.timestamp;
            }
            if (facet.nextCheckAt === null) facet.nextCheckAt = time + intervalMs(1);
            else if (delayed && time >= facet.nextCheckAt) {
                facet.reviewStage = Math.min(facet.reviewStage + 1, MATH_PILOT_POLICY.reviewIntervalsDays.length);
                facet.nextCheckAt = time + intervalMs(facet.reviewStage);
                facet.needsRecheck = false;
            }
        } else {
            // Reconfirm only the observed method/variant. Its past delayed
            // successes and evidence for other methods remain historical facts.
            facet.keys.clear(); facet.attempts = 0;
            facet.needsRecheck = true;
            facet.reviewStage = 1;
            facet.nextCheckAt = time + intervalMs(1);
        }
        facet.lastAttemptAt = record.timestamp;
        facets.set(key, facet);
    }

    const evaluations: MathUnitPilotEvaluation[] = units.map((unit) => {
        const facets = [...accumulators.get(unit.id)!.values()].map((facet): LearningFacetEvidence => ({
            representation: facet.representation,
            variant: facet.variant,
            independentProblemCount: facet.keys.size,
            independentAttemptCount: facet.attempts,
            delayedConfirmationCount: facet.delayed,
            ready: facet.keys.size >= MATH_PILOT_POLICY.distinctIndependentProblems,
            retained: facet.lastDelayedConfirmationAt !== null,
            lastAttemptAt: facet.lastAttemptAt,
            historicalIndependentProblemCount: facet.historicalKeys.size,
            lastDelayedConfirmationAt: facet.lastDelayedConfirmationAt,
            nextCheckAt: iso(facet.nextCheckAt),
            reviewStage: facet.reviewStage,
            freshness: facet.keys.size < MATH_PILOT_POLICY.distinctIndependentProblems || facet.needsRecheck
                ? 'unconfirmed' : facet.nextCheckAt !== null && facet.nextCheckAt <= asOfTime ? 'due' : 'fresh',
            needsRecheck: facet.needsRecheck,
        })).sort((a, b) => `${a.representation}:${a.variant}`.localeCompare(`${b.representation}:${b.variant}`));
        const requiredVariants = getMathUnitRequiredVariants(unit.id);
        const completedMethods = (field: 'ready' | 'retained'): LearningRepresentation[] =>
            (['symbol', 'algorithm'] as const).filter((method) => requiredVariants.every((variant) =>
                facets.some((facet) => facet.representation === method && facet.variant === variant && facet[field])));
        const readyMethods = completedMethods('ready');
        const retainedMethods = completedMethods('retained');
        const unknownAt = lastUnknown.get(unit.id) ?? null;
        const uncertainty = unknownAt !== null && (lastIndependent.get(unit.id) ?? -Infinity) <= unknownAt;
        const freshMethod = readyMethods.some(method => requiredVariants.every(variant => facets.some(facet =>
            facet.representation === method && facet.variant === variant && facet.freshness === 'fresh')));
        const dueMethod = readyMethods.some(method => requiredVariants.every(variant => facets.some(facet =>
            facet.representation === method && facet.variant === variant && facet.freshness !== 'unconfirmed')));
        const deadlines = facets.flatMap(facet => facet.nextCheckAt ? [Date.parse(facet.nextCheckAt)] : []);
        return {
            unitId: unit.id, label: unit.label,
            readiness: readyMethods.length > 0 ? 'ready' : 'unconfirmed',
            retention: retainedMethods.length > 0 ? 'confirmed' : 'unconfirmed',
            readyMethods, retainedMethods,
            // The pilot checks unit performance separately from route eligibility.
            // It does not infer prerequisite mastery from successful later units.
            unconfirmedPrerequisites: [...unit.prerequisites],
            facets, unknownAttempts: unknown.get(unit.id) ?? 0,
            lastUnknownAt: iso(unknownAt), uncertainty,
            lastContactAt: iso(lastContact.get(unit.id) ?? null),
            nextCheckAt: iso(deadlines.length ? Math.min(...deadlines) : null),
            freshness: uncertainty ? 'unconfirmed' : freshMethod ? 'fresh' : dueMethod ? 'due' : 'unconfirmed',
            needsRecheck: uncertainty || facets.some(facet => facet.needsRecheck),
        };
    });
    for (const unit of evaluations) {
        unit.unconfirmedPrerequisites = unit.unconfirmedPrerequisites.filter((id) =>
            !evaluations.some((candidate) => candidate.unitId === id && candidate.readiness === 'ready'));
    }
    return {
        mode: 'evidence-projection' as const,
        profileId,
        asOf,
        policy: MATH_PILOT_POLICY,
        allUnitsReady: evaluations.every((unit) => unit.readiness === 'ready'),
        allUnitsRetained: evaluations.every((unit) => unit.retention === 'confirmed'),
        ignoredRecords,
        duplicateRecords,
        units: evaluations,
    };
};

export interface ReservedEvidenceEvent {
    id: string;
    profileId: string;
    timestamp: string | number;
    learningEvidence?: LearningEvidenceContext;
    learningEvidenceBarrier?: LearningEvidenceBarrier;
}

/** Existing full supported events and interruption barriers; no gameplay observation input. */
export const reservedEventsToEvidenceRecords = (events: readonly ReservedEvidenceEvent[]): LearningEvidenceRecord[] =>
    events.flatMap((event) => {
        const time = typeof event.timestamp === 'number' ? event.timestamp : Date.parse(event.timestamp);
        if (!Number.isFinite(time) || !Number.isFinite(new Date(time).getTime())) return [];
        const context = event.learningEvidence?.problem ?? event.learningEvidenceBarrier?.problem;
        if (!context) return [];
        // Successful independent events are already represented by AttemptLog.
        if (!event.learningEvidenceBarrier && event.learningEvidence?.assistance !== 'assisted') return [];
        return [{
            id: `event:${event.id}`, profileId: event.profileId,
            subject: context.subject, itemId: context.itemId, timestamp: new Date(time).toISOString(),
            result: 'barrier' as const,
            learningEvidenceBarrier: event.learningEvidenceBarrier ?? {
                problem: context, reason: 'support-opened' as const,
            },
        }];
    });
