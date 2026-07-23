import {
    assignmentsMatch,
    createExploreLearningAssignment,
} from "./learningAssignment";
import {
    createExploreLearningSegmentId,
    getExploreLearningSegmentWindow,
} from "./learningSegment";
import type {
    ExploreLearningAssignment,
    ExploreLearningSegment,
    ExploreLearningSegmentSlot,
    ExploreRunRecord,
} from "./persistenceTypes";

export const exploreJsonValuesMatch = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
        return Array.isArray(left)
            && Array.isArray(right)
            && left.length === right.length
            && left.every((value, index) => exploreJsonValuesMatch(value, right[index]));
    }
    if (!left || !right || typeof left !== "object" || typeof right !== "object") {
        return false;
    }
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined).sort();
    const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined).sort();
    return leftKeys.length === rightKeys.length
        && leftKeys.every((key, index) => (
            key === rightKeys[index]
            && exploreJsonValuesMatch(leftRecord[key], rightRecord[key])
        ));
};

export const exploreLearningSegmentsMatch = (
    left: ExploreLearningSegment,
    right: ExploreLearningSegment,
): boolean => (
    left.schemaVersion === right.schemaVersion
    && left.segmentId === right.segmentId
    && left.segmentKey === right.segmentKey
    && left.startStep === right.startStep
    && left.endStepExclusive === right.endStepExclusive
    && left.plannedFromStep === right.plannedFromStep
    && left.plannerVersion === right.plannerVersion
    && left.generatorVersion === right.generatorVersion
    && left.seed === right.seed
    && exploreJsonValuesMatch(left.profileSnapshot, right.profileSnapshot)
    && left.slots.length === right.slots.length
    && left.slots.every((slot, index) => {
        const other = right.slots[index];
        return Boolean(other)
            && slot.step === other.step
            && slot.slotIndex === other.slotIndex
            && slot.sequenceOrdinal === other.sequenceOrdinal
            && slot.gateId === other.gateId
            && slot.nodeId === other.nodeId
            && slot.actionType === other.actionType
            && slot.attemptCount === other.attemptCount
            && slot.bridgePlan === other.bridgePlan
            && slot.encounterId === other.encounterId
            && exploreJsonValuesMatch(slot.problem, other.problem)
            && assignmentsMatch(slot.assignment, other.assignment);
    })
);

const hasValidAssignmentPolicy = (assignment: ExploreLearningAssignment): boolean => {
    const isGameOnly = assignment.source === "game-only-fallback";
    const countsTowardReviewCap = assignment.source === "due"
        || assignment.source === "maintenance"
        || assignment.source === "weak";
    return assignment.affectsSrs !== isGameOnly
        && assignment.isReview === (assignment.source === "due")
        && assignment.isMaintenanceCheck === (assignment.source === "maintenance")
        && assignment.countsTowardReviewCap === countsTowardReviewCap
        && Number.isFinite(assignment.reservedAt)
        && assignment.reservedAt >= 0;
};

const slotIntegrityError = (
    slot: ExploreLearningSegmentSlot,
    segment: ExploreLearningSegment,
    run: ExploreRunRecord,
    index: number,
): string | undefined => {
    const canonicalAssignment = createExploreLearningAssignment({
        profileId: slot.assignment.profileId,
        runId: slot.assignment.runId,
        gateId: slot.assignment.gateId,
        problemId: slot.assignment.problemId,
        categoryId: slot.assignment.categoryId,
        source: slot.assignment.source,
        isReview: slot.assignment.isReview,
        isMaintenanceCheck: slot.assignment.isMaintenanceCheck,
        countsTowardReviewCap: slot.assignment.countsTowardReviewCap,
        affectsSrs: slot.assignment.affectsSrs,
        reservedAt: slot.assignment.reservedAt,
        reservedProblem: slot.assignment.reservedProblem,
        reservedEncounterId: slot.assignment.reservedEncounterId,
    });
    const storedAssignment = run.learningAssignments?.[slot.problem.id];
    const knownNode = run.activeCheckpoint?.state.nodes.find((node) => node.id === slot.nodeId);
    if (
        slot.step !== segment.plannedFromStep + index
        || slot.slotIndex !== slot.step - segment.startStep
        || slot.sequenceOrdinal !== slot.step
        || !slot.gateId
        || slot.gateId !== `${run.runId}:${slot.nodeId}`
        || !slot.nodeId
        || (knownNode && slot.actionType !== (knownNode.kind === "bridge" ? "bridge" : "dig"))
        || slot.attemptCount < 0
        || !Number.isSafeInteger(slot.attemptCount)
        || (slot.actionType === "bridge"
            ? slot.bridgePlan !== "stones"
            : slot.bridgePlan !== undefined)
        || !slot.problem.id
        || slot.problem.subject !== "math"
        || !slot.problem.categoryId
        || slot.problem.id !== slot.assignment.problemId
        || slot.problem.categoryId !== slot.assignment.categoryId
        || slot.problem.isReview !== slot.assignment.isReview
        || Boolean(slot.problem.isMaintenanceCheck) !== slot.assignment.isMaintenanceCheck
        || slot.assignment.profileId !== run.profileId
        || slot.assignment.runId !== run.runId
        || slot.assignment.gateId !== slot.gateId
        || !assignmentsMatch(slot.assignment, canonicalAssignment)
        || (
            slot.assignment.reservedProblem !== undefined
            && (
                !exploreJsonValuesMatch(
                    slot.problem,
                    slot.assignment.reservedProblem,
                )
                || slot.encounterId !== slot.assignment.reservedEncounterId
            )
        )
        || !storedAssignment
        || !assignmentsMatch(storedAssignment, slot.assignment)
        || !hasValidAssignmentPolicy(slot.assignment)
    ) return `learning segment slot ${index} is inconsistent`;
    return undefined;
};

export const getExploreLearningSegmentsIntegrityError = (
    run: ExploreRunRecord,
): string | undefined => {
    const seenSteps = new Set<number>();
    const seenGateIds = new Set<string>();
    const seenProblemIds = new Set<string>();
    for (const [mapKey, segment] of Object.entries(run.learningSegments || {})) {
        if (!segment) continue;
        const window = getExploreLearningSegmentWindow(segment.plannedFromStep);
        const segmentId = createExploreLearningSegmentId(run.runId, segment.plannedFromStep);
        if (
            segment.schemaVersion !== 1
            || !window
            || !segmentId
            || mapKey !== segment.segmentKey
            || segment.segmentId !== segmentId
            || segment.segmentKey !== window.key
            || segment.startStep !== window.startStep
            || segment.endStepExclusive !== window.endStepExclusive
            || !segment.plannerVersion
            || !segment.generatorVersion
            || !segment.seed
            || !Number.isFinite(segment.plannedAt)
            || segment.plannedAt < 0
            || !Number.isSafeInteger(segment.profileSnapshot.mathMainLevel)
            || segment.profileSnapshot.mathMainLevel < 1
            || !Number.isSafeInteger(segment.profileSnapshot.mathMaxUnlocked)
            || segment.profileSnapshot.mathMaxUnlocked < segment.profileSnapshot.mathMainLevel
            || segment.slots.length !== segment.endStepExclusive - segment.plannedFromStep
        ) return `learning segment ${mapKey} has an invalid boundary`;

        for (let index = 0; index < segment.slots.length; index += 1) {
            const slot = segment.slots[index];
            const error = slotIntegrityError(slot, segment, run, index);
            if (error) return error;
            if (
                seenSteps.has(slot.step)
                || seenGateIds.has(slot.gateId)
                || seenProblemIds.has(slot.problem.id)
            ) return "learning segments contain duplicate bindings";
            seenSteps.add(slot.step);
            seenGateIds.add(slot.gateId);
            seenProblemIds.add(slot.problem.id);
        }
    }
    return undefined;
};
