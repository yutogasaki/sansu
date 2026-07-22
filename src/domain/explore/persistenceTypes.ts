import type { Problem } from "../types";
import type { AttemptIdentity, AttemptNumber } from "./attemptIdentity";
import type { DiscoveryInstance } from "./types";

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
}

export interface CommitExploreAttemptInput {
    identity: AttemptIdentity;
    problem: Pick<Problem, "id" | "categoryId">;
    result: PersistedExploreAttemptResult;
    committedAt: number;
    timeMs?: number;
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
}

export interface FinishExploreRunInput {
    runId: string;
    profileId: string;
    status: PersistedExploreRunTerminalStatus;
    endedAt: number;
    energyUsed: number;
    discoveries: DiscoveryInstance[];
    routeSummary: string[];
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
}

export interface ExploreRunFinishReceipt {
    runId: string;
    profileId: string;
    status: PersistedExploreRunTerminalStatus;
    endedAt: number;
}
