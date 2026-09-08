import type { InputType, MathRepresentationMode, SubjectKey } from '../types';

export const LEARNING_CATALOG_VERSION = 'curriculum-v1' as const;

export type LearningRepresentation = MathRepresentationMode | 'recognition';

/** A concept/lexical sense, not a replacement for the saved numeric level. */
export interface LearningUnitDefinition {
    id: string;
    subject: SubjectKey;
    label: string;
    strand: string;
    itemIds: readonly string[];
    prerequisites: readonly string[];
    suggestedPrerequisites: readonly string[];
    availability: 'existing' | 'planned';
    notes?: string;
}

export interface LearningItemMapping {
    itemId: string;
    subject: SubjectKey;
    unitId: string;
    representation: LearningRepresentation;
    legacyLevel: number;
    variants: readonly string[];
}

/** Frozen with a newly generated question; absent means legacy/unknown. */
export interface LearningProblemContext {
    catalogVersion: typeof LEARNING_CATALOG_VERSION;
    subject: SubjectKey;
    itemId: string;
    unitId: string;
    representation: LearningRepresentation;
    variant: string;
    inputType: InputType;
    problemKey: string;
}

/** Whole-problem evidence only. It never changes existing SRS or promotion. */
export interface LearningEvidenceContext {
    problem: LearningProblemContext;
    assistance: 'independent' | 'assisted' | 'unknown';
    completion: 'whole-problem';
}

/** Invalidates confidence without claiming a whole-problem answer or changing SRS. */
export interface LearningEvidenceBarrier {
    problem: LearningProblemContext;
    reason: 'support-opened' | 'error-correction' | 'skipped';
}
