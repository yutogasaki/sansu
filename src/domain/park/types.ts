import type { Problem, SubjectKey } from '../types';
import type { LearningEvidenceBarrier, LearningEvidenceContext } from '../learning/types';

export const PART_KINDS = ['slide', 'trampoline', 'bubble', 'mat', 'bell', 'paint'] as const;
export type PartKind = typeof PART_KINDS[number];
export interface ParkPart { id: string; kind: PartKind }
export interface ParkCourse { id: string; name: string; slots: (string | null)[] }
export interface ParkRecord {
    profileId: string;
    schemaVersion: 1;
    revision: number;
    parts: ParkPart[];
    courses: ParkCourse[];
    activeCourseId: string;
    completedPlans: number;
    pendingPlanId?: string;
    updatedAt: number;
}
export interface LearningSlot {
    problem: Problem;
    source: string;
    countsTowardReviewCap: boolean;
    assisted: boolean;
    /** Separate from SRS support policy; error correction is sticky for unit evidence. */
    learningEvidenceAssistance?: 'independent' | 'assisted' | 'unknown';
    completed: boolean;
    hissanStep?: number;
    hissanValues?: Record<string, string>;
}
export interface ParkPlan {
    id: string;
    profileId: string;
    schemaVersion: 1;
    plannerVersion: 'park-learning-v1';
    subject: SubjectKey;
    partKind: PartKind;
    rewardId: string;
    status: 'active' | 'completed';
    revision: number;
    cursor: number;
    slots: LearningSlot[];
    startedAt: number;
    completedAt?: number;
}
export type ParkLearningAction =
    | { type: 'answer'; answer: string | string[] }
    | { type: 'support_opened' }
    | { type: 'skipped' };
export interface ParkEvent {
    id: string;
    profileId: string;
    planId?: string;
    courseId?: string;
    type: 'plan_started' | 'plan_completed' | 'answer' | 'support_opened' | 'skipped'
        | 'replay_started' | 'replay_completed' | 'learning_resumed';
    timestamp: number;
    action?: ParkLearningAction;
    slotIndex?: number;
    result?: 'correct' | 'incorrect' | 'assisted-correct' | 'assisted-incorrect' | 'skipped';
    learningLogId?: number;
    /** Assisted whole answers have no SRS log; preserve their unit-evidence barrier here. */
    learningEvidence?: LearningEvidenceContext;
    learningEvidenceBarrier?: LearningEvidenceBarrier;
    rewardId?: string;
    layout?: (PartKind | null)[];
}
export type ParkEdit =
    | { type: 'place'; courseId: string; slot: number; partId: string; fromCourseId?: string }
    | { type: 'remove'; courseId: string; slot: number }
    | { type: 'add-slot'; courseId: string }
    | { type: 'add-course' }
    | { type: 'select-course'; courseId: string }
    | { type: 'rename'; courseId: string; name: string };
