import {
    DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
    isExploreOpeningExperienceId,
    type ExploreOpeningExperienceId,
} from "./openingExperience";
import { assignmentsMatch } from "./learningAssignment";
import { exploreReducer } from "./reducer";
import { createAttemptIdentity } from "./attemptIdentity";
import type {
    ExploreActiveCheckpoint,
    ExploreAttemptCommitReceipt,
    ExploreProblemAnsweredEventRecord,
    ExploreRunRecord,
} from "./persistenceTypes";
import type { ExploreRunState } from "./types";

export const EXPLORE_ACTIVE_CHECKPOINT_SCHEMA_VERSION = 1 as const;

export class ExploreCheckpointConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExploreCheckpointConflictError";
    }
}

export interface CreateExploreActiveCheckpointInput {
    state: ExploreRunState;
    openingExperienceId?: ExploreOpeningExperienceId;
    acknowledgedDiscoveryId?: string;
    revision?: number;
    updatedAt?: number;
}

const assertRevision = (revision: number) => {
    if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new ExploreCheckpointConflictError(
            "checkpoint revision must be a non-negative safe integer",
        );
    }
};

export const createExploreActiveCheckpoint = ({
    state,
    openingExperienceId = DEFAULT_EXPLORE_OPENING_EXPERIENCE_ID,
    acknowledgedDiscoveryId,
    revision = 0,
    updatedAt = state.startedAt,
}: CreateExploreActiveCheckpointInput): ExploreActiveCheckpoint => {
    assertRevision(revision);
    if (!Number.isFinite(updatedAt) || updatedAt < 0) {
        throw new ExploreCheckpointConflictError("checkpoint updatedAt must be non-negative");
    }
    if (
        acknowledgedDiscoveryId
        && !state.temporaryFinds.some((find) => find.id === acknowledgedDiscoveryId)
    ) {
        throw new ExploreCheckpointConflictError(
            `acknowledged discovery ${acknowledgedDiscoveryId} is not in the active run`,
        );
    }

    return {
        schemaVersion: EXPLORE_ACTIVE_CHECKPOINT_SCHEMA_VERSION,
        revision,
        openingExperienceId,
        acknowledgedDiscoveryId,
        state,
        updatedAt,
    };
};

const hasUniqueStrings = (values: readonly string[]) => new Set(values).size === values.length;

/**
 * Checks the cross-record invariants required before a stored run can be
 * resumed. Aggregate counters may be one answer ahead until the event tail is
 * reconciled by the repository.
 */
export const assertExploreActiveCheckpointForRun = (
    checkpoint: ExploreActiveCheckpoint,
    run: ExploreRunRecord,
) => {
    if (checkpoint.schemaVersion !== EXPLORE_ACTIVE_CHECKPOINT_SCHEMA_VERSION) {
        throw new ExploreCheckpointConflictError("unsupported explore checkpoint schema");
    }
    assertRevision(checkpoint.revision);
    if (!isExploreOpeningExperienceId(checkpoint.openingExperienceId)) {
        throw new ExploreCheckpointConflictError("unknown opening experience in checkpoint");
    }
    if (
        !Number.isFinite(checkpoint.updatedAt)
        || checkpoint.updatedAt < 0
        || checkpoint.updatedAt > run.updatedAt
    ) {
        throw new ExploreCheckpointConflictError("checkpoint has an invalid update boundary");
    }
    const { state } = checkpoint;
    if (
        run.status !== "active"
        || state.status !== "active"
        || state.runId !== run.runId
        || state.profileId !== run.profileId
        || state.seed !== run.seed
        || state.startedAt !== run.startedAt
    ) {
        throw new ExploreCheckpointConflictError("checkpoint does not belong to the active run");
    }
    if (
        !Number.isSafeInteger(state.steps)
        || state.steps < 0
        || !Number.isSafeInteger(state.incorrectAnswers)
        || state.incorrectAnswers < 0
        || !Number.isFinite(state.energy)
        || state.energy < 0
        || state.energy > state.maxEnergy
        || !Number.isSafeInteger(state.maxEnergy)
        || state.maxEnergy < 1
        || state.maxEnergy !== state.config.maxEnergy
    ) {
        throw new ExploreCheckpointConflictError("checkpoint contains invalid counters");
    }
    const nodeIds = state.nodes.map((node) => node.id);
    const knownNodeIds = new Set(nodeIds);
    if (
        !hasUniqueStrings(nodeIds)
        || !hasUniqueStrings(state.openedNodeIds)
        || !hasUniqueStrings(state.committedAttemptKeys)
        || !hasUniqueStrings(state.attempts.map((attempt) => attempt.attemptKey))
        || !hasUniqueStrings(state.temporaryFinds.map((find) => find.id))
        || !knownNodeIds.has(state.currentNodeId)
        || !state.openedNodeIds.includes(state.currentNodeId)
        || state.openedNodeIds.some((nodeId) => !knownNodeIds.has(nodeId))
        || state.temporaryFinds.some((find) => !knownNodeIds.has(find.nodeId))
        || (state.pendingProblem && !knownNodeIds.has(state.pendingProblem.nodeId))
        || state.attempts.length !== state.committedAttemptKeys.length
        || state.attempts.some((attempt) => (
            !state.committedAttemptKeys.includes(attempt.attemptKey)
        ))
    ) {
        throw new ExploreCheckpointConflictError("checkpoint contains inconsistent run history");
    }
    if (
        checkpoint.acknowledgedDiscoveryId
        && !state.temporaryFinds.some((find) => find.id === checkpoint.acknowledgedDiscoveryId)
    ) {
        throw new ExploreCheckpointConflictError("checkpoint discovery cursor is outside the run");
    }

    const gate = state.pendingProblem;
    if (gate?.problem) {
        const assignment = gate.learningAssignment;
        const storedAssignment = run.learningAssignments?.[gate.problem.id];
        if (
            !assignment
            || !storedAssignment
            || !assignmentsMatch(assignment, storedAssignment)
            || assignment.profileId !== run.profileId
            || assignment.runId !== run.runId
            || assignment.gateId !== gate.gateId
            || assignment.problemId !== gate.problem.id
            || assignment.categoryId !== gate.problem.categoryId
            || assignment.isReview !== gate.problem.isReview
        ) {
            throw new ExploreCheckpointConflictError(
                "checkpoint pending problem does not match its stored assignment",
            );
        }
    }
};

export const assertExploreCheckpointMatchesRunAggregates = (
    checkpoint: ExploreActiveCheckpoint,
    run: ExploreRunRecord,
) => {
    const correctCount = checkpoint.state.attempts.filter(
        (attempt) => attempt.result === "correct",
    ).length;
    const incorrectCount = checkpoint.state.attempts.filter(
        (attempt) => attempt.result === "incorrect",
    ).length;
    if (
        run.problemsAnswered !== checkpoint.state.attempts.length
        || run.correctCount !== correctCount
        || run.incorrectCount !== incorrectCount
        || run.skippedCount !== 0
        || checkpoint.state.steps !== correctCount
        || checkpoint.state.incorrectAnswers !== incorrectCount
        || checkpoint.state.temporaryFinds.length !== correctCount
    ) {
        throw new ExploreCheckpointConflictError(
            "checkpoint does not match the persisted run aggregates",
        );
    }
};

export const createExploreReceiptFromEvent = (
    event: ExploreProblemAnsweredEventRecord,
): ExploreAttemptCommitReceipt => ({
    attemptKey: event.attemptKey,
    identity: createAttemptIdentity({
        profileId: event.profileId,
        runId: event.runId,
        gateId: event.gateId,
        attemptNumber: event.attemptNumber,
    }),
    recordedSkillId: event.recordedSkillId,
    result: event.result,
    affectsSrs: event.affectsSrs === true,
    assignmentKey: event.assignmentKey,
    learningSource: event.learningSource,
    learningLogId: event.learningLogId,
    committedAt: event.timestamp,
});

export interface FoldExploreAnswerTailInput {
    checkpoint: ExploreActiveCheckpoint;
    event: ExploreProblemAnsweredEventRecord;
}

/** Applies exactly one durable answer event to a checkpoint through the reducer. */
export const foldExploreAnswerTail = ({
    checkpoint,
    event,
}: FoldExploreAnswerTailInput): ExploreActiveCheckpoint => {
    if (checkpoint.state.committedAttemptKeys.includes(event.attemptKey)) return checkpoint;
    if (event.result !== "correct" && event.result !== "incorrect") {
        throw new ExploreCheckpointConflictError("unsupported answer result in checkpoint tail");
    }

    const receipt = createExploreReceiptFromEvent(event);
    const nextState = exploreReducer(checkpoint.state, {
        type: "APPLY_COMMITTED_ATTEMPT",
        receipt,
        expectedResult: event.result,
    });
    if (nextState === checkpoint.state) {
        throw new ExploreCheckpointConflictError(
            `answer tail ${event.attemptKey} does not match the checkpoint boundary`,
        );
    }

    return createExploreActiveCheckpoint({
        state: nextState,
        openingExperienceId: checkpoint.openingExperienceId,
        acknowledgedDiscoveryId: checkpoint.acknowledgedDiscoveryId,
        revision: checkpoint.revision + 1,
        updatedAt: Math.max(checkpoint.updatedAt, event.timestamp),
    });
};
