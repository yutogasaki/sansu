export type FoundationCourse = 'foundation' | 'vocabulary';
export type FoundationUnit = 'F01' | 'F02';
export type FoundationTarget = 'A' | 'B' | 'C' | 'apple' | 'cat' | 'dog';
export type FoundationForm = 'shape' | 'letter-name' | 'word-listening';
export interface FoundationCourseRecord {
    profileId: string;
    course?: FoundationCourse;
    unit: FoundationUnit;
    pending?: { course: FoundationCourse; unit: FoundationUnit };
}
export interface FoundationOwner { profileId: string; status: 'active' | 'deleting'; updatedAt: number }
export interface FoundationProgress {
    profileId: string;
    id: string;
    target: FoundationTarget;
    form: FoundationForm;
    introduced: boolean;
    contactRevision: number;
    lastContactAt?: number;
    lastPresentationId?: string;
    strength: number;
    nextReview?: number;
    independentCount: number;
    delayedCount: number;
}
export interface FoundationPresentation {
    id: string;
    at: number;
    contactRevision: number;
    delayedEligible: boolean;
    timing: 'known' | 'unknown';
}
export interface FoundationSlot {
    index: number;
    target: FoundationTarget;
    form: FoundationForm;
    choices: FoundationTarget[];
    audio: string;
    picture?: string;
    support: 'none' | 'hint' | 'model';
    firstAnswer?: { answer: FoundationTarget; correct: boolean; at: number };
    presentation?: FoundationPresentation;
    completedAt?: number;
    completionKind?: 'independent' | 'assisted';
}
export interface FoundationPlan {
    id: string;
    profileId: string;
    unit: FoundationUnit;
    sourceVersion: 'english-foundation-v1';
    catalogVersion: 'foundation-v1';
    status: 'pending' | 'completed';
    revision: number;
    cursor: number;
    introDone: boolean;
    introTargets: FoundationTarget[];
    createdAt: number;
    slots: FoundationSlot[];
}
export interface FoundationEvent {
    id: string;
    profileId: string;
    planId?: string;
    slotIndex?: number;
    type: 'introduction' | 'replay' | 'model' | 'presentation' | 'answer' | 'hint' | 'supported_completed' | 'alternative';
    at: number;
    target?: FoundationTarget;
    answer?: FoundationTarget;
    correct?: boolean;
    delayed?: boolean;
}
export interface FoundationCompletion {
    sourceVersion: 'english-foundation-v1';
    profileId: string;
    completionId: string;
    planId: string;
    slotIndex: number;
    completionKind: 'independent' | 'assisted';
    completedAt: number;
}
export interface FoundationOutbox extends FoundationCompletion { acknowledgedAt?: number }
export interface FoundationAction {
    profileId: string;
    planId: string;
    revision: number;
    action: 'answer' | 'hint' | 'model' | 'supported_completed' | 'alternative';
    answer?: FoundationTarget;
}
