import type {
    ExploreLearningAssignment,
    ReserveExploreLearningAssignmentInput,
} from "./persistenceTypes";

const EXPLORE_LEARNING_ASSIGNMENT_VERSION = "explore-learning-assignment-v1" as const;

export const createExploreLearningAssignmentKey = (
    input: Pick<
        ReserveExploreLearningAssignmentInput,
        "profileId" | "runId" | "gateId" | "problemId"
    >,
): string => JSON.stringify([
    EXPLORE_LEARNING_ASSIGNMENT_VERSION,
    input.profileId,
    input.runId,
    input.gateId,
    input.problemId,
]);

export const createExploreLearningAssignment = (
    input: ReserveExploreLearningAssignmentInput,
): ExploreLearningAssignment => ({
    ...input,
    assignmentKey: createExploreLearningAssignmentKey(input),
});

export const assignmentsMatch = (
    left: ExploreLearningAssignment,
    right: ExploreLearningAssignment,
): boolean => (
    left.assignmentKey === right.assignmentKey
    && left.profileId === right.profileId
    && left.runId === right.runId
    && left.gateId === right.gateId
    && left.problemId === right.problemId
    && left.categoryId === right.categoryId
    && left.source === right.source
    && left.isReview === right.isReview
    && left.isMaintenanceCheck === right.isMaintenanceCheck
    && left.countsTowardReviewCap === right.countsTowardReviewCap
    && left.affectsSrs === right.affectsSrs
    && left.learningEvidenceAssistance === right.learningEvidenceAssistance
    && left.reservedEncounterId === right.reservedEncounterId
    && JSON.stringify(left.reservedProblem ?? null)
        === JSON.stringify(right.reservedProblem ?? null)
);

/** Preserve the review label of legacy frozen reservations. */
export const expectedExploreAssignmentReview = (assignment: ExploreLearningAssignment): boolean =>
    assignment.source === 'due' || (assignment.learningEvidenceAssistance !== undefined
        && (assignment.source === 'weak' || assignment.source === 'maintenance'));

export const hasValidExploreEvidenceAssistance = (assignment: ExploreLearningAssignment): boolean =>
    assignment.learningEvidenceAssistance === undefined
    || assignment.learningEvidenceAssistance === 'independent'
    || assignment.learningEvidenceAssistance === 'assisted';
