import { db } from "../../db";
import { createSeededRandom } from "../../utils/random";
import {
    getMaintenanceMathSkillIds,
    getRecentAttempts,
    getRetiredMathSkillIds,
    getReviewItems,
    getSkippedItemsToday,
    getWeakMathSkillIds,
} from "../learningRepository";
import {
    planMathProblems,
    type MathProblemPlanItem,
} from "../math";
import {
    getAvailableSkills,
    getMathSkillMetadata,
} from "../math/curriculum";
import type { UserProfile } from "../types";
import { getProfile } from "../user/repository";
import {
    getExploreBenchmarkE2EOptions,
    waitForExploreProblemPlanE2E,
} from "./persistenceClient";
import { getExploreAssistCandidates } from "./problemAdapter";
import {
    createExploreProblemPlan,
    createExploreProblemPlanForSkill,
    EXPLORE_PROBLEM_GENERATOR_VERSION,
    type ExploreProblemPlan,
} from "./problemAdapter";
import {
    reserveExploreLearningAssignment,
    reserveExploreLearningSegment,
} from "./persistenceRepository";
import type {
    ExploreLearningAssignment,
    ExploreLearningSegment,
    ExploreLearningSource,
    ExploreRunRecord,
} from "./persistenceTypes";
import type { ExploreProblemGate, ExploreRunState } from "./types";
import {
    COLD_OPEN_FIXED_TEN_ID,
    createColdOpenFixedTenProblem,
} from "../benchmark/coldOpenFixedTen";
import {
    getRequestedExploreEncounterId,
    resolveExploreEncounterId,
} from "./encounters";
import {
    getExploreLearningSegmentKey,
    projectExploreLearningSegmentGates,
    type ExploreLearningSegmentGateProjection,
} from "./learningSegment";
import {
    assignmentsMatch,
    createExploreLearningAssignment,
} from "./learningAssignment";

const EXPLORE_PLAN_WINDOW = 10;
const EXPLORE_COOLDOWN_WINDOW = 5;
const EXPLORE_REVIEW_CAP = 0.6;
const EXPLORE_WEAK_LIMIT = 3;
const EXPLORE_PLUS_ONE_LIMIT = 3;
export const EXPLORE_LEARNING_PLANNER_VERSION = "explore-learning-planner-v2";

interface ExploreLearningPlannerSnapshot {
    run: ExploreRunRecord;
    profile: UserProfile;
    due: Awaited<ReturnType<typeof getReviewItems>>;
    weak: string[];
    maintenance: string[];
    retired: string[];
    skippedToday: string[];
    recentAttempts: Awaited<ReturnType<typeof getRecentAttempts>>;
}

export interface ReservedExploreProblemPlan extends ExploreProblemPlan {
    assignment: ExploreLearningAssignment;
    learningSegment?: ExploreLearningSegment;
}

export interface CreateAndReserveExploreProblemPlanOptions {
    signal?: AbortSignal;
    expectedCheckpointRevision: number;
}

const assertPlannerActive = (signal?: AbortSignal) => {
    if (!signal?.aborted) return;
    const error = signal.reason instanceof Error
        ? signal.reason
        : new Error("Explore problem planning was cancelled");
    error.name = "AbortError";
    throw error;
};

const toExploreLearningSource = (
    source: MathProblemPlanItem["source"],
): ExploreLearningSource => source === "retry" ? "representation-retry" : source;

const sortAssignments = (
    run: ExploreRunRecord,
    throughStep: number,
): ExploreLearningAssignment[] => {
    const gateSteps = new Map<string, number>();
    Object.values(run.learningSegments || {}).forEach((segment) => {
        segment?.slots.forEach((slot) => gateSteps.set(slot.gateId, slot.sequenceOrdinal));
    });
    return Object.values(run.learningAssignments || {})
        .filter((assignment) => {
            const step = gateSteps.get(assignment.gateId);
            return step === undefined || step <= throughStep;
        })
        .sort((left, right) => {
            const leftStep = gateSteps.get(left.gateId);
            const rightStep = gateSteps.get(right.gateId);
            if (leftStep !== undefined && rightStep !== undefined && leftStep !== rightStep) {
                return leftStep - rightStep;
            }
            if (left.reservedAt !== right.reservedAt) return left.reservedAt - right.reservedAt;
            return left.problemId.localeCompare(right.problemId);
        });
};

const prepareExploreLearningPlannerSnapshot = async (
    profileId: string,
    signal?: AbortSignal,
) => {
    // Resolve one-time compatibility writes before the atomic planning
    // transaction. Every actual planner input is re-read inside that boundary.
    await getProfile(profileId);
    await getWeakMathSkillIds(profileId);
    assertPlannerActive(signal);
};

const getExploreLearningPlannerTransactionTables = () => [
    db.appData,
    db.profiles,
    db.memoryMath,
    db.memoryVocab,
    db.logs,
    db.exploreRuns,
] as const;

const readExploreLearningPlannerSnapshot = async (
    profileId: string,
    runId: string,
    profileFallback: UserProfile | undefined,
    signal?: AbortSignal,
): Promise<ExploreLearningPlannerSnapshot> => {
    const [
        run,
        profile,
        due,
        weak,
        maintenance,
        retired,
        skippedToday,
        recentAttempts,
    ] = await Promise.all([
        db.exploreRuns.get(runId),
        getProfile(profileId),
        getReviewItems(profileId, "math"),
        getWeakMathSkillIds(profileId),
        getMaintenanceMathSkillIds(profileId),
        getRetiredMathSkillIds(profileId),
        getSkippedItemsToday(profileId, "math"),
        getRecentAttempts(profileId, 20),
    ]);
    assertPlannerActive(signal);
    const resolvedProfile = profile ?? profileFallback;
    if (!run || run.profileId !== profileId || run.status !== "active") {
        throw new Error(`Active exploration run ${runId} was not found`);
    }
    if (!resolvedProfile || resolvedProfile.id !== profileId) {
        throw new Error(`Profile ${profileId} was not found`);
    }
    return {
        run,
        profile: resolvedProfile,
        due,
        weak,
        maintenance,
        retired,
        skippedToday,
        recentAttempts,
    };
};

export const canAddExploreReviewAssignment = (
    assignments: readonly Pick<ExploreLearningAssignment, "countsTowardReviewCap">[],
    windowSize: number,
): boolean => {
    const safeWindowSize = Math.max(1, Math.floor(windowSize));
    const existing = assignments
        .slice(-Math.max(0, safeWindowSize - 1))
        .map((assignment) => assignment.countsTowardReviewCap);
    const totalAfterCandidate = existing.length + 1;
    const reviewCountAfterCandidate = existing.filter(Boolean).length + 1;
    const allowedReviewCount = Math.max(
        1,
        Math.floor(totalAfterCandidate * EXPLORE_REVIEW_CAP),
    );
    return reviewCountAfterCandidate <= allowedReviewCount;
};

const countAssignments = (
    assignments: readonly ExploreLearningAssignment[],
): Map<string, number> => {
    const counts = new Map<string, number>();
    assignments.forEach((assignment) => {
        counts.set(assignment.categoryId, (counts.get(assignment.categoryId) || 0) + 1);
    });
    return counts;
};

const getRetrySkillIds = (gate: ExploreProblemGate): string[] => {
    if (gate.attemptCount < 2 || !gate.skillId) return [];
    const configured = getMathSkillMetadata(gate.skillId).reviewFallbackSkillIds ?? [];
    return [...new Set([
        ...configured,
        ...getExploreAssistCandidates(gate.skillId),
    ])];
};

const reservePlan = async (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    plan: ExploreProblemPlan,
    selection: Omit<MathProblemPlanItem, "skillId" | "source"> & {
        source: ExploreLearningSource;
        affectsSrs: boolean;
    },
    options: CreateAndReserveExploreProblemPlanOptions,
): Promise<ReservedExploreProblemPlan> => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");
    assertPlannerActive(options.signal);
    const assignment = await reserveExploreLearningAssignment({
        profileId: state.profileId,
        runId: state.runId,
        gateId: gate.gateId,
        problemId: plan.problem.id,
        categoryId: plan.problem.categoryId,
        source: selection.source,
        isReview: selection.isReview,
        isMaintenanceCheck: selection.isMaintenanceCheck,
        countsTowardReviewCap: selection.countsTowardReviewCap,
        affectsSrs: selection.affectsSrs,
        reservedAt: Date.now(),
        reservedProblem: plan.problem,
        reservedEncounterId: plan.encounterId,
    }, {
        signal: options.signal,
        expectedCheckpointRevision: options.expectedCheckpointRevision,
        expectedStep: state.steps,
        expectedAttemptCount: gate.attemptCount,
    });
    assertPlannerActive(options.signal);
    return { ...plan, assignment };
};

const restoreReservedPlan = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profile: UserProfile,
    assignment: ExploreLearningAssignment,
): ReservedExploreProblemPlan => {
    if (assignment.reservedProblem) {
        if (
            assignment.gateId !== gate.gateId
            || assignment.problemId !== assignment.reservedProblem.id
            || assignment.categoryId !== assignment.reservedProblem.categoryId
        ) {
            throw new Error(`Reserved exploration problem ${assignment.problemId} is inconsistent`);
        }
        return {
            problem: assignment.reservedProblem,
            encounterId: assignment.reservedEncounterId,
            assignment,
        };
    }
    const plan = createExploreProblemPlanForSkill(
        state,
        gate,
        assignment.categoryId,
        profile,
        {
            isReview: assignment.isReview,
            isMaintenanceCheck: assignment.isMaintenanceCheck,
        },
    );
    if (!plan || plan.problem.id !== assignment.problemId) {
        throw new Error(`Reserved exploration problem ${assignment.problemId} cannot be restored`);
    }
    return { ...plan, assignment };
};

const segmentGateMatches = (
    gate: ExploreProblemGate,
    slot: ExploreLearningSegment["slots"][number],
): boolean => (
    slot.gateId === gate.gateId
    && slot.nodeId === gate.nodeId
    && slot.actionType === gate.actionType
    && slot.attemptCount === gate.attemptCount
    && slot.bridgePlan === gate.bridgePlan
);

const restoreSegmentPlan = (
    run: ExploreRunRecord,
    state: ExploreRunState,
    gate: ExploreProblemGate,
): ReservedExploreProblemPlan | undefined => {
    const key = getExploreLearningSegmentKey(state.steps);
    const segment = key ? run.learningSegments?.[key] : undefined;
    if (!segment) return undefined;

    const slot = segment.slots.find((candidate) => candidate.step === state.steps);
    const storedAssignment = slot
        ? run.learningAssignments?.[slot.problem.id]
        : undefined;
    if (
        !slot
        || !storedAssignment
        || !segmentGateMatches(gate, slot)
        || slot.problem.id !== slot.assignment.problemId
        || slot.problem.categoryId !== slot.assignment.categoryId
        || !assignmentsMatch(slot.assignment, storedAssignment)
    ) {
        throw new Error(`Stored exploration segment ${segment.segmentId} is inconsistent`);
    }
    return {
        problem: slot.problem,
        encounterId: slot.encounterId,
        assignment: storedAssignment,
        learningSegment: segment,
    };
};

const createSegmentSeed = (
    state: ExploreRunState,
    projection: ExploreLearningSegmentGateProjection,
): string => JSON.stringify([
    EXPLORE_LEARNING_PLANNER_VERSION,
    state.seed,
    projection.segmentId,
]);

const orderSelectionsForAuthoredGates = (
    state: ExploreRunState,
    projection: ExploreLearningSegmentGateProjection,
    profile: UserProfile,
    selections: readonly MathProblemPlanItem[],
): MathProblemPlanItem[] => {
    // The shared planner remains authoritative. We only reorder two items
    // with the exact same learning policy so an authored node can receive a
    // compatible visual representation; no Due or source is replaced.
    const ordered = [...selections];
    const planFor = (selection: MathProblemPlanItem, gate: ExploreProblemGate) => (
        createExploreProblemPlanForSkill(
            state,
            gate,
            selection.skillId,
            profile,
            {
                isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
            },
        )
    );
    projection.slots.forEach(({ gate }, slotIndex) => {
        const requestedEncounter = getRequestedExploreEncounterId(state, gate);
        const current = ordered[slotIndex];
        if (!requestedEncounter || !current) return;
        if (planFor(current, gate)?.encounterId === requestedEncounter) return;

        const compatibleIndex = ordered.findIndex((candidate, candidateIndex) => (
            candidateIndex > slotIndex
            && candidate.source === current.source
            && candidate.isReview === current.isReview
            && candidate.isMaintenanceCheck === current.isMaintenanceCheck
            && candidate.countsTowardReviewCap === current.countsTowardReviewCap
            && planFor(candidate, gate)?.encounterId === requestedEncounter
        ));
        if (compatibleIndex < 0) return;
        [ordered[slotIndex], ordered[compatibleIndex]] = [
            ordered[compatibleIndex],
            ordered[slotIndex],
        ];
    });
    return ordered;
};

const createSegmentAssignment = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    plan: ExploreProblemPlan,
    selection: Omit<MathProblemPlanItem, "skillId" | "source"> & {
        source: ExploreLearningSource;
        affectsSrs: boolean;
    },
    reservedAt: number,
): ExploreLearningAssignment => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");
    return createExploreLearningAssignment({
        profileId: state.profileId,
        runId: state.runId,
        gateId: gate.gateId,
        problemId: plan.problem.id,
        categoryId: plan.problem.categoryId,
        source: selection.source,
        isReview: selection.isReview,
        isMaintenanceCheck: selection.isMaintenanceCheck,
        countsTowardReviewCap: selection.countsTowardReviewCap,
        affectsSrs: selection.affectsSrs,
        reservedAt,
    });
};

export const createFixedTenExploreBenchmarkPlan = (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    startIndex: number,
): ExploreProblemPlan | undefined => {
    const fixtureIndex = startIndex + state.steps;
    const problem = createColdOpenFixedTenProblem(
        fixtureIndex,
        `${gate.gateId}:benchmark-${fixtureIndex}:attempt-${gate.attemptCount}`,
    );
    if (!problem) return undefined;

    return {
        problem,
        encounterId: resolveExploreEncounterId(state, gate, problem),
    };
};

const createAndReserveSegmentPlan = async (
    state: ExploreRunState,
    projection: ExploreLearningSegmentGateProjection,
    snapshot: ExploreLearningPlannerSnapshot,
    options: CreateAndReserveExploreProblemPlanOptions,
    fixedCurrent?: ReservedExploreProblemPlan,
): Promise<ReservedExploreProblemPlan> => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");
    const {
        run,
        profile,
        due,
        weak,
        maintenance,
        retired,
        skippedToday,
        recentAttempts,
    } = snapshot;
    const assignments = sortAssignments(run, state.steps);
    const planWindow = assignments.slice(-EXPLORE_PLAN_WINDOW);
    const recentAssignmentIds = assignments
        .slice(-EXPLORE_COOLDOWN_WINDOW)
        .map((assignment) => assignment.categoryId);
    const recentLogIds = recentAttempts
        .filter((attempt) => attempt.subject === "math")
        .map((attempt) => attempt.itemId)
        .slice(0, EXPLORE_COOLDOWN_WINDOW);
    const availableSkills = new Set(getAvailableSkills(profile.mathMaxUnlocked));
    const compatiblePlans = new Map<string, ExploreProblemPlan | null>();
    const getCompatiblePlan = (skillId: string, gate: ExploreProblemGate) => {
        const key = `${gate.gateId}\u0000${skillId}`;
        if (!compatiblePlans.has(key)) {
            compatiblePlans.set(
                key,
                createExploreProblemPlanForSkill(state, gate, skillId, profile),
            );
        }
        return compatiblePlans.get(key) ?? null;
    };
    const planningSlots = fixedCurrent ? projection.slots.slice(1) : projection.slots;
    const planningProjection: ExploreLearningSegmentGateProjection = {
        ...projection,
        slots: planningSlots,
    };
    const isSkillEligible = (skillId: string) => planningSlots.every(
        ({ gate }) => getCompatiblePlan(skillId, gate) !== null,
    );
    const segmentSeed = createSegmentSeed(state, projection);
    const benchmark = getExploreBenchmarkE2EOptions();
    const isFixedTenBenchmark = benchmark.fixtureId === COLD_OPEN_FIXED_TEN_ID
        && benchmark.startIndex !== undefined;
    const selections = isFixedTenBenchmark
        ? []
        : planMathProblems({
            profile,
            count: planningSlots.length,
            dueSkillIds: [...new Set(due.map((item) => item.id))],
            weakSkillIds: weak.filter((skillId) => availableSkills.has(skillId)),
            maintenanceSkillIds: maintenance,
            retiredSkillIds: retired,
            cooldownIds: [...new Set([...recentLogIds, ...recentAssignmentIds])],
            recentIds: recentAssignmentIds,
            skippedTodayIds: skippedToday,
            // This map starts empty so the planner's same-skill guard applies
            // to this segment, while cooldownIds still carries prior history.
            blockCounts: new Map(),
            canAddReview: (planned) => canAddExploreReviewAssignment([
                ...assignments,
                ...planned,
            ], profile.dailyGoal ?? 20),
            currentWeakCount: planWindow.filter((item) => item.source === "weak").length,
            weakLimit: EXPLORE_WEAK_LIMIT,
            plusOneCount: planWindow.filter((item) => item.source === "plus-one").length,
            plusOneLimit: EXPLORE_PLUS_ONE_LIMIT,
            sameSkillLimit: 1,
            recentWindow: EXPLORE_COOLDOWN_WINDOW,
            maintenanceRate: 0.01,
            weakRate: 0.3,
            plusOneRate: 0.3,
            isSkillEligible,
            random: createSeededRandom(segmentSeed),
        });
    if (!isFixedTenBenchmark && selections.length !== planningSlots.length) {
        throw new Error(`Planner did not fill segment ${projection.segmentId}`);
    }
    const orderedSelections = isFixedTenBenchmark
        ? selections
        : orderSelectionsForAuthoredGates(state, planningProjection, profile, selections);

    const plannedAt = Date.now();
    const slots: ExploreLearningSegment["slots"] = projection.slots.map(
        ({ step, gate }, index) => {
            if (fixedCurrent && index === 0) {
                if (
                    fixedCurrent.problem.id !== fixedCurrent.assignment.problemId
                    || fixedCurrent.problem.categoryId !== fixedCurrent.assignment.categoryId
                    || fixedCurrent.assignment.gateId !== gate.gateId
                ) {
                    throw new Error(`Legacy segment ${projection.segmentId} has an invalid current slot`);
                }
                return {
                    step,
                    slotIndex: step - projection.startStep,
                    sequenceOrdinal: step,
                    gateId: gate.gateId,
                    nodeId: gate.nodeId,
                    actionType: gate.actionType,
                    attemptCount: gate.attemptCount,
                    bridgePlan: gate.bridgePlan,
                    problem: fixedCurrent.problem,
                    encounterId: fixedCurrent.encounterId,
                    assignment: fixedCurrent.assignment,
                };
            }
            const selectionIndex = index - (fixedCurrent ? 1 : 0);
            const selection = orderedSelections[selectionIndex];
            let plan: ExploreProblemPlan;
            let policy: Omit<MathProblemPlanItem, "skillId" | "source"> & {
                source: ExploreLearningSource;
                affectsSrs: boolean;
            };
            if (isFixedTenBenchmark) {
                const fixtureIndex = (benchmark.startIndex ?? 0) + step;
                // The throughput harness intentionally starts a second run at
                // fixture 8 and stops after two answers. Reserve its dormant
                // third slot with a wrapped fixture so the production 3-slot
                // atomicity contract remains intact without adding an 11th
                // measured question.
                const problem = createColdOpenFixedTenProblem(
                    fixtureIndex,
                    `${gate.gateId}:benchmark-${fixtureIndex}:attempt-${gate.attemptCount}`,
                ) ?? createColdOpenFixedTenProblem(
                    fixtureIndex % 10,
                    `${gate.gateId}:benchmark-${fixtureIndex}:attempt-${gate.attemptCount}`,
                );
                if (!problem) throw new Error(`Benchmark fixture ${fixtureIndex} is unavailable`);
                plan = {
                    problem,
                    encounterId: resolveExploreEncounterId(state, gate, problem),
                };
                policy = {
                    source: "game-only-fallback",
                    isReview: false,
                    isMaintenanceCheck: false,
                    countsTowardReviewCap: false,
                    affectsSrs: false,
                };
            } else {
                const exactPlan = selection
                    ? createExploreProblemPlanForSkill(
                        state,
                        gate,
                        selection.skillId,
                        profile,
                        {
                            isReview: selection.isReview,
                            isMaintenanceCheck: selection.isMaintenanceCheck,
                        },
                    )
                    : null;
                if (!selection || !exactPlan) {
                    throw new Error(`Segment ${projection.segmentId} has no compatible slot ${step}`);
                }
                plan = exactPlan;
                policy = {
                    source: toExploreLearningSource(selection.source),
                    isReview: selection.isReview,
                    isMaintenanceCheck: selection.isMaintenanceCheck,
                    countsTowardReviewCap: selection.countsTowardReviewCap,
                    affectsSrs: true,
                };
            }
            const assignment = createSegmentAssignment(
                state,
                gate,
                plan,
                policy,
                plannedAt,
            );
            return {
                step,
                slotIndex: step - projection.startStep,
                sequenceOrdinal: step,
                gateId: gate.gateId,
                nodeId: gate.nodeId,
                actionType: gate.actionType,
                attemptCount: gate.attemptCount,
                bridgePlan: gate.bridgePlan,
                problem: plan.problem,
                encounterId: plan.encounterId,
                assignment,
            };
        },
    );
    const segment: ExploreLearningSegment = {
        schemaVersion: 1,
        segmentId: projection.segmentId,
        segmentKey: projection.segmentKey,
        startStep: projection.startStep,
        endStepExclusive: projection.endStepExclusive,
        plannedFromStep: projection.plannedFromStep,
        plannerVersion: EXPLORE_LEARNING_PLANNER_VERSION,
        generatorVersion: EXPLORE_PROBLEM_GENERATOR_VERSION,
        seed: segmentSeed,
        profileSnapshot: {
            mathMainLevel: profile.mathMainLevel,
            mathMaxUnlocked: profile.mathMaxUnlocked,
        },
        plannedAt,
        slots,
    };
    assertPlannerActive(options.signal);
    const persisted = await reserveExploreLearningSegment({
        runId: state.runId,
        profileId: state.profileId,
        expectedCheckpointRevision: options.expectedCheckpointRevision,
        expectedStartStep: projection.plannedFromStep,
        expectedStartGateId: projection.slots[0]!.gate.gateId,
        segment,
    });
    assertPlannerActive(options.signal);
    const current = persisted.slots.find((slot) => slot.step === state.steps);
    if (!current) throw new Error(`Segment ${persisted.segmentId} has no current slot`);
    return {
        problem: current.problem,
        encounterId: current.encounterId,
        assignment: current.assignment,
        learningSegment: persisted,
    };
};

const createAndReserveRetryPlan = async (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    snapshot: ExploreLearningPlannerSnapshot,
    options: CreateAndReserveExploreProblemPlanOptions,
): Promise<ReservedExploreProblemPlan> => {
    const {
        profile,
        due,
        weak,
        maintenance,
        retired,
        skippedToday,
        recentAttempts,
    } = snapshot;
    const assignments = sortAssignments(snapshot.run, state.steps);
    const planWindow = assignments.slice(-EXPLORE_PLAN_WINDOW);
    const recentAssignmentIds = assignments
        .slice(-EXPLORE_COOLDOWN_WINDOW)
        .map((assignment) => assignment.categoryId);
    const recentLogIds = recentAttempts
        .filter((attempt) => attempt.subject === "math")
        .map((attempt) => attempt.itemId)
        .slice(0, EXPLORE_COOLDOWN_WINDOW);
    const availableSkills = new Set(getAvailableSkills(profile.mathMaxUnlocked));
    const compatiblePlans = new Map<string, ExploreProblemPlan | null>();
    const getCompatiblePlan = (skillId: string) => {
        if (!compatiblePlans.has(skillId)) {
            compatiblePlans.set(
                skillId,
                createExploreProblemPlanForSkill(state, gate, skillId, profile),
            );
        }
        return compatiblePlans.get(skillId) ?? null;
    };

    const [selection] = planMathProblems({
        profile,
        count: 1,
        dueSkillIds: [...new Set(due.map((item) => item.id))],
        weakSkillIds: weak.filter((skillId) => availableSkills.has(skillId)),
        maintenanceSkillIds: maintenance,
        retiredSkillIds: retired,
        retrySkillIds: getRetrySkillIds(gate),
        retryLimit: 1,
        cooldownIds: [...new Set([...recentLogIds, ...recentAssignmentIds])],
        recentIds: recentAssignmentIds,
        skippedTodayIds: skippedToday,
        blockCounts: countAssignments(planWindow),
        canAddReview: (planned) => canAddExploreReviewAssignment([
            ...assignments,
            ...planned,
        ], profile.dailyGoal ?? 20),
        currentWeakCount: planWindow.filter((item) => item.source === "weak").length,
        weakLimit: EXPLORE_WEAK_LIMIT,
        plusOneCount: planWindow.filter((item) => item.source === "plus-one").length,
        plusOneLimit: EXPLORE_PLUS_ONE_LIMIT,
        sameSkillLimit: 2,
        recentWindow: EXPLORE_COOLDOWN_WINDOW,
        maintenanceRate: 0.01,
        weakRate: 0.3,
        plusOneRate: 0.3,
        isSkillEligible: (skillId) => getCompatiblePlan(skillId) !== null,
        random: createSeededRandom(JSON.stringify([
            "explore-learning-plan-v1",
            state.seed,
            gate.gateId,
            gate.attemptCount,
        ])),
    });

    if (selection) {
        const exactPlan = createExploreProblemPlanForSkill(
            state,
            gate,
            selection.skillId,
            profile,
            {
                isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
            },
        );
        if (exactPlan) {
            return reservePlan(state, gate, exactPlan, {
                source: toExploreLearningSource(selection.source),
                isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
                countsTowardReviewCap: selection.countsTowardReviewCap,
                affectsSrs: true,
            }, options);
        }
    }

    // Unsupported answer/input types remain playable but must not influence SRS.
    return reservePlan(state, gate, createExploreProblemPlan(state, gate, profile), {
        source: "game-only-fallback",
        isReview: false,
        isMaintenanceCheck: false,
        countsTowardReviewCap: false,
        affectsSrs: false,
    }, options);
};

/**
 * Selects with the shared Study planner, reserves the immutable learning
 * assignment, and only then returns a problem that the Explore UI may display.
 */
export const createAndReserveExploreProblemPlan = async (
    state: ExploreRunState,
    gate: ExploreProblemGate,
    profileSnapshot: UserProfile | undefined,
    options: CreateAndReserveExploreProblemPlanOptions,
): Promise<ReservedExploreProblemPlan> => {
    if (!state.profileId) throw new Error("Explore run is not bound to a profile");

    await waitForExploreProblemPlanE2E(options.signal);
    assertPlannerActive(options.signal);

    const run = await db.exploreRuns.get(state.runId);
    if (!run || run.profileId !== state.profileId || run.status !== "active") {
        throw new Error(`Active exploration run ${state.runId} was not found`);
    }
    if (run.activeCheckpoint?.revision !== options.expectedCheckpointRevision) {
        throw new Error(
            `Explore planner expected checkpoint ${options.expectedCheckpointRevision}`,
        );
    }

    const storedSegmentPlan = gate.attemptCount === 0
        ? restoreSegmentPlan(run, state, gate)
        : undefined;
    if (storedSegmentPlan) return storedSegmentPlan;

    const segmentKey = getExploreLearningSegmentKey(state.steps);
    const visibleAssignment = gate.problem
        ? run.learningAssignments?.[gate.problem.id]
        : undefined;
    if (
        gate.problem
        && (
            !gate.learningAssignment
            || !visibleAssignment
            || !assignmentsMatch(gate.learningAssignment, visibleAssignment)
        )
    ) {
        throw new Error(`Visible exploration problem ${gate.problem.id} is inconsistent`);
    }
    const shouldAdoptLegacyCurrent = Boolean(
        segmentKey
        && !run.learningSegments?.[segmentKey]
        && gate.problem
        && visibleAssignment,
    );
    const problemId = `${gate.gateId}:attempt-${gate.attemptCount}`;
    const existingAssignment = run.learningAssignments?.[problemId];
    if (existingAssignment && gate.attemptCount > 0 && !shouldAdoptLegacyCurrent) {
        const profile = await getProfile(state.profileId) ?? profileSnapshot;
        if (!profile || profile.id !== state.profileId) {
            throw new Error(`Profile ${state.profileId} was not found`);
        }
        return restoreReservedPlan(state, gate, profile, existingAssignment);
    }

    // This lane compares presentation throughput only. It deliberately does
    // not claim planner authenticity: the same fixed category appears ten
    // times, so every reservation is game-only and excluded from SRS. Base
    // attempts still use the same atomic segment boundary as production;
    // representation retries remain attached to their current slot.
    const benchmark = getExploreBenchmarkE2EOptions();
    const benchmarkPlan = benchmark.fixtureId === COLD_OPEN_FIXED_TEN_ID
        && benchmark.startIndex !== undefined
        && gate.attemptCount > 0
        && !shouldAdoptLegacyCurrent
        ? createFixedTenExploreBenchmarkPlan(state, gate, benchmark.startIndex)
        : undefined;
    if (benchmarkPlan) {
        return reservePlan(state, gate, benchmarkPlan, {
            source: "game-only-fallback",
            isReview: false,
            isMaintenanceCheck: false,
            countsTowardReviewCap: false,
            affectsSrs: false,
        }, options);
    }

    await prepareExploreLearningPlannerSnapshot(state.profileId, options.signal);
    return db.transaction(
        "rw",
        getExploreLearningPlannerTransactionTables(),
        async () => {
            const snapshot = await readExploreLearningPlannerSnapshot(
                state.profileId!,
                state.runId,
                profileSnapshot,
                options.signal,
            );
            if (snapshot.run.activeCheckpoint?.revision !== options.expectedCheckpointRevision) {
                throw new Error(
                    `Explore planner snapshot moved past checkpoint ${options.expectedCheckpointRevision}`,
                );
            }
            if (shouldAdoptLegacyCurrent) {
                const concurrentlyStored = restoreSegmentPlan(snapshot.run, state, gate);
                if (concurrentlyStored) return concurrentlyStored;
            }
            if (gate.attemptCount === 0 || shouldAdoptLegacyCurrent) {
                const projection = projectExploreLearningSegmentGates(state);
                if (!projection || projection.slots[0]?.gate.gateId !== gate.gateId) {
                    throw new Error(`Explore gate ${gate.gateId} cannot start a learning segment`);
                }
                const snapshotVisibleAssignment = gate.problem
                    ? snapshot.run.learningAssignments?.[gate.problem.id]
                    : undefined;
                let fixedCurrent: ReservedExploreProblemPlan | undefined;
                if (gate.problem) {
                    if (
                        !gate.learningAssignment
                        || !snapshotVisibleAssignment
                        || !assignmentsMatch(
                            gate.learningAssignment,
                            snapshotVisibleAssignment,
                        )
                    ) {
                        throw new Error(
                            `Visible exploration problem ${gate.problem.id} moved during planning`,
                        );
                    }
                    fixedCurrent = {
                        problem: gate.problem,
                        encounterId: gate.encounterId,
                        assignment: snapshotVisibleAssignment,
                    };
                }
                return createAndReserveSegmentPlan(
                    state,
                    projection,
                    snapshot,
                    options,
                    fixedCurrent,
                );
            }

            return createAndReserveRetryPlan(state, gate, snapshot, options);
        },
    );
};
