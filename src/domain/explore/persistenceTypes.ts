import type { Problem } from "../types";
import type { AttemptIdentity, AttemptNumber } from "./attemptIdentity";
import type {
    ExploreLearningSegmentEndStepExclusive,
    ExploreLearningSegmentKey,
    ExploreLearningSegmentStartStep,
    ExploreLearningStep,
} from "./learningSegment";
import type { ExploreOpeningExperienceId } from "./openingExperience";
import type {
    DiscoveryInstance,
    ExploreEncounterId,
    ExploreProblemGate,
    ExploreRunState,
} from "./types";

export type PersistedExploreRunStatus = "active" | "returned" | "rescued" | "abandoned";
export type PersistedExploreRunTerminalStatus = Exclude<PersistedExploreRunStatus, "active">;
export type PersistedExploreAttemptResult = "correct" | "incorrect" | "skipped";
export type ExploreLearningSource =
    | "due"
    | "weak"
    | "maintenance"
    | "followup"
    | "main"
    | "plus-one"
    | "representation-retry"
    | "game-only-fallback";

export interface ExploreLearningAssignment {
    assignmentKey: string;
    profileId: string;
    runId: string;
    gateId: string;
    problemId: string;
    categoryId: Problem["categoryId"];
    source: ExploreLearningSource;
    isReview: boolean;
    isMaintenanceCheck: boolean;
    countsTowardReviewCap: boolean;
    affectsSrs: boolean;
    reservedAt: number;
    /** Retry plans keep their exact generated Problem here; base plans live in learningSegments. */
    reservedProblem?: Problem;
    reservedEncounterId?: ExploreEncounterId;
}

export interface ExploreLearningProfileSnapshotBoundary {
    mathMainLevel: number;
    mathMaxUnlocked: number;
}

export interface ExploreLearningSegmentSlot {
    step: ExploreLearningStep;
    slotIndex: number;
    sequenceOrdinal: number;
    gateId: string;
    nodeId: string;
    actionType: ExploreProblemGate["actionType"];
    attemptCount: number;
    bridgePlan?: ExploreProblemGate["bridgePlan"];
    problem: Problem;
    encounterId?: ExploreEncounterId;
    assignment: ExploreLearningAssignment;
}

export interface ExploreLearningSegment {
    schemaVersion: 1;
    segmentId: string;
    segmentKey: ExploreLearningSegmentKey;
    startStep: ExploreLearningSegmentStartStep;
    endStepExclusive: ExploreLearningSegmentEndStepExclusive;
    plannedFromStep: ExploreLearningStep;
    plannerVersion: string;
    generatorVersion: string;
    seed: string;
    profileSnapshot: ExploreLearningProfileSnapshotBoundary;
    plannedAt: number;
    slots: readonly ExploreLearningSegmentSlot[];
}

/**
 * Versioned, JSON-serializable snapshot of the active reducer state. The
 * answer being typed is deliberately UI-only; `pendingProblem` and its
 * one-based attempt boundary live inside `state`.
 */
export interface ExploreActiveCheckpoint {
    schemaVersion: 1;
    revision: number;
    openingExperienceId: ExploreOpeningExperienceId;
    acknowledgedDiscoveryId?: string;
    state: ExploreRunState;
    updatedAt: number;
}

export interface ExploreRunRecord {
    runId: string;
    profileId: string;
    seed: string;
    status: PersistedExploreRunStatus;
    startedAt: number;
    endedAt?: number;
    energyUsed: number;
    problemsAnswered: number;
    correctCount: number;
    incorrectCount: number;
    skippedCount: number;
    discoveries: DiscoveryInstance[];
    routeSummary: string[];
    updatedAt: number;
    learningAssignments?: Record<string, ExploreLearningAssignment>;
    learningSegments?: Partial<Record<ExploreLearningSegmentKey, ExploreLearningSegment>>;
    activeCheckpoint?: ExploreActiveCheckpoint;
}

export interface ExploreDiscoveryRecord {
    profileId: string;
    discoveryId: string;
    kind: string;
    name: string;
    rarity: "common" | "uncommon" | "rare" | "legend";
    firstFoundAt: number;
    count: number;
    lastFoundAt: number;
}

interface ExploreRunEventRecordBase {
    id?: number;
    profileId: string;
    runId: string;
    timestamp: number;
}

export interface ExploreRunStartedEventRecord extends ExploreRunEventRecordBase {
    type: "run_started";
    attemptKey?: never;
    payload: {
        seed: string;
    };
}

export interface ExploreProblemAnsweredEventRecord extends ExploreRunEventRecordBase {
    type: "problem_answered";
    attemptKey: string;
    gateId: string;
    attemptNumber: AttemptNumber;
    recordedSkillId: Problem["categoryId"];
    result: PersistedExploreAttemptResult;
    affectsSrs: boolean;
    assignmentKey?: string;
    learningSource?: ExploreLearningSource;
    isReview?: boolean;
    isMaintenanceCheck?: boolean;
    learningLogId?: number;
    payload: null;
}

export interface ExploreRunEndedEventRecord extends ExploreRunEventRecordBase {
    type: "run_ended";
    attemptKey?: never;
    payload: {
        status: PersistedExploreRunTerminalStatus;
        energyUsed: number;
        discoveries: DiscoveryInstance[];
        routeSummary: string[];
    };
}

export type ExploreRunEventRecord =
    | ExploreRunStartedEventRecord
    | ExploreProblemAnsweredEventRecord
    | ExploreRunEndedEventRecord;

export interface StartExploreRunInput {
    runId: string;
    profileId: string;
    seed: string;
    startedAt: number;
    activeCheckpoint?: ExploreActiveCheckpoint;
}

export interface CommitExploreAttemptInput {
    identity: AttemptIdentity;
    problem: Pick<Problem, "id" | "categoryId">;
    result: PersistedExploreAttemptResult;
    committedAt: number;
    timeMs?: number;
    expectedCheckpointRevision?: number;
}

export interface ReserveExploreLearningAssignmentInput {
    runId: string;
    profileId: string;
    gateId: string;
    problemId: string;
    categoryId: Problem["categoryId"];
    source: ExploreLearningSource;
    isReview: boolean;
    isMaintenanceCheck: boolean;
    countsTowardReviewCap: boolean;
    affectsSrs: boolean;
    reservedAt: number;
    reservedProblem?: Problem;
    reservedEncounterId?: ExploreEncounterId;
}

export interface ReserveExploreLearningSegmentInput {
    runId: string;
    profileId: string;
    expectedCheckpointRevision: number;
    expectedStartStep: ExploreLearningStep;
    expectedStartGateId: string;
    segment: ExploreLearningSegment;
}

export interface FinishExploreRunInput {
    runId: string;
    profileId: string;
    status: PersistedExploreRunTerminalStatus;
    endedAt: number;
    energyUsed: number;
    discoveries: DiscoveryInstance[];
    routeSummary: string[];
    expectedCheckpointRevision?: number;
}

export interface ExploreAttemptCommitReceipt {
    attemptKey: string;
    identity: AttemptIdentity;
    recordedSkillId: Problem["categoryId"];
    result: PersistedExploreAttemptResult;
    affectsSrs: boolean;
    assignmentKey?: string;
    learningSource?: ExploreLearningSource;
    learningLogId?: number;
    committedAt: number;
    checkpointRevision?: number;
}

export interface ExploreRunFinishReceipt {
    runId: string;
    profileId: string;
    status: PersistedExploreRunTerminalStatus;
    endedAt: number;
    checkpointRevision?: number;
}

export interface SaveExploreRunCheckpointInput {
    runId: string;
    profileId: string;
    expectedRevision: number;
    state: ExploreRunState;
    openingExperienceId: ExploreOpeningExperienceId;
    acknowledgedDiscoveryId?: string;
    savedAt: number;
}

export interface ExploreRunCheckpointSaveReceipt {
    runId: string;
    profileId: string;
    checkpointRevision: number;
    savedAt: number;
}

export interface ResumableExploreRun {
    run: ExploreRunRecord;
    checkpoint: ExploreActiveCheckpoint;
}
