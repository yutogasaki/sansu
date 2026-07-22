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
);
